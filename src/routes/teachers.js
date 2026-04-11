const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const subscriptionMiddleware = require('../middleware/subscriptionMiddleware');

router.use(authMiddleware);

// ─── SETUP ────────────────────────────────────────────────────────────────
// Login dan keyin frontend shu endpointni tekshiradi
// Agar isConfigured = false bo'lsa, modal chiqarib summa so'raydi
router.get('/amount-check', teacherController.checkAmountConfigured);

// Font puli miqdorini o'rnatish yoki yangilash
router.post('/set-amount', teacherController.setDefaultAmount);

// ─── DASHBOARD ────────────────────────────────────────────────────────────
// Faqat o'z sinfi, balans, joriy oy ma'lumotlari
router.get('/dashboard', subscriptionMiddleware, teacherController.getTeacherDashboard);

// ─── HISOBOT ─────────────────────────────────────────────────────────────
// O'z sinfi uchun oy hisoboti (o'quvchilar + to'lov holati)
router.get('/report', subscriptionMiddleware, teacherController.getMyClassReport);

// ─── TO'LOVLAR ────────────────────────────────────────────────────────────
// Oy boshida barcha o'quvchilar uchun to'lov yaratish (default summa bilan)
router.post('/payments/create', subscriptionMiddleware, teacherController.createMonthlyPaymentsForMyClass);

// To'lov statusini o'zgartirish: paid / not_paid
router.put('/payments/:paymentId/status', subscriptionMiddleware, teacherController.updateMyPaymentStatus);

// ─── XARAJATLAR ───────────────────────────────────────────────────────────
// Xarajat qo'shish (faqat teacher)
router.post('/expenses', subscriptionMiddleware, expenseController.createExpense);

// Oy bo'yicha xarajatlar
router.get('/expenses', subscriptionMiddleware, expenseController.getExpensesByMonth);

// Yillik summary
router.get('/expenses/yearly', subscriptionMiddleware, expenseController.getYearlySummary);

// Xarajat o'chirish
router.delete('/expenses/:expenseId', subscriptionMiddleware, expenseController.deleteExpense);

module.exports = router;