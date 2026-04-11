const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const MonthlyPayment = require('../models/MonthlyPayment');

// ================================
// ADMIN YARATISH (faqat bir marta, seed uchun)
// ================================
exports.createAdmin = async (req, res) => {
  try {
    const existing = await Admin.findOne();
    if (existing) {
      return res.status(400).json({ error: 'Admin allaqachon mavjud' });
    }

    const { name, email, password } = req.body;
    const admin = new Admin({ name, email, password });
    await admin.save();

    res.status(201).json({ message: 'Admin yaratildi', email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER YARATISH (faqat admin)
// ================================
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Ism, email va parol majburiy' });
    }

    const existing = await Teacher.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    const teacher = new Teacher({ name, email, password, phone, createdByAdmin: true });
    await teacher.save();

    res.status(201).json({
      message: 'Teacher muvaffaqiyatli yaratildi',
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER PAROLINI YANGILASH
// ================================
exports.resetTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) return res.status(400).json({ error: 'Yangi parol majburiy' });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' });

    teacher.password = newPassword; // pre-save hook hash qiladi
    await teacher.save();

    res.json({ message: 'Parol yangilandi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// TEACHER O'CHIRISH
// ================================
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.teacherId);
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' });

    res.json({ message: 'Teacher o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// BARCHA TEACHERLAR
// ================================
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().select('-password');
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// ADMIN DASHBOARD — hamma sinflar + subscription holati
// ================================
exports.getDashboard = async (req, res) => {
  try {
    const classes = await Class.find().populate('teacher', 'name email');
    const now = new Date();

    const result = await Promise.all(
      classes.map(async (cls) => {
        const subscription = await Subscription.findOne({ class: cls._id });
        const studentsCount = await Student.countDocuments({ class: cls._id });

        return {
          class: {
            id: cls._id,
            name: cls.name,
            plan: cls.plan,
            isActive: cls.isActive,
          },
          teacher: cls.teacher,
          studentsCount,
          subscription: subscription
            ? {
                plan: subscription.plan,
                expiryDate: subscription.expiryDate,
                isActive: subscription.isActive,
                daysLeft: subscription.daysLeft(),
                isExpired: subscription.isExpired(),
                selfDeactivated: subscription.selfDeactivated,
              }
            : null,
        };
      })
    );

    res.json({ total: classes.length, classes: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// SUBSCRIPTION BELGILASH (admin sinf uchun expiry date qo'yadi)
// ================================
exports.setSubscription = async (req, res) => {
  try {
    const { classId } = req.params;
    const { plan, months } = req.body; // plan: free/plus/pro, months: necha oy

    if (!plan || !months) {
      return res.status(400).json({ error: 'Plan va months majburiy' });
    }

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ error: 'Sinf topilmadi' });

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));

    let subscription = await Subscription.findOne({ class: classId });

    if (subscription) {
      // Agar muddati o'tmagan bo'lsa, ustiga qo'shiladi
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
      subscription = new Subscription({
        class: classId,
        plan,
        expiryDate,
        paidMonths: parseInt(months),
        lastPaidAt: now,
      });
    }

    await subscription.save();

    // Class ni ham yangilash
    cls.plan = plan;
    cls.isActive = true;
    await cls.save();

    res.json({
      message: `Subscription yangilandi — ${months} oy (${plan})`,
      subscription,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};