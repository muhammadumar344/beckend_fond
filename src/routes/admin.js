// ============================================================================
// FILE: src/routes/admin.js
// ============================================================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/setup', adminController.createAdmin);

router.use(authMiddleware, adminMiddleware);

router.put('/change-password/:adminId', adminController.changeAdminPassword);

router.post('/teachers', adminController.createTeacher);
router.get('/teachers', adminController.getAllTeachers);
router.get('/teachers/:teacherId', adminController.getTeacherById);
router.get('/teachers/:teacherId/stats', adminController.getTeacherStats);
router.put('/teachers/:teacherId/reset-password', adminController.resetTeacherPassword);
router.delete('/teachers/:teacherId', adminController.deleteTeacher);

router.post('/subscription/:classId', adminController.setSubscription);
router.get('/subscriptions', adminController.getAllSubscriptions);
router.put('/subscription/:classId/deactivate', adminController.deactivateSubscription);
router.put('/subscription/:classId/activate', adminController.activateSubscription);

router.get('/dashboard', adminController.getDashboard);
router.get('/stats', adminController.getAdminStats);
router.get('/class-report/:classId', adminController.getClassReport);

module.exports = router;