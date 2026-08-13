const express = require("express");
const authController = require("../controllers/authController");
const staffCtrl = require("../controllers/staffController");
const auth = require("../middleware/auth");
const router = express.Router();

router.get("/setup/check", authController.checkSetup);
router.post("/setup", authController.createAdmin);

router.post("/admin/login", authController.adminLogin);
router.post("/teacher/login", authController.teacherLogin);

// ✅ TUZATILDI: staffLogin authController'da, staffController'da emas
router.post("/staff/login", authController.staffLogin);

// Email tasdiqlash (token URL'da)
router.get("/staff/verify/:token", staffCtrl.verifyEmail);

// ── Parol tiklash — DIREKTOR va XODIM uchun birga ───────────
// ⚠️ Eski `/staff/*` manzillari FAQAT Staff kolleksiyasidan qidirardi,
//    shuning uchun direktor parolni umuman tiklay olmasdi. Endi ikkalasi
//    ham yangi controller'ga boradi (controllers/passwordResetController.js).
//    Eski manzillar alias sifatida qoldirildi — eski frontend keshi
//    bo'lgan foydalanuvchilarda ham ishlashi uchun.
const pwReset = require("../controllers/passwordResetController");

router.post("/forgot-password", pwReset.forgotPassword);
router.post("/reset-password/:token", pwReset.resetPassword);

// Eski manzillar (alias) — o'chirmang, eski build'lar shularni chaqiradi
router.post("/staff/forgot-password", pwReset.forgotPassword);
router.post("/staff/reset-password/:token", pwReset.resetPassword);

// O'z parolini o'zgartirish (login kerak)
router.post("/staff/change-password", auth, staffCtrl.changeOwnPassword);

// O'z profilini ko'rish (login kerak)
router.get("/staff/me", auth, staffCtrl.getMyProfile);
router.post('/teacher/register',     authController.teacherRegister)
// Direktor o'z parolini o'zgartiradi (login kerak)
router.post('/teacher/change-password', auth, authController.teacherChangePassword)
router.post('/login', authController.unifiedLogin)
router.post('/teacher/verify-email', authController.verifyTeacherEmail)
router.post('/teacher/resend-code',  authController.resendVerificationCode)

module.exports = router;