// src/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.use(authMiddleware, adminMiddleware);

// Teacher yaratish (ADMIN FAQAT)
router.post('/teachers', adminController.createTeacher);
router.get('/teachers', adminController.getAllTeachers);
router.get('/teachers/:teacherId', adminController.getTeacherById);
router.delete('/teachers/:teacherId', adminController.deleteTeacher);

// Subscription boshqaruvi
router.post('/subscription/:classId', adminController.setSubscription);
router.get('/subscriptions', adminController.getAllSubscriptions);
router.put('/subscription/:classId/activate', adminController.activateSubscription);
router.put('/subscription/:classId/deactivate', adminController.deactivateSubscription);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/stats', adminController.getAdminStats);

module.exports = router;