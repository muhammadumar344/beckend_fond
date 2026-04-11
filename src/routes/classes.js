// ============================================================================
// FILE: src/routes/classes.js
// ============================================================================

const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.get('/', classController.getAllClasses);

router.post('/', adminMiddleware, classController.createClass);

router.put('/:classId', adminMiddleware, classController.updateClass);

router.delete('/:classId', adminMiddleware, classController.deleteClass);

router.get('/:classId/report', subscriptionMiddleware, classController.getClassReport);

module.exports = router;