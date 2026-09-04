// src/controllers/inviteController.js
// ════════════════════════════════════════════════════════════
// Taklif kodlari — CRM tomoni.
//
// Xodim o'quvchi kartochkasida "Kod chiqarish" bosadi, kodni
// ota-onaga aytadi (telefonda yoki qog'ozda). Ota-ona uni botga
// yozadi va bog'lanadi.
//
// ⚠️ Kod PAROL bilan tengdir — u bilan bolaning baholari ochiladi.
//    Shu sababli:
//      · faqat SHU markazning o'quvchisiga chiqariladi
//      · 7 kun yashaydi, keyin MongoDB o'zi o'chiradi (TTL indeks)
//      · bir marta ishlatiladi
//      · yangi kod chiqarilsa eskisi darhol kuchini yo'qotadi
// ════════════════════════════════════════════════════════════

const InviteCode = require("../models/InviteCode");
const Student = require("../models/Student");
const Class = require("../models/Class");
const StudentLink = require("../models/StudentLink");
const { resolveContext, requirePermission } = require("../utils/resolveContext");

const TTL_DAYS = 7;

/**
 * O'quvchi shu markazga tegishlimi.
 * @returns {Promise<boolean>}
 */
async function ownsStudent(directorId, studentId) {
  const student = await Student.findById(studentId).select("class").lean();
  if (!student) return false;
  const cls = await Class.findOne({
    _id: student.class,
    teacher: directorId,
  }).select("_id").lean();
  return Boolean(cls);
}

// ── POST /api/teacher/students/:studentId/invite ─────────────
exports.createInvite = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId } = req.params;
    const kind = req.body?.kind === "student" ? "student" : "parent";

    if (!(await ownsStudent(ctx.directorId, studentId))) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });
    }

    // ⚠️ Eski ishlatilmagan kodlar bekor qilinadi. Aks holda bitta
    //    o'quvchi uchun bir nechta amaldagi kod yurardi va qaysi biri
    //    kimga berilgani noma'lum bo'lib qolardi.
    await InviteCode.deleteMany({ student: studentId, usedAt: null });

    const display = InviteCode.generateCode();
    const invite = await InviteCode.create({
      director: ctx.directorId,
      student: studentId,
      code: InviteCode.normalizeCode(display),
      display,
      kind,
      expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
      createdBy: ctx.staffId || ctx.directorId,
    });

    return res.status(201).json({
      success: true,
      code: invite.display,
      expiresAt: invite.expiresAt,
      expiresInDays: TTL_DAYS,
    });
  } catch (err) {
    console.error("createInvite error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

// ── GET /api/teacher/students/:studentId/links ───────────────
// Kim ulangan va amaldagi kod bormi.
exports.getStudentLinks = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId } = req.params;
    if (!(await ownsStudent(ctx.directorId, studentId))) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });
    }

    const [links, pending] = await Promise.all([
      StudentLink.find({ student: studentId, isActive: true })
        .select("kind verifiedVia telegramUsername lastSeenAt createdAt")
        .lean(),
      InviteCode.findOne({
        student: studentId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .select("display expiresAt")
        .lean(),
    ]);

    return res.json({
      success: true,
      links: links.map((l) => ({
        // ⚠️ `id` SHART. Busiz interfeys qatorni ADRESLAY
        //    olmaydi va `DELETE /teacher/links/:linkId` hech
        //    qayerdan chaqirilmasdi — ya'ni noto'g'ri ulangan
        //    odam bolaning baholarini abadiy ko'rib turardi.
        id: l._id,
        kind: l.kind,
        verified: l.verifiedVia !== "legacy",
        via: l.verifiedVia,
        username: l.telegramUsername || "",
        lastSeenAt: l.lastSeenAt,
        linkedAt: l.createdAt,
      })),
      pendingCode: pending
        ? { code: pending.display, expiresAt: pending.expiresAt }
        : null,
    });
  } catch (err) {
    console.error("getStudentLinks error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};

// ── DELETE /api/teacher/links/:linkId ────────────────────────
// Ota-onaning ulanishini uzish (masalan ajrashgan holatda).
exports.revokeLink = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const link = await StudentLink.findOne({
      _id: req.params.linkId,
      director: ctx.directorId, // ⚠️ boshqa markazning ulanishiga tegmasin
    });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, error: "Ulanish topilmadi" });
    }

    link.isActive = false;
    await link.save();

    return res.json({ success: true, message: "Ulanish uzildi" });
  } catch (err) {
    console.error("revokeLink error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};
