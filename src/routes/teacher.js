// backend/src/routes/teacher.js
const express = require('express');
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const teacherRole = require('../middleware/roles');

const router = express.Router();

router.use(auth, teacherRole('teacher'));

// Classes
router.post('/classes', teacherController.createClass);
router.get('/classes', teacherController.getMyClasses);
router.put('/classes/:classId/amount', teacherController.updateClassDefaultAmount);
router.delete('/classes/:classId', teacherController.deleteClass);

// Students
router.post('/classes/:classId/students', teacherController.addStudent);
router.get('/classes/:classId/students', teacherController.getClassStudents);
router.delete('/students/:studentId', teacherController.deleteStudent);

// Payments
router.post('/payments/create-monthly', teacherController.createMonthlyPayments);
router.get('/payments', teacherController.getMonthlyPayments);
router.put('/payments/:paymentId/status', teacherController.updatePaymentStatus);

// Expenses
router.post('/expenses', teacherController.addExpense);
router.get('/expenses', teacherController.getExpenses);
router.delete('/expenses/:expenseId', teacherController.deleteExpense);

// Dashboard
router.get('/dashboard', teacherController.getDashboard);

module.exports = router;