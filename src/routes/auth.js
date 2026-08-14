const express = require("express");
const authController = require("../controllers/authController");
const staffCtrl = require("../controllers/staffController");
const auth = require("../middleware/auth");
// ── So'rov cheklagichi ──────────────────────────────────────
// Parol tekshiriladigan HAR BIR manzil cheklanadi. Bittasini
// unutsak hujumchi o'sha eshikdan kiraveradi — shuning uchun
// quyida "login" so'zi uchraydigan joyning hammasida bor.
const {
  loginLimiter,
  loginByEmailLimiter,
  forgotLimiter,
  registerLimiter,
} = require("../middleware/rateLimit");

const router = express.Router();

router.get("/setup/check", authController.checkSetup);
router.post("/setup", registerLimiter, authController.createAdmin);

router.post("/admin/login", loginLimiter, loginByEmailLimiter, authController.adminLogin);
router.post("/teacher/login", loginLimiter, loginByEmailLimiter, authController.teacherLogin);

// ✅ TUZATILDI: staffLogin authController'da, staffController'da emas
router.post("/staff/login", loginLimiter, loginByEmailLimiter, authController.staffLogin);

// Email tasdiqlash (token URL'da)
router.get("/staff/verify/:token", staffCtrl.verifyEmail);

// ── Parol tiklash — DIREKTOR va XODIM uchun birga ───────────
// ⚠️ Eski `/staff/*` manzillari FAQAT Staff kolleksiyasidan qidirardi,
//    shuning uchun direktor parolni umuman tiklay olmasdi. Endi ikkalasi
//    ham yangi controller'ga boradi (controllers/passwordResetController.js).
//    Eski manzillar alias sifatida qoldirildi — eski frontend keshi
//    bo'lgan foydalanuvchilarda ham ishlashi uchun.
const pwReset = require("../controllers/passwordResetController");

router.post("/forgot-password", forgotLimiter, pwReset.forgotPassword);
router.post("/reset-password/:token", forgotLimiter, pwReset.resetPassword);

// Eski manzillar (alias) — o'chirmang, eski build'lar shularni chaqiradi
router.post("/staff/forgot-password", forgotLimiter, pwReset.forgotPassword);
router.post("/staff/reset-password/:token", forgotLimiter, pwReset.resetPassword);

// ── Hisobni tiklash (o'chirish muhlati ichida) ──────────────
// Login TALAB QILINMAYDI: o'chirish navbatidagi hisob kira olmaydi,
// shuning uchun bu yerda email+parol qaytadan so'raladi.
const accountCtrl = require("../controllers/accountController");
router.post("/restore-account", loginLimiter, loginByEmailLimiter, accountCtrl.restoreAccount);

// O'z parolini o'zgartirish (login kerak)
router.post("/staff/change-password", auth, staffCtrl.changeOwnPassword);

// O'z profilini ko'rish (login kerak)
router.get("/staff/me", auth, staffCtrl.getMyProfile);
router.post('/teacher/register',     registerLimiter, authController.teacherRegister)
// Direktor o'z parolini o'zgartiradi (login kerak)
router.post('/teacher/change-password', auth, authController.teacherChangePassword)
router.post('/login', loginLimiter, loginByEmailLimiter, authController.unifiedLogin)
router.post('/teacher/verify-email', loginLimiter, authController.verifyTeacherEmail)
router.post('/teacher/resend-code',  forgotLimiter, authController.resendVerificationCode)

module.exports = router;