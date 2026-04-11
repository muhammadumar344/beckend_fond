// ============================================================================
// FILE: src/controllers/studentController.js
// ============================================================================

const Student = require('../models/Student');
const Class = require('../models/Class');
const MonthlyPayment = require('../models/MonthlyPayment');

const PLAN_LIMITS = {
  free: { students: 30 },
  plus: { students: 100 },
  pro: { students: Infinity },
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

    const studentCount = await Student.countDocuments({ class: classId, isActive: true });
    const limit = PLAN_LIMITS[cls.plan] || PLAN_LIMITS.free;

    if (studentCount >= limit.students) {
      return res.status(400).json({
        error: `${cls.plan} rejimda maksimal ${limit.students} ta o'quvchi bo'lishi mumkin`,
      });
    }

    const student = new Student({
      name: name.trim(),
      class: classId,
      parentPhone: parentPhone || '',
    });

    await student.save();

    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const students = await Student.find({ class: classId, isActive: true }).sort({ name: 1 });

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name, parentPhone } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Talaba nomi majburiy' });
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { name: name.trim(), parentPhone: parentPhone || '' },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: 'Talaba topilmadi' });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    await MonthlyPayment.deleteMany({ student: studentId });
    await Student.findByIdAndDelete(studentId);

    res.json({ message: 'Talaba va uning to\'lovlari o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({ isActive: true })
      .populate('class', 'name')
      .sort({ name: 1 });

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};