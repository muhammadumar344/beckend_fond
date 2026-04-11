const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Admin yaratish — faqat bir marta (setup uchun)
router.post('/setup', adminController.createAdmin);

// Quyidagilar faqat admin uchun
router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', adminController.getDashboard);

// Teacher boshqaruvi
router.post('/teachers', adminController.createTeacher);
router.get('/teachers', adminController.getAllTeachers);
router.put('/teachers/:teacherId/reset-password', adminController.resetTeacherPassword);
router.delete('/teachers/:teacherId', adminController.deleteTeacher);

// Subscription belgilash
router.post('/subscription/:classId', adminController.setSubscription);

module.exports = router;