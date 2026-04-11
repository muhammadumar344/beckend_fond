// ============================================================================
// FILE: src/controllers/subscriptionController.js
// ============================================================================

const Subscription = require('../models/Subscription');
const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');

exports.checkSubscription = async (req, res) => {
  try {
    const { classId } = req.params;

    const subscription = await Subscription.findOne({ class: classId });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription topilmadi' });
    }

    const daysLeft = subscription.daysLeft();
    const isExpired = subscription.isExpired();

    res.json({
      isActive: subscription.isActive && !isExpired,
      isExpired,
      selfDeactivated: subscription.selfDeactivated,
      plan: subscription.plan,
      expiryDate: subscription.expiryDate,
      daysLeft,
      showWarning: daysLeft <= 3 && !isExpired,
      warningMessage: daysLeft <= 3 && !isExpired
        ? `Obunangiz ${daysLeft} kundan so'ng tugaydi. To'lov qiling!`
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.selfDeactivate = async (req, res) => {
  try {
    const { classId } = req.params;

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    if (req.user.role === 'teacher' && cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    const students = await Student.find({ class: classId });
    const studentIds = students.map((s) => s._id);

    await MonthlyPayment.deleteMany({ class: classId });
    await Expense.deleteMany({ class: classId });
    await Student.deleteMany({ class: classId });

    await Subscription.findOneAndUpdate(
      { class: classId },
      { isActive: false, selfDeactivated: true }
    );

    await Class.findByIdAndDelete(classId);

    res.json({ message: 'Sinf va barcha ma\'lumotlar o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.requestPayment = async (req, res) => {
  try {
    const { classId } = req.params;

    const subscription = await Subscription.findOne({ class: classId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription topilmadi' });
    }

    res.json({
      message: 'To\'lov so\'rovi qabul qilindi. Admin kutayapti.',
      redirectToLogin: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonthlyReminder = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const unpaidPayments = await MonthlyPayment.find({
      class: classId,
      status: 'not_paid',
      month: currentMonth,
      year: currentYear,
    }).populate('student', 'name parentPhone');

    const paidPayments = await MonthlyPayment.find({
      class: classId,
      status: 'paid',
      month: currentMonth,
      year: currentYear,
    });

    const totalExpected = await MonthlyPayment.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    });

    const totalAmount = totalExpected.reduce((s, p) => s + p.amount, 0);
    const paidAmount = paidPayments.reduce((s, p) => s + p.amount, 0);

    res.json({
      month: currentMonth,
      year: currentYear,
      unpaidCount: unpaidPayments.length,
      paidCount: paidPayments.length,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      unpaidStudents: unpaidPayments.map((p) => ({
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