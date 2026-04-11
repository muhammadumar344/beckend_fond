const Student = require('../models/Student');
const Class = require('../models/Class');
const MonthlyPayment = require('../models/MonthlyPayment');

const PLAN_LIMITS = {
  free:  { students: 30  },
  plus:  { students: 100 },
  pro:   { students: Infinity },
};

// ================================
// TALABA QO'SHISH
// ================================
exports.createStudent = async (req, res) => {
  try {
    const { name, classId, parentPhone } = req.body;

    if (!name || !classId) {
      return res.status(400).json({ error: 'Ism va sinf majburiy' });
    }

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

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

// ================================
// SINF BO'YICHA O'QUVCHILAR
// ================================
exports.getStudentsByClass = async (req, res) => {
  try {
    const students = await Student.find({ class: req.params.classId });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TALABANI TAHRIRLASH
// ================================
exports.updateStudent = async (req, res) => {
  try {
    const { name, parentPhone } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.studentId,
      { name, parentPhone },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Talaba topilmadi' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TALABANI O'CHIRISH (uning to'lovlari ham)
// ================================
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

// ================================
// HAMMA O'QUVCHILAR (admin uchun)
// ================================
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find().populate('class', 'name');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};