const Staff  = require('../models/Staff');
const Role   = require('../models/Role');
const Branch = require('../models/Branch');
const Teacher = require('../models/Teacher');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  resolveContext,
  requirePermission,
  requireAnyPermission,
} = require('../utils/resolveContext');
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
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // ✅ TUZATILDI — MUHIM BUG: bu yerda parol qo'lda bcrypt bilan hash
    // qilinib, keyin Staff modelidagi pre('save') hook YANA hash qilib
    // yuborardi ("hash'ning hash'i"). Natijada emailga ketgan vaqtinchalik
    // parol hech qachon saqlangan parolga to'g'ri kelmasdi — YANGI
    // qo'shilgan HAR BIR xodim "email yoki parol xato" bilan kirolmasdi.
    // Endi parol PLAIN holida beriladi, hash qilishni FAQAT model hook'i
    // bajaradi (bir marta).
    const staff = new Staff({
      name,
      email:            email.toLowerCase(),
      password:         tempPassword,
      role:             roleId,
      branch:           assignedBranch,
      director:         ctx.directorId,
      position:         position || '',
      isActive:         true,
      emailVerified:    false,
      verificationToken,
    });
    await staff.save();

    try {
      const teacher = await Teacher.findById(ctx.directorId).lean();
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
      await sendStaffWelcomeEmail({
        toEmail:         staff.email,
        staffName:       staff.name,
        directorName:    teacher?.fullName || teacher?.institutionName || 'Direktor',
        institutionName: teacher?.institutionName || 'Lumo',
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
      success: true,
      staff: {
        _id:           staff._id,
        name:          staff.name,
        email:         staff.email,
        role:          staff.role,
        branch:        staff.branch,
        position:      staff.position,
        isActive:      staff.isActive,
        emailVerified: staff.emailVerified,
        generatedPassword: tempPassword,
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
    // ⚠️ Ro'yxatni KO'RISH uchun `manageStaff` shart emas.
    //    Buxgalterga maosh uchun xodimlar ro'yxati kerak, lekin
    //    unga xodim QO'SHISH huquqini berish ortiqcha bo'lardi.
    requireAnyPermission(ctx, ['viewStaff', 'manageStaff']);

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    if (req.query.branchId) query.branch   = req.query.branchId;
    if (req.query.roleId)   query.role     = req.query.roleId;
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const staff = await Staff.find(query)
      .populate('role',   'name color slug permissions')
      .populate('branch', 'name')
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
      .sort({ name: 1 });

    res.json({ success: true, staff });
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
    res.json({ success: true, staff });
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

    if (roleId && String(roleId) !== String(staff.role)) {
      const newRole = await Role.findOne({ _id: roleId, director: ctx.directorId });
      if (!newRole) return res.status(404).json({ message: "Yangi rol topilmadi" });

      if (newRole.slug === 'branch_manager' && !ctx.isDirector) {
        return res.status(403).json({
          message: "Branch Manager rolini faqat direktor tayinlay oladi",
        });
      }
      staff.role = roleId;
    }

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
      success: true,
      staff: {
        _id:      staff._id,
        name:     staff.name,
        email:    staff.email,
        role:     staff.role,
        branch:   staff.branch,
        position: staff.position,
        isActive: staff.isActive,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── TOGGLE ───────────────────────────────────────────────────────────────────

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
      success: true,
      _id:      staff._id,
      name:     staff.name,
      isActive: staff.isActive,
      message:  staff.isActive ? "Xodim faollashtirildi" : "Xodim bloklandi",
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── BRANCH MANAGER TAYINLASH ─────────────────────────────────────────────────

const assignManager = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageBranches');

    if (!ctx.isDirector) {
      return res.status(403).json({ message: "Faqat direktor manager tayinlay oladi" });
    }

    const branch = await Branch.findOne({ _id: req.params.id, teacher: ctx.directorId });
    if (!branch) return res.status(404).json({ message: "Filial topilmadi" });

    const { staffId } = req.body;

    if (staffId) {
      const staff = await Staff.findOne({ _id: staffId, director: ctx.directorId });
      if (!staff) return res.status(404).json({ message: "Xodim topilmadi" });
      branch.manager = staffId;
    } else {
      branch.manager = null;
    }

    await branch.save();
    await branch.populate('manager', 'name email');

    res.json({ success: true, branch });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── DIREKTOR O'ZINI MANAGER QILISH ──────────────────────────────────────────

const becomeManagerToo = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    if (!ctx.isDirector) {
      return res.status(403).json({ message: "Faqat direktor uchun" });
    }

    const branch = await Branch.findOne({ _id: req.params.id, teacher: ctx.directorId });
    if (!branch) return res.status(404).json({ message: "Filial topilmadi" });

    branch.directorIsManager = !branch.directorIsManager;
    await branch.save();

    res.json({ success: true, branch });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── RESET PASSWORD (Director tomonidan) ─────────────────────────────────────

const resetStaffPassword = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: "Faqat direktor parol yangilaya oladi" });
    }

    const staff = await Staff.findOne({ _id: req.params.id, director: req.user.id });
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    const newPassword   = generateTempPassword();
    // ✅ TUZATILDI — xuddi createStaff'dagi bug: qo'lda hash + pre('save')
    // hook yana hash qilib, "hash'ning hash'i" chiqarardi.
    staff.password       = newPassword;
    staff.emailVerified = false;
    await staff.save();

    res.json({
      success: true,
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

    const staff = await Staff.findOne({ verificationToken: token }).select('+verificationToken');
    if (!staff) {
      return res.status(400).json({ message: "Token noto'g'ri yoki muddati o'tgan" });
    }

    staff.emailVerified     = true;
    staff.verificationToken = undefined;
    await staff.save();

    res.json({
      success: true,
      message: "Email muvaffaqiyatli tasdiqlandi! Endi tizimga kirishingiz mumkin.",
      email: staff.email,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email majburiy' });

    const staff = await Staff.findOne({ email: email.toLowerCase() });

    // Xavfsizlik: email mavjud bo'lmasa ham bir xil javob qaytaramiz
    if (!staff) {
      return res.json({ success: true, message: "Agar email mavjud bo'lsa, tiklash xati yuborildi" });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    // ✅ TUZATILDI: Staff.js modelida bu fieldlar endi mavjud
    staff.resetPasswordToken   = resetToken;
    staff.resetPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 soat
    await staff.save();

    try {
      // ✅ FRONTEND_URL dan faqat birinchi domenni olamiz (vergul bo'lsa)
      const baseUrl = (process.env.FRONTEND_URL || 'https://schoolfonds.netlify.app')
        .split(',')[0]
        .trim();
      const resetLink = `${baseUrl}/reset-password/${resetToken}`;
      await sendPasswordResetEmail({ toEmail: staff.email, name: staff.name, resetLink });
    } catch (emailErr) {
      console.error('[Email] Parol tiklash xati ketmadi:', emailErr.message);
    }

    res.json({ success: true, message: "Agar email mavjud bo'lsa, tiklash xati yuborildi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── RESET PASSWORD (token orqali) ───────────────────────────────────────────

const resetPasswordByToken = async (req, res) => {
  try {
    const { token } = req.params;

    // ✅ TUZATILDI: frontend { password } yuboradi, { newPassword } emas
    const newPassword = req.body.password || req.body.newPassword;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token va yangi parol majburiy" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parol kamida 6 ta belgi bo'lishi kerak" });
    }

    // ✅ TUZATILDI: resetPasswordToken select:false — .select('+resetPasswordToken') kerak
    const staff = await Staff.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!staff) {
      return res.status(400).json({
        success: false,
        message: "Token noto'g'ri yoki muddati o'tgan (24 soat)",
      });
    }

    // Parol yangilash (pre-save hook hash qiladi)
    staff.password             = newPassword;
    staff.resetPasswordToken   = undefined;
    staff.resetPasswordExpires = undefined;
    await staff.save();

    res.json({
      success: true,
      message: "Parol muvaffaqiyatli yangilandi. Endi tizimga kirishingiz mumkin.",
    });
  } catch (err) {
    console.error('[resetPasswordByToken]', err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── CHANGE OWN PASSWORD ──────────────────────────────────────────────────────

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

    const staff = await Staff.findById(req.user.id).select('+password');
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });

    const isMatch = await bcrypt.compare(currentPassword, staff.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Joriy parol noto'g'ri" });
    }

    staff.password = newPassword; // pre-save hook hash qiladi
    await staff.save();

    res.json({ success: true, message: "Parol muvaffaqiyatli yangilandi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── GET MY PROFILE ───────────────────────────────────────────────────────────

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
  assignManager,
  becomeManagerToo,
  resetStaffPassword,
  verifyEmail,
  forgotPassword,
  resetPasswordByToken,
  changeOwnPassword,
  getMyProfile,
};