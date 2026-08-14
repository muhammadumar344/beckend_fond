// src/controllers/accountController.js
// ════════════════════════════════════════════════════════════
// HISOBNI O'CHIRISH — 30 kunlik muhlat bilan.
//
// NEGA darhol emas: bu yerda pul tarixi yotibdi. Xato bosilgan
// tugma tufayli o'quv markazi bir yillik to'lov yozuvlarini
// yo'qotsa, uni hech qayerdan tiklab bo'lmaydi. Shuning uchun:
//
//   1. Direktor o'chirishni so'raydi  → parol bilan tasdiqlaydi
//   2. Hisob DARHOL yopiladi          → kira olmaydi
//   3. 30 kun ichida qaytsa           → tiklay oladi
//   4. 30 kun o'tsa                   → cron butunlay o'chiradi
//
// Bu Google/GitHub dagi bilan bir xil naqsh va foydalanuvchiga
// tanish. 2-qadam muhim: "o'chirdim" degan odam ertasiga hisobi
// hamon ochiqligini ko'rsa, tizimga ishonchi qoladi.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const Staff = require("../models/Staff");
const { purgeDirector } = require("../utils/accountPurge");

const GRACE_DAYS = 30;

// Foydalanuvchi qo'lda yozishi kerak bo'lgan so'z. Tasodifiy
// bosishdan himoya: parol menejeri to'ldirib qo'yolmaydi.
const CONFIRM_WORD = "O'CHIRISH";

// Yozilishidagi farqlar kechiriladi: apostrof turi (' ’ ‘),
// katta-kichik harf, chetdagi bo'shliq.
const normalizeConfirm = (s) =>
  String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[’‘`´]/g, "'");

/**
 * POST /api/teacher/account/delete
 * Body: { password, confirm }
 */
const requestDeletion = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, error: "Faqat direktor uchun" });
    }

    const { password, confirm } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Parol majburiy" });
    }
    if (normalizeConfirm(confirm) !== CONFIRM_WORD) {
      return res.status(400).json({
        success: false,
        error: `Tasdiqlash uchun "${CONFIRM_WORD}" so'zini yozing`,
      });
    }

    const teacher = await Teacher.findById(req.user.id).select("+password");
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }
    if (!(await teacher.comparePassword(password))) {
      return res.status(400).json({ success: false, error: "Parol noto'g'ri" });
    }
    if (teacher.deletionScheduledFor) {
      return res.status(400).json({
        success: false,
        error: "Hisob allaqachon o'chirish navbatida",
        deletionScheduledFor: teacher.deletionScheduledFor,
      });
    }

    const now = new Date();
    teacher.deletionRequestedAt = now;
    teacher.deletionScheduledFor = new Date(
      now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    await teacher.save();

    // Xodimlar ham kira olmasligi kerak — markaz yopilyapti.
    // ⚠️ `isActive` GA TEGILMAYDI, aks holda tiklashda direktor
    //    ataylab bloklagan xodim ham ochilib ketardi.
    const staffCount = await Staff.countDocuments({ director: teacher._id });

    console.log(
      `[account] o'chirish so'raldi: ${teacher.email} → ${teacher.deletionScheduledFor.toISOString()}`,
    );

    return res.json({
      success: true,
      message: `Hisob ${GRACE_DAYS} kundan keyin o'chiriladi`,
      deletionScheduledFor: teacher.deletionScheduledFor,
      graceDays: GRACE_DAYS,
      affectedStaff: staffCount,
    });
  } catch (err) {
    console.error("requestDeletion error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/auth/restore-account
 * Body: { email, password }
 *
 * Tizimga kirmasdan chaqiriladi — chunki o'chirish navbatidagi
 * hisob login qila olmaydi. Shuning uchun parol yana so'raladi.
 */
const restoreAccount = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email va parol majburiy" });
    }

    const teacher = await Teacher.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("+password");

    // ⚠️ Hisob yo'q, parol xato yoki o'chirish navbatida emas —
    //    uchalasiga BIR XIL javob. Aks holda bu endpoint orqali
    //    qaysi email ro'yxatdan o'tganini bilib olish mumkin edi.
    const vague = () =>
      res.status(400).json({
        success: false,
        error: "Tiklab bo'lmadi — ma'lumotlarni tekshiring",
      });

    if (!teacher) return vague();
    if (!(await teacher.comparePassword(password))) return vague();
    if (!teacher.deletionScheduledFor) return vague();

    // Muhlat o'tib ketgan bo'lsa ham cron hali yetib bormagan
    // bo'lishi mumkin. Bu holatda tiklashga ruxsat bermaymiz —
    // aks holda "30 kun" va'dasi yolg'on bo'lardi.
    if (teacher.deletionScheduledFor <= new Date()) {
      return res.status(410).json({
        success: false,
        error: "Tiklash muddati o'tib ketgan",
      });
    }

    teacher.deletionRequestedAt = null;
    teacher.deletionScheduledFor = null;
    await teacher.save();

    console.log(`[account] hisob tiklandi: ${teacher.email}`);

    return res.json({
      success: true,
      message: "Hisob tiklandi — endi tizimga kirishingiz mumkin",
    });
  } catch (err) {
    console.error("restoreAccount error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/teacher/account/deletion-status
 * Profil sahifasi holatni ko'rsatishi uchun.
 */
const deletionStatus = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, error: "Faqat direktor uchun" });
    }
    const teacher = await Teacher.findById(req.user.id).select(
      "deletionRequestedAt deletionScheduledFor",
    );
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }
    return res.json({
      success: true,
      pending: Boolean(teacher.deletionScheduledFor),
      deletionRequestedAt: teacher.deletionRequestedAt,
      deletionScheduledFor: teacher.deletionScheduledFor,
      graceDays: GRACE_DAYS,
    });
  } catch (err) {
    console.error("deletionStatus error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Muhlati o'tgan hisoblarni butunlay o'chirish.
 * cron/accountCleanupCron.js chaqiradi. Qo'lda ham chaqirish mumkin.
 */
async function purgeExpiredAccounts() {
  const due = await Teacher.find({
    deletionScheduledFor: { $ne: null, $lte: new Date() },
  }).select("_id email");

  const results = [];
  for (const t of due) {
    try {
      const counts = await purgeDirector(t._id);
      console.log(`[account] butunlay o'chirildi: ${t.email}`, counts);
      results.push({ email: t.email, ok: true, counts });
    } catch (err) {
      // Bittasi yiqilsa qolganlari davom etsin
      console.error(`[account] o'chirishda xato: ${t.email}`, err.message);
      results.push({ email: t.email, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  requestDeletion,
  restoreAccount,
  deletionStatus,
  purgeExpiredAccounts,
  GRACE_DAYS,
  CONFIRM_WORD,
};
