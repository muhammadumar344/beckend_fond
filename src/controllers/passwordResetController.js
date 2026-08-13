// src/controllers/passwordResetController.js
// ════════════════════════════════════════════════════════════
// Parolni tiklash — DIREKTOR va XODIM uchun birga.
//
// ⚠️ NEGA ALOHIDA FAYL: ilgari bu oqim `staffController` ichida
//    edi va faqat `Staff` kolleksiyasidan qidirardi. Direktor
//    (Teacher) parolni unutsa:
//
//      1. "Parolni unutdingizmi?" formasi ishlaydi
//      2. Staff'dan qidiriladi — topilmaydi
//      3. Xavfsizlik uchun baribir "xat yuborildi" deb javob beriladi
//      4. Xat hech qachon kelmaydi
//
//    Ya'ni direktorda parolni tiklash imkoni UMUMAN yo'q edi, lekin
//    interfeys "yuborildi" deb turardi. Xato jimgina yutilardi.
//
// Endi ikkala kolleksiya ham qidiriladi. Javob matni o'zgarmadi —
// "email bor yoki yo'q"ligini oshkor qilmaslik ataylab (aks holda
// qaysi email ro'yxatda borligini tashqaridan bilib olish mumkin).
// Lekin server logida aniq yoziladi.
// ════════════════════════════════════════════════════════════
const crypto = require("crypto");
const Teacher = require("../models/Teacher");
const Staff = require("../models/Staff");
const { sendPasswordResetEmail } = require("../services/emailService");

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 soat

// Javob har doim bir xil — email bor-yo'qligi oshkor bo'lmasin
const VAGUE = "Agar email mavjud bo'lsa, tiklash xati yuborildi";

/** FRONTEND_URL dan toza asosiy manzil */
function baseUrl() {
  return (process.env.FRONTEND_URL || "https://schoolfonds.netlify.app")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Emailni ikkala kolleksiyadan qidiradi.
 * Direktor birinchi — u muassasa egasi, ustunlik unda.
 */
async function findAccount(email) {
  const teacher = await Teacher.findOne({ email });
  if (teacher) return { doc: teacher, kind: "teacher" };

  const staff = await Staff.findOne({ email });
  if (staff) return { doc: staff, kind: "staff" };

  return null;
}

// ── POST /api/auth/forgot-password ───────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email majburiy" });
    }

    const normalized = String(email).toLowerCase().trim();
    const found = await findAccount(normalized);

    if (!found) {
      // Tashqariga bir xil javob, logda esa aniq sabab
      console.log(`[forgotPassword] topilmadi: ${normalized}`);
      return res.json({ success: true, message: VAGUE });
    }

    const { doc, kind } = found;

    // Bloklangan hisobga tiklash xati yubormaymiz
    if (doc.isActive === false) {
      console.log(`[forgotPassword] bloklangan hisob: ${normalized} (${kind})`);
      return res.json({ success: true, message: VAGUE });
    }

    const token = crypto.randomBytes(32).toString("hex");
    doc.resetPasswordToken = token;
    doc.resetPasswordExpires = new Date(Date.now() + TOKEN_TTL_MS);
    await doc.save();

    try {
      await sendPasswordResetEmail({
        toEmail: doc.email,
        name: doc.name,
        resetLink: `${baseUrl()}/reset-password/${token}`,
      });
      console.log(`[forgotPassword] xat yuborildi: ${normalized} (${kind})`);
    } catch (emailErr) {
      // ⚠️ Xat ketmasa ham foydalanuvchiga bir xil javob beramiz, lekin
      // bu JIDDIY xato — logda ko'rinib tursin
      console.error(
        `[forgotPassword] ❌ XAT KETMADI: ${normalized} (${kind}) —`,
        emailErr.message,
      );
    }

    return res.json({ success: true, message: VAGUE });
  } catch (err) {
    console.error("[forgotPassword]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/auth/reset-password/:token ─────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    // Frontend `password` yuboradi; `newPassword` ham qabul qilinadi
    const newPassword = req.body.password || req.body.newPassword;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ success: false, error: "Token va yangi parol majburiy" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Parol kamida 6 ta belgi bo'lishi kerak",
      });
    }

    const query = {
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    };
    // ⚠️ Ikkala maydon ham `select: false` — aniq so'ralmasa kelmaydi
    const select = "+resetPasswordToken +resetPasswordExpires";

    let doc = await Teacher.findOne(query).select(select);
    if (!doc) doc = await Staff.findOne(query).select(select);

    if (!doc) {
      return res.status(400).json({
        success: false,
        error: "Token noto'g'ri yoki muddati o'tgan (24 soat)",
      });
    }

    // pre('save') hook parolni o'zi hash qiladi — qo'lda hash QILMANG
    doc.password = newPassword;
    doc.resetPasswordToken = null;
    doc.resetPasswordExpires = null;
    await doc.save();

    console.log(`[resetPassword] parol yangilandi: ${doc.email}`);

    return res.json({
      success: true,
      message: "Parol muvaffaqiyatli yangilandi. Endi tizimga kirishingiz mumkin.",
    });
  } catch (err) {
    console.error("[resetPassword]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
