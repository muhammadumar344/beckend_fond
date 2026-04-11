const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// Oylik to'lovlarni yaratish (hamma not_paid bilan)
router.post('/create-monthly', subscriptionMiddleware, paymentController.createMonthlyPayments);

// To'lov statusini o'zgartirish: paid / not_paid
router.put('/:paymentId/status', paymentController.updatePaymentStatus);

// To'lanmaganlar ro'yhati
router.get('/unpaid/:classId', subscriptionMiddleware, paymentController.getUnpaidPayments);

// Oy bo'yicha jami hisobot
router.get('/summary/:classId', subscriptionMiddleware, paymentController.getPaymentSummary);

// Bir talabaning to'lov tarixi
router.get('/student/:studentId', paymentController.getStudentPaymentHistory);

module.exports = router;