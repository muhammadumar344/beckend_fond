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
const { canSee, isVerified, visibleSections } = require("../utils/tmaAccess");

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
          .select("institutionName logo brandColor institutionType")
          .lean()
      : [];
    const byId = new Map(directors.map((d) => [String(d._id), d]));

    // Guruh nomlari
    const classIds = links.map((l) => l.student?.class).filter(Boolean);
    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } }).select("name").lean()
      : [];
    const className = new Map(classes.map((c) => [String(c._id), c.name]));

    const children = links.map((l) => {
      const d = byId.get(String(l.director));
      return {
        studentId: l.student?._id,
        name: l.student?.name || "—",
        className: className.get(String(l.student?.class)) || "",
        kind: l.kind,
        verified: isVerified(l),
        sections: visibleSections(l),
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
