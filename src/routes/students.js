const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// Hamma o'quvchilar — faqat admin
router.get('/', adminMiddleware, studentController.getAllStudents);

// Sinf bo'yicha o'quvchilar — subscription tekshiruvi
router.get('/class/:classId', subscriptionMiddleware, studentController.getStudentsByClass);

// Talaba qo'shish — subscription tekshiruvi
router.post('/', subscriptionMiddleware, studentController.createStudent);

// Talaba tahrirlash
router.put('/:studentId', studentController.updateStudent);

// Talaba o'chirish
router.delete('/:studentId', studentController.deleteStudent);

module.exports = router;