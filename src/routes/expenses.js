// ============================================================================
// FILE: src/routes/expenses.js
// ============================================================================

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

router.post('/', subscriptionMiddleware, expenseController.createExpense);

router.delete('/:expenseId', expenseController.deleteExpense);

router.get('/monthly/:classId', subscriptionMiddleware, expenseController.getExpensesByMonth);

router.get('/yearly/:classId', subscriptionMiddleware, expenseController.getYearlySummary);

module.exports = router;