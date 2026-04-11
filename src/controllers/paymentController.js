// src/controllers/paymentController.js
const MonthlyPayment = require('../models/MonthlyPayment');
const Student = require('../models/Student');
const Class = require('../models/Class');

exports.createMonthlyPayments = async (req, res) => {
  try {
    const { classId, month, year, amount } = req.body;

    if (!classId || !month || !year || !amount) {
      return res.status(400).json({ error: 'classId, month, year, amount majburiy' });
    }

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const students = await Student.find({ class: classId, isActive: true });
    if (students.length === 0) {
      return res.status(400).json({ error: 'Bu sinfda o\'quvchi yo\'q' });
    }

    const operations = students.map((student) => ({
      updateOne: {
        filter: { student: student._id, class: classId, month, year },
        update: {
          $setOnInsert: {
            student: student._id,
            class: classId,
            month,
            year,
            amount,
            status: 'not_paid',
          },
        },
        upsert: true,
      },
    }));

    const result = await MonthlyPayment.bulkWrite(operations);

    res.status(201).json({
      message: 'Oylik to\'lovlar yaratildi',
      created: result.upsertedCount,
      alreadyExisted: students.length - result.upsertedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!['paid', 'not_paid'].includes(status)) {
      return res.status(400).json({ error: 'Status: paid yoki not_paid bo\'lishi kerak' });
    }

    const payment = await MonthlyPayment.findByIdAndUpdate(
      paymentId,
      {
        status,
        paidDate: status === 'paid' ? new Date() : null,
      },
      { new: true }
    ).populate('student', 'name');

    if (!payment) {
      return res.status(404).json({ error: 'To\'lov topilmadi' });
    }

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnpaidPayments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const unpaid = await MonthlyPayment.find({
      class: classId,
      status: 'not_paid',
      month: currentMonth,
      year: currentYear,
    }).populate('student', 'name parentPhone');

    res.json({
      month: currentMonth,
      year: currentYear,
      count: unpaid.length,
      students: unpaid.map((p) => ({
        paymentId: p._id,
        studentId: p.student._id,
        name: p.student.name,
        parentPhone: p.student.parentPhone,
        amount: p.amount,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const all = await MonthlyPayment.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    });

    const paid = all.filter((p) => p.status === 'paid');
    const unpaid = all.filter((p) => p.status === 'not_paid');

    res.json({
      month: currentMonth,
      year: currentYear,
      total: all.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      collectedAmount: paid.reduce((s, p) => s + p.amount, 0),
      remainingAmount: unpaid.reduce((s, p) => s + p.amount, 0),
      summary: {
        totalCollected: paid.reduce((s, p) => s + p.amount, 0),
        unpaidCount: unpaid.length,
        totalExpenses: 0, // Keling expenselardan hisoblab olish
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};