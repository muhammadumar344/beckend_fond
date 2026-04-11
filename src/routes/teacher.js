// src/routes/teacher.js
const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Classes
router.post('/classes', teacherController.createClass);
router.get('/classes', teacherController.getMyClasses);
router.put('/classes/:classId', teacherController.updateMyClass);
router.delete('/classes/:classId', teacherController.deleteMyClass);
router.post('/classes/:classId/set-amount', teacherController.setDefaultAmount);

// Dashboard
router.get('/dashboard', teacherController.getTeacherDashboard);

// Plan
router.post('/select-plan', teacherController.selectPlan);

// Expenses - YANGI
router.get('/expenses', teacherController.getExpenses);
router.post('/expenses', teacherController.addExpense);
router.delete('/expenses/:expenseId', teacherController.deleteExpense);

// Students - YANGI
router.get('/students', teacherController.getStudents);
router.post('/students', teacherController.addStudent);
router.delete('/students/:studentId', teacherController.deleteStudent);

// Payments - YANGI
router.get('/payments', teacherController.getPayments);
router.post('/payments/create-monthly', teacherController.createMonthlyPayments);
router.put('/payments/:paymentId/status', teacherController.updatePaymentStatus);

module.exports = router;