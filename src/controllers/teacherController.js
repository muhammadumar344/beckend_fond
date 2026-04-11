const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');
const Subscription = require('../models/Subscription');

// ─── YORDAMCHI: teacher o'z sinfiga egaligini tekshirish ──────────────────
const checkClassOwnership = async (teacherId, classId) => {
  const cls = await Class.findOne({ _id: classId, teacher: teacherId });
  return cls;
};

// ================================
// DEFAULT FONT PULINI O'RNATISH
// Teacher birinchi login da yoki keyinchalik o'zgartirishi mumkin
// ================================
exports.setDefaultAmount = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Summa 0 dan katta bo\'lishi kerak' });
    }

    // Teacher ning sinfi
    const cls = await Class.findOne({ teacher: req.user.id });
    if (!cls) {
      return res.status(404).json({ error: 'Sizga tegishli sinf topilmadi' });
    }

    cls.defaultPaymentAmount = amount;
    cls.isAmountConfigured = true;
    await cls.save();

    res.json({
      message: 'Default font puli o\'rnatildi',
      classId: cls._id,
      className: cls.name,
      defaultPaymentAmount: cls.defaultPaymentAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// DEFAULT SUMMA O'RNATILGANMI TEKSHIRISH
// Frontend login dan keyin shu endpoint ni chaqiradi
// Agar isAmountConfigured = false bo'lsa, modal chiqaradi
// ================================
exports.checkAmountConfigured = async (req, res) => {
  try {
    const cls = await Class.findOne({ teacher: req.user.id });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    res.json({
      isConfigured: cls.isAmountConfigured,
      defaultPaymentAmount: cls.defaultPaymentAmount,
      classId: cls._id,
      className: cls.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER DASHBOARD
// Faqat o'z sinfi — boshqa sinflar ko'rinmaydi
// ================================
exports.getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Faqat o'z sinfi
    const cls = await Class.findOne({ teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sizga tegishli sinf topilmadi' });
    }

    const classId = cls._id;

    // Subscription holati
    const subscription = await Subscription.findOne({ class: classId });

    // O'quvchilar soni
    const totalStudents = await Student.countDocuments({ class: classId, isActive: true });

    // ── BARCHA DAVRLAR UCHUN JAMI TUSHUMLAR ──────────────────
    // Paid bo'lgan barcha to'lovlar yig'indisi (hech qanday oy filtri yo'q)
    const allPaidPayments = await MonthlyPayment.find({
      class: classId,
      status: 'paid',
    });
    const totalCollectedAllTime = allPaidPayments.reduce((s, p) => s + p.amount, 0);

    // ── BARCHA DAVRLAR UCHUN JAMI XARAJATLAR ─────────────────
    const allExpenses = await Expense.find({ class: classId });
    const totalExpensesAllTime = allExpenses.reduce((s, e) => s + e.amount, 0);

    // ── BALANS (fond) ─────────────────────────────────────────
    const balance = totalCollectedAllTime - totalExpensesAllTime;

    // ── JORIY OY MA'LUMOTLARI ────────────────────────────────
    const currentMonthPayments = await MonthlyPayment.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    });
    const currentMonthPaid = currentMonthPayments.filter(p => p.status === 'paid');
    const currentMonthUnpaid = currentMonthPayments.filter(p => p.status === 'not_paid');

    const currentMonthCollected = currentMonthPaid.reduce((s, p) => s + p.amount, 0);
    const currentMonthExpenses = allExpenses
      .filter(e => e.month === currentMonth && e.year === currentYear)
      .reduce((s, e) => s + e.amount, 0);

    // ── SO'NGGI 5 XARAJAT ─────────────────────────────────────
    const recentExpenses = await Expense.find({ class: classId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      class: {
        id: cls._id,
        name: cls.name,
        plan: cls.plan,
        isActive: cls.isActive,
        defaultPaymentAmount: cls.defaultPaymentAmount,
        isAmountConfigured: cls.isAmountConfigured,
      },
      subscription: subscription ? {
        plan: subscription.plan,
        expiryDate: subscription.expiryDate,
        daysLeft: subscription.daysLeft(),
        isExpired: subscription.isExpired(),
      } : null,
      students: {
        total: totalStudents,
      },
      finance: {
        // Barcha davrlar uchun jami
        totalCollectedAllTime,
        totalExpensesAllTime,
        balance,                         // fond puli = tushumlar - xarajatlar

        // Joriy oy
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          collected: currentMonthCollected,
          expenses: currentMonthExpenses,
          paidCount: currentMonthPaid.length,
          unpaidCount: currentMonthUnpaid.length,
          totalStudents: currentMonthPayments.length,
        },
      },
      recentExpenses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER O'Z SINFINING OY HISOBOTINI OLISH
// ================================
exports.getMyClassReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    // Faqat o'z sinfi
    const cls = await Class.findOne({ teacher: req.user.id });
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    const classId = cls._id;

    const students = await Student.find({ class: classId, isActive: true });

    const payments = await MonthlyPayment.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    });

    const expenses = await Expense.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    });

    const report = students.map(student => {
      const payment = payments.find(
        p => p.student.toString() === student._id.toString()
      );
      return {
        studentId: student._id,
        name: student.name,
        parentPhone: student.parentPhone,
        status: payment ? payment.status : 'not_paid',
        amount: payment ? payment.amount : 0,
        paymentId: payment ? payment._id : null,
        paidDate: payment ? payment.paidDate : null,
      };
    });

    const paidList = report.filter(r => r.status === 'paid');
    const unpaidList = report.filter(r => r.status === 'not_paid');
    const totalCollected = paidList.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      class: { id: cls._id, name: cls.name, defaultPaymentAmount: cls.defaultPaymentAmount },
      month: currentMonth,
      year: currentYear,
      summary: {
        total: students.length,
        paidCount: paidList.length,
        unpaidCount: unpaidList.length,
        totalCollected,
        totalExpenses,
        netBalance: totalCollected - totalExpenses,
      },
      report,
      expenses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// OY BOSHLANGANDA BARCHA O'QUVCHILAR UCHUN TO'LOV YARATISH
// Default summa avtomatik qo'llaniladi
// ================================
exports.createMonthlyPaymentsForMyClass = async (req, res) => {
  try {
    const { month, year } = req.body;
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const cls = await Class.findOne({ teacher: req.user.id });
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    if (!cls.isAmountConfigured || cls.defaultPaymentAmount <= 0) {
      return res.status(400).json({
        error: 'Avval default font puli miqdorini belgilang',
      });
    }

    const students = await Student.find({ class: cls._id, isActive: true });
    if (students.length === 0) {
      return res.status(400).json({ error: 'Sinfda o\'quvchi yo\'q' });
    }

    const operations = students.map(student => ({
      updateOne: {
        filter: {
          student: student._id,
          class: cls._id,
          month: currentMonth,
          year: currentYear,
        },
        update: {
          $setOnInsert: {
            student: student._id,
            class: cls._id,
            month: currentMonth,
            year: currentYear,
            amount: cls.defaultPaymentAmount,
            status: 'not_paid',
          },
        },
        upsert: true,
      },
    }));

    const result = await MonthlyPayment.bulkWrite(operations);

    res.status(201).json({
      message: 'Oylik to\'lovlar yaratildi',
      month: currentMonth,
      year: currentYear,
      defaultAmount: cls.defaultPaymentAmount,
      studentsCount: students.length,
      created: result.upsertedCount,
      alreadyExisted: students.length - result.upsertedCount,
      expectedTotal: cls.defaultPaymentAmount * students.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TO'LOV STATUSINI O'ZGARTIRISH
// Teacher faqat o'z sinfidagi to'lovni o'zgartira oladi
// ================================
exports.updateMyPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!['paid', 'not_paid'].includes(status)) {
      return res.status(400).json({ error: 'Status: paid yoki not_paid bo\'lishi kerak' });
    }

    // Teacher o'z sinfiga egaligini tekshirish
    const cls = await Class.findOne({ teacher: req.user.id });
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    const payment = await MonthlyPayment.findOne({
      _id: paymentId,
      class: cls._id,  // faqat o'z sinfi
    });

    if (!payment) {
      return res.status(404).json({ error: 'To\'lov topilmadi yoki ruxsat yo\'q' });
    }

    payment.status = status;
    payment.paidDate = status === 'paid' ? new Date() : null;
    await payment.save();

    // Joriy balansni qaytarish
    const allPaid = await MonthlyPayment.find({ class: cls._id, status: 'paid' });
    const allExpenses = await Expense.find({ class: cls._id });
    const balance = allPaid.reduce((s, p) => s + p.amount, 0) -
                    allExpenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      payment,
      updatedBalance: balance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};