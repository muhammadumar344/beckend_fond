// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/admin/login', authController.adminLogin);
router.post('/teacher/login', authController.teacherLogin);
router.get('/me', require('../middleware/authMiddleware'), authController.getMe);

module.exports = router;