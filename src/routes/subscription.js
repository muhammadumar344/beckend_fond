// src/routes/subscription.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/check/:classId', subscriptionController.checkSubscription);
router.delete('/deactivate/:classId', subscriptionController.selfDeactivate);
router.post('/request-payment/:classId', subscriptionController.requestPayment);
router.get('/reminder/:classId', subscriptionController.getMonthlyReminder);

module.exports = router;