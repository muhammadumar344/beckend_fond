const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Subscription = require('../models/Subscription');

// Plan limitleri
const PLAN_LIMITS = {
  free:  { classes: 1,         students: 30  },
  plus:  { classes: 3,         students: 100 },
  pro:   { classes: Infinity,  students: Infinity },
};

// ================================
// BARCHA SINFLAR (admin — hammasi, teacher — faqat o'ziniki)
// ================================
exports.getAllClasses = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { teacher: req.user.id };
    const classes = await Class.find(filter).populate('teacher', 'name email');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SINF YARATISH (admin yaratadi, teacherga biriktiradi)
// ================================
exports.createClass = async (req, res) => {
  try {
    const { name, description, teacherId, plan = 'free' } = req.body;

    if (!name || !teacherId) {
      return res.status(400).json({ error: 'Sinf nomi va teacher majburiy' });
    }

    // Plan limitini tekshirish
    const teacherClassCount = await Class.countDocuments({ teacher: teacherId });
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    if (teacherClassCount >= limit.classes) {
      return res.status(400).json({
        error: `${plan} rejimda maksimal ${limit.classes} ta sinf bo'lishi mumkin`,
      });
    }

    const newClass = new Class({ name, description, teacher: teacherId, plan });
    await newClass.save();

    res.status(201).json(newClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SINF TAHRIRLASH
// ================================
exports.updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, description } = req.body;

    const cls = await Class.findByIdAndUpdate(
      classId,
      { name, description },
      { new: true }
    );
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    res.json(cls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SINF O'CHIRISH (admin)
// ================================
exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;

    await MonthlyPayment.deleteMany({ class: classId });
    await Student.deleteMany({ class: classId });
    await Subscription.findOneAndDelete({ class: classId });
    await Class.findByIdAndDelete(classId);

    res.json({ message: 'Sinf va bog\'liq ma\'lumotlar o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SINF HISOBOTI — oylik to'lov holati
// ================================
exports.getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    const currentYear = parseInt(year) || new Date().getFullYear();

    const students = await Student.find({ class: classId });
    const payments = await MonthlyPayment.find({
      class: classId,
      month: currentMonth,
      year: currentYear,
    }).populate('student');

    const report = students.map((student) => {
      const payment = payments.find(
        (p) => p.student && p.student._id.toString() === student._id.toString()
      );
      return {
        studentId: student._id,
        student: student.name,
        parentPhone: student.parentPhone,
        status: payment ? payment.status : 'not_paid',
        amount: payment ? payment.amount : 0,
        paymentId: payment ? payment._id : null,
        paidDate: payment ? payment.paidDate : null,
      };
    });

    const totalStudents = students.length;
    const paidCount = report.filter((r) => r.status === 'paid').length;
    const unpaidCount = totalStudents - paidCount;
    const totalCollected = report.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);

    res.json({
      month: currentMonth,
      year: currentYear,
      totalStudents,
      paidCount,
      unpaidCount,
      totalCollected,
      report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};