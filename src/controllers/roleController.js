// src/controllers/roleController.js
const Role = require('../models/Role')

// Tizim tomonidan har bir Director uchun avtomatik yaratiladigan default rollar
const DEFAULT_ROLES = [
  {
    name: 'Branch Manager', slug: 'branch_manager',
    permissions: {
      manageStaff: true, manageBranches: false, manageGroups: true,
      manageStudents: true, manageAttendance: true, manageGrades: true,
      managePayments: true, manageSalaries: false,
      viewBranchStats: true, viewAllStats: false,
    },
  },
  {
    name: 'Administration', slug: 'administration',
    permissions: {
      manageStaff: false, manageBranches: false, manageGroups: true,
      manageStudents: true, manageAttendance: false, manageGrades: false,
      managePayments: true, manageSalaries: false,
      viewBranchStats: true, viewAllStats: false,
    },
  },
  {
    name: 'Teacher', slug: 'teacher',
    permissions: {
      manageStaff: false, manageBranches: false, manageGroups: false,
      manageStudents: false, manageAttendance: true, manageGrades: true,
      managePayments: false, manageSalaries: false,
      viewBranchStats: false, viewAllStats: false,
    },
  },
  {
    name: 'Support Teacher', slug: 'support_teacher',
    permissions: {
      manageStaff: false, manageBranches: false, manageGroups: false,
      manageStudents: false, manageAttendance: true, manageGrades: false,
      managePayments: false, manageSalaries: false,
      viewBranchStats: false, viewAllStats: false,
    },
  },
]

// ── Director birinchi marta LC tanlaganda chaqiriladi ────────
exports.createDefaultRoles = async (directorId) => {
  try {
    const existing = await Role.countDocuments({ director: directorId })
    if (existing > 0) return // allaqachon yaratilgan

    const roles = DEFAULT_ROLES.map(r => ({
      director: directorId,
      name: r.name,
      slug: r.slug,
      permissions: r.permissions,
      isDefault: true,
    }))
    await Role.insertMany(roles)
    console.log(`✅ ${roles.length} ta default rol yaratildi (director: ${directorId})`)
  } catch (e) {
    console.error('createDefaultRoles error:', e.message)
  }
}

// ── Director: barcha rollarni ko'rish ────────────────────────
exports.getMyRoles = async (req, res) => {
  try {
    const roles = await Role.find({ director: req.user.id, isActive: true }).sort({ isDefault: -1, createdAt: 1 })
    res.json({ success: true, roles })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Director: yangi custom rol yaratish ─────────────────────
exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Rol nomi majburiy' })
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    const existing = await Role.findOne({ director: req.user.id, slug })
    if (existing) {
      return res.status(400).json({ success: false, error: 'Bu nomdagi rol allaqachon mavjud' })
    }

    const role = await Role.create({
      director: req.user.id,
      name: name.trim(),
      slug,
      permissions: {
        manageStaff:     !!permissions?.manageStaff,
        manageBranches:  !!permissions?.manageBranches,
        manageGroups:    !!permissions?.manageGroups,
        manageStudents:  !!permissions?.manageStudents,
        manageAttendance:!!permissions?.manageAttendance,
        manageGrades:    !!permissions?.manageGrades,
        managePayments:  !!permissions?.managePayments,
        manageSalaries:  !!permissions?.manageSalaries,
        viewBranchStats: !!permissions?.viewBranchStats,
        viewAllStats:    false, // faqat director uchun, custom rolga berilmaydi
      },
      isDefault: false,
    })

    res.status(201).json({ success: true, message: 'Yangi rol yaratildi', role })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Rol o'chirish (faqat custom, default emas) ──────────────
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findOne({ _id: req.params.roleId, director: req.user.id })
    if (!role) return res.status(404).json({ success: false, error: 'Rol topilmadi' })
    if (role.isDefault) {
      return res.status(400).json({ success: false, error: 'Standart rollarni o\'chirish mumkin emas' })
    }

    const Staff = require('../models/Staff')
    const staffCount = await Staff.countDocuments({ role: role._id })
    if (staffCount > 0) {
      return res.status(400).json({ success: false, error: `Bu rolda ${staffCount} ta xodim bor, avval ularni o'zgartiring` })
    }

    role.isActive = false
    await role.save()
    res.json({ success: true, message: 'Rol o\'chirildi' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}