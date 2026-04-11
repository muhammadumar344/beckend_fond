// ============================================================================
// FILE: src/routes/teacher.js
// ============================================================================

const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const expenseController = require('../controllers/expenseController');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.get('/amount-check', teacherController.checkAmountConfigured);

router.post('/set-amount', teacherController.setDefaultAmount);

router.get('/dashboard', subscriptionMiddleware, teacherController.getTeacherDashboard);

router.get('/report', subscriptionMiddleware, teacherController.getMyClassReport);

router.post('/payments/create', subscriptionMiddleware, teacherController.createMonthlyPaymentsForMyClass);

router.put('/payments/:paymentId/status', subscriptionMiddleware, teacherController.updateMyPaymentStatus);

router.post('/expenses', subscriptionMiddleware, expenseController.createExpense);

router.get('/expenses/monthly', subscriptionMiddleware, expenseController.getExpensesByMonth);

router.get('/expenses/yearly', subscriptionMiddleware, expenseController.getYearlySummary);

router.delete('/expenses/:expenseId', subscriptionMiddleware, expenseController.deleteExpense);

module.exports = router;