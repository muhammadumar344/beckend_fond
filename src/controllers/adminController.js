// ============================================================================
// FILE: src/controllers/adminController.js
// ============================================================================

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Subscription = require('../models/Subscription');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');

exports.createAdmin = async (req, res) => {
  try {
    const existing = await Admin.findOne();
    if (existing) {
      return res.status(400).json({ error: 'Admin allaqachon mavjud' });
    }

    const { name, email, password } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Ism majburiy' });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'Email majburiy' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Parol kamita 6 belgidan iborat bo\'lishi kerak' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email to\'g\'ri formatda emas' });
    }

    const admin = new Admin({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
    });

    await admin.save();

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Admin muvaffaqiyatli yaratildi',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Eski va yangi parol majburiy' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yangi parol kamita 6 belgidan iborat bo\'lishi kerak' });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ error: 'Yangi parol eski parol bilan bir xil bo\'lmasligi kerak' });
    }

    const admin = await Admin.findById(adminId).select('+password');
    if (!admin) {
      return res.status(404).json({ error: 'Admin topilmadi' });
    }

    const isOldPasswordValid = await admin.checkOldPassword(oldPassword);
    if (!isOldPasswordValid) {
      return res.status(401).json({ error: 'Eski parol noto\'g\'ri' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Ism majburiy' });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'Email majburiy' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Parol kamita 6 belgidan iborat bo\'lishi kerak' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email to\'g\'ri formatda emas' });
    }

    const existing = await Teacher.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    const teacher = new Teacher({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      phone: phone || '',
      createdByAdmin: true,
    });

    await teacher.save();

    res.status(201).json({
      message: 'Teacher muvaffaqiyatli yaratildi',
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().select('-password').sort({ createdAt: -1 });

    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const classCount = await Class.countDocuments({ teacher: teacher._id });
        const classIds = await Class.find({ teacher: teacher._id }).select('_id');
        const classIdArray = classIds.map(c => c._id);
        const studentCount = await Student.countDocuments({
          class: { $in: classIdArray }
        });

        return {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          classCount,
          studentCount,
          createdByAdmin: teacher.createdByAdmin,
          isActive: teacher.isActive,
          createdAt: teacher.createdAt,
        };
      })
    );

    res.json({
      total: teachersWithStats.length,
      teachers: teachersWithStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeacherById = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    const classes = await Class.find({ teacher: teacherId }).populate('teacher', 'name email');
    const classIds = classes.map(c => c._id);
    const studentCount = await Student.countDocuments({ class: { $in: classIds } });

    res.json({
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        isActive: teacher.isActive,
      },
      classCount: classes.length,
      studentCount,
      classes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Yangi parol kamita 6 belgidan iborat bo\'lishi kerak' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.json({
      message: 'Teacher paroli muvaffaqiyatli yangilandi',
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findByIdAndDelete(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    await Class.deleteMany({ teacher: teacherId });

    res.json({
      message: 'Teacher va uning sinflar o\'chirildi',
      deletedTeacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setSubscription = async (req, res) => {
  try {
    const { classId } = req.params;
    const { plan, months } = req.body;

    if (!plan || !months) {
      return res.status(400).json({ error: 'Plan va oylar soni majburiy' });
    }

    if (!['free', 'plus', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan faqat free, plus yoki pro bo\'lishi kerak' });
    }

    if (isNaN(months) || months <= 0) {
      return res.status(400).json({ error: 'Oylar soni musbat son bo\'lishi kerak' });
    }

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const now = new Date();
    let subscription = await Subscription.findOne({ class: classId });

    if (subscription) {
      const base = subscription.isExpired() ? now : subscription.expiryDate;
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));

      subscription.plan = plan;
      subscription.expiryDate = newExpiry;
      subscription.isActive = true;
      subscription.selfDeactivated = false;
      subscription.paidMonths += parseInt(months);
      subscription.lastPaidAt = now;
    } else {
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));

      subscription = new Subscription({
        class: classId,
        plan,
        expiryDate,
        paidMonths: parseInt(months),
        lastPaidAt: now,
        isActive: true,
      });
    }

    await subscription.save();

    cls.plan = plan;
    cls.isActive = true;
    await cls.save();

    res.json({
      message: `Subscription ${months} oy uchun yangilandi (${plan})`,
      subscription: {
        id: subscription._id,
        class: subscription.class,
        plan: subscription.plan,
        expiryDate: subscription.expiryDate,
        daysLeft: subscription.daysLeft(),
        isActive: subscription.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const totalClasses = await Class.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalStudents = await Student.countDocuments();

    const classes = await Class.find().populate('teacher', 'name email');

    const classesWithSubscription = await Promise.all(
      classes.map(async (cls) => {
        const subscription = await Subscription.findOne({ class: cls._id });
        const students = await Student.countDocuments({ class: cls._id });
        const payments = await MonthlyPayment.countDocuments({
          class: cls._id,
          status: 'paid'
        });
        const expenses = await Expense.find({ class: cls._id });
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        return {
          class: {
            id: cls._id,
            name: cls.name,
            plan: cls.plan,
            isActive: cls.isActive,
          },
          teacher: cls.teacher,
          studentCount: students,
          paidPayments: payments,
          totalExpenses,
          subscription: subscription ? {
            plan: subscription.plan,
            expiryDate: subscription.expiryDate,
            isActive: subscription.isActive,
            daysLeft: subscription.daysLeft(),
            isExpired: subscription.isExpired(),
          } : null,
        };
      })
    );

    res.json({
      summary: {
        totalClasses,
        totalTeachers,
        totalStudents,
      },
      classes: classesWithSubscription,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const totalClasses = await Class.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalStudents = await Student.countDocuments();

    const activeSubscriptions = await Subscription.countDocuments({
      isActive: true,
      expiryDate: { $gte: now }
    });

    const expiredSubscriptions = await Subscription.countDocuments({
      isActive: false
    });

    const monthlyPayments = await MonthlyPayment.find({
      month: currentMonth,
      year: currentYear,
    });

    const paidPayments = monthlyPayments.filter(p => p.status === 'paid').length;
    const unpaidPayments = monthlyPayments.filter(p => p.status === 'not_paid').length;

    const expenses = await Expense.find({
      month: currentMonth,
      year: currentYear,
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      stats: {
        totalClasses,
        totalTeachers,
        totalStudents,
        activeSubscriptions,
        expiredSubscriptions,
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          paidPayments,
          unpaidPayments,
          totalExpenses,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateSubscription = async (req, res) => {
  try {
    const { classId } = req.params;

    const subscription = await Subscription.findOne({ class: classId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription topilmadi' });
    }

    subscription.isActive = false;
    subscription.selfDeactivated = true;
    await subscription.save();

    const cls = await Class.findById(classId);
    cls.isActive = false;
    await cls.save();

    res.json({
      message: 'Subscription faol bo\'lmadi',
      subscription: {
        id: subscription._id,
        isActive: subscription.isActive,
        selfDeactivated: subscription.selfDeactivated,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.activateSubscription = async (req, res) => {
  try {
    const { classId } = req.params;

    const subscription = await Subscription.findOne({ class: classId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription topilmadi' });
    }

    if (subscription.isExpired()) {
      return res.status(400).json({ error: 'Subscription muddati o\'tmagan, avval yangilang' });
    }

    subscription.isActive = true;
    subscription.selfDeactivated = false;
    await subscription.save();

    const cls = await Class.findById(classId);
    cls.isActive = true;
    await cls.save();

    res.json({
      message: 'Subscription faol qilindi',
      subscription: {
        id: subscription._id,
        isActive: subscription.isActive,
        expiryDate: subscription.expiryDate,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Oy va yil majburiy' });
    }

    const cls = await Class.findById(classId).populate('teacher', 'name email');
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    const students = await Student.find({ class: classId });
    const payments = await MonthlyPayment.find({
      class: classId,
      month: parseInt(month),
      year: parseInt(year),
    }).populate('student', 'name parentPhone');

    const expenses = await Expense.find({
      class: classId,
      month: parseInt(month),
      year: parseInt(year),
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const report = students.map(student => {
      const payment = payments.find(p => p.student._id.toString() === student._id.toString());
      return {
        student: student.name,
        studentId: student._id,
        parentPhone: student.parentPhone,
        status: payment ? payment.status : 'not_paid',
        amount: payment ? payment.amount : 0,
        paidDate: payment ? payment.paidDate : null,
      };
    });

    res.json({
      class: {
        id: cls._id,
        name: cls.name,
      },
      teacher: cls.teacher,
      month: parseInt(month),
      year: parseInt(year),
      report,
      expenses,
      totalExpenses,
      summary: {
        totalStudents: students.length,
        paidStudents: report.filter(r => r.status === 'paid').length,
        unpaidStudents: report.filter(r => r.status === 'not_paid').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate('class', 'name').sort({ expiryDate: 1 });

    const result = subscriptions.map(sub => ({
      id: sub._id,
      class: sub.class,
      plan: sub.plan,
      expiryDate: sub.expiryDate,
      daysLeft: sub.daysLeft(),
      isActive: sub.isActive,
      isExpired: sub.isExpired(),
      paidMonths: sub.paidMonths,
      lastPaidAt: sub.lastPaidAt,
    }));

    res.json({
      total: result.length,
      subscriptions: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeacherStats = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    const classes = await Class.find({ teacher: teacherId });
    const classIds = classes.map(c => c._id);

    const totalStudents = await Student.countDocuments({ class: { $in: classIds } });
    const totalPayments = await MonthlyPayment.countDocuments({ class: { $in: classIds } });
    const paidPayments = await MonthlyPayment.countDocuments({
      class: { $in: classIds },
      status: 'paid',
    });

    const expenses = await Expense.find({ class: { $in: classIds } });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
      },
      statistics: {
        classCount: classes.length,
        studentCount: totalStudents,
        totalPayments,
        paidPayments,
        unpaidPayments: totalPayments - paidPayments,
        totalExpenses,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};