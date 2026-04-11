const Subscription = require('../models/Subscription');
const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');

// ================================
// SUBSCRIPTION HOLATINI TEKSHIRISH
// Frontend har login da shu endpoint ni chaqiradi
// ================================
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
      // Frontend bu flagga qarab modal chiqaradi
      showWarning: daysLeft <= 3 && !isExpired,
      warningMessage: daysLeft <= 3 && !isExpired
        ? `Obunangiz ${daysLeft} kundan so'ng tugaydi. To'lov qiling!`
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SINF O'ZI RAD ETDI — "Saytdan foydalanmaymiz" button
// Sinf va barcha ma'lumotlari o'chiriladi
// ================================
exports.selfDeactivate = async (req, res) => {
  try {
    const { classId } = req.params;

    // Faqat o'sha sinfning teacheri o'chira oladi
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    if (req.user.role === 'teacher' && cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    // Cascade o'chirish
    const students = await Student.find({ class: classId });
    const studentIds = students.map((s) => s._id);

    await MonthlyPayment.deleteMany({ class: classId });
    await Expense.deleteMany({ class: classId });
    await Student.deleteMany({ class: classId });

    // Subscription ni deactivate qilish
    await Subscription.findOneAndUpdate(
      { class: classId },
      { isActive: false, selfDeactivated: true }
    );

    // Sinfni o'chirish
    await Class.findByIdAndDelete(classId);

    res.json({ message: 'Sinf va barcha ma\'lumotlar o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TO'LOV QILISH NIYATI — "To'lov qilamiz" button
// Sinfni ochmaydi, faqat admin kutadi
// ================================
exports.requestPayment = async (req, res) => {
  try {
    const { classId } = req.params;

    const subscription = await Subscription.findOne({ class: classId });
    if (!subscription) return res.status(404).json({ error: 'Subscription topilmadi' });

    // Frontend login sahifasiga yo'naltiradi, admin to'lovni qabul qilib
    // setSubscription endpoint ni chaqiradi

    res.json({
      message: 'To\'lov so\'rovi qabul qilindi. Login sahifasiga o\'ting.',
      redirectToLogin: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// OY OHIRI ESLATMA — to'lamaganlar ro'yxati
// ================================
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
    }).populate('student', 'name');

    const totalExpected = await MonthlyPayment.find({ class: classId, month: currentMonth, year: currentYear });
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