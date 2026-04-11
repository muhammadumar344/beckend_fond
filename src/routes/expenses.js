const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// Xarajat qo'shish (plus va pro rejim)
router.post('/', subscriptionMiddleware, expenseController.createExpense);

// Oy bo'yicha xarajatlar
router.get('/:classId', subscriptionMiddleware, expenseController.getExpensesByMonth);

// Yillik summary
router.get('/:classId/yearly', subscriptionMiddleware, expenseController.getYearlySummary);

// Xarajat o'chirish
router.delete('/:expenseId', expenseController.deleteExpense);

module.exports = router;