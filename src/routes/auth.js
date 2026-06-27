const express = require("express");
const authController = require("../controllers/authController");
const staffCtrl = require('../controllers/staffController');
const auth      = require('../middleware/auth');
const router = express.Router();

router.get("/setup/check", authController.checkSetup);
router.post("/setup", authController.createAdmin);
router.post("/staff/login", staffCtrl.staffLogin);

router.post("/admin/login", authController.adminLogin);
router.post("/teacher/login", authController.teacherLogin);
// Email tasdiqlash (token URL'da)
router.get('/staff/verify/:token', staffCtrl.verifyEmail);

// Parol tiklash
router.post('/staff/forgot-password',          staffCtrl.forgotPassword);
router.post('/staff/reset-password/:token',    staffCtrl.resetPasswordByToken);

// O'z parolini o'zgartirish (login kerak)
router.post('/staff/change-password', auth, staffCtrl.changeOwnPassword);

// O'z profilini ko'rish (login kerak)
router.get('/staff/me', auth, staffCtrl.getMyProfile);


module.exports = router;
