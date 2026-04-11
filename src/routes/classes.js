const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// Barcha sinflar (admin — hamma, teacher — o'ziniki)
router.get('/', classController.getAllClasses);

// Sinf yaratish — faqat admin
router.post('/', adminMiddleware, classController.createClass);

// Sinf tahrirlash — faqat admin
router.put('/:classId', adminMiddleware, classController.updateClass);

// Sinf o'chirish — faqat admin
router.delete('/:classId', adminMiddleware, classController.deleteClass);

// Sinf hisoboti — subscription tekshiruvi bilan
router.get('/:classId/report', subscriptionMiddleware, classController.getClassReport);

module.exports = router;