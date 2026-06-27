const Staff  = require('../models/Staff');
const Role   = require('../models/Role');
const Branch = require('../models/Branch');
const Teacher = require('../models/Teacher');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { resolveContext, requirePermission } = require('../utils/resolveContext');
const { sendStaffWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');

// ─── HELPER ───────────────────────────────────────────────────────────────────

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

const createStaff = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageStaff');

    const { name, email, roleId, branchId, position } = req.body;

    if (!name || !email || !roleId) {
      return res.status(400).json({ message: "Ism, email va rol majburiy" });
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ message: "Email @gmail.com bilan tugashi kerak" });
    }

    const role = await Role.findOne({ _id: roleId, director: ctx.directorId });
    if (!role) return res.status(404).json({ message: "Rol topilmadi" });

    if (role.slug === 'branch_manager' && !ctx.isDirector) {
      return res.status(403).json({
        message: "Branch Manager rolini faqat direktor tayinlay oladi",
      });
    }

    const assignedBranch = branchId || ctx.branchFilter;
    if (!assignedBranch) {
      return res.status(400).json({ message: "Filial ko'rsatilmagan" });
    }
    if (!ctx.isDirector && String(assignedBranch) !== String(ctx.branchFilter)) {
      return res.status(403).json({
        message: "Faqat o'z filialingizga xodim qo'sha olasiz",
      });
    }

    const existing = await Staff.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "Bu email bilan xodim allaqachon mavjud" });
    }

    const tempPassword      = generateTempPassword();
    const hashedPassword    = await bcrypt.hash(tempPassword, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const staff = new Staff({
      name,
      email:            email.toLowerCase(),
      password:         hashedPassword,
      role:             roleId,
      branch:           assignedBranch,
      director:         ctx.directorId,
      position:         position || '',
      isActive:         true,
      emailVerified:    false,
      verificationToken,
    });
    await staff.save();

    // Email yuborish (xato bo'lsa ham staff yaratiladi)
    try {
      const teacher = await Teacher.findById(ctx.directorId).lean();
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
      await sendStaffWelcomeEmail({
        toEmail:         staff.email,
        staffName:       staff.name,
        directorName:    teacher?.fullName || teacher?.institutionName || 'Direktor',
        institutionName: teacher?.institutionName || 'FondSchool',
        tempPassword,
        verificationLink,
      });
    } catch (emailErr) {
      console.error('[Email] Xato (staff yaratildi, email ketmadi):', emailErr.message);
    }

    await staff.populate([
      { path: 'role',   select: 'name color slug' },
      { path: 'branch', select: 'name' },
    ]);

    res.status(201).json({
      staff: {
        _id:           staff._id,
        name:          staff.name,
        email:         staff.email,
        role:          staff.role,
        branch:        staff.branch,
        position:      staff.position,
        isActive:      staff.isActive,
        emailVerified: staff.emailVerified,
      },
      tempPassword,
      warning: "Parolni xodimga xavfsiz yetkazing. Bu sahifadan keyin ko'rinmaydi!",
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────

const getStaff = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageStaff');

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    // Query filters
    if (req.query.branchId)  query.branch   = req.query.branchId;
    if (req.query.roleId)    query.role      = req.query.roleId;
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const staff = await Staff.find(query)
      .populate('role',   'name color slug permissions')
      .populate('branch', 'name')
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
      .sort({ name: 1 });

    res.json(staff);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────────

const getStaffById = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageStaff');

    const query = { _id: req.params.id, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const staff = await Staff.findOne(query)
      .populate('role',   'name color slug permissions')
      .populate('branch', 'name')
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });
    res.json(staff);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const updateStaff = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageStaff');

    const query = { _id: req.params.id, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const staff = await Staff.findOne(query);
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    const { name, position, roleId, branchId } = req.body;

    if (name !== undefined)     staff.name     = name;
    if (position !== undefined) staff.position = position;

    // Rol o'zgartirish
    if (roleId && String(roleId) !== String(staff.role)) {
      const newRole = await Role.findOne({ _id: roleId, director: ctx.directorId });
      if (!newRole) return res.status(404).json({ message: "Yangi rol topilmadi" });

      // Branch Manager rolini faqat Director berishi mumkin
      if (newRole.slug === 'branch_manager' && !ctx.isDirector) {
        return res.status(403).json({
          message: "Branch Manager rolini faqat direktor tayinlay oladi",
        });
      }
      staff.role = roleId;
    }

    // Filial o'zgartirish — faqat Director
    if (branchId && ctx.isDirector && String(branchId) !== String(staff.branch)) {
      const branch = await Branch.findOne({ _id: branchId, teacher: ctx.directorId });
      if (!branch) return res.status(404).json({ message: "Filial topilmadi" });
      staff.branch = branchId;
    }

    await staff.save();
    await staff.populate([
      { path: 'role',   select: 'name color slug' },
      { path: 'branch', select: 'name' },
    ]);

    res.json({
      _id:      staff._id,
      name:     staff.name,
      email:    staff.email,
      role:     staff.role,
      branch:   staff.branch,
      position: staff.position,
      isActive: staff.isActive,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── TOGGLE (faollashtirish / o'chirish) ─────────────────────────────────────

const toggleStaff = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageStaff');

    const query = { _id: req.params.id, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const staff = await Staff.findOne(query);
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    staff.isActive = !staff.isActive;
    await staff.save();

    res.json({
      _id:      staff._id,
      name:     staff.name,
      isActive: staff.isActive,
      message:  staff.isActive ? "Xodim faollashtirildi" : "Xodim bloklandi",
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── RESET PASSWORD (Director tomonidan) ─────────────────────────────────────

const resetStaffPassword = async (req, res) => {
  try {
    // Faqat Director
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: "Faqat direktor parol yangilaya oladi" });
    }

    const staff = await Staff.findOne({
      _id:      req.params.id,
      director: req.user.id,
    });
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    const newPassword  = generateTempPassword();
    staff.password     = await bcrypt.hash(newPassword, 10);
    staff.emailVerified = false; // qayta tasdiqlash kerak
    await staff.save();

    res.json({
      tempPassword: newPassword,
      warning: "Yangi parolni xodimga xavfsiz yetkazing!",
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── EMAIL VERIFICATION ───────────────────────────────────────────────────────

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: 'Token mavjud emas' });

    const staff = await Staff.findOne({ verificationToken: token });
    if (!staff) {
      return res.status(400).json({
        message: "Token noto'g'ri yoki muddati o'tgan",
      });
    }

    staff.emailVerified    = true;
    staff.verificationToken = undefined;
    await staff.save();

    res.json({
      message: "Email muvaffaqiyatli tasdiqlandi! Endi tizimga kirishingiz mumkin.",
      email: staff.email,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── FORGOT PASSWORD (Staff o'zi so'raydi) ───────────────────────────────────

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email majburiy' });

    const staff = await Staff.findOne({ email: email.toLowerCase() });

    // Xavfsizlik: email topilmasa ham xuddi shu javob
    if (!staff) {
      return res.json({ message: "Agar email mavjud bo'lsa, tiklash xati yuborildi" });
    }

    const resetToken  = crypto.randomBytes(32).toString('hex');
    staff.resetPasswordToken   = resetToken;
    staff.resetPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 soat
    await staff.save();

    try {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendPasswordResetEmail({ toEmail: staff.email, name: staff.name, resetLink });
    } catch (emailErr) {
      console.error('[Email] Parol tiklash xati ketmadi:', emailErr.message);
    }

    res.json({ message: "Agar email mavjud bo'lsa, tiklash xati yuborildi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── RESET PASSWORD (token orqali) ───────────────────────────────────────────

const resetPasswordByToken = async (req, res) => {
  try {
    const { token }       = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token va yangi parol majburiy" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parol kamida 6 ta belgi bo'lishi kerak" });
    }

    const staff = await Staff.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!staff) {
      return res.status(400).json({
        message: "Token noto'g'ri yoki muddati o'tgan (24 soat)",
      });
    }

    staff.password             = await bcrypt.hash(newPassword, 10);
    staff.resetPasswordToken   = undefined;
    staff.resetPasswordExpires = undefined;
    await staff.save();

    res.json({ message: "Parol muvaffaqiyatli yangilandi. Endi tizimga kirishingiz mumkin." });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── CHANGE OWN PASSWORD (Staff login qilib o'zi o'zgartiradi) ───────────────

const changeOwnPassword = async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: "Faqat xodimlar uchun" });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Joriy va yangi parol majburiy" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yangi parol kamida 6 ta belgi" });
    }

    const staff = await Staff.findById(req.user.id);
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    const isMatch = await bcrypt.compare(currentPassword, staff.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Joriy parol noto'g'ri" });
    }

    staff.password = await bcrypt.hash(newPassword, 10);
    await staff.save();

    res.json({ message: "Parol muvaffaqiyatli yangilandi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── GET MY PROFILE (Staff o'z profilini ko'radi) ────────────────────────────

const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: "Faqat xodimlar uchun" });
    }

    const staff = await Staff.findById(req.user.id)
      .populate('role',   'name color slug permissions')
      .populate('branch', 'name address')
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });
    res.json(staff);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  toggleStaff,
  resetStaffPassword,
  verifyEmail,
  forgotPassword,
  resetPasswordByToken,
  changeOwnPassword,
  getMyProfile,
};