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

// Parol tiklash — ✅ TUZATILDI: endi Teacher (Direktor) VA Staff ikkalasi
// uchun ham ishlaydi (yo'l nomi tarixiy sabablarga ko'ra "/staff/..." bo'lib
// qolgan, lekin controller ichida ikkala jadval ham tekshiriladi)
router.post("/staff/forgot-password", staffCtrl.forgotPassword);
router.post("/staff/reset-password/:token", staffCtrl.resetPasswordByToken);

// O'z parolini o'zgartirish (login kerak)
router.post("/staff/change-password", auth, staffCtrl.changeOwnPassword);

// O'z profilini ko'rish (login kerak)
router.get("/staff/me", auth, staffCtrl.getMyProfile);
router.post('/teacher/register',     authController.teacherRegister)
router.post('/login', authController.unifiedLogin)
router.post('/teacher/verify-email', authController.verifyTeacherEmail)
router.post('/teacher/resend-code',  authController.resendVerificationCode)

module.exports = router;