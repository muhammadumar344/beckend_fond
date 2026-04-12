// backend/src/controllers/adminController.js
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');
const Expense = require('../models/Expense');

exports.getDashboard = async (req, res) => {
  try {
    const totalTeachers = await Teacher.countDocuments();
    const totalClasses = await Class.countDocuments();
    const totalStudents = await Student.countDocuments();

    const teachers = await Teacher.find().select('-password').sort({ createdAt: -1 });

    res.json({
      summary: { totalTeachers, totalClasses, totalStudents },
      teachers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { newPassword } = req.body;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher topilmadi' });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.json({ message: 'Parol yangilandi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTeacherPlan = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { plan } = req.body;

    if (!['free', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan noto\'g\'ri' });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { plan },
      { new: true }
    );

    await Class.updateMany({ teacher: teacherId }, { plan });

    res.json({ message: 'Plan yangilandi', teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { isActive: false },
      { new: true }
    );

    res.json({ message: 'Teacher bloklandi', teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};