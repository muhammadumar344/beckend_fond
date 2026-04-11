const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Subscription holatini tekshirish (frontend har login da chaqiradi)
router.get('/check/:classId', subscriptionController.checkSubscription);

// "Saytdan foydalanmaymiz" — sinfni o'chiradi
router.delete('/deactivate/:classId', subscriptionController.selfDeactivate);

// "To'lov qilamiz" — niyat bildirish
router.post('/request-payment/:classId', subscriptionController.requestPayment);

// Oy oxiri eslatma — to'lamaganlar ro'yhati
router.get('/reminder/:classId', subscriptionController.getMonthlyReminder);

module.exports = router;