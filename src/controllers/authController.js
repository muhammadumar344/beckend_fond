const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');

// Token yaratish
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '24h' });
};

// ================================
// ADMIN LOGIN
// ================================
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol majburiy' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    const token = generateToken({ id: admin._id, email: admin.email, role: 'admin' });

    res.json({
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER LOGIN
// ================================
exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol majburiy' });
    }

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    if (!teacher.isActive) {
      return res.status(403).json({ error: 'Akkauntingiz bloklangan. Admin bilan bog\'laning' });
    }

    const isValid = await teacher.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }

    // Teacher o'z sinfining subscription holatini tekshirish
    const Class = require('../models/Class');
    const Subscription = require('../models/Subscription');

    const teacherClass = await Class.findOne({ teacher: teacher._id });

    if (teacherClass) {
      const subscription = await Subscription.findOne({ class: teacherClass._id });

      if (subscription && (subscription.isExpired() || !subscription.isActive)) {
        return res.status(403).json({
          error: 'subscription_expired',
          message: 'Iltimos to\'lov qiling. Obunangiz tugagan.',
        });
      }

      if (subscription && subscription.selfDeactivated) {
        return res.status(403).json({
          error: 'self_deactivated',
          message: 'Sinf o\'chirilgan. Admin bilan bog\'laning.',
        });
      }
    }

    const token = generateToken({ id: teacher._id, email: teacher.email, role: 'teacher' });

    res.json({
      token,
      user: { id: teacher._id, name: teacher.name, email: teacher.email, role: 'teacher' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TOKENNI TEKSHIRISH (me)
// ================================
exports.getMe = async (req, res) => {
  try {
    const { id, role } = req.user;
    let user;

    if (role === 'admin') {
      user = await Admin.findById(id).select('-password');
    } else {
      user = await Teacher.findById(id).select('-password');
    }

    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    res.json({ user: { ...user.toObject(), role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};