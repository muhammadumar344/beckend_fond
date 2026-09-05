// src/controllers/teacherController.js
const Class = require("../models/Class");
const Student = require("../models/Student");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const Teacher = require("../models/Teacher");
const {
  getGroupStudents,
  countGroupStudents,
  countUniqueStudents,
  buildGroupStudentMap,
} = require("../utils/enrollment");
const { collectTargets, markNotified } = require("../utils/notifyTargets");
const Staff = require("../models/Staff");
const Branch = require("../models/Branch");
// Tarif katalogidagi "ochiq lidlar" hisobi uchun
const Lead = require("../models/Lead");
const PaymentClaim = require("../models/PaymentClaim");
const cloudinary = require("../services/cloudinary");
const platform = require("../config/platform");
const studentImport = require("../services/studentImport");
const centerHealth = require("../services/centerHealth");
const { purgeStudent } = require("../utils/studentPurge");
const billing = require("../services/billing");
const cloudinaryCfg = require("../config/cloudinary");
const XLSX = require("xlsx");
const {
  Document,
  Packer,
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  AlignmentType,
} = require("docx");
const {
  limitsFor,
  priceFor,
  featuresFor,
  activePlanOf,
  hasFeature,
  canOpenNewClass,
  canAddStudent,
  effectivePlan,
} = require("../utils/planHelper");
const smsService = require("../services/smsService");
const { sendPaymentConfirmation } = require("../services/telegramService");
const {
  resolveContext,
  requirePermission,
  requireAnyPermission,
} = require("../utils/resolveContext");
const { audit, diff } = require("../services/audit");

// Jurnalda to'lov "Karim Aliyev — 9/2026" bo'lib ko'rinsin.
// Bunsiz direktor har bir qatorni ochib ko'rishga majbur
// bo'lardi va jurnaldan amalda foydalanmasdi.
//
// ⚠️ `student` populate qilingan bo'lsa ismini oladi, aks holda
//    bo'sh qoldiradi — jurnal uchun qo'shimcha so'rov qilmaymiz.
const paymentLabel = (p) => {
  const who = p?.student?.name || "";
  const when = p?.month && p?.year ? `${p.month}/${p.year}` : "";
  return [who, when].filter(Boolean).join(" — ");
};

const PAY_METHODS = ["cash", "card", "transfer"];

// Pulni kim qabul qilgani va qanday kelgani — kunlik kassa
// (`services/cashShift.js`) aynan shu ikki maydonga tayanadi.
//
// ⚠️ "To'lanmadi" ga qaytarilganda `receivedBy` TOZALANADI.
//    Maydon "pul hozir kimda" degan ma'noni bildiradi, "kim bir
//    marta tugmani bosgan" degani emas. Eski qiymat qolsa,
//    bekor qilingan to'lov odamning smenasiga osilib turardi.
//    Allaqachon yopilgan smena esa o'z nusxasini saqlaydi —
//    unga bu ta'sir qilmaydi.
function applyReceiver(ctx, payment, method) {
  if (payment.status !== "paid") {
    payment.receivedBy = undefined;
    return;
  }
  if (PAY_METHODS.includes(method)) payment.paymentMethod = method;
  payment.receivedBy = {
    id: ctx.isDirector ? ctx.directorId : ctx.staffId,
    model: ctx.isDirector ? "Teacher" : "Staff",
    name: ctx.isDirector ? "Direktor" : ctx.staffName || "",
  };
}

// ============================================================
//  ONBOARDING — Fonds va Learning Center uchun ajratilgan validatsiya
// ============================================================
const completeOnboarding = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { institutionType, institutionName, city, studentCountRange } =
      req.body || {};

    // ✅ YANGI — QULF: bir marta tanlangan institutionType'ni ilova ichida
    // boshqa hech qanday yo'l bilan o'zgartirib bo'lmaydi (avval sidebar'dagi
    // "mode-switch" tugmasi shu endpoint'ni qayta chaqirib, Fond<->LC
    // orasida hech narsa so'ramasdan almashtirib yuborardi — shu "chalkashlik"
    // va sahifalar almashib ketishining asosiy sababi shu edi).
    const existingTeacher = await Teacher.findById(teacherId).select(
      "onboardingCompleted institutionType",
    );
    if (!existingTeacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    }
    if (existingTeacher.onboardingCompleted && existingTeacher.institutionType) {
      return res.status(403).json({
        success: false,
        error:
          "Muassasa turi (Fond / O'quv markazi) allaqachon tanlangan va uni ilova ichida o'zgartirib bo'lmaydi. Yordam kerak bo'lsa, qo'llab-quvvatlash xizmatiga murojaat qiling.",
        locked: true,
      });
    }

    if (
      !institutionType ||
      !["school", "learning_center"].includes(institutionType)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "institutionType: 'school' yoki 'learning_center' bo'lishi kerak",
      });
    }

    if (!institutionName || !institutionName.trim()) {
      return res.status(400).json({
        success: false,
        error:
          institutionType === "school"
            ? "Sinf nomini kiriting (masalan: 8-D)"
            : "Muassasa nomi majburiy",
      });
    }

    const updateData = {
      onboardingCompleted: true,
      institutionType,
      institutionName: institutionName.trim(),
    };

    if (institutionType === "learning_center") {
      // ✅ Learning Center — to'liq muassasa ma'lumoti kerak
      if (!city || !city.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Shahar/tuman majburiy" });
      }
      if (
        !studentCountRange ||
        !["1-50", "51-150", "151-300", "300+"].includes(studentCountRange)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "O'quvchilar soni diapazoni noto'g'ri",
          });
      }
      updateData.city = city.trim();
      updateData.studentCountRange = studentCountRange;
    } else {
      // ✅ Fonds (school) — city/studentCountRange kerak EMAS, chunki
      // account bitta SINF uchun, butun maktab uchun emas
      updateData.city = "";
      updateData.studentCountRange = null;
    }

    const teacher = await Teacher.findByIdAndUpdate(teacherId, updateData, {
      new: true,
    });

    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });

    // O'quv markazi tanlansa — default rollar avtomatik yaratiladi
    // ✅ TUZATILDI: try/catch bilan himoyalangan — agar rol yaratishda
    // xato bo'lsa ham, onboarding umuman to'xtab qolmaydi
    if (institutionType === "learning_center") {
      try {
        const { createDefaultRoles } = require("./roleController");
        await createDefaultRoles(teacher._id);
      } catch (roleErr) {
        console.error(
          "createDefaultRoles xatosi (onboarding davom etadi):",
          roleErr.message,
        );
      }
    }

    return res.json({
      success: true,
      message: "Onboarding muvaffaqiyatli yakunlandi",
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: "teacher",
        plan: teacher.plan,
        planActive: teacher.isPlanActive(),
        daysLeft: teacher.daysLeft(),
        onboardingCompleted: true,
        institutionType: teacher.institutionType,
        institutionName: teacher.institutionName,
        city: teacher.city,
        studentCountRange: teacher.studentCountRange,
        referralCode: teacher.referralCode,
      },
    });
  } catch (err) {
    console.error("completeOnboarding error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select("-password");
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    return res.json({ success: true, teacher });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  REJIMNI ALMASHTIRISH — faqat hisob BO'SH bo'lsa
// ============================================================
// ⚠️ Rejim (Fond / O'quv markazi) onboarding'da bir marta
//    tanlanadi va qulflanadi — sabab `completeOnboarding`
//    izohida. Lekin qulf butunlay yopiq bo'lsa, xato tanlagan
//    odam qamalib qolardi: xabar "qo'llab-quvvatlashga murojaat
//    qiling" derdi, ammo hech qanday murojaat yo'li yo'q edi.
//
//    Yechim: hisobda HALI HECH NARSA YO'Q bo'lsa almashtirishga
//    ruxsat. Bunda ko'chiriladigan ma'lumot ham yo'q, ya'ni
//    hech narsa buzilmaydi. Bitta o'quvchi qo'shilishi bilan
//    qulf qaytadan yopiladi.
const getModeStatus = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, error: "Faqat direktor uchun" });
    }

    const teacher = await Teacher.findById(req.user.id).select(
      "institutionType institutionName",
    );
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }

    const blockers = await countModeBlockers(req.user.id);
    const total = Object.values(blockers).reduce((a, b) => a + b, 0);

    return res.json({
      success: true,
      mode: teacher.institutionType,
      canSwitch: total === 0,
      blockers,
    });
  } catch (err) {
    console.error("getModeStatus error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Rejim almashtirishga to'sqinlik qiladigan ma'lumot */
async function countModeBlockers(directorId) {
  const classIds = await Class.find({ teacher: directorId }).distinct("_id");
  const [students, staff, branches] = await Promise.all([
    classIds.length
      ? Student.countDocuments({ class: { $in: classIds } })
      : 0,
    Staff.countDocuments({ director: directorId }),
    Branch.countDocuments({ teacher: directorId }),
  ]);
  return { classes: classIds.length, students, staff, branches };
}

const switchMode = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, error: "Faqat direktor uchun" });
    }

    const { institutionType } = req.body || {};
    if (!["school", "learning_center"].includes(institutionType)) {
      return res.status(400).json({
        success: false,
        error: "institutionType: 'school' yoki 'learning_center' bo'lishi kerak",
      });
    }

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }
    if (teacher.institutionType === institutionType) {
      return res.json({ success: true, mode: institutionType, message: "Rejim o'zgarmadi" });
    }

    const blockers = await countModeBlockers(req.user.id);
    const total = Object.values(blockers).reduce((a, b) => a + b, 0);
    if (total > 0) {
      return res.status(403).json({
        success: false,
        error:
          "Rejimni almashtirish uchun hisob bo'sh bo'lishi kerak. Avval sinf/guruh, o'quvchi va xodimlarni o'chiring.",
        blockers,
      });
    }

    teacher.institutionType = institutionType;
    await teacher.save();

    console.log(
      `[mode] ${teacher.email}: rejim → ${institutionType}`,
    );

    return res.json({
      success: true,
      mode: institutionType,
      message:
        institutionType === "learning_center"
          ? "O'quv markazi rejimiga o'tdingiz"
          : "Maktab fondi rejimiga o'tdingiz",
    });
  } catch (err) {
    console.error("switchMode error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  BRENDLASH (white-label) — muassasa o'z logotipini qo'yadi
// ============================================================
// Logotip qayerda saqlanishi Cloudinary yoqilgan-yoqilmaganiga
// bog'liq — models/Teacher.js dagi `logo` izohiga qarang.
const LOGO_MAX_BYTES = 300 * 1024; // 300KB — sidebar uchun yetarlidan ortiq

// Cloudinary yoqilganda kattaroq faylga ruxsat: bazaga emas, CDN ga
// ketadi va yuklashda 512px gacha kichraytiriladi. Foydalanuvchi
// telefondan olingan logotipni qayta o'lchamasdan tashlay oladi.
const LOGO_MAX_BYTES_CDN = 3 * 1024 * 1024; // 3MB

const updateBranding = async (req, res) => {
  try {
    // Faqat direktorning o'zi — xodim muassasa brendini o'zgartira olmaydi
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ success: false, error: "Faqat direktor uchun" });
    }

    const { logo, brandColor, institutionName } = req.body;
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    }

    // Eski Cloudinary nusxasi — yangisi BAZAGA YOZILGANDAN keyin
    // o'chiriladi. Teskarisi xavfli: o'chirib bo'lib saqlash xato
    // bersa, direktor logotipsiz va tiklab bo'lmaydigan holda qolardi.
    let staleId = "";

    if (logo !== undefined) {
      const oldPublicId = teacher.logoPublicId || "";

      if (logo === null || logo === "") {
        // Logotipni olib tashlash
        teacher.logo = "";
        teacher.logoSize = 0;
        teacher.logoPublicId = "";
        staleId = oldPublicId;
      } else {
        if (typeof logo !== "string" || !logo.startsWith("data:image/")) {
          return res
            .status(400)
            .json({ success: false, error: "Logotip rasm bo'lishi kerak" });
        }

        const useCdn = cloudinary.enabled();
        // base64 uzunligidan taxminiy bayt hajmi (screenshot bilan bir xil)
        const sizeBytes = Math.round((logo.length * 3) / 4);
        if (useCdn && sizeBytes > LOGO_MAX_BYTES_CDN) {
          return res.status(400).json({
            success: false,
            error: "Logotip hajmi 3MB dan oshmasligi kerak",
          });
        }
        if (!useCdn && sizeBytes > LOGO_MAX_BYTES) {
          return res.status(400).json({
            success: false,
            error: "Logotip hajmi 300KB dan oshmasligi kerak",
          });
        }

        if (useCdn) {
          try {
            const up = await cloudinary.uploadImage(logo, {
              folder: cloudinaryCfg.folders.logos,
              // Har bir direktorga bitta doimiy nom — yangisi eskisi
              // ustiga yoziladi, hisobda axlat to'planmaydi.
              publicId: `director-${teacher._id}`,
            });
            teacher.logo = up.url;
            teacher.logoSize = up.bytes;
            teacher.logoPublicId = up.publicId;
          } catch (err) {
            console.error("Logotip yuklash xatosi:", cloudinary.errorText(err));
            return res.status(502).json({
              success: false,
              error: "Logotipni yuklab bo'lmadi, birozdan keyin urinib ko'ring",
            });
          }
        } else {
          // Cloudinary sozlanmagan — eski yo'l, bazaga base64
          teacher.logo = logo;
          teacher.logoSize = sizeBytes;
          teacher.logoPublicId = "";
        }

        // Nom o'zgarmagan bo'lsa yuqoridagi yuklash o'zi ustiga yozgan
        if (oldPublicId && oldPublicId !== teacher.logoPublicId) {
          staleId = oldPublicId;
        }
      }
    }

    if (brandColor !== undefined) {
      const c = String(brandColor || "").trim();
      // Faqat #RGB / #RRGGBB — boshqa qiymat CSS'ga tushib ketmasin
      if (c && !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(c)) {
        return res
          .status(400)
          .json({ success: false, error: "Rang formati noto'g'ri" });
      }
      teacher.brandColor = c;
    }

    if (institutionName !== undefined) {
      const n = String(institutionName || "").trim();
      if (!n) {
        return res
          .status(400)
          .json({ success: false, error: "Muassasa nomi majburiy" });
      }
      teacher.institutionName = n;
    }

    await teacher.save();

    // Saqlangandan keyin — eskisini tozalash. `destroyImage` otmaydi.
    if (staleId) await cloudinary.destroyImage(staleId);

    return res.json({
      success: true,
      message: "Brend saqlandi",
      branding: {
        logo: teacher.logo || "",
        brandColor: teacher.brandColor || "",
        institutionName: teacher.institutionName || "",
      },
      logoMaxBytes: cloudinary.enabled() ? LOGO_MAX_BYTES_CDN : LOGO_MAX_BYTES,
    });
  } catch (err) {
    console.error("updateBranding error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Brendni O'QISH — xodimlar ham chaqiradi (sidebar'da ko'rsatish uchun),
 * shu sabab `resolveContext` orqali direktor topiladi.
 */
const getBranding = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const director = await Teacher.findById(ctx.directorId).select(
      "logo brandColor institutionName institutionType",
    );
    if (!director) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    }
    // ⚠️ KUTAYOTGAN "TO'LADIM" SONI SHU YERDA — alohida so'rov EMAS.
    //    Belgi yon menyuda, ya'ni HAR BIR sahifada kerak. Buning
    //    uchun alohida endpoint qo'ysak, har sahifa ochilishida
    //    ortiqcha so'rov ketardi; ro'yxatning o'zini so'rasak esa
    //    bitta raqam uchun 100 tagacha yozuv tortilardi.
    //    Bu chaqiruv sidebar uchun allaqachon ketyapti va
    //    `countDocuments` indeksdan o'qiydi (director+status).
    //
    //    Xato bo'lsa 0 qaytadi: logotip belgi tufayli
    //    ko'rinmay qolmasin.
    let pendingClaims = 0;
    try {
      pendingClaims = await PaymentClaim.countDocuments({
        director: ctx.directorId,
        status: "pending",
        ...(ctx.branchFilter ? { branch: ctx.branchFilter } : {}),
      });
    } catch (e) {
      console.error("getBranding pendingClaims:", e.message);
    }

    return res.json({
      success: true,
      branding: {
        logo: director.logo || "",
        brandColor: director.brandColor || "",
        institutionName: director.institutionName || "",
        institutionType: director.institutionType || null,
      },
      pendingClaims,
      // Interfeys cheklovni O'ZI o'ylab topmasligi uchun shu yerdan
      // aytiladi: CDN yoqilgan bo'lsa 3MB, bo'lmasa 300KB.
      logoMaxBytes: cloudinary.enabled()
        ? LOGO_MAX_BYTES_CDN
        : LOGO_MAX_BYTES,
    });
  } catch (err) {
    console.error("getBranding error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  CLASSES — School Fund (Director only, plan limitlar bilan)
// ============================================================
const createClass = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");

    const { name, defaultAmount, initialBalance, initialBalanceNote, branch } =
      req.body;
    const teacherId = ctx.directorId;

    if (!name || defaultAmount === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Sinf nomi va oylik to'lov summasi majburiy",
        });
    }
    if (Number(defaultAmount) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" });
    }
    if (initialBalance !== undefined && Number(initialBalance) < 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Boshlang'ich balans manfiy bo'lishi mumkin emas",
        });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });

    // ⚠️ Arxivdagi guruh chegarani band qilmaydi: o'tgan yilni
    //    yopgan direktor yangi guruh ocholmay qolmasin.
    const currentClassCount = await Class.countDocuments({
      teacher: teacherId,
      archivedAt: null,
    });
    if (!canOpenNewClass(teacher, currentClassCount)) {
      const activePlan = teacher.isPlanActive() ? teacher.plan : "free";
      const limit = limitsFor(activePlan, teacher);
      return res.status(403).json({
        success: false,
        error: teacher.isPlanActive()
          ? `${activePlan.toUpperCase()} rejimda maksimal ${limit.classes} ta sinf ochishingiz mumkin`
          : "Obunangiz tugagan. Yangi sinf ochish uchun Pro yoki Premium sotib oling",
        requiresUpgrade: !teacher.isPlanActive(),
      });
    }

    // ✅ Staff filialga bog'langan bo'lsa (ctx.branchFilter), yangi
    // guruh avtomatik o'sha filialga tegishli bo'ladi. Direktor esa
    // istalgan filialni (yoki hech qaysisini) tanlashi mumkin.
    const resolvedBranch = ctx.branchFilter || branch || null;

    const activePlan = teacher.isPlanActive() ? teacher.plan : "free";
    const newClass = new Class({
      name: name.trim(),
      teacher: teacherId,
      defaultAmount: Number(defaultAmount),
      plan: activePlan,
      initialBalance: initialBalance !== undefined ? Number(initialBalance) : 0,
      initialBalanceNote: (initialBalanceNote || "").trim(),
      branch: resolvedBranch,
    });
    await newClass.save();

    return res.status(201).json({
      success: true,
      message: "Sinf muvaffaqiyatli yaratildi",
      class: newClass,
    });
  } catch (err) {
    console.error("createClass error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getMyClasses = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const teacherId = ctx.directorId;
    const query = { teacher: teacherId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    // ⚠️ Arxivdagilar odatda ko'rinmaydi, lekin yo'qolmaydi.
    //    `{ archivedAt: null }` maydoni umuman yo'q eski
    //    sinflarni ham topadi.
    if (req.query.includeArchived !== "1") query.archivedAt = null;
    const classes = await Class.find(query).sort({
      createdAt: -1,
    });

    // ⚠️ ILGARI BU YERDA N+1 BOR EDI: har bir sinf uchun alohida
    //    `countGroupStudents`, `MonthlyPayment.find` va
    //    `Expense.find`. Ikkinchisi va uchinchisi sinfning BUTUN
    //    tarixini xotiraga yuklab, keyin JS'da yig'ardi — ya'ni
    //    uch yillik markazda o'n minglab hujjat. Bu esa Fond
    //    rejimidagi eng ko'p ochiladigan sahifa.
    //
    //    Endi hammasi uchta so'rovda: o'quvchilar
    //    `buildGroupStudentMap` orqali (u aynan shu maqsad uchun
    //    yozilgan), pul esa bazada yig'iladi.
    const classIds = classes.map((c) => c._id);
    const [studentMap, payRows, expRows] = await Promise.all([
      buildGroupStudentMap(classIds),
      MonthlyPayment.aggregate([
        { $match: { class: { $in: classIds } } },
        {
          $group: {
            _id: { class: "$class", status: "$status" },
            sum: { $sum: "$amount" },
            n: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { class: { $in: classIds } } },
        { $group: { _id: "$class", sum: { $sum: "$amount" } } },
      ]),
    ]);

    const paid = new Map();   // classId → { sum, n }
    const total = new Map();  // classId → jami yozuvlar soni
    for (const r of payRows) {
      const id = String(r._id.class);
      total.set(id, (total.get(id) || 0) + r.n);
      if (r._id.status === "paid") paid.set(id, { sum: r.sum, n: r.n });
    }
    const spent = new Map(expRows.map((r) => [String(r._id), r.sum]));

    const classesWithStats = classes.map((cls) => {
      const id = String(cls._id);
      const p = paid.get(id) || { sum: 0, n: 0 };
      const collectedOnSite = p.sum;
      const totalCollected = (cls.initialBalance || 0) + collectedOnSite;
      const totalExpenses = spent.get(id) || 0;

      return {
        ...cls.toObject(),
        studentCount: studentMap.get(id)?.size || 0,
        paidCount: p.n,
        unpaidCount: (total.get(id) || 0) - p.n,
        collectedOnSite,
        totalCollected,
        totalExpenses,
        realBalance: totalCollected - totalExpenses,
      };
    });

    return res.json({ success: true, classes: classesWithStats });
  } catch (err) {
    console.error("getMyClasses error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ✅ Staff + Director — /classes/list dropdown uchun
const getClassesForStaff = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const query = { teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    // ⚠️ Arxivdagi guruh xodim ro'yxatlarida ko'rinmaydi: davomat
    //    va baho tanlagichida o'tgan yilning guruhlari turishi
    //    faqat chalkashtiradi.
    if (req.query.includeArchived !== "1") query.archivedAt = null;

    const classes = await Class.find(query)
      .select("name branch defaultAmount")
      .populate("branch", "name")
      .sort({ name: 1 });

    return res.json({ success: true, classes });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getClassById = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const classId = req.params.classId || req.params.id;
    const query = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const cls = await Class.findOne(query).populate("branch", "name");
    if (!cls)
      return res.status(404).json({ success: false, error: "Guruh topilmadi" });
    res.json({ success: true, class: cls });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const updateClass = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");
    const classId = req.params.classId || req.params.id;
    const query = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const cls = await Class.findOne(query);
    if (!cls)
      return res.status(404).json({ success: false, error: "Guruh topilmadi" });

    const before = { name: cls.name };
    const { name, monthlyFee, defaultAmount, description, archived, branch } =
      req.body;
    if (name !== undefined) cls.name = name;
    if (monthlyFee !== undefined) cls.monthlyFee = monthlyFee;
    if (defaultAmount !== undefined) cls.defaultAmount = defaultAmount;
    if (description !== undefined) cls.description = description;
    // ⚠️ Ilgari bu yerda `cls.isActive = isActive` turgandi va
    //    sxemada bunday maydon YO'Q edi — Mongoose uni jimgina
    //    tashlab yuborardi. Ya'ni "arxivlash" hech qachon
    //    ishlamagan.
    if (archived !== undefined) cls.archivedAt = archived ? new Date() : null;
    if (branch !== undefined && ctx.isDirector) cls.branch = branch;

    // ⚠️ Nom o'zgarishi jurnalga tushadi: hisobotda "7-A" nima
    //    uchun "8-A" bo'lib qolganini keyin tushuntirish kerak
    //    bo'lishi mumkin.
    if (name !== undefined && name !== before.name) {
      audit(req, ctx, {
        action: "class.updated",
        entity: "Class",
        entityId: cls._id,
        entityLabel: cls.name,
        changes: [{ field: "nom", from: before.name, to: cls.name }],
      });
    }

    await cls.save();
    res.json({ success: true, class: cls });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const updateInitialBalance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { initialBalance, initialBalanceNote } = req.body;
    const teacherId = req.user.id;

    if (initialBalance === undefined || Number(initialBalance) < 0) {
      return res.status(400).json({
        success: false,
        error: "Balans 0 yoki undan katta bo'lishi kerak",
      });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    cls.initialBalance = Number(initialBalance);
    cls.initialBalanceNote = (initialBalanceNote || "").trim();
    await cls.save();

    return res.json({
      success: true,
      message: "Boshlang'ich balans yangilandi",
      class: cls,
    });
  } catch (err) {
    console.error("updateInitialBalance error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateClassDefaultAmount = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");
    const { classId } = req.params;
    const { defaultAmount } = req.body;

    if (defaultAmount === undefined || Number(defaultAmount) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" });
    }

    const query = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const cls = await Class.findOne(query);
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    cls.defaultAmount = Number(defaultAmount);
    await cls.save();

    return res.json({
      success: true,
      message: "Default summa yangilandi",
      class: cls,
    });
  } catch (err) {
    console.error("updateClassDefaultAmount error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const deleteClass = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");
    const { classId } = req.params;

    const query = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const cls = await Class.findOne(query);
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    await Student.deleteMany({ class: classId });
    await MonthlyPayment.deleteMany({ class: classId });
    await Expense.deleteMany({ class: classId });
    await Class.findByIdAndDelete(classId);

    return res.json({
      success: true,
      message: "Sinf va barcha bog'liq ma'lumotlar o'chirildi",
    });
  } catch (err) {
    console.error("deleteClass error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  STUDENTS — School Fund (Director only, plan limitlar bilan)
// ============================================================
const addStudent = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");
    const { classId } = req.params;
    const { name, parentPhone } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "O'quvchi ismi majburiy" });
    }

    const classQuery = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;
    const cls = await Class.findOne(classQuery);
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    // ✅ Limit sinfdagi eski `plan` va direktorning HOZIRGI tarifidan
    // kattarog'i bo'yicha hisoblanadi — aks holda tarifni ko'targan
    // foydalanuvchi eski sinflarida eski limitda qolib ketardi.
    const director = await Teacher.findById(ctx.directorId);
    const studentCount = await countGroupStudents(classId);
    if (!canAddStudent(cls.plan, studentCount, director)) {
      const limit =
        limitsFor(effectivePlan(cls.plan, director), director);
      return res.status(403).json({
        success: false,
        error: `Bu sinfga maksimal ${limit.students} ta o'quvchi qo'shish mumkin`,
        requiresUpgrade: true,
      });
    }

    const student = new Student({
      name: name.trim(),
      class: classId,
      parentPhone: (parentPhone || "").trim(),
      rollNumber: studentCount + 1,
    });
    await student.save();

    return res
      .status(201)
      .json({ success: true, message: "O'quvchi qo'shildi", student });
  } catch (err) {
    console.error("addStudent error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getClassStudents = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;

    const query = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const cls = await Class.findOne(query);
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    // ⚠️ ARXIVDAGILAR ALOHIDA SO'RALADI. O'quvchi ketganda uni
    //    o'chirish emas, arxivlash kerak (`isActive: false`) —
    //    o'chirish uning butun to'lov tarixini ham olib ketadi.
    //    Odatiy ro'yxatda arxivdagilar ko'rinmaydi, lekin ular
    //    yo'qolmagan: `?includeInactive=1` ularni ham beradi.
    const includeInactive =
      req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const students = await getGroupStudents(classId, { includeInactive });
    return res.json({ success: true, students });
  } catch (err) {
    console.error("getClassStudents error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const query = { teacher: ctx.directorId };

    if (req.query.classId) {
      query.class = req.query.classId;
    } else if (ctx.branchFilter) {
      const classIds = await Class.find({
        teacher: ctx.directorId,
        branch: ctx.branchFilter,
      }).distinct("_id");
      query.class = { $in: classIds };
    }

    if (req.query.active !== undefined) {
      query.isActive = req.query.active === "true";
    }

    const students = await Student.find(query)
      .populate("class", "name defaultAmount")
      .sort({ name: 1 });

    res.json({ success: true, students });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ⚠️ BU FUNKSIYA YOZILGAN-U ULANMAGAN edi — va ustiga BUZUQ
//    ham edi: `Student.findOne({ _id, teacher })` deb qidirardi,
//    `Student` da esa `teacher` maydoni UMUMAN YO'Q (o'quvchi
//    guruh orqali bog'lanadi). Ya'ni route'ga ulangan taqdirda
//    ham har doim "O'quvchi topilmadi" qaytarardi.
//
//    Natijada tizimda o'quvchi ma'lumotini tahrirlashning
//    umuman iloji yo'q edi: telefon o'zgarsa yoki ismda xato
//    bo'lsa, yagona yo'l — o'chirib qayta yaratish. U esa
//    o'quvchining BUTUN TO'LOV TARIXINI o'chiradi
//    (`deleteStudent` ga qarang). Xato uchun ma'lumot
//    yo'qotiladigan tizim — bu tizim emas.
const updateStudent = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const student = await Student.findById(
      req.params.studentId || req.params.id,
    );
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });

    // Egalik guruh orqali tekshiriladi — `deleteStudent` bilan
    // bir xil qolip. Xodimda filial cheklovi ham bor.
    const ownQuery = { _id: student.class, teacher: ctx.directorId };
    if (ctx.branchFilter) ownQuery.branch = ctx.branchFilter;
    const cls = await Class.findOne(ownQuery);
    if (!cls)
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });

    const { name, parentPhone, classId, rollNumber, isActive } = req.body;

    // O'zgarishlar jurnal uchun yig'iladi: "kim telefonni
    // almashtirdi?" degan savolga javob bo'lsin.
    const changes = [];
    const track = (field, from, to) => {
      if (to !== undefined && String(from ?? "") !== String(to ?? "")) {
        changes.push({ field, from: from ?? null, to: to ?? null });
      }
    };

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ success: false, error: "Ism bo'sh bo'lmasin" });
      }
      track("name", student.name, trimmed);
      student.name = trimmed;
    }
    if (parentPhone !== undefined) {
      const phone = String(parentPhone).trim();
      track("parentPhone", student.parentPhone, phone);
      student.parentPhone = phone;
    }
    if (rollNumber !== undefined && rollNumber !== null && rollNumber !== "") {
      track("rollNumber", student.rollNumber, Number(rollNumber));
      student.rollNumber = Number(rollNumber);
    }
    if (isActive !== undefined) {
      track("isActive", student.isActive, Boolean(isActive));
      student.isActive = Boolean(isActive);
    }

    // ── Boshqa guruhga ko'chirish ──
    if (classId && String(classId) !== String(student.class)) {
      const targetQuery = { _id: classId, teacher: ctx.directorId };
      if (ctx.branchFilter) targetQuery.branch = ctx.branchFilter;
      const target = await Class.findOne(targetQuery);
      if (!target)
        return res
          .status(404)
          .json({ success: false, error: "Yangi guruh topilmadi" });

      // ⚠️ Ko'chirish ham tarif chegarasidan o'tadi. Aks holda
      //    to'lgan guruhga "qo'shish" mumkin bo'lmasa ham,
      //    "ko'chirish" bilan chetlab o'tish mumkin bo'lardi.
      const director = await Teacher.findById(ctx.directorId);
      const count = await countGroupStudents(target._id);
      if (!canAddStudent(target.plan, count, director)) {
        const limit = limitsFor(effectivePlan(target.plan, director), director);
        return res.status(403).json({
          success: false,
          error: "Tarif chegarasi: bu guruhga ko'proq o'quvchi sig'maydi",
          requiresUpgrade: true,
          limit: { max: limit.students, current: count },
        });
      }

      changes.push({ field: "guruh", from: cls.name, to: target.name });
      student.class = target._id;
    }

    if (!changes.length) {
      return res.json({ success: true, student, message: "O'zgarish yo'q" });
    }

    await student.save();

    audit(req, ctx, {
      action: "student.updated",
      entity: "Student",
      entityId: student._id,
      entityLabel: `${student.name} — ${cls.name}`,
      changes,
    });

    res.json({ success: true, student, message: "Saqlandi" });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ══ EXCEL'DAN IMPORT ═══════════════════════════════════════
//
// ⚠️ AVVAL KO'RSATADI, KEYIN YOZADI. `apply: false` (standart)
//    faqat tahlil qaytaradi: nechta qo'shiladi, qaysilari takror,
//    qaysi qatorda xato. Yozish uchun ikkinchi so'rov kerak.
//    Begona faylni ko'r-ko'rona bazaga to'kmaymiz
//    (`/lc/rooms/import` bilan bir xil qoida).
//
// ⚠️ YARIM IMPORT YO'Q. Tarif chegarasidan oshsa hech narsa
//    yozilmaydi: yarmi tushgan ro'yxatda direktor qaysi bola
//    qolganini bilmaydi va butun faylni qo'lda solishtirib
//    chiqishga majbur bo'ladi.
const importStudents = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { classId } = req.params;
    const { file, apply = false } = req.body;

    // ⚠️ TARIF TEKSHIRUVI. `import` bayrog'i `planHelper` da
    //    bor edi, lekin hech qayerda tekshirilmasdi — `export`
    //    besh joyda tekshiriladi, juftligi esa umuman ochiq
    //    turardi. (`canAddStaff` / `canOpenBranch` bilan bir xil
    //    naqsh: yozilgan-u ulanmagan.)
    const director = await Teacher.findById(ctx.directorId);
    if (!hasFeature(director, "import")) {
      return res.status(403).json({
        success: false,
        error: "Import faqat yuqori tarifda",
        requiresUpgrade: true,
      });
    }

    const classQuery = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;
    const cls = await Class.findOne(classQuery);
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });

    let table;
    try {
      table = studentImport.readFile(file);
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, error: "Faylni o'qib bo'lmadi" });
    }

    // Takrorni topish uchun guruhdagi hozirgi ro'yxat
    const existing = await getGroupStudents(classId);
    const parsed = studentImport.parseTable(
      table,
      existing.map((s) => ({ name: s.name, parentPhone: s.parentPhone })),
    );

    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        error: parsed.error,
        // Fayldagi sarlavhalar — odam nimani tuzatishni bilsin
        headers: parsed.headers,
      });
    }

    // ── Tarif chegarasi ──
    // (`director` yuqorida, `import` tekshiruvida olingan)
    const current = existing.length;
    const limit = limitsFor(effectivePlan(cls.plan, director), director);
    const fits = Math.max(0, (limit.students || 0) - current);

    const willAdd = parsed.rows.length;
    const overLimit = willAdd > fits;

    const summary = {
      willAdd,
      duplicates: parsed.duplicates.length,
      invalid: parsed.invalid.length,
      truncated: parsed.truncated || 0,
      current,
      max: limit.students,
      fits,
      overLimit,
      hasPhoneColumn: parsed.hasPhoneColumn,
    };

    // ── Ko'rib chiqish ──
    if (!apply) {
      return res.json({
        success: true,
        preview: true,
        summary,
        rows: parsed.rows.slice(0, 100),
        duplicates: parsed.duplicates.slice(0, 50),
        invalid: parsed.invalid.slice(0, 50),
      });
    }

    if (overLimit) {
      return res.status(403).json({
        success: false,
        error: "Tarif chegarasi: bu guruhga ko'proq o'quvchi sig'maydi",
        requiresUpgrade: true,
        limit: { max: limit.students, current, fits },
      });
    }

    if (!willAdd) {
      return res.json({ success: true, added: 0, summary, message: "O'zgarish yo'q" });
    }

    // ⚠️ `rollNumber` ketma-ket davom etadi — ro'yxat aralashib
    //    ketmasin. Bazadagi eng kattasidan boshlanadi, sanoqdan
    //    emas: o'chirilgan o'quvchidan keyin raqam takrorlanardi.
    const maxRoll = existing.reduce((m, s) => Math.max(m, s.rollNumber || 0), 0);
    const docs = parsed.rows.map((r, i) => ({
      name: r.name,
      class: classId,
      parentPhone: r.phone,
      rollNumber: maxRoll + i + 1,
    }));
    await Student.insertMany(docs);

    audit(req, ctx, {
      action: "student.imported",
      entity: "Class",
      entityId: cls._id,
      entityLabel: cls.name,
      changes: [
        { field: "qo'shildi", from: current, to: current + docs.length },
        { field: "takror (o'tkazildi)", from: null, to: parsed.duplicates.length },
      ],
    });

    return res.json({
      success: true,
      added: docs.length,
      summary,
      message: "Import tugadi",
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });

    const classQuery = { _id: student.class, teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;
    const cls = await Class.findOne(classQuery);
    if (!cls)
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });

    // ⚠️ Bu amal QAYTARILMAYDI va o'quvchining butun to'lov
    //    tarixini ham o'chiradi. Nechta to'lov yo'q qilingani
    //    jurnalga yozilsin — keyinchalik "bu odam umuman
    //    to'lamagan" degan bahs chiqsa, javob shu yerda bo'ladi.
    const wiped = await MonthlyPayment.countDocuments({ student: studentId });

    // ⚠️ FAQAT TO'LOVLAR EMAS. Ilgari shu yerda faqat
    //    `MonthlyPayment` o'chirilardi va davomat, baholar,
    //    uy vazifasi natijalari, qo'shimcha guruhlarga
    //    yozilishi, Telegram bog'lanishi bazada EGASIZ qolib
    //    ketardi — davomat foizi esa o'sha yozuvlarni sanashda
    //    davom etardi.
    const removed = await purgeStudent(studentId);
    await Student.findByIdAndDelete(studentId);

    audit(req, ctx, {
      action: "student.deleted",
      entity: "Student",
      entityId: student._id,
      entityLabel: `${student.name} — ${cls.name}`,
      changes: [
        { field: "name", from: student.name, to: null },
        { field: "parentPhone", from: student.parentPhone || null, to: null },
        { field: "o'chirilgan to'lovlar", from: wiped, to: 0 },
        // Qaysi to'plamdan nechta yozuv ketgani ham jurnalda
        // qolsin: keyin "davomat qayerga ketdi?" degan savol
        // chiqsa, javob shu yerda.
        { field: "o'chirilgan yozuvlar", from: JSON.stringify(removed), to: null },
      ],
    });

    return res.json({ success: true, message: "O'quvchi o'chirildi" });
  } catch (err) {
    console.error("deleteStudent error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  PAYMENTS — School Fund
// ============================================================
const createMonthlyPayments = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { classId, month, year } = req.body;
    const teacherId = ctx.directorId;

    if (!classId || !month || !year) {
      return res
        .status(400)
        .json({ success: false, error: "classId, month, year majburiy" });
    }
    if (month < 1 || month > 12 || year < 2020) {
      return res
        .status(400)
        .json({ success: false, error: "Oy va yil noto'g'ri" });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls)
      return res
        .status(404)
        .json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res
        .status(403)
        .json({ success: false, error: "Bu sinf sizning filialingizga tegishli emas" });
    }

    // ⚠️ Mantiq `services/billing.js` da: "hammasiga yaratish"
    //    tugmasi ham aynan shuni chaqiradi va qoida ikki joyda
    //    bo'lib qolmasin.
    const summary = await billing.ensureBillsForClass({
      cls,
      teacherId,
      month: Number(month),
      year: Number(year),
    });

    if (!summary.total) {
      return res
        .status(400)
        .json({ success: false, error: "Bu sinfda o'quvchi yo'q" });
    }

    return res.json({
      success: true,
      message: `${summary.created} ta to'lov yaratildi`,
      summary,
    });
  } catch (err) {
    console.error("createMonthlyPayments error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ══ HAMMA GURUHGA VARAQA — bir bosishda ════════════════════
//
// ⚠️ NEGA KERAK: varaqani har guruh uchun alohida yaratish
//    kerak edi va o'n beshta guruhi bor markazda bittasini
//    unutish — vaqt masalasi. Unutilgan guruhdan esa o'sha oy
//    pul umuman so'ralmaydi va buni hech narsa aytmaydi.
//    `GET /teacher/health` muammoni KO'RSATADI, bu esa uni
//    umuman bo'lmaydigan qiladi.
//
// ⚠️ Ikki marta bosish xavfsiz: mavjud varaqalar qayta
//    yaratilmaydi.
const createMonthlyPaymentsAll = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const month = Number(req.body.month);
    const year = Number(req.body.year);
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      return res
        .status(400)
        .json({ success: false, error: "Oy va yil noto'g'ri" });
    }

    const query = { teacher: ctx.directorId, archivedAt: null };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const classes = await Class.find(query).select("name defaultAmount branch");

    const result = await billing.ensureBillsForClasses({
      classes,
      teacherId: ctx.directorId,
      month,
      year,
    });

    return res.json({
      success: true,
      message: `${result.created} ta to'lov yaratildi`,
      ...result,
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

const getMonthlyPayments = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { month, year } = req.query;

    // Filialga biriktirilgan xodim faqat o'z filiali sinflarini ko'radi
    const classQuery = { teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;

    const classes = await Class.find(classQuery);
    const classIds = classes.map((c) => c._id);

    const query = { class: { $in: classIds } };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const payments = await MonthlyPayment.find(query)
      .populate("student", "name parentPhone rollNumber")
      .populate("class", "name defaultAmount")
      .sort({ class: 1, createdAt: -1 });

    const classStats = {};
    for (const cls of classes) {
      const studentCount = await countGroupStudents(cls._id);
      classStats[cls._id.toString()] = {
        className: cls.name,
        defaultAmount: cls.defaultAmount,
        studentCount,
        expectedTotal: studentCount * cls.defaultAmount,
        initialBalance: cls.initialBalance || 0,
        initialBalanceNote: cls.initialBalanceNote || "",
      };
    }

    const paidPayments = payments.filter((p) => p.status === "paid");
    const collectedTotal = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const expectedTotal = Object.values(classStats).reduce(
      (sum, c) => sum + c.expectedTotal,
      0,
    );
    const totalInitialBalance = classes.reduce(
      (sum, c) => sum + (c.initialBalance || 0),
      0,
    );

    return res.json({
      success: true,
      payments,
      classStats,
      summary: {
        paidCount: paidPayments.length,
        unpaidCount: payments.length - paidPayments.length,
        collectedTotal,
        expectedTotal,
        remaining: expectedTotal - collectedTotal,
        totalInitialBalance,
        grandTotal: totalInitialBalance + collectedTotal,
      },
    });
  } catch (err) {
    console.error("getMonthlyPayments error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const getClassPayments = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { classId } = req.params;
    const { month, year } = req.query;

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const students = await Student.find({ class: classId });
    const query = { class: classId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const payments = await MonthlyPayment.find(query).populate(
      "student",
      "name parentPhone rollNumber",
    );

    payments.sort(
      (a, b) => (a.student?.rollNumber || 0) - (b.student?.rollNumber || 0),
    );

    const paidPayments = payments.filter((p) => p.status === "paid");
    const collectedOnSite = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const expectedTotal = students.length * cls.defaultAmount;

    const allExpenses = await Expense.find({ class: classId });
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCollected = (cls.initialBalance || 0) + collectedOnSite;
    const realBalance = totalCollected - totalExpenses;

    return res.json({
      success: true,
      class: {
        id: cls._id,
        name: cls.name,
        defaultAmount: cls.defaultAmount,
        studentCount: students.length,
        initialBalance: cls.initialBalance || 0,
        initialBalanceNote: cls.initialBalanceNote || "",
      },
      payments,
      summary: {
        studentCount: students.length,
        paidCount: paidPayments.length,
        unpaidCount: students.length - paidPayments.length,
        expectedTotal,
        collectedOnSite,
        totalCollected,
        remaining: expectedTotal - collectedOnSite,
        totalExpenses,
        realBalance,
      },
    });
  } catch (err) {
    console.error("getClassPayments error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { paymentId } = req.params;
    const { status } = req.body;

    if (!["paid", "not_paid"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status 'paid' yoki 'not_paid' bo'lishi kerak",
      });
    }

    const payment = await MonthlyPayment.findById(paymentId)
      .populate("class")
      .populate("student");
    if (!payment)
      return res
        .status(404)
        .json({ success: false, error: "To'lov topilmadi" });
    if (String(payment.class.teacher) !== String(ctx.directorId))
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    if (
      ctx.branchFilter &&
      payment.class.branch &&
      String(payment.class.branch) !== ctx.branchFilter
    ) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    // ⚠️ Eski holat oldindan olinadi: jurnalda "nimadan nimaga"
    //    o'zgargani ko'rinmasa, yozuv deyarli foydasiz bo'ladi.
    const before = {
      status: payment.status,
      paidDate: payment.paidDate,
      paymentMethod: payment.paymentMethod,
    };

    payment.status = status;
    payment.paidDate = status === "paid" ? new Date() : null;
    applyReceiver(ctx, payment, req.body.paymentMethod);
    await payment.save();

    audit(req, ctx, {
      action: status === "paid" ? "payment.marked_paid" : "payment.marked_unpaid",
      entity: "MonthlyPayment",
      entityId: payment._id,
      entityLabel: paymentLabel(payment),
      changes: diff(before, payment, ["status", "paidDate", "paymentMethod"]),
    });

    if (status === "paid") {
      try {
        // ⚠️ Ro'yxat IKKALA manbadan (`utils/notifyTargets.js`).
        //    Bu yer faqat eski `TelegramParent` ni o'qirdi, ya'ni
        //    Mini App orqali bog'langan ota-ona pulini to'lab,
        //    HECH QANDAY tasdiq olmasdi — u esa qayta so'rar va
        //    "to'ladimmi, yo'qmi" degan savol markazga qaytardi.
        const targets = await collectTargets({
          studentIds: [String(payment.student._id)],
        });

        if (targets.length) {
          const remainingPayments = await MonthlyPayment.find({
            student: payment.student._id,
            status: "not_paid",
          }).sort({ year: 1, month: 1 });

          const remaining = remainingPayments.map((p) => ({
            month: p.month,
            year: p.year,
            amount: p.amount,
          }));

          // Otasi ham, onasi ham ulangan bo'lsa — ikkalasiga ham
          for (const t of targets) {
            await sendPaymentConfirmation(
              t.chatId,
              payment.student.name,
              payment.class.name,
              [{ month: payment.month, year: payment.year }],
              remaining,
            );
            await markNotified(t);
          }
        }
      } catch (tgErr) {
        console.error(
          "Telegram payment notification xatosi:",
          tgErr.message || tgErr,
        );
      }
    }

    return res.json({ success: true, message: "Status yangilandi", payment });
  } catch (err) {
    console.error("updatePaymentStatus error:", err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

const markPayment = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const payment = await MonthlyPayment.findOne({
      _id: req.params.paymentId || req.params.id,
      teacher: ctx.directorId,
    }).populate("class", "branch");
    if (!payment)
      return res
        .status(404)
        .json({ success: false, error: "To'lov topilmadi" });

    // ⚠️ FILIAL CHEKLOVI. `updatePaymentStatus` da bu bor edi,
    //    bu yerda esa YO'Q edi — ya'ni bitta filialga biriktirilgan
    //    administrator boshqa filialning to'lov summasini
    //    o'zgartira olardi. Bu funksiya route'ga ulanmagani uchun
    //    teshik ochilmagan; ulashdan oldin yopildi.
    if (
      ctx.branchFilter &&
      payment.class?.branch &&
      String(payment.class.branch) !== ctx.branchFilter
    ) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const { isPaid, status, amount, paidDate, note, paymentMethod } = req.body;

    // ⚠️ SUMMA TEKSHIRILADI. Ilgari `payment.amount = amount` deb
    //    to'g'ridan-to'g'ri yozilardi: manfiy son ham, matn ham
    //    bazaga tushardi va hisobotlar jimgina buzilardi.
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({
          success: false,
          error: "Summa 0 dan kichik bo'lmasligi kerak",
        });
      }
    }

    // ⚠️ Bu funksiya SUMMANI ham o'zgartira oladi. Aynan shu
    //    sabab jurnal eng avval shu yerga kerak edi: 300 000 ni
    //    250 000 ga tushirib qo'yish hech qanday iz qoldirmasdi.
    const before = {
      status: payment.status,
      paidDate: payment.paidDate,
      amount: payment.amount,
      note: payment.note,
      paymentMethod: payment.paymentMethod,
    };

    if (isPaid !== undefined) {
      payment.status = isPaid ? "paid" : "not_paid";
      payment.paidDate = isPaid
        ? paidDate
          ? new Date(paidDate)
          : new Date()
        : null;
    } else if (status !== undefined) {
      // Noma'lum status sxemani buzadi — enum bo'yicha cheklaymiz
      if (!["paid", "not_paid"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Status 'paid' yoki 'not_paid' bo'lishi kerak",
        });
      }
      payment.status = status;
      payment.paidDate = status === "paid" ? new Date() : null;
    }

    if (amount !== undefined) payment.amount = Number(amount);
    if (note !== undefined) payment.note = note;

    applyReceiver(ctx, payment, paymentMethod);

    await payment.save();

    // Summa o'zgarishi alohida amal sifatida belgilanadi —
    // direktor jurnalda avvalo shuni qidiradi.
    const changes = diff(before, payment, [
      "status",
      "paidDate",
      "amount",
      "note",
      "paymentMethod",
    ]);

    // ⚠️ Bu yerda `payment` populate QILINMAGAN va uni populate
    //    qilib bo'lmaydi: javobda `student` id bo'lib qaytadi va
    //    frontend shunga tayangan. Shuning uchun ismni alohida,
    //    faqat jurnal uchun o'qiymiz — indeksli, yengil so'rov.
    let label = "";
    if (changes.length) {
      const st = await Student.findById(payment.student).select("name").lean();
      label = paymentLabel({ student: st, month: payment.month, year: payment.year });
    }

    audit(req, ctx, {
      action: changes.some((c) => c.field === "amount")
        ? "payment.amount_changed"
        : payment.status === "paid"
          ? "payment.marked_paid"
          : "payment.marked_unpaid",
      entity: "MonthlyPayment",
      entityId: payment._id,
      entityLabel: label,
      changes,
    });

    res.json({ success: true, payment });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  EXPENSES — School Fund
// ============================================================
// ⚠️ XARAJATNI XODIM HAM KIRITADI — VA BU TUZATISH.
//    Ilgari uchala endpoint `onlyTeacher` edi, ya'ni faqat
//    direktor. Ayni paytda interfeys direktorga "Xarajat
//    kiritish" (`manageExpenses`) huquqini berish imkonini
//    berardi va u huquq hech qayerda tekshirilmasdi: direktor
//    buxgalteriga huquq beradi, buxgalter esa hech qanday
//    sahifa ko'rmaydi.
//
//    Muhimi boshqa yerda: kassadan pulni ADMINISTRATOR oladi.
//    U xarajatni yoza olmasa, kechqurun smenada kamomad
//    chiqadi va halol odam o'g'ri bo'lib ko'rinadi. Kassa va
//    xarajat bir-birisiz ishlamaydi.
//
// ⚠️ `req.user.id` EMAS, `ctx.directorId`. Xodim uchun
//    `req.user.id` — bu Staff._id; uni `teacher` maydoniga
//    yozsak xarajat egasiz qolardi va hech qaysi hisobotda
//    ko'rinmasdi.
// ── CHEK SURATI ─────────────────────────────────────────────
//
// ⚠️ Telefon surati katta bo'ladi, shuning uchun chegara logotipnikidan
//    kattaroq. Yuklashda 1600px gacha kichrayadi — 512px da chekdagi
//    raqamlarni o'qib bo'lmasdi, ya'ni surat o'z vazifasini
//    bajarmasdi.
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const RECEIPT_MAX_SIDE = 1600;

/**
 * Chek suratini CDN ga yuklaydi.
 * Xato bo'lsa `status` bilan otadi — chaqiruvchi uni foydalanuvchiga
 * tushunarli qilib qaytaradi.
 */
async function uploadReceipt(dataUri, publicId) {
  if (!cloudinary.enabled()) {
    throw Object.assign(
      new Error("Chek surati hozircha yoqilmagan"),
      { status: 503 },
    );
  }
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
    throw Object.assign(new Error("Chek rasm bo'lishi kerak"), { status: 400 });
  }
  // base64 uzunligidan taxminiy bayt hajmi (logotip bilan bir xil hisob)
  if (Math.round((dataUri.length * 3) / 4) > RECEIPT_MAX_BYTES) {
    throw Object.assign(
      new Error("Chek hajmi 5MB dan oshmasligi kerak"),
      { status: 400 },
    );
  }
  try {
    const up = await cloudinary.uploadImage(dataUri, {
      folder: cloudinaryCfg.folders.receipts,
      publicId,
      maxSide: RECEIPT_MAX_SIDE,
    });
    return { url: up.url, publicId: up.publicId };
  } catch (err) {
    console.error("Chek yuklash xatosi:", cloudinary.errorText(err));
    throw Object.assign(
      new Error("Chekni yuklab bo'lmadi — chek suratisiz ham saqlashingiz mumkin"),
      { status: 502 },
    );
  }
}

const addExpense = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageExpenses");

    const { classId, reason, amount, month, year, description, paidFrom, spentDate, receipt } =
      req.body;

    if (!classId || !reason || amount === undefined || !month || !year) {
      return res.status(400).json({
        success: false,
        error: "Barcha majburiy maydonlarni to'ldiring",
      });
    }
    if (Number(amount) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" });
    }

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({
        success: false,
        error: "Bu sinf sizning filialingizga tegishli emas",
      });
    }

    // Noma'lum qiymat kelsa `null` — kassaga tegmaydi.
    // "Xato yozilgani uchun pul jimgina kamayib qolishi"dan
    // ko'ra ko'rsatilmagan bo'lgani yaxshi.
    const source = ["cash", "card", "bank"].includes(paidFrom) ? paidFrom : null;

    // ⚠️ SAQLASHDAN OLDIN yuklanadi. Aks holda xarajat bazaga
    //    tushib, surat yiqilsa — foydalanuvchi xato ko'radi-yu,
    //    yozuv allaqachon yaratilgan bo'lardi va u ikkinchi marta
    //    bosib takror yozuv yasardi.
    let shot = null;
    if (receipt) {
      shot = await uploadReceipt(
        receipt,
        `expense-${ctx.directorId}-${Date.now()}`,
      );
    }

    const expense = new Expense({
      class: classId,
      teacher: ctx.directorId,
      reason: reason.trim(),
      amount: Number(amount),
      month: Number(month),
      year: Number(year),
      description: (description || "").trim(),
      paidFrom: source,
      receipt: shot?.url || "",
      receiptPublicId: shot?.publicId || "",
      spentDate: spentDate ? new Date(spentDate) : new Date(),
      paidBy: {
        id: ctx.isDirector ? ctx.directorId : ctx.staffId,
        model: ctx.isDirector ? "Teacher" : "Staff",
        name: ctx.isDirector ? "Direktor" : ctx.staffName || "",
      },
    });
    await expense.save();

    // ⚠️ Xarajat — pul harakati. Naqd bo'lsa u kassadan chiqadi,
    //    ya'ni kechqurun sanaladigan summani o'zgartiradi.
    //    Jurnalsiz direktor "bu 200 000 qayerga ketdi?" degan
    //    savolga javob topa olmasdi.
    audit(req, ctx, {
      action: "expense.created",
      entity: "Expense",
      entityId: expense._id,
      entityLabel: `${expense.reason} — ${cls.name}`,
      changes: [
        { field: "summa", from: null, to: expense.amount },
        { field: "manba", from: null, to: source || "ko'rsatilmagan" },
      ],
    });

    return res
      .status(201)
      .json({ success: true, message: "Xarajat qo'shildi", expense });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

// ── PUT /api/teacher/expenses/:expenseId/receipt ────────────
//
// ⚠️ ALOHIDA ENDPOINT KERAK. Chek ko'pincha keyinroq topiladi:
//    xarajat kechqurun kiritiladi, chek esa cho'ntakda qoladi.
//    Busiz yagona yo'l — yozuvni o'chirib qaytadan yaratish, ya'ni
//    jurnalda soxta "o'chirildi/yaratildi" juftligi paydo bo'lardi
//    (arxiv qoidasi bilan bir xil sabab).
//
// Body: { receipt: "data:image/..." }  yoki  { receipt: null } — olib tashlash
const setExpenseReceipt = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageExpenses");

    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      teacher: ctx.directorId,
    }).populate("class", "name branch");
    if (!expense) {
      return res
        .status(404)
        .json({ success: false, error: "Xarajat topilmadi yoki ruxsat yo'q" });
    }
    if (
      ctx.branchFilter &&
      expense.class?.branch &&
      String(expense.class.branch) !== ctx.branchFilter
    ) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const { receipt } = req.body || {};
    const staleShot = expense.receiptPublicId || "";

    if (receipt === null || receipt === "") {
      expense.receipt = "";
      expense.receiptPublicId = "";
    } else {
      const shot = await uploadReceipt(
        receipt,
        `expense-${ctx.directorId}-${expense._id}`,
      );
      expense.receipt = shot.url;
      expense.receiptPublicId = shot.publicId;
    }
    await expense.save();

    // ⚠️ Eskisini SAQLANGANDAN keyin o'chiramiz — logotip bilan
    //    bir xil qoida: o'chirib bo'lib saqlash yiqilsa, foydalanuvchi
    //    cheksiz va tiklab bo'lmaydigan holatda qolardi.
    if (staleShot && staleShot !== expense.receiptPublicId) {
      await cloudinary.destroyImage(staleShot);
    }

    // ⚠️ Jurnalga yoziladi: chek — xarajatning isboti, uni jimgina
    //    almashtirib qo'yish mumkin bo'lmasin.
    audit(req, ctx, {
      action: "expense.updated",
      entity: "Expense",
      entityId: expense._id,
      entityLabel: `${expense.reason} — ${expense.class?.name || ""}`,
      changes: [
        { field: "chek", from: staleShot ? "bor" : "yo'q", to: expense.receipt ? "bor" : "yo'q" },
      ],
    });

    return res.json({ success: true, expense });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

const getExpenses = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageExpenses");

    const { month, year } = req.query;

    const query = { teacher: ctx.directorId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    // Filialga biriktirilgan xodim faqat o'z filialining
    // sinflariga tegishli xarajatlarni ko'radi.
    if (ctx.branchFilter) {
      const classIds = await Class.find({
        teacher: ctx.directorId,
        branch: ctx.branchFilter,
      }).distinct("_id");
      query.class = { $in: classIds };
    }

    const expenses = await Expense.find(query)
      .populate("class", "name")
      .sort({ spentDate: -1, createdAt: -1 });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // ⚠️ Interfeys O'ZI o'ylab topmasin: kalit yo'q bo'lsa
    //    "Chek qo'shish" tugmasi umuman chiqmasligi kerak
    //    (`logoMaxBytes` bilan bir xil qoida).
    return res.json({
      success: true,
      expenses,
      total,
      receiptEnabled: cloudinary.enabled(),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageExpenses");

    const { expenseId } = req.params;

    const expense = await Expense.findOne({
      _id: expenseId,
      teacher: ctx.directorId,
    }).populate("class", "name branch");
    if (!expense) {
      return res
        .status(404)
        .json({ success: false, error: "Xarajat topilmadi yoki ruxsat yo'q" });
    }
    if (
      ctx.branchFilter &&
      expense.class?.branch &&
      String(expense.class.branch) !== ctx.branchFilter
    ) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    // ⚠️ O'CHIRISHDAN OLDIN jurnalga yozamiz. Naqd xarajatni
    //    o'chirish kassadagi kutilgan summani KO'TARADI — ya'ni
    //    kechagi kamomadni yashirishning eng oson yo'li aynan
    //    shu. Iz qolishi shart.
    audit(req, ctx, {
      action: "expense.deleted",
      entity: "Expense",
      entityId: expense._id,
      entityLabel: `${expense.reason} — ${expense.class?.name || ""}`,
      changes: [
        { field: "summa", from: expense.amount, to: null },
        { field: "manba", from: expense.paidFrom || "ko'rsatilmagan", to: null },
      ],
    });

    const staleShot = expense.receiptPublicId || "";
    await Expense.findByIdAndDelete(expenseId);
    // ⚠️ Yozuv o'chgandan KEYIN. Teskarisi bo'lsa, o'chirish
    //    xatosi yozuvni ham, rasmni ham yarim holatda qoldirardi.
    //    Bu chaqiruv hech qachon otmaydi (`destroyImage` izohi).
    if (staleShot) await cloudinary.destroyImage(staleShot);
    return res.json({ success: true, message: "Xarajat o'chirildi" });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

// ============================================================
//  DASHBOARD
// ============================================================
const getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map((c) => c._id);
    const allStudents = await Student.find({ class: { $in: classIds } });

    const monthlyPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      month: currentMonth,
      year: currentYear,
    });

    const paidPayments = monthlyPayments.filter((p) => p.status === "paid");
    const collectedThisMonth = paidPayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    let expectedThisMonth = 0;
    for (const cls of classes) {
      const classStudents = allStudents.filter(
        (s) => s.class.toString() === cls._id.toString(),
      );
      expectedThisMonth += classStudents.length * cls.defaultAmount;
    }

    const monthlyExpenses = await Expense.find({
      teacher: teacherId,
      month: currentMonth,
      year: currentYear,
    });
    const expensesTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    const totalInitialBalance = classes.reduce(
      (sum, c) => sum + (c.initialBalance || 0),
      0,
    );

    const allPaidEver = await MonthlyPayment.find({
      class: { $in: classIds },
      status: "paid",
    });
    const allCollectedEver = allPaidEver.reduce((sum, p) => sum + p.amount, 0);
    const allExpensesEver = await Expense.find({ teacher: teacherId });
    const allExpensesTotalEver = allExpensesEver.reduce(
      (sum, e) => sum + e.amount,
      0,
    );
    const realTotalBalance =
      totalInitialBalance + allCollectedEver - allExpensesTotalEver;

    // ⚠️ BU YERDA HAM N+1 BOR EDI: har bir sinf uchun alohida
    //    `MonthlyPayment.find` va `Expense.find` — ikkalasi ham
    //    sinfning BUTUN tarixini xotiraga yuklardi. Dashboard —
    //    kirgandan keyin birinchi ochiladigan sahifa, ya'ni har
    //    bir seans shu yerdan boshlanadi.
    const dashClassIds = classes.map((c) => c._id);
    const [allPaidRows, allExpRows] = await Promise.all([
      MonthlyPayment.aggregate([
        { $match: { class: { $in: dashClassIds }, status: "paid" } },
        { $group: { _id: "$class", sum: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { class: { $in: dashClassIds } } },
        { $group: { _id: "$class", sum: { $sum: "$amount" } } },
      ]),
    ]);
    const paidEver = new Map(allPaidRows.map((r) => [String(r._id), r.sum]));
    const spentEver = new Map(allExpRows.map((r) => [String(r._id), r.sum]));

    const classDetails = classes.map((cls) => {
      const id = String(cls._id);
      const classStudents = allStudents.filter((s) => String(s.class) === id);
      const classPayments = monthlyPayments.filter((p) => String(p.class) === id);
      const classPaid = classPayments.filter((p) => p.status === "paid");
      const classCollectedThisMonth = classPaid.reduce((sum, p) => sum + p.amount, 0);
      const classExpensesThisMonth = monthlyExpenses
        .filter((e) => e.class && String(e.class) === id)
        .reduce((sum, e) => sum + e.amount, 0);

      const classRealBalance =
        (cls.initialBalance || 0) + (paidEver.get(id) || 0) - (spentEver.get(id) || 0);

      return {
        id: cls._id,
        name: cls.name,
        defaultAmount: cls.defaultAmount,
        studentCount: classStudents.length,
        paidCount: classPaid.length,
        unpaidCount: classStudents.length - classPaid.length,
        collectedThisMonth: classCollectedThisMonth,
        expectedThisMonth: classStudents.length * cls.defaultAmount,
        expensesThisMonth: classExpensesThisMonth,
        initialBalance: cls.initialBalance || 0,
        initialBalanceNote: cls.initialBalanceNote || "",
        realBalance: classRealBalance,
      };
    });

    return res.json({
      success: true,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        plan: teacher.plan,
        planActive: teacher.isPlanActive(),
        daysLeft: teacher.daysLeft(),
        planExpiresAt: teacher.planExpiresAt,
        features: {
          monthly_reminder: hasFeature(teacher, "monthly_reminder"),
          export: hasFeature(teacher, "export"),
          // ⚠️ Interfeys tugmani SHUNGA qarab yashiradi — odam
          //    bosib 403 olmasin (chegara bilan bir xil qoida).
          import: hasFeature(teacher, "import"),
          multi_lang: hasFeature(teacher, "multi_lang"),
          sms_reminder: hasFeature(teacher, "sms_reminder"),
        },
      },
      registeredDate: teacher.registeredDate || teacher.createdAt,
      currentMonth,
      currentYear,
      summary: {
        totalClasses: classes.length,
        totalStudents: allStudents.length,
        paidCount: paidPayments.length,
        unpaidCount: monthlyPayments.length - paidPayments.length,
        collectedThisMonth,
        expectedThisMonth,
        remainingThisMonth: expectedThisMonth - collectedThisMonth,
        expensesTotal,
        balance: collectedThisMonth - expensesTotal,
        totalInitialBalance,
        realTotalBalance,
      },
      classDetails,
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  MONTHLY REMINDER
// ============================================================
const getMonthlyReminder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { month, year } = req.query;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    if (!hasFeature(teacher, "monthly_reminder")) {
      return res.status(403).json({
        success: false,
        error: "Bu funksiya Pro va Premium tarifda",
        requiresUpgrade: true,
      });
    }

    const now = new Date();
    const m = Number(month) || now.getMonth() + 1;
    const y = Number(year) || now.getFullYear();

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map((c) => c._id);

    const unpaidPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      month: m,
      year: y,
      status: "not_paid",
    })
      .populate("student", "name parentPhone rollNumber")
      .populate("class", "name defaultAmount");

    const grouped = {};
    for (const p of unpaidPayments) {
      const cid = p.class._id.toString();
      if (!grouped[cid]) {
        grouped[cid] = {
          classId: cid,
          className: p.class.name,
          defaultAmount: p.class.defaultAmount,
          unpaidStudents: [],
          totalUnpaid: 0,
        };
      }
      grouped[cid].unpaidStudents.push({
        // ⚠️ `studentId` YO'Q EDI va interfeys uning o'rniga qator
        //    RAQAMINI ishlatardi (`st.studentId || idx`). Ya'ni
        //    "tanlanganlarga yuborish" tugmasi backend'ga
        //    `[0, 1, 2]` yuborardi — Pro tarifda sotilayotgan
        //    xususiyat hech qachon ishlamagan.
        studentId: String(p.student._id),
        rollNumber: p.student.rollNumber,
        name: p.student.name,
        parentPhone: p.student.parentPhone,
        amount: p.amount,
      });
      grouped[cid].totalUnpaid += p.amount;
    }

    // ⚠️ `hasTelegram` ham YO'Q EDI: har bir qator "ulanmagan"
    //    belgisi bilan chiqardi va "Hammasini tanlash" tugmasi
    //    (`if (st.hasTelegram)`) hech kimni tanlamasdi.
    //
    // ⚠️ Ro'yxat IKKALA manbadan — `utils/notifyTargets.js`.
    const connected = new Set(
      (
        await collectTargets({
          directorId: teacherId,
          studentIds: unpaidPayments.map((p) => String(p.student._id)),
        })
      ).map((t) => t.studentId),
    );
    for (const g of Object.values(grouped)) {
      for (const st of g.unpaidStudents) {
        st.hasTelegram = connected.has(st.studentId);
      }
    }

    let extraData = {};
    if (hasFeature(teacher, "export")) {
      const allPaid = await MonthlyPayment.find({
        class: { $in: classIds },
        status: "paid",
      });
      const allExpenses = await Expense.find({ teacher: teacherId });
      const totalInitialBalance = classes.reduce(
        (sum, c) => sum + (c.initialBalance || 0),
        0,
      );
      const totalIncome = allPaid.reduce((s, p) => s + p.amount, 0);
      const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
      extraData.overallBalance = {
        totalInitialBalance,
        totalIncome,
        grandTotal: totalInitialBalance + totalIncome,
        totalExpenses,
        balance: totalInitialBalance + totalIncome - totalExpenses,
      };
    }

    return res.json({
      success: true,
      month: m,
      year: y,
      totalUnpaidStudents: unpaidPayments.length,
      // Nechtasiga xabar yetib boradi — "0 yuborildi" ni tushunish uchun
      telegramReady: connected.size,
      classes: Object.values(grouped),
      ...extraData,
    });
  } catch (err) {
    console.error("getMonthlyReminder error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  SMS REMINDER
// ============================================================
const sendSmsReminders = async (req, res) => {
  try {
    const { classId, month, year } = req.body;
    const teacherId = req.user.id;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    if (!hasFeature(teacher, "sms_reminder")) {
      return res.status(403).json({
        success: false,
        error: "SMS reminder faqat Premium uchun",
        requiresUpgrade: true,
      });
    }

    // ⚠️ PROVAYDER TEKSHIRUVI TARIFDAN KEYIN, LEKIN ISHDAN OLDIN.
    //    Ilgari bu yer yo'q edi: `smsService` har bir o'quvchi
    //    uchun jimgina `failed` qaytarardi va javob `success:
    //    true` bo'lardi. Premium sotib olgan direktor "0
    //    yuborildi" ni ko'rib, sababini bilmasdi.
    //
    //    Payme/Click bilan bir xil qoida: kalit yo'q → 503 va
    //    halol xabar.
    if (!smsService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SMS xizmati sozlanmagan",
        smsConfigured: false,
      });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });

    const payments = await MonthlyPayment.find({
      class: classId,
      month: Number(month),
      year: Number(year),
      status: "not_paid",
    }).populate("student", "name parentPhone rollNumber");

    if (payments.length === 0) {
      return res.json({
        success: true,
        message: "SMS yuborilmaydigan o'quvchi yo'q",
        summary: { total: 0, sent: 0, failed: 0 },
      });
    }

    const studentsToNotify = payments.map((p) => ({
      _id: p.student._id,
      name: p.student.name,
      parentPhone: p.student.parentPhone,
      amount: p.amount,
    }));

    const results = await smsService.sendBulkReminders(
      studentsToNotify,
      cls.name,
      month,
      year,
    );
    const successCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return res.json({
      success: true,
      message: "SMS reminder yuborildi",
      summary: {
        total: results.length,
        sent: successCount,
        failed: failedCount,
      },
      details: results,
    });
  } catch (err) {
    console.error("sendSmsReminders error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  EXPORT
// ============================================================
const exportToExcel = (res, cls, data, meta) => {
  try {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [
        "№",
        "O'quvchi ismi",
        "Ota-ona telefoni",
        "Summa (so'm)",
        "Holati",
        "To'lagan sanasi",
      ],
      ...data.map((d) => [
        d["№"],
        d["O'quvchi ismi"],
        d["Ota-ona telefoni"],
        d["Summa (so'm)"],
        d["Holati"],
        d["To'lagan sanasi"],
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "To'lovlar");

    const summaryRows = [
      [`${cls.name} — ${meta.monthName} ${meta.year}`],
      [],
      ["Ko'rsatkich", "Summa (so'm)"],
      ["Jami o'quvchilar", data.length],
      ["To'lagan", meta.paidCount],
      ["To'lamagan", data.length - meta.paidCount],
      [],
      ["⬇ Saytdan oldingi balans", meta.initialBalance],
      ...(meta.initialBalanceNote
        ? [[`  (${meta.initialBalanceNote})`, ""]]
        : []),
      ["⬇ Saytda yig'ilgan", meta.collectedOnSite],
      ["= Jami yig'ilgan (hamma vaqt)", meta.totalCollected],
      [],
      ["Jami xarajatlar", meta.totalExpenses],
      [],
      ["✅ Haqiqiy fond qoldig'i", meta.realBalance],
      [],
      ["Shu oy kutilayotgan", meta.expectedTotal],
      ["Shu oyda qolgan", meta.remaining],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Hisobot");

    const buf = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      compression: true,
    });
    const fileName = encodeURIComponent(
      `${cls.name}_${meta.month}_${meta.year}.xlsx`,
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "no-cache");
    return res.end(buf);
  } catch (err) {
    console.error("exportToExcel error:", err);
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, error: "Excel export xatosi: " + err.message });
  }
};

const exportToWord = async (res, cls, data, meta) => {
  try {
    const headerCells = [
      "№",
      "O'quvchi ismi",
      "Ota-ona telefoni",
      "Summa (so'm)",
      "Holati",
      "To'lagan sanasi",
    ].map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, size: 20 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "2B6CB0" },
        }),
    );

    const dataRows = data.map((row) => {
      const isPaid = row["Holati"] === "To'lagan";
      return new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: String(row["№"] || ""), size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: row["O'quvchi ismi"] || "", size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: row["Ota-ona telefoni"] || "",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: String(row["Summa (so'm)"] || 0),
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: row["Holati"] || "",
                    size: 18,
                    color: isPaid ? "276749" : "C05621",
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: isPaid ? { fill: "F0FFF4" } : { fill: "FFFAF0" },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: row["To'lagan sanasi"] || "", size: 18 }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${cls.name} — To'lovlar Hisoboti`,
                  bold: true,
                  size: 32,
                  color: "1A365D",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${meta.monthName} ${meta.year}`,
                  size: 24,
                  color: "4A5568",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "📊 Moliyaviy holat",
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            ...(meta.initialBalance > 0
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Saytdan oldingi balans: ${meta.initialBalance.toLocaleString("uz-UZ")} so'm`,
                        size: 20,
                        color: "2B6CB0",
                      }),
                    ],
                  }),
                  ...(meta.initialBalanceNote
                    ? [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `  (${meta.initialBalanceNote})`,
                              size: 18,
                              italics: true,
                              color: "718096",
                            }),
                          ],
                        }),
                      ]
                    : []),
                ]
              : []),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Saytda yig'ilgan: ${meta.collectedOnSite.toLocaleString("uz-UZ")} so'm`,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Jami yig'ilgan: ${meta.totalCollected.toLocaleString("uz-UZ")} so'm`,
                  size: 20,
                  bold: true,
                  color: "276749",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Jami xarajatlar: ${meta.totalExpenses.toLocaleString("uz-UZ")} so'm`,
                  size: 20,
                  color: "C05621",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `✅ Fond qoldig'i: ${meta.realBalance.toLocaleString("uz-UZ")} so'm`,
                  size: 22,
                  bold: true,
                  color: meta.realBalance >= 0 ? "276749" : "C53030",
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `To'lagan: ${meta.paidCount} | To'lamagan: ${data.length - meta.paidCount}`,
                  size: 20,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "📋 O'quvchilar ro'yxati",
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ children: headerCells, tableHeader: true }),
                ...dataRows,
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Chiqarilgan: ${new Date().toLocaleDateString("uz-UZ")}`,
                  size: 16,
                  color: "718096",
                  italics: true,
                }),
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 400 },
            }),
          ],
        },
      ],
    });

    const buf = await Packer.toBuffer(doc);
    const fileName = encodeURIComponent(
      `${cls.name}_${meta.month}_${meta.year}.docx`,
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "no-cache");
    return res.end(buf);
  } catch (err) {
    console.error("exportToWord error:", err);
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, error: "Word export xatosi: " + err.message });
  }
};

const exportPayments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year, format = "json" } = req.query;
    const teacherId = req.user.id;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });
    if (!hasFeature(teacher, "export")) {
      return res.status(403).json({
        success: false,
        error: "Export faqat Premium uchun",
        requiresUpgrade: true,
      });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });

    const students = await Student.find({ class: classId }).sort({
      rollNumber: 1,
    });
    if (students.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Bu sinfda o'quvchi yo'q" });
    }

    const query = { class: classId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const payments = await MonthlyPayment.find(query).populate(
      "student",
      "name parentPhone rollNumber",
    );

    const monthNames = [
      "Yanvar",
      "Fevral",
      "Mart",
      "Aprel",
      "May",
      "Iyun",
      "Iyul",
      "Avgust",
      "Sentabr",
      "Oktabr",
      "Noyabr",
      "Dekabr",
    ];
    const monthName = month ? monthNames[Number(month) - 1] || "" : "";

    const exportData = students.map((student) => {
      const payment = payments.find(
        (p) => p.student._id.toString() === student._id.toString(),
      );
      return {
        "№": student.rollNumber,
        "O'quvchi ismi": student.name,
        "Ota-ona telefoni": student.parentPhone || "—",
        "Summa (so'm)": payment ? payment.amount : cls.defaultAmount,
        Holati: payment?.status === "paid" ? "To'lagan" : "To'lamagan",
        "To'lagan sanasi": payment?.paidDate
          ? new Date(payment.paidDate).toLocaleDateString("uz-UZ")
          : "—",
      };
    });

    const paidCount = exportData.filter(
      (r) => r["Holati"] === "To'lagan",
    ).length;
    const collectedOnSite = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const expectedTotal = students.length * cls.defaultAmount;
    const allExpenses = await Expense.find({ class: classId });
    const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);

    const meta = {
      paidCount,
      expectedTotal,
      collectedOnSite,
      initialBalance: cls.initialBalance || 0,
      initialBalanceNote: cls.initialBalanceNote || "",
      totalCollected: (cls.initialBalance || 0) + collectedOnSite,
      totalExpenses,
      realBalance: (cls.initialBalance || 0) + collectedOnSite - totalExpenses,
      remaining: expectedTotal - collectedOnSite,
      month: Number(month) || 0,
      year: Number(year) || new Date().getFullYear(),
      monthName,
    };

    if (format === "excel") return exportToExcel(res, cls, exportData, meta);
    if (format === "word") return exportToWord(res, cls, exportData, meta);

    return res.json({
      success: true,
      data: exportData,
      meta: {
        className: cls.name,
        ...meta,
        studentCount: students.length,
        unpaidCount: students.length - paidCount,
      },
    });
  } catch (err) {
    console.error("exportPayments error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ══ MARKAZ SALOMATLIGI ═════════════════════════════════════
//
// ⚠️ Tizimdagi eng qimmat xatolar xato bermaydi — ular
//    shunchaki SODIR BO'LMAYDI. To'lov varaqasi qo'lda
//    yaratiladi va bitta guruh unutilsa, o'sha oy o'sha
//    guruhdan pul umuman so'ralmaydi. Hech qanday xabar yo'q,
//    oy oxirida esa "nega tushum kam?" degan savol qoladi.
const getCenterHealth = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    // Moliyaviy ma'lumot bor (qaysi guruhdan pul so'ralmagan)
    requireAnyPermission(ctx, ["viewPayments", "managePayments"]);

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    const teacher = await Teacher.findById(ctx.directorId).select(
      "institutionType",
    );

    const data = await centerHealth.collect({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
      month,
      year,
      isLC: teacher?.institutionType === "learning_center",
    });

    return res.json({
      success: true,
      period: { month, year },
      ...centerHealth.buildHealth(data),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

// ============================================================
//  SUBSCRIPTION
// ============================================================
//
// ⚠️ NARX VA CHEGARA FRONTENDDA QOTIRILMAYDI. Ilgari
//    `Subscription.vue` uchta tarifni o'zi yozib turardi —
//    29 000 / 59 000 va "1 ta sinf, 30 ta o'quvchi". Bu FOND
//    raqamlari, sahifa esa LC menyusida ham bor. Ya'ni o'quv
//    markazi direktori Pro narxini 29 000 deb ko'rar, o'shancha
//    to'lar edi — backend esa so'rovni `priceFor` bo'yicha
//    199 000 deb yozardi va admin uni rad etardi. Mijoz pul
//    yubordi, xizmat olmadi va sababini bilmadi.
//
//    Shuning uchun katalog SHU YERDAN, `planHelper` dan ketadi:
//    narx ham, chegara ham, funksiyalar ham. Rejim
//    (`institutionType`) hisobga olinadi.
//
// ⚠️ `usage` ham qo'shildi: interfeys chegarani BOSISHDAN
//    OLDIN ko'rsatsin. Aks holda odam "Xodim qo'shish" ni bosib
//    403 oladi va nima noto'g'ri ekanini tushunmaydi.
const PLAN_IDS = ["free", "pro", "premium"];

const buildPlanCatalog = (teacher) =>
  PLAN_IDS.map((id) => ({
    id,
    price: priceFor(id, teacher)?.monthly || 0,
    limits: limitsFor(id, teacher),
    features: featuresFor(id, teacher),
  }));

/** Hozir nechtadan foydalanilyapti — chegara bilan yonma-yon ko'rsatish uchun */
const collectUsage = async (teacher) => {
  const id = teacher._id;

  // ⚠️ O'quvchi `Student.teacher` orqali bog'lanmaydi — bunday
  //    maydon umuman yo'q. Guruh orqali topiladi va sanoq
  //    `countUniqueStudents` bilan: ikkita guruhda o'qiydigan
  //    bola ikki marta sanalmasin (`utils/enrollment.js`).
  const classIds = (await Class.find({ teacher: id }).select("_id").lean()).map(
    (c) => c._id,
  );

  const [students, staff, branches, leads] = await Promise.all([
    countUniqueStudents(classIds),
    Staff.countDocuments({ director: id, isActive: { $ne: false } }),
    Branch.countDocuments({ teacher: id, isActive: true }),
    // Ochiq lidlar — chegara ham aynan shularni sanaydi
    Lead.countDocuments({ director: id, status: { $nin: ["won", "lost"] } }),
  ]);
  return { classes: classIds.length, students, staff, branches, leads };
};

const getSubscriptionInfo = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: "Teacher topilmadi" });

    return res.json({
      success: true,
      mode: teacher.institutionType || "school",
      plans: buildPlanCatalog(teacher),
      // ⚠️ Karta raqami frontendda QOTIRILMAYDI. U yerda
      //    `8600 1234 5678 9012` turgandi — namuna matn, haqiqiy
      //    karta emas. Direktor uni nusxa olib pul yuborardi.
      //    Kalit qo'yilmagan bo'lsa `configured: false` va sahifa
      //    soxta raqam o'rniga ogohlantirish ko'rsatadi.
      payTo: {
        configured: platform.configured,
        card: platform.card,
        cardPlain: platform.cardPlain,
        holder: platform.holder,
      },
      // ⚠️ TARIFDA BOR ≠ ISHLAYDI. "SMS eslatma" Premium qatorida
      //    turadi, lekin provayder ulanmagan bo'lsa hech qanday
      //    SMS ketmaydi. Sahifa buni oldindan aytishi kerak —
      //    aks holda direktor pulini to'lab, tugmani bosib,
      //    503 ni ko'radi. `payTo.configured` bilan bir xil qoida.
      channels: {
        sms: { configured: smsService.isConfigured() },
      },
      usage: await collectUsage(teacher),
      limits: limitsFor(activePlanOf(teacher), teacher),
      currentPlan: teacher.plan,
      planActive: teacher.isPlanActive(),
      daysLeft: teacher.daysLeft(),
      planExpiresAt: teacher.planExpiresAt,
      highestPlanEver: teacher.highestPlanEver,
      features: {
        monthly_reminder: hasFeature(teacher, "monthly_reminder"),
        export: hasFeature(teacher, "export"),
        import: hasFeature(teacher, "import"),
        multi_lang: hasFeature(teacher, "multi_lang"),
        sms_reminder: hasFeature(teacher, "sms_reminder"),
      },
      // Chek hajmi cheklovi — interfeys o'zi o'ylab topmasin.
      // CDN yoqilgan bo'lsa 5MB, aks holda 2MB
      // (controllers/paymentRequestController.js).
      screenshotMaxBytes: cloudinary.enabled()
        ? 5 * 1024 * 1024
        : 2 * 1024 * 1024,
    });
  } catch (err) {
    console.error("getSubscriptionInfo error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ============================================================
//  EXPORTS
// ============================================================
module.exports = {
  completeOnboarding,
  getProfile,
  getModeStatus,
  switchMode,
  updateBranding,
  getBranding,

  getDashboard,
  getSubscriptionInfo,
  getCenterHealth,

  getClassesForStaff,
  getMyClasses,
  getClassById,
  createClass,
  updateClassDefaultAmount,
  updateInitialBalance,
  deleteClass,
  updateClass,

  addStudent,
  getClassStudents,
  deleteStudent,
  getStudents,
  updateStudent,
  importStudents,

  createMonthlyPayments,
  createMonthlyPaymentsAll,
  getMonthlyPayments,
  getClassPayments,
  updatePaymentStatus,
  markPayment,

  addExpense,
  getExpenses,
  setExpenseReceipt,
  deleteExpense,

  getMonthlyReminder,
  sendSmsReminders,
  exportPayments,
};
