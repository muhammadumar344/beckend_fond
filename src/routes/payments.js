// src/routes/payments.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.post('/create-monthly', subscriptionMiddleware, paymentController.createMonthlyPayments);
router.put('/:paymentId/status', subscriptionMiddleware, paymentController.updatePaymentStatus);
router.get('/unpaid/:classId', subscriptionMiddleware, paymentController.getUnpaidPayments);
router.get('/summary/:classId', subscriptionMiddleware, paymentController.getPaymentSummary);

module.exports = router;