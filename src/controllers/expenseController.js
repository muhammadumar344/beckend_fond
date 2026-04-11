// src/controllers/expenseController.js
const Expense = require('../models/Expense');
const Class = require('../models/Class');
const MonthlyPayment = require('../models/MonthlyPayment');

const getTeacherClass = async (teacherId) => {
  return await Class.findOne({ teacher: teacherId });
};

exports.createExpenseForTeacher = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Faqat teacher xarajat qo\'sha oladi' });
    }

    const { reason, amount, month, year, description } = req.body;

    if (!reason || !amount || !month || !year) {
      return res.status(400).json({ error: 'reason, amount, month, year majburiy' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Summa 0 dan katta bo\'lishi kerak' });
    }

    const cls = await getTeacherClass(req.user.id);
    if (!cls) {
      return res.status(404).json({ error: 'Sizga tegishli sinf topilmadi' });
    }

    const expense = new Expense({
      class: cls._id,
      reason,
      amount,
      month: parseInt(month),
      year: parseInt(year),
      description,
    });
    await expense.save();

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeacherExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const cls = await getTeacherClass(req.user.id);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const expenses = await Expense.find({
      class: cls._id,
      month: currentMonth,
      year: currentYear,
    }).sort({ createdAt: -1 });

    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ month: currentMonth, year: currentYear, expenses, totalAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTeacherExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);

    if (!expense) {
      return res.status(404).json({ error: 'Xarajat topilmadi' });
    }

    const cls = await getTeacherClass(req.user.id);
    if (!cls || expense.class.toString() !== cls._id.toString()) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    await expense.deleteOne();

    res.json({ message: 'Xarajat o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};