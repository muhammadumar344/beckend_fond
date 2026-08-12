// src/controllers/authController.js
const jwt    = require('jsonwebtoken')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const Admin   = require('../models/Admin')
const Teacher = require('../models/Teacher')
const Staff   = require('../models/Staff')
const { sendVerificationCode } = require('../services/emailService')

// ✅ TUZATILDI — MUHIM XAVFSIZLIK: avval bu yerda zaxira (fallback) qiymat
// qattiq yozilgan edi ('fond-school-secret-2024'). Agar muhitda JWT_SECRET
// sozlanmasa, tizim SHU ma'lum qiymat bilan token imzolab, ishlashda davom
// etardi — bu qiymatni bilgan har kim istalgan hisob (hatto Admin) uchun
// soxta token yasashi mumkin edi. Endi zaxira YO'Q: JWT_SECRET sozlanmasa,
// server umuman ishga tushmaydi (server.js'dagi tekshiruvga qarang).
const JWT_SECRET = process.env.JWT_SECRET

const generateToken = (id, role) => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '30d' })

const generateReferralCode = (name) => {
  const base   = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${base}-${suffix}`
}

const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000))
const CODE_TTL_MS = 15 * 60 * 1000

// ══ SETUP ════════════════════════════════════════════════════════════════════
exports.checkSetup = async (req, res) => {
  try {
    const admin = await Admin.findOne()
    res.json({ setupRequired: !admin })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ══ ADMIN ═════════════════════════════════════════════════════════════════════
exports.createAdmin = async (req, res) => {
  try {
    if (await Admin.findOne()) return res.status(400).json({ error: 'Admin allaqachon mavjud' })
    const { name, email, password } = req.body
    if (!name?.trim())                        return res.status(400).json({ error: 'Ism majburiy' })
    if (!email?.trim())                       return res.status(400).json({ error: 'Email majburiy' })
    if (!password || password.length < 6)     return res.status(400).json({ error: 'Parol kamida 6 belgi' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email noto'g'ri" })

    const admin = new Admin({ name: name.trim(), email: email.toLowerCase(), password })
    await admin.save()
    const token = generateToken(admin._id, 'admin')
    res.status(201).json({
      message: 'Admin yaratildi',
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu email band' })
    res.status(500).json({ error: err.message })
  }
}

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })
    const admin = await Admin.findOne({ email }).select('+password')
    if (!admin || !(await admin.comparePassword(password)))
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
    const token = generateToken(admin._id, 'admin')
    res.json({ token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ══ TEACHER — RO'YXATDAN O'TISH ════════════════════════════════════════════════
exports.teacherRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name?.trim())    return res.status(400).json({ error: 'Ism-familya majburiy' })
    if (!email?.trim())   return res.status(400).json({ error: 'Email majburiy' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email noto'g'ri" })
    if (!password || password.length < 6) return res.status(400).json({ error: 'Parol kamida 6 belgi' })

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await Teacher.findOne({ email: normalizedEmail }).select('+password +verificationCode +verificationCodeExpires')

    const code = generateVerificationCode()

    if (existing) {
      if (existing.emailVerified) {
        return res.status(400).json({
          error: "Bu email allaqachon ro'yxatdan o'tgan. Login qiling.",
          alreadyVerified: true,
        })
      }
      existing.name = name.trim()
      existing.password = password
      existing.verificationCode = code
      existing.verificationCodeExpires = new Date(Date.now() + CODE_TTL_MS)
      await existing.save()
    } else {
      const teacher = new Teacher({
        name: name.trim(),
        email: normalizedEmail,
        password,
        emailVerified: false,
        verificationCode: code,
        verificationCodeExpires: new Date(Date.now() + CODE_TTL_MS),
        referralCode: generateReferralCode(name),
      })
      await teacher.save()
    }

    try {
      await sendVerificationCode({ toEmail: normalizedEmail, name: name.trim(), code })
    } catch (emailErr) {
      console.error('[Email] Tasdiqlash kodi ketmadi:', emailErr.message)
      return res.status(500).json({ error: "Email yuborishda xatolik. Birozdan so'ng qayta urinib ko'ring." })
    }

    res.status(201).json({
      message: 'Tasdiqlash kodi emailingizga yuborildi',
      email: normalizedEmail,
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu email band' })
    console.error('teacherRegister error:', err)
    res.status(500).json({ error: err.message })
  }
}

exports.verifyTeacherEmail = async (req, res) => {
  try {
    const { email, code } = req.body
    if (!email || !code) return res.status(400).json({ error: 'Email va kod majburiy' })

    const normalizedEmail = email.toLowerCase().trim()
    const teacher = await Teacher.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpires')

    if (!teacher) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
    if (teacher.emailVerified) {
      return res.status(400).json({ error: 'Email allaqachon tasdiqlangan', alreadyVerified: true })
    }
    if (!teacher.verificationCode || teacher.verificationCode !== String(code).trim()) {
      return res.status(400).json({ error: "Kod noto'g'ri" })
    }
    if (!teacher.verificationCodeExpires || teacher.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: "Kod muddati tugagan. Yangi kod so'rang.", expired: true })
    }

    teacher.emailVerified = true
    teacher.verificationCode = undefined
    teacher.verificationCodeExpires = undefined
    await teacher.save()

    const token = generateToken(teacher._id, 'teacher')
    res.json({
      message: 'Email tasdiqlandi',
      token,
      user: {
        id:                  teacher._id,
        name:                teacher.name,
        email:               teacher.email,
        role:                'teacher',
        plan:                teacher.plan,
        planActive:          teacher.isPlanActive(),
        daysLeft:            teacher.daysLeft(),
        onboardingCompleted: teacher.onboardingCompleted,
        institutionType:     teacher.institutionType,
        referralCode:        teacher.referralCode,
      },
    })
  } catch (err) {
    console.error('verifyTeacherEmail error:', err)
    res.status(500).json({ error: err.message })
  }
}

exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email majburiy' })

    const normalizedEmail = email.toLowerCase().trim()
    const teacher = await Teacher.findOne({ email: normalizedEmail })
    if (!teacher) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })
    if (teacher.emailVerified) {
      return res.status(400).json({ error: 'Email allaqachon tasdiqlangan', alreadyVerified: true })
    }

    const code = generateVerificationCode()
    teacher.verificationCode = code
    teacher.verificationCodeExpires = new Date(Date.now() + CODE_TTL_MS)
    await teacher.save()

    await sendVerificationCode({ toEmail: normalizedEmail, name: teacher.name, code })

    res.json({ message: 'Yangi kod yuborildi' })
  } catch (err) {
    console.error('resendVerificationCode error:', err)
    res.status(500).json({ error: err.message })
  }
}

// ══ TEACHER — LOGIN (alohida, backward-compat uchun saqlanadi) ═══════════════
exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })
    const teacher = await Teacher.findOne({ email: email.toLowerCase().trim() }).select('+password')
    if (!teacher || !(await teacher.comparePassword(password)))
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
    if (!teacher.isActive) return res.status(403).json({ error: 'Akkaunt bloklangan' })
    if (!teacher.emailVerified) {
      return res.status(403).json({ error: 'Email hali tasdiqlanmagan', needsVerification: true, email: teacher.email })
    }

    const token = generateToken(teacher._id, 'teacher')
    res.json({
      token,
      user: {
        id:                  teacher._id,
        name:                teacher.name,
        email:               teacher.email,
        role:                'teacher',
        plan:                teacher.plan,
        planActive:          teacher.isPlanActive(),
        daysLeft:            teacher.daysLeft(),
        onboardingCompleted: teacher.onboardingCompleted,
        institutionType:     teacher.institutionType,
        referralCode:        teacher.referralCode,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ══ TEACHER — O'Z PAROLINI O'ZGARTIRISH (tizimga kirgan holda) ══════════════
// Avval direktor faqat "parolni unutdim" (email orqali) qila olardi.
// Xodimlardagi staffCtrl.changeOwnPassword bilan bir xil naqsh.
exports.teacherChangePassword = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Faqat direktor uchun' })
    }

    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Joriy va yangi parol majburiy' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgi bo\'lishi kerak' })
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Yangi parol joriysidan farq qilishi kerak' })
    }

    const teacher = await Teacher.findById(req.user.id).select('+password')
    if (!teacher) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' })

    if (!(await teacher.comparePassword(currentPassword))) {
      return res.status(400).json({ error: "Joriy parol noto'g'ri" })
    }

    // Model'dagi pre('save') hook parolni o'zi hash qiladi
    teacher.password = newPassword
    await teacher.save()

    res.json({ success: true, message: "Parol muvaffaqiyatli o'zgartirildi" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ══ STAFF — LOGIN (alohida, backward-compat uchun saqlanadi) ═════════════════
exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email va parol majburiy' })
    }

    // ✅ TUZATILDI: .select('+password') qo'shildi — Staff.js da password
    // select:false bo'lgani uchun bu bo'lmasa staff.password har doim
    // undefined bo'lib, bcrypt.compare 500 xato berardi
    const staff = await Staff.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('role',   'name slug permissions color')
      .populate('branch', 'name')

    if (!staff) return res.status(401).json({ message: "Email yoki parol noto'g'ri" })
    if (!staff.isActive) {
      return res.status(403).json({ message: "Hisobingiz bloklangan. Direktor bilan bog'laning." })
    }

    const isMatch = await staff.comparePassword(password)
    if (!isMatch) return res.status(401).json({ message: "Email yoki parol noto'g'ri" })

    const token = generateToken(staff._id, 'staff')
    res.json({
      token,
      user: {
        _id:           staff._id,
        name:          staff.name,
        email:         staff.email,
        role:          'staff',
        staffRole:     staff.role,
        branch:        staff.branch,
        position:      staff.position,
        emailVerified: staff.emailVerified,
        isActive:      staff.isActive,
      },
    })
  } catch (err) {
    console.error('[staffLogin]', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
}

// ══ UNIFIED LOGIN — bitta forma, rol avtomatik aniqlanadi ════════════════════
// POST /api/auth/login
// Teacher → Staff → Admin tartibida tekshiradi, birinchi topilgan email/parol
// mos kelgan hisobga kiritadi. Frontend rolni oldindan bilishi shart emas.
exports.unifiedLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })
    const normalizedEmail = email.toLowerCase().trim()

    // 1) TEACHER (Fonds direktori/kuratori)
    const teacher = await Teacher.findOne({ email: normalizedEmail }).select('+password')
    if (teacher) {
      const isMatch = await teacher.comparePassword(password)
      if (!isMatch) return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
      if (!teacher.isActive) return res.status(403).json({ error: 'Akkaunt bloklangan' })
      if (!teacher.emailVerified) {
        return res.status(403).json({
          error: 'Email hali tasdiqlanmagan',
          needsVerification: true,
          email: teacher.email,
        })
      }

      const token = generateToken(teacher._id, 'teacher')
      return res.json({
        token,
        user: {
          id:                  teacher._id,
          name:                teacher.name,
          email:               teacher.email,
          role:                'teacher',
          plan:                teacher.plan,
          planActive:          teacher.isPlanActive(),
          daysLeft:            teacher.daysLeft(),
          onboardingCompleted: teacher.onboardingCompleted,
          institutionType:     teacher.institutionType,
          referralCode:        teacher.referralCode,
        },
      })
    }

    // 2) STAFF (LC xodimi)
    // ✅ TUZATILDI: .select('+password') qo'shildi (aynan shu yer 500 xatoning sababi edi)
    const staff = await Staff.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('role',   'name slug permissions color')
      .populate('branch', 'name')
    if (staff) {
      const isMatch = await staff.comparePassword(password)
      if (!isMatch) return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
      if (!staff.isActive) {
        return res.status(403).json({ error: "Hisobingiz bloklangan. Direktor bilan bog'laning." })
      }

      const token = generateToken(staff._id, 'staff')
      return res.json({
        token,
        user: {
          _id:           staff._id,
          name:          staff.name,
          email:         staff.email,
          role:          'staff',
          staffRole:     staff.role,
          branch:        staff.branch,
          position:      staff.position,
          emailVerified: staff.emailVerified,
          isActive:      staff.isActive,
        },
      })
    }

    // 3) ADMIN
    const admin = await Admin.findOne({ email: normalizedEmail }).select('+password')
    if (admin) {
      const isMatch = await admin.comparePassword(password)
      if (!isMatch) return res.status(401).json({ error: "Email yoki parol noto'g'ri" })

      const token = generateToken(admin._id, 'admin')
      return res.json({
        token,
        user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' },
      })
    }

    // Hech qayerda topilmadi
    return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
  } catch (err) {
    console.error('unifiedLogin error:', err)
    res.status(500).json({ error: 'Server xatosi' })
  }
}