// backend/src/controllers/teacherController.js
const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');
const Teacher = require('../models/Teacher');

// PLAN LIMITS
const PLAN_LIMITS = {
  free: { classes: 1, students: 30 },
  pro: { classes: 3, students: 40 },
  premium: { classes: 5, students: 50 }
};

// ===== CLASSES =====

exports.createClass = async (req, res) => {
  try {
    const { name, defaultAmount } = req.body;
    const teacherId = req.user.id;

    const teacher = await Teacher.findById(teacherId);
    const limit = PLAN_LIMITS[teacher.plan];
    const classCount = await Class.countDocuments({ teacher: teacherId });

    if (classCount >= limit.classes) {
      return res.status(400).json({
        error: `${teacher.plan} rejimda maksimal ${limit.classes} ta sinf ochishingiz mumkin`
      });
    }

    const newClass = new Class({
      name,
      teacher: teacherId,
      defaultAmount: defaultAmount || 0,
      plan: teacher.plan
    });

    await newClass.save();

    res.status(201).json({
      message: 'Sinf yaratildi',
      class: newClass
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyClasses = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const classes = await Class.find({ teacher: teacherId });

    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments({ class: cls._id });
        return {
          ...cls.toObject(),
          studentCount
        };
      })
    );

    res.json({ classes: classesWithStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateClassDefaultAmount = async (req, res) => {
  try {
    const { classId } = req.params;
    const { defaultAmount } = req.body;

    const cls = await Class.findByIdAndUpdate(
      classId,
      { defaultAmount },
      { new: true }
    );

    res.json({ message: 'Default summa yangilandi', class: cls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    await Student.deleteMany({ class: classId });
    await MonthlyPayment.deleteMany({ class: classId });
    await Expense.deleteMany({ class: classId });
    await Class.findByIdAndDelete(classId);

    res.json({ message: 'Sinf o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== STUDENTS =====

exports.addStudent = async (req, res) => {
  try {
    const classId = req.params.classId;
    const { name, parentPhone } = req.body;
    const teacherId = req.user.id;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi yoki ruxsat yo\'q' });
    }

    const limit = PLAN_LIMITS[cls.plan];
    const studentCount = await Student.countDocuments({ class: classId });

    if (studentCount >= limit.students) {
      return res.status(400).json({
        error: `Bu sinfda maksimal ${limit.students} ta talaba bo\'lishi mumkin`
      });
    }

    const rollNumber = studentCount + 1;

    const student = new Student({
      name,
      class: classId,
      parentPhone,
      rollNumber
    });

    await student.save();

    res.status(201).json({ message: 'Talaba qo\'shildi', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    const students = await Student.find({ class: classId }).sort({ rollNumber: 1 });

    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    await Student.findByIdAndDelete(studentId);
    await MonthlyPayment.deleteMany({ student: studentId });

    res.json({ message: 'Talaba o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== PAYMENTS =====

exports.createMonthlyPayments = async (req, res) => {
  try {
    const { classId, month, year } = req.body;
    const teacherId = req.user.id;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const students = await Student.find({ class: classId });

    let createdCount = 0;
    for (const student of students) {
      const existing = await MonthlyPayment.findOne({
        student: student._id,
        class: classId,
        month,
        year
      });

      if (!existing) {
        const payment = new MonthlyPayment({
          student: student._id,
          class: classId,
          teacher: teacherId,
          amount: cls.defaultAmount,
          month,
          year,
          status: 'not_paid'
        });

        await payment.save();
        createdCount++;
      }
    }

    res.json({ message: `${createdCount} ta to'lov yaratildi`, createdCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonthlyPayments = async (req, res) => {
  try {
    const { month, year } = req.query;
    const teacherId = req.user.id;

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    let query = { teacher: teacherId };
    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const payments = await MonthlyPayment
      .find(query)
      .populate('student', 'name parentPhone rollNumber')
      .populate('class', 'name')
      .sort({ createdAt: -1 });

    const paidCount = payments.filter(p => p.status === 'paid').length;
    const unpaidCount = payments.filter(p => p.status === 'not_paid').length;
    const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      payments,
      summary: { paidCount, unpaidCount, totalAmount }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    const payment = await MonthlyPayment.findByIdAndUpdate(
      paymentId,
      {
        status,
        paidDate: status === 'paid' ? new Date() : null
      },
      { new: true }
    ).populate('student', 'name parentPhone');

    res.json({ message: 'Status yangilandi', payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== EXPENSES =====

exports.addExpense = async (req, res) => {
  try {
    const { classId, reason, amount, month, year, description } = req.body;
    const teacherId = req.user.id;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const expense = new Expense({
      class: classId,
      teacher: teacherId,
      reason,
      amount,
      month,
      year,
      description
    });

    await expense.save();

    res.status(201).json({ message: 'Xarajat qo\'shildi', expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    const teacherId = req.user.id;

    let query = { teacher: teacherId };
    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const expenses = await Expense.find(query).populate('class', 'name');
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ expenses, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    await Expense.findByIdAndDelete(expenseId);

    res.json({ message: 'Xarajat o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== DASHBOARD =====

exports.getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const teacher = await Teacher.findById(teacherId);
    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    const totalStudents = await Student.countDocuments({ class: { $in: classIds } });

    const monthlyPayments = await MonthlyPayment.find({
      teacher: teacherId,
      month: currentMonth,
      year: currentYear
    });

    const paidCount = monthlyPayments.filter(p => p.status === 'paid').length;
    const unpaidCount = monthlyPayments.filter(p => p.status === 'not_paid').length;
    const collectedThisMonth = monthlyPayments
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + p.amount, 0);

    const expensesThisMonth = await Expense.find({
      teacher: teacherId,
      month: currentMonth,
      year: currentYear
    });

    const expensesTotal = expensesThisMonth.reduce((s, e) => s + e.amount, 0);
    const balance = collectedThisMonth - expensesTotal;

    res.json({
      teacher: { name: teacher.name, email: teacher.email, plan: teacher.plan },
      registeredDate: teacher.registeredDate,
      summary: {
        totalClasses: classes.length,
        totalStudents,
        currentMonth,
        currentYear,
        paidCount,
        unpaidCount,
        collectedThisMonth,
        expensesTotal,
        balance
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};