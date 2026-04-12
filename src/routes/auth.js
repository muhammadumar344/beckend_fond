// backend/src/routes/auth.js
const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

router.post('/admin/login', authController.adminLogin);
router.post('/teacher/login', authController.teacherLogin);
router.post('/admin/register-teacher', authController.adminRegisterTeacher);

module.exports = router;