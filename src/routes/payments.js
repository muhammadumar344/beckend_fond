// ============================================================================
// FILE: src/routes/payments.js
// ============================================================================

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.post('/create-monthly', subscriptionMiddleware, paymentController.createMonthlyPayments);

router.put('/:paymentId/status', paymentController.updatePaymentStatus);

router.get('/student/:studentId', paymentController.getStudentPaymentHistory);

router.get('/summary/:classId', subscriptionMiddleware, paymentController.getPaymentSummary);

router.get('/unpaid/:classId', subscriptionMiddleware, paymentController.getUnpaidPayments);

module.exports = router;