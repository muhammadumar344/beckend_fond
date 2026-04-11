// src/routes/teacher.js
const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// Setup
router.get('/amount-check', teacherController.checkAmountConfigured);
router.post('/set-amount', teacherController.setDefaultAmount);

// Dashboard
router.get('/dashboard', subscriptionMiddleware, teacherController.getTeacherDashboard);

// Report
router.get('/report', subscriptionMiddleware, teacherController.getMyClassReport);

// Payments
router.post('/payments/create', subscriptionMiddleware, teacherController.createMonthlyPaymentsForMyClass);
router.put('/payments/:paymentId/status', subscriptionMiddleware, teacherController.updateMyPaymentStatus);

// Expenses
router.post('/expenses', subscriptionMiddleware, teacherController.createExpenseForTeacher);
router.get('/expenses', subscriptionMiddleware, teacherController.getTeacherExpenses);
router.delete('/expenses/:expenseId', subscriptionMiddleware, teacherController.deleteTeacherExpense);

module.exports = router;