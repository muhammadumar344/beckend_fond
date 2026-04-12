// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '30d' }
  );
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol majburiy' });
    }

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const token = generateToken(admin._id, 'admin');
    res.json({
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol majburiy' });
    }

    const teacher = await Teacher.findOne({ email }).select('+password');
    if (!teacher || !(await teacher.comparePassword(password))) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    if (!teacher.isActive) {
      return res.status(403).json({ error: 'Akkaunt bloklangan' });
    }

    const token = generateToken(teacher._id, 'teacher');
    res.json({
      token,
      user: { id: teacher._id, name: teacher.name, email: teacher.email, role: 'teacher' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminRegisterTeacher = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (await Teacher.findOne({ email })) {
      return res.status(400).json({ error: 'Email allaqachon ro\'yxatdan o\'tgan' });
    }

    const teacher = new Teacher({ name, email, password, phone, registeredDate: new Date() });
    await teacher.save();

    res.status(201).json({
      message: 'Teacher muvaffaqiyatli qo\'shildi',
      teacher: { id: teacher._id, name, email, phone, plan: teacher.plan }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};