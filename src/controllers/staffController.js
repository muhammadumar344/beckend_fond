// src/controllers/staffController.js
const Staff   = require('../models/Staff')
const Role    = require('../models/Role')
const Branch  = require('../models/Branch')
const Teacher = require('../models/Teacher')
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')

const JWT_SECRET = process.env.JWT_SECRET || 'fond-school-secret-2024'

// ── Email format tekshirish (gmail.com bilan tugashi shart) ──
const isValidGmail = (email) => {
  const re = /^[^\s@]+@gmail\.com$/i
  return re.test(email)
}

// ── Tasodifiy parol generatsiya ──────────────────────────────
const generatePassword = () => {
  // 8 ta belgi: harf + raqam, o'qish oson bo'lishi uchun
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pass = ''
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

// ── Kim caqirayotganini aniqlash: Director (Teacher) yoki Staff ──
const getCallerContext = (req) => {
  // auth middleware req.user = { id, role } qo'yadi
  // role: 'teacher' (director) yoki 'staff'
  return { id: req.user.id, role: req.user.role, staffRole: req.user.staffRole || null }
}

// ============================================================
//  XODIM YARATISH (Director YOKI Branch Manager chaqiradi)
// ============================================================
exports.createStaff = async (req, res) => {
  try {
    const caller = getCallerContext(req)
    const { name, email, roleSlug, branchId, phone } = req.body

    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Ism majburiy' })
    if (!email || !isValidGmail(email)) {
      return res.status(400).json({ success: false, error: "Email @gmail.com bilan tugashi va to'g'ri formatda bo'lishi kerak" })
    }
    if (!roleSlug) return res.status(400).json({ success: false, error: 'Rol tanlanishi shart' })

    // ── Director ID ni aniqlash ──────────────────────────────
    let directorId
    let allowedBranchId = branchId || null

    if (caller.role === 'teacher') {
      // Director o'zi yaratmoqda
      directorId = caller.id
    } else if (caller.role === 'staff') {
      // Branch Manager yaratmoqda — faqat o'z filiali uchun, manageStaff ruxsati bo'lishi kerak
      const callerStaff = await Staff.findById(caller.id).populate('role')
      if (!callerStaff || !callerStaff.role.permissions.manageStaff) {
        return res.status(403).json({ success: false, error: "Xodim qo'shish huquqi yo'q" })
      }
      directorId = callerStaff.director
      allowedBranchId = callerStaff.branch // Branch manager faqat o'z filialiga qo'sha oladi
    } else {
      return res.status(403).json({ success: false, error: 'Ruxsat yo\'q' })
    }

    // ── Rolni topish ──────────────────────────────────────────
    const role = await Role.findOne({ director: directorId, slug: roleSlug, isActive: true })
    if (!role) return res.status(404).json({ success: false, error: 'Rol topilmadi' })

    // Branch manager — branch_manager yoki director rolini bera olmaydi
    if (caller.role === 'staff' && ['branch_manager'].includes(roleSlug)) {
      return res.status(403).json({ success: false, error: 'Bu rolni faqat direktor bera oladi' })
    }

    // ── Email band emasligini tekshirish ─────────────────────
    if (await Staff.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ success: false, error: 'Bu email allaqachon ishlatilgan' })
    }
    if (await Teacher.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ success: false, error: 'Bu email allaqachon ishlatilgan' })
    }

    // ── Filial tekshirish (agar ko'rsatilgan bo'lsa) ─────────
    if (allowedBranchId) {
      const branch = await Branch.findOne({ _id: allowedBranchId, teacher: directorId })
      if (!branch) return res.status(404).json({ success: false, error: 'Filial topilmadi' })
    }

    // ── Parol generatsiya va saqlash ─────────────────────────
    const plainPassword = generatePassword()
    const verificationToken = crypto.randomBytes(24).toString('hex')

    const staff = await Staff.create({
      director: directorId,
      branch: allowedBranchId,
      role: role._id,
      name: name.trim(),
      email: email.toLowerCase(),
      password: plainPassword,
      phone: (phone || '').trim(),
      verificationToken,
      verificationSentAt: new Date(),
      createdBy: caller.role === 'staff' ? caller.id : null,
    })

    // ── Tasdiqlash xati yuborish (TODO: real email service ulanganda) ──
    // Hozircha login ma'lumotlarini javobda qaytaramiz —
    // chunki direktor/manager buni xodimga o'zi yetkazadi.
    // sendVerificationEmail(staff.email, verificationToken) // keyingi bosqichda

    res.status(201).json({
      success: true,
      message: `${role.name} muvaffaqiyatli qo'shildi. Login ma'lumotlarini xodimga yuboring.`,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: role.name,
        roleSlug: role.slug,
        branch: allowedBranchId,
        // ⚠️ Parol FAQAT shu javobda bir marta ko'rsatiladi — keyin qaytarilmaydi
        generatedPassword: plainPassword,
      },
    })
  } catch (e) {
    console.error('createStaff error:', e)
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Staff login ────────────────────────────────────────────
exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })

    const staff = await Staff.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('role')
      .populate('director', 'name institutionName')
      .populate('branch', 'name')

    if (!staff || !(await staff.comparePassword(password))) {
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
    }
    if (!staff.isActive) return res.status(403).json({ error: 'Akkaunt bloklangan' })

    const token = jwt.sign(
      { id: staff._id, role: 'staff', staffRole: staff.role.slug },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      token,
      user: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: 'staff',
        staffRole: staff.role.slug,
        staffRoleName: staff.role.name,
        permissions: staff.role.permissions,
        director: staff.director,
        branch: staff.branch,
        emailVerified: staff.emailVerified,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── Director/Manager: o'z xodimlarini ko'rish ────────────────
exports.getMyStaff = async (req, res) => {
  try {
    const caller = getCallerContext(req)
    let filter = {}

    if (caller.role === 'teacher') {
      filter.director = caller.id
    } else if (caller.role === 'staff') {
      const callerStaff = await Staff.findById(caller.id)
      filter.director = callerStaff.director
      // Branch manager faqat o'z filialidagi xodimlarni ko'radi
      if (callerStaff.branch) filter.branch = callerStaff.branch
    }

    const staff = await Staff.find(filter)
      .populate('role', 'name slug permissions')
      .populate('branch', 'name')
      .sort({ createdAt: -1 })

    res.json({ success: true, total: staff.length, staff })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Xodimni bloklash/faollashtirish ──────────────────────────
exports.toggleStaffStatus = async (req, res) => {
  try {
    const { staffId } = req.params
    const staff = await Staff.findById(staffId)
    if (!staff) return res.status(404).json({ success: false, error: 'Xodim topilmadi' })

    staff.isActive = !staff.isActive
    await staff.save()

    res.json({ success: true, message: staff.isActive ? 'Faollashtirildi' : 'Bloklandi', isActive: staff.isActive })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Email tasdiqlash (link orqali) ───────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params
    const staff = await Staff.findOne({ verificationToken: token }).select('+verificationToken')
    if (!staff) return res.status(404).json({ success: false, error: 'Havola yaroqsiz yoki muddati o\'tgan' })

    staff.emailVerified = true
    staff.verificationToken = null
    await staff.save()

    res.json({ success: true, message: 'Email tasdiqlandi!' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}