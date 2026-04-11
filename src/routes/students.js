// src/routes/students.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.get('/', subscriptionMiddleware, studentController.getStudentsByClass);
router.post('/', subscriptionMiddleware, studentController.createStudent);
router.put('/:studentId', subscriptionMiddleware, studentController.updateStudent);
router.delete('/:studentId', subscriptionMiddleware, studentController.deleteStudent);

module.exports = router;