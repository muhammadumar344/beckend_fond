// backend/src/routes/admin.js
const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const adminRole = require('../middleware/roles');

const router = express.Router();

router.use(auth, adminRole('admin'));

router.get('/dashboard', adminController.getDashboard);
router.put('/teachers/:teacherId/password', adminController.updateTeacherPassword);
router.put('/teachers/:teacherId/plan', adminController.updateTeacherPlan);
router.put('/teachers/:teacherId/deactivate', adminController.deactivateTeacher);

module.exports = router;