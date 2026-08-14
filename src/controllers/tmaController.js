// src/controllers/tmaController.js
// ════════════════════════════════════════════════════════════
// Mini App (ota-ona / o'quvchi) uchun API.
//
// ⚠️ HAR BIR endpoint `req.tma.linkFor(studentId)` orqali
//    ushbu Telegram hisobi AYNAN shu o'quvchiga bog'langanini
//    tekshiradi. `studentId` manzildan keladi — tekshiruvsiz
//    istalgan bolaning baholarini so'rash mumkin bo'lardi
//    (klassik IDOR).
//
// ⚠️ Bu yerdan hech qachon boshqa o'quvchilarning ma'lumoti,
//    guruh daromadi yoki xodim ma'lumoti chiqmasin. Ota-ona
//    faqat O'Z farzandini ko'radi.
// ════════════════════════════════════════════════════════════

const Student = require("../models/Student");
const Class = require("../models/Class");
const Grade = require("../models/Grade");
const Attendance = require("../models/Attendance");
const MonthlyPayment = require("../models/MonthlyPayment");
const Teacher = require("../models/Teacher");
const StudentLink = require("../models/StudentLink");
const InviteCode = require("../models/InviteCode");
const Staff = require("../models/Staff");
const SupportSlot = require("../models/SupportSlot");
const SupportBooking = require("../models/SupportBooking");
const Homework = require("../models/Homework");
const HomeworkResult = require("../models/HomeworkResult");
const { canSee, isVerified, visibleSections } = require("../utils/tmaAccess");
const { getStudentGroupIds } = require("../utils/enrollment");
const { freeSlots } = require("../utils/supportSlots");
const { bookSlot } = require("../services/supportBooking");
const { verifyPayload } = require("../services/supportQr");

/** Bog'lanishni topadi va bo'limga ruxsatni tekshiradi */
function requireLink(req, res, studentId, section) {
  const link = req.tma.linkFor(studentId);
  if (!link) {
    res.status(403).json({ success: false, error: "Bu o'quvchiga ruxsat yo'q" });
    return null;
  }
  if (!canSee(link, section)) {
    res.status(403).json({
      success: false,
      error: "Buni ko'rish uchun hisobingizni tasdiqlang",
      needsVerification: true,
    });
    return null;
  }
  return link;
}

// ── GET /api/tma/me ──────────────────────────────────────────
// Mini App ochilganda birinchi chaqiriladigan manzil.
exports.getMe = async (req, res) => {
  try {
    const { user, links } = req.tma;

    // Markaz brendi — Mini App direktorning logotipi bilan ochilsin
    const directorIds = [...new Set(links.map((l) => String(l.director)))];
    const directors = directorIds.length
      ? await Teacher.find({ _id: { $in: directorIds } })
          .select("institutionName logo brandColor institutionType supportEnabled")
          .lean()
      : [];
    const byId = new Map(directors.map((d) => [String(d._id), d]));

    // Bloklangan o'quvchilar — "yozila olmaysiz" sababini
    // ko'rsatish uchun (yozilishga urinib, keyin xato olishdan
    // ko'ra oldindan aytgan yaxshi)
    const studentIds = links.map((l) => l.student?._id).filter(Boolean);
    const blocks = studentIds.length
      ? await Student.find({
          _id: { $in: studentIds },
          supportBlockedUntil: { $gt: new Date() },
        })
          .select("supportBlockedUntil")
          .lean()
      : [];
    const blockedUntil = new Map(
      blocks.map((s) => [String(s._id), s.supportBlockedUntil]),
    );

    // Guruh nomlari
    const classIds = links.map((l) => l.student?.class).filter(Boolean);
    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } }).select("name").lean()
      : [];
    const className = new Map(classes.map((c) => [String(c._id), c.name]));

    const children = links.map((l) => {
      const d = byId.get(String(l.director));

      // ⚠️ Markazda bu xizmat bo'lmasa "Yozilish" tabi UMUMAN
      //    ko'rsatilmaydi. Aks holda ota-ona tabni bosib, bo'sh
      //    ekranga tushardi va "nima uchun ishlamayapti?" deb
      //    markazga qo'ng'iroq qilardi.
      const sections = visibleSections(l).filter(
        (s) => s !== "booking" || d?.supportEnabled,
      );

      return {
        studentId: l.student?._id,
        name: l.student?.name || "—",
        className: className.get(String(l.student?.class)) || "",
        kind: l.kind,
        verified: isVerified(l),
        sections,
        supportBlockedUntil: blockedUntil.get(String(l.student?._id)) || null,
        center: d
          ? {
              name: d.institutionName || "",
              logo: d.logo || "",
              brandColor: d.brandColor || "",
              type: d.institutionType || null,
            }
          : null,
      };
    });

    // Oxirgi kirish vaqti — direktor "faol ota-onalar" ni ko'rishi uchun.
    // Javobni kutmaymiz, bu ma'lumot kechikishi mumkin.
    StudentLink.updateMany(
      { telegramUserId: user.id, isActive: true },
      { $set: { lastSeenAt: new Date() } },
    ).catch(() => {});

    res.json({
      success: true,
      user: { name: [user.firstName, user.lastName].filter(Boolean).join(" ") },
      children,
    });
  } catch (err) {
    console.error("[tma] getMe", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/grades ───────────────────
exports.getGrades = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!requireLink(req, res, studentId, "grades")) return;

    const grades = await Grade.find({ student: studentId })
      .sort({ date: -1 })
      .limit(100)
      .select("subject score maxScore date type note")
      .lean();

    // Fan bo'yicha o'rtacha — ota-ona eng avval shuni qidiradi
    const bySubject = new Map();
    for (const g of grades) {
      const k = g.subject || "—";
      if (!bySubject.has(k)) bySubject.set(k, { sum: 0, n: 0 });
      const b = bySubject.get(k);
      b.sum += (g.score / (g.maxScore || 100)) * 100;
      b.n += 1;
    }

    const subjects = [...bySubject.entries()]
      .map(([subject, b]) => ({
        subject,
        average: Math.round(b.sum / b.n),
        count: b.n,
      }))
      .sort((a, b) => b.count - a.count);

    const overall = grades.length
      ? Math.round(
          grades.reduce((s, g) => s + (g.score / (g.maxScore || 100)) * 100, 0) /
            grades.length,
        )
      : null;

    res.json({ success: true, overall, subjects, grades });
  } catch (err) {
    console.error("[tma] getGrades", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/attendance ───────────────
exports.getAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!requireLink(req, res, studentId, "attendance")) return;

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    const records = await Attendance.find({ student: studentId, month, year })
      .sort({ date: -1 })
      .select("date status note")
      .lean();

    const count = (s) => records.filter((r) => r.status === s).length;
    const present = count("present");
    const late = count("late");
    const absent = count("absent");
    const excused = count("excused");
    const total = records.length;

    // ⚠️ Sababli kelmagan kun foizni tushirmaydi — u bolaning
    //    aybi emas. Shuning uchun maxrajdan ham chiqariladi.
    const counted = total - excused;

    res.json({
      success: true,
      month,
      year,
      summary: {
        total,
        present,
        late,
        absent,
        excused,
        // Kelgan deb hisoblanadi: o'z vaqtida + kechikkan
        percent: counted ? Math.round(((present + late) / counted) * 100) : null,
      },
      records,
    });
  } catch (err) {
    console.error("[tma] getAttendance", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/payments ─────────────────
exports.getPayments = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!requireLink(req, res, studentId, "payments")) return;

    const payments = await MonthlyPayment.find({ student: studentId })
      .sort({ year: -1, month: -1 })
      .limit(24)
      .select("month year amount status paidDate")
      .lean();

    const unpaid = payments.filter((p) => p.status !== "paid");
    const debt = unpaid.reduce((s, p) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      debt,
      unpaidCount: unpaid.length,
      payments,
    });
  } catch (err) {
    console.error("[tma] getPayments", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/homework ─────────────────
exports.getHomework = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!requireLink(req, res, studentId, "homework")) return;

    // O'quvchi qatnashadigan barcha guruhlar (asosiy + qo'shimcha)
    const groupIds = await getStudentGroupIds(studentId);
    if (!groupIds.length) {
      return res.json({ success: true, homework: [], pendingCount: 0 });
    }

    const items = await Homework.find({ class: { $in: groupIds } })
      .sort({ dueDate: -1 })
      .limit(40)
      .select("title description subject assignedDate dueDate points class")
      .lean();
    if (!items.length) {
      return res.json({ success: true, homework: [], pendingCount: 0 });
    }

    // Natijalar bir so'rovda — har bir topshiriq uchun alohida
    // so'rov yuborsak 40 ta so'rov bo'lardi
    const results = await HomeworkResult.find({
      student: studentId,
      homework: { $in: items.map((h) => h._id) },
    })
      .select("homework status points note checkedAt")
      .lean();
    const byHw = new Map(results.map((r) => [String(r.homework), r]));

    const today = new Date().toISOString().slice(0, 10);

    const homework = items.map((h) => {
      const r = byHw.get(String(h._id));
      const status = r?.status || "pending";
      return {
        id: h._id,
        title: h.title,
        description: h.description,
        subject: h.subject,
        assignedDate: h.assignedDate,
        dueDate: h.dueDate,
        maxPoints: h.points,
        status,
        points: r?.points ?? null,
        note: r?.note || "",
        // ⚠️ "Muddati o'tgan" holati BAZADA yo'q — u sanadan
        //    kelib chiqadi. Bazaga yozib qo'ysak har kuni
        //    yangilab turish kerak bo'lardi.
        overdue: status === "pending" && h.dueDate < today,
      };
    });

    res.json({
      success: true,
      homework,
      pendingCount: homework.filter((h) => h.status === "pending").length,
    });
  } catch (err) {
    console.error("[tma] getHomework", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ══ QO'SHIMCHA MASHG'ULOT ═══════════════════════════════════

// ── GET /api/tma/student/:studentId/teachers ─────────────────
// Kimga yozilish mumkin: o'quvchi guruhlarining ustozlari.
exports.getSupportTeachers = async (req, res) => {
  try {
    const { studentId } = req.params;
    const link = requireLink(req, res, studentId, "booking");
    if (!link) return;

    // O'quvchi qatnashadigan guruhlar (asosiy + qo'shimcha)
    const groupIds = await getStudentGroupIds(studentId);
    if (!groupIds.length) return res.json({ success: true, teachers: [] });

    const groups = await Class.find({ _id: { $in: groupIds } })
      .select("assignedTeacher name")
      .lean();

    const teacherIds = [
      ...new Set(groups.map((g) => g.assignedTeacher).filter(Boolean).map(String)),
    ];
    if (!teacherIds.length) return res.json({ success: true, teachers: [] });

    // ⚠️ Faqat qabul vaqti BOR ustozlar ko'rsatiladi. Aks holda
    //    o'quvchi ustozni tanlab, keyin "bo'sh vaqt yo'q" degan
    //    bo'sh ekranga tushardi.
    const withSlots = await SupportSlot.find({
      teacher: { $in: teacherIds },
      director: link.director,
      isActive: true,
    }).distinct("teacher");

    const staff = await Staff.find({ _id: { $in: withSlots } })
      .select("name position")
      .lean();

    res.json({
      success: true,
      teachers: staff.map((s) => ({
        id: s._id,
        name: s.name,
        position: s.position || "",
      })),
    });
  } catch (err) {
    console.error("[tma] getSupportTeachers", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/free?teacherId=&date= ────
exports.getFreeSlots = async (req, res) => {
  try {
    const { studentId } = req.params;
    const link = requireLink(req, res, studentId, "booking");
    if (!link) return;

    const { teacherId, date } = req.query;
    if (!teacherId || !date) {
      return res
        .status(400)
        .json({ success: false, error: "teacherId va date majburiy" });
    }

    const slots = await freeSlots({
      directorId: link.director,
      teacherId,
      date,
    });
    res.json({ success: true, date, slots });
  } catch (err) {
    console.error("[tma] getFreeSlots", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── POST /api/tma/student/:studentId/bookings ────────────────
exports.createBooking = async (req, res) => {
  try {
    const { studentId } = req.params;
    const link = requireLink(req, res, studentId, "booking");
    if (!link) return;

    const { teacherId, date, startTime, topic } = req.body || {};
    if (!teacherId || !date || !startTime) {
      return res.status(400).json({
        success: false,
        error: "teacherId, date, startTime majburiy",
      });
    }

    const r = await bookSlot({
      directorId: link.director,
      studentId,
      teacherId,
      date,
      startTime,
      topic,
      via: "app",
    });

    if (!r.ok) {
      return res.status(r.status || 400).json({ success: false, error: r.error });
    }

    res.status(201).json({
      success: true,
      message: "Yozildingiz. Ustoz tasdiqlagach xabar keladi.",
      booking: {
        id: r.booking._id,
        date: r.booking.date,
        startTime: r.booking.startTime,
        endTime: r.booking.endTime,
        status: r.booking.status,
      },
    });
  } catch (err) {
    console.error("[tma] createBooking", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── GET /api/tma/student/:studentId/bookings ─────────────────
exports.getBookings = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!requireLink(req, res, studentId, "booking")) return;

    const bookings = await SupportBooking.find({ student: studentId })
      .sort({ date: -1, startTime: -1 })
      .limit(20)
      .populate("teacher", "name")
      .select("date startTime endTime topic status note teacher")
      .lean();

    res.json({
      success: true,
      bookings: bookings.map((b) => ({
        id: b._id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        topic: b.topic,
        status: b.status,
        note: b.note,
        teacherName: b.teacher?.name || "",
      })),
    });
  } catch (err) {
    console.error("[tma] getBookings", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── POST /api/tma/scan ───────────────────────────────────────
// O'quvchi ustoz ekranidagi QR ni skanerlaydi → "keldi".
//
// ⚠️ BEKOR QILISH ENDPOINT'I ATAYLAB YO'Q. Yozildingizmi —
//    kelasiz. Bekor qilish erkin bo'lsa, o'quvchi vaqtni band
//    qilib qo'yib oxirgi daqiqada bo'shatardi va o'sha joyga
//    boshqa hech kim ulgurmasdi.
exports.scanQr = async (req, res) => {
  try {
    const v = verifyPayload(req.body?.payload);
    if (!v.ok) {
      return res.status(400).json({ success: false, error: v.reason });
    }

    const booking = await SupportBooking.findById(v.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: "Yozuv topilmadi" });
    }

    // ⚠️ QR AYNAN shu foydalanuvchining yozuvidanmi. Usiz do'stining
    //    QR ini skanerlab, o'zini kelgan qilib ko'rsatish mumkin edi.
    const link = req.tma.linkFor(booking.student);
    if (!link) {
      return res
        .status(403)
        .json({ success: false, error: "Bu yozuv sizniki emas" });
    }

    if (booking.attendedAt) {
      return res.json({
        success: true,
        already: true,
        message: "Allaqachon belgilangan",
      });
    }
    if (!["pending", "confirmed"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, error: "Bu yozuv faol emas" });
    }

    booking.attendedAt = new Date();
    booking.status = "done";
    await booking.save();

    console.log(`[tma] mashg'ulotga keldi: ${booking._id}`);

    res.json({
      success: true,
      message: "Kelganingiz belgilandi ✅",
      booking: {
        id: booking._id,
        date: booking.date,
        startTime: booking.startTime,
      },
    });
  } catch (err) {
    console.error("[tma] scanQr", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

// ── POST /api/tma/redeem ─────────────────────────────────────
// Taklif kodi bilan bog'lanish. Telefon mos kelmaganda ishlatiladi.
exports.redeemCode = async (req, res) => {
  try {
    const { user } = req.tma;
    const raw = req.body?.code;
    const code = InviteCode.normalizeCode(raw);

    if (!code || code.length < 6) {
      return res.status(400).json({ success: false, error: "Kod noto'g'ri" });
    }

    const invite = await InviteCode.findOne({ code });

    // ⚠️ Yo'q / ishlatilgan / muddati o'tgan — UCHALASIGA bir xil
    //    javob. Aks holda kod terib topayotgan odam qaysi kod
    //    "mavjud, lekin ishlatilgan" ekanini bilib olardi.
    const vague = () =>
      res.status(400).json({
        success: false,
        error: "Kod noto'g'ri yoki muddati o'tgan",
      });

    if (!invite) return vague();
    if (invite.usedAt) return vague();
    if (invite.expiresAt <= new Date()) return vague();

    const student = await Student.findById(invite.student).select("name class");
    if (!student) return vague();

    // Allaqachon bog'langan bo'lsa — darajasini ko'taramiz
    const existing = await StudentLink.findOne({
      telegramUserId: user.id,
      student: invite.student,
    });

    if (existing) {
      existing.verifiedVia = "code";
      existing.isActive = true;
      existing.telegramUsername = user.username || existing.telegramUsername;
      await existing.save();
    } else {
      await StudentLink.create({
        director: invite.director,
        student: invite.student,
        telegramUserId: user.id,
        telegramChatId: user.id,
        telegramUsername: user.username || "",
        kind: invite.kind,
        verifiedVia: "code",
      });
    }

    invite.usedAt = new Date();
    invite.usedByTelegramId = user.id;
    await invite.save();

    console.log(`[tma] kod ishlatildi: ${student.name} ← ${user.id}`);

    res.json({
      success: true,
      message: `${student.name} bilan bog'landingiz`,
      studentName: student.name,
    });
  } catch (err) {
    console.error("[tma] redeemCode", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};
