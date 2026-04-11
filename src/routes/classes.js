// src/routes/classes.js
const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.use(authMiddleware);

router.get('/', classController.getAllClasses);
router.post('/', adminMiddleware, classController.createClass);
router.put('/:classId', adminMiddleware, classController.updateClass);
router.delete('/:classId', adminMiddleware, classController.deleteClass);
router.get('/:classId/report', classController.getClassReport);

module.exports = router;