// ============================================================================
// FILE: src/routes/students.js
// ============================================================================

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.get('/', adminMiddleware, studentController.getAllStudents);

router.get('/class/:classId', subscriptionMiddleware, studentController.getStudentsByClass);

router.post('/', subscriptionMiddleware, studentController.createStudent);

router.put('/:studentId', studentController.updateStudent);

router.delete('/:studentId', studentController.deleteStudent);

module.exports = router;