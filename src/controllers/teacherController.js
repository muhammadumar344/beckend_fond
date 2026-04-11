// src/controllers/teacherController.js
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');

const PLAN_LIMITS = {
  free: { classes: 1, students: 30 },
  plus: { classes: 4, students: 100 },
  pro: { classes: Infinity, students: Infinity }
};

// ============= CLASSES =============

exports.createClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Sinf nomi majburiy' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    const limit = PLAN_LIMITS[teacher.plan];
    const classCount = await Class.countDocuments({ teacher: teacherId });

    if (classCount >= limit.classes) {
      return res.status(400).json({
        error: `${teacher.plan} rejimda maksimal ${limit.classes} ta sinf ochishingiz mumkin`
      });
    }

    const newClass = new Class({
      name: name.trim(),
      description: description || '',
      teacher: teacherId,
      plan: teacher.plan
    });

    await newClass.save();

    res.status(201).json({
      message: 'Sinf muvaffaqiyatli yaratildi',
      class: {
        _id: newClass._id,
        name: newClass.name,
        description: newClass.description,
        plan: newClass.plan
      }
    });
  } catch (err) {
    console.error('Create class xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMyClasses = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const classes = await Class.find({ teacher: teacherId }).sort({ createdAt: -1 });

    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments({ class: cls._id, isActive: true });
        const paidPayments = await MonthlyPayment.countDocuments({
          class: cls._id,
          status: 'paid'
        });

        return {
          _id: cls._id,
          name: cls.name,
          description: cls.description,
          plan: cls.plan,
          studentCount,
          paidPayments,
          defaultPaymentAmount: cls.defaultPaymentAmount,
          isAmountConfigured: cls.isAmountConfigured,
          createdAt: cls.createdAt
        };
      })
    );

    res.json({
      total: classesWithStats.length,
      classes: classesWithStats
    });
  } catch (err) {
    console.error('Get classes xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateMyClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId } = req.params;
    const { name, description } = req.body;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    if (name) cls.name = name.trim();
    if (description !== undefined) cls.description = description;

    await cls.save();

    res.json({
      message: 'Sinf yangilandi',
      class: cls
    });
  } catch (err) {
    console.error('Update class xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMyClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId } = req.params;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    await MonthlyPayment.deleteMany({ class: classId });
    await Expense.deleteMany({ class: classId });
    await Student.deleteMany({ class: classId });
    await Class.findByIdAndDelete(classId);

    res.json({
      message: 'Sinf va barcha ma\'lumotlar o\'chirildi',
      deletedClass: { _id: cls._id, name: cls.name }
    });
  } catch (err) {
    console.error('Delete class xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.setDefaultAmount = async (req, res) => {
  try {
    const { classId } = req.params;
    const { amount } = req.body;
    const teacherId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Summa 0 dan katta bo\'lishi kerak' });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    cls.defaultPaymentAmount = amount;
    cls.isAmountConfigured = true;
    await cls.save();

    res.json({
      message: 'Default summa o\'rnatildi',
      class: {
        _id: cls._id,
        name: cls.name,
        defaultPaymentAmount: cls.defaultPaymentAmount
      }
    });
  } catch (err) {
    console.error('Set amount xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============= STUDENTS =============

exports.getStudents = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    const students = await Student.find({ class: { $in: classIds }, isActive: true });

    res.json({
      total: students.length,
      students
    });
  } catch (err) {
    console.error('Get students xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.addStudent = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { name, classId, parentPhone } = req.body;

    if (!name || !classId) {
      return res.status(400).json({ error: 'Ism va sinf majburiy' });
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    const teacher = await Teacher.findById(teacherId);
    const limit = PLAN_LIMITS[teacher.plan];
    const studentCount = await Student.countDocuments({
      class: { $in: await Class.find({ teacher: teacherId }).select('_id') }
    });

    if (studentCount >= limit.students) {
      return res.status(400).json({
        error: `${teacher.plan} rejimda maksimal ${limit.students} ta talaba qo\'shishingiz mumkin`
      });
    }

    const student = new Student({
      name: name.trim(),
      class: classId,
      parentPhone: parentPhone || '',
      isActive: true
    });

    await student.save();

    res.status(201).json({
      message: 'Talaba qo\'shildi',
      student
    });
  } catch (err) {
    console.error('Add student xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Talaba topilmadi' });
    }

    const cls = await Class.findOne({ _id: student.class, teacher: teacherId });
    if (!cls) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    await Student.findByIdAndDelete(studentId);
    await MonthlyPayment.deleteMany({ student: studentId });

    res.json({ message: 'Talaba o\'chirildi' });
  } catch (err) {
    console.error('Delete student xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============= EXPENSES =============

exports.getExpenses = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { month, year } = req.query;

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    let query = { class: { $in: classIds } };
    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const expenses = await Expense.find(query).sort({ createdAt: -1 });
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      expenses,
      totalAmount
    });
  } catch (err) {
    console.error('Get expenses xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { reason, amount, month, year, description } = req.body;

    if (!reason || !amount) {
      return res.status(400).json({ error: 'Sabab va summa majburiy' });
    }

    const classes = await Class.find({ teacher: teacherId });
    if (classes.length === 0) {
      return res.status(400).json({ error: 'Avval sinf yaratash kerak' });
    }

    const now = new Date();
    const expense = new Expense({
      class: classes[0]._id,
      reason: reason.trim(),
      amount,
      month: month || now.getMonth() + 1,
      year: year || now.getFullYear(),
      description: description || '',
      createdAt: now
    });

    await expense.save();

    res.status(201).json({
      message: 'Xarajat qo\'shildi',
      expense
    });
  } catch (err) {
    console.error('Add expense xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findByIdAndDelete(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Xarajat topilmadi' });
    }

    res.json({ message: 'Xarajat o\'chirildi' });
  } catch (err) {
    console.error('Delete expense xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============= PAYMENTS =============

exports.getPayments = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { month, year } = req.query;

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    let query = { class: { $in: classIds } };
    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const payments = await MonthlyPayment.find(query)
      .populate('student', 'name parentPhone')
      .sort({ createdAt: -1 });

    res.json({
      payments
    });
  } catch (err) {
    console.error('Get payments xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createMonthlyPayments = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'Oy va yil majburiy' });
    }

    const classes = await Class.find({ teacher: teacherId });
    let createdCount = 0;

    for (const cls of classes) {
      const students = await Student.find({ class: cls._id, isActive: true });

      for (const student of students) {
        const existing = await MonthlyPayment.findOne({
          student: student._id,
          class: cls._id,
          month,
          year
        });

        if (!existing) {
          const payment = new MonthlyPayment({
            student: student._id,
            class: cls._id,
            amount: cls.defaultPaymentAmount || 0,
            month,
            year,
            status: 'not_paid'
          });

          await payment.save();
          createdCount++;
        }
      }
    }

    res.json({
      message: `${createdCount} ta to'lov yaratildi`,
      created: createdCount
    });
  } catch (err) {
    console.error('Create payments xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!['paid', 'not_paid'].includes(status)) {
      return res.status(400).json({ error: 'Status noto\'g\'ri' });
    }

    const payment = await MonthlyPayment.findByIdAndUpdate(
      paymentId,
      {
        status,
        paidDate: status === 'paid' ? new Date() : null
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'To\'lov topilmadi' });
    }

    res.json({
      message: 'To\'lov statusu yangilandi',
      payment
    });
  } catch (err) {
    console.error('Update payment xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============= DASHBOARD =============

exports.getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    const totalStudents = await Student.countDocuments({
      class: { $in: classIds },
      isActive: true
    });

    const allPaidPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      status: 'paid'
    });
    const totalCollectedAllTime = allPaidPayments.reduce((s, p) => s + p.amount, 0);

    const allExpenses = await Expense.find({
      class: { $in: classIds }
    });
    const totalExpensesAllTime = allExpenses.reduce((s, e) => s + e.amount, 0);

    const balance = totalCollectedAllTime - totalExpensesAllTime;

    const currentMonthPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      month: currentMonth,
      year: currentYear
    });
    const currentMonthPaid = currentMonthPayments.filter(p => p.status === 'paid');
    const currentMonthUnpaid = currentMonthPayments.filter(p => p.status === 'not_paid');
    const currentMonthCollected = currentMonthPaid.reduce((s, p) => s + p.amount, 0);

    const currentMonthExpenses = allExpenses
      .filter(e => e.month === currentMonth && e.year === currentYear)
      .reduce((s, e) => s + e.amount, 0);

    res.json({
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email, plan: teacher.plan },
      subscription: { plan: teacher.plan, isActive: teacher.subscriptionIsActive },
      classes: { total: classes.length, list: classes },
      students: { total: totalStudents },
      finance: {
        totalCollectedAllTime,
        totalExpensesAllTime,
        balance,
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          collected: currentMonthCollected,
          expenses: currentMonthExpenses,
          paidCount: currentMonthPaid.length,
          unpaidCount: currentMonthUnpaid.length
        }
      }
    });
  } catch (err) {
    console.error('Dashboard xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.selectPlan = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { plan } = req.body;

    if (!['free', 'plus', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan noto\'g\'ri' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    teacher.plan = plan;
    await teacher.save();

    await Class.updateMany({ teacher: teacherId }, { plan });

    res.json({ message: `Plan "${plan}" tanlandi`, plan });
  } catch (err) {
    console.error('Select plan xatosi:', err);
    res.status(500).json({ error: err.message });
  }
};