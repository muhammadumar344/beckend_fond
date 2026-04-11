// src/controllers/studentController.js
const Student = require('../models/Student');
const Class = require('../models/Class');
const MonthlyPayment = require('../models/MonthlyPayment');

const PLAN_LIMITS = {
  free: { students: 30 },
  plus: { students: 100 },
  pro: { students: Infinity },
};

exports.getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.query;
    if (!classId) {
      return res.status(400).json({ error: 'classId majburiy' });
    }

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    // Teacher o'z sinfini tekshir
    if (req.user.role === 'teacher' && cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    const students = await Student.find({ class: classId });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { name, classId, parentPhone } = req.body;

    if (!name || !classId) {
      return res.status(400).json({ error: 'Ism va sinf majburiy' });
    }

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi' });
    }

    // Teacher faqat o'z sinfiga
    if (req.user.role === 'teacher' && cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    // Plan limiti
    const studentCount = await Student.countDocuments({ class: classId });
    const limit = PLAN_LIMITS[cls.plan] || PLAN_LIMITS.free;
    if (studentCount >= limit.students) {
      return res.status(400).json({
        error: `${cls.plan} rejimda maksimal ${limit.students} ta o'quvchi bo'lishi mumkin`,
      });
    }

    const student = new Student({ name, class: classId, parentPhone });
    await student.save();

    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { name, parentPhone } = req.body;
    const student = await Student.findById(req.params.studentId).populate('class');

    if (!student) {
      return res.status(404).json({ error: 'Talaba topilmadi' });
    }

    // Teacher faqat o'z sinfiga
    if (req.user.role === 'teacher' && student.class.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    student.name = name || student.name;
    student.parentPhone = parentPhone !== undefined ? parentPhone : student.parentPhone;
    await student.save();

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId).populate('class');

    if (!student) {
      return res.status(404).json({ error: 'Talaba topilmadi' });
    }

    // Teacher faqat o'z sinfiga
    if (req.user.role === 'teacher' && student.class.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    await MonthlyPayment.deleteMany({ student: req.params.studentId });
    await Student.findByIdAndDelete(req.params.studentId);

    res.json({ message: 'Talaba va uning to\'lovlari o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};