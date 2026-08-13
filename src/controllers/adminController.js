// src/controllers/adminController.js
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const Student = require('../models/Student')
const Admin = require('../models/Admin')
const MonthlyPayment = require('../models/MonthlyPayment')
const TelegramParent = require('../models/TelegramParent')
const {
  SCHOOL,
  LC,
  limitsFor,
  priceFor,
  featuresFor,
} = require('../utils/planHelper')
const crypto = require('crypto')
// ✅ XATO TUZATILDI: 'referalController' import o'chirildi
// (fayl nomi noto'g'ri yozilgan edi, va bu yerda ishlatilmaydi —
//  applyReferralBonus faqat paymentRequestController.js da kerak)

const generateReferralCode = (name) => {
  const base   = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${base}-${suffix}`
}

// ✅ createAdmin bu yerda YO'Q — u authController.js da (POST /api/auth/setup)

// Admin dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalTeachers = await Teacher.countDocuments()
    const totalClasses = await Class.countDocuments()
    const totalStudents = await Student.countDocuments()
    const totalTelegramParents = await TelegramParent.countDocuments({ isActive: true })

    const teachers = await Teacher.find().select('-password').sort({ createdAt: -1 })

    const teachersWithStats = await Promise.all(
      teachers.map(async (t) => {
        const classIds = await Class.find({ teacher: t._id }).distinct('_id')
        const classCount = classIds.length
        const studentCount = await Student.countDocuments({ class: { $in: classIds } })
        const telegramCount = await TelegramParent.countDocuments({
          teacherId: t._id,
          isActive: true,
        })

        const allPayments = await MonthlyPayment.find({ teacher: t._id })
        const totalFund = allPayments
          .filter((p) => p.status === 'paid')
          .reduce((s, p) => s + p.amount, 0)

        return {
          ...t.toObject(),
          classCount,
          studentCount,
          telegramCount,
          totalFund,
          planActive: t.isPlanActive(),
          daysLeft: t.daysLeft(),
          activePlan: t.activePlan(),
        }
      })
    )

    res.json({
      summary: { totalTeachers, totalClasses, totalStudents, totalTelegramParents },
      teachers: teachersWithStats,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Ism, email va parol majburiy' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email noto\'g\'ri formatda' })
    if (password.length < 6)
      return res.status(400).json({ error: 'Parol kamida 6 belgi' })
    if (await Teacher.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'Bu email allaqachon band' })

    // ✅ Referral kod tekshirish
    let referredBy = null
    if (referralCode) {
      const referrer = await Teacher.findOne({ referralCode: referralCode.toUpperCase() })
      if (referrer) referredBy = referrer._id
    }

    const teacher = new Teacher({
      name:          name.trim(),
      email:         email.toLowerCase(),
      password,
      phone:         phone || '',
      registeredDate: new Date(),
      referredBy,
      referralCode:  generateReferralCode(name),
    })
    await teacher.save()

    res.status(201).json({
      message: 'Teacher muvaffaqiyatli qo\'shildi',
      teacher: {
        id:           teacher._id,
        name:         teacher.name,
        email:        teacher.email,
        phone:        teacher.phone,
        plan:         teacher.plan,
        referralCode: teacher.referralCode,
        referredBy:   referredBy ? 'Ha' : 'Yo\'q',
        registeredDate: teacher.registeredDate,
      },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu email allaqachon band' })
    res.status(500).json({ error: err.message })
  }
}

// Parol yangilash
exports.updateTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Parol kamita 6 ta belgidan iborat bo'lsin" })
    }

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    teacher.password = newPassword
    await teacher.save()

    res.json({ message: 'Parol muvaffaqiyatli yangilandi' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Plan o'rnatish
exports.updateTeacherPlan = async (req, res) => {
  try {
    const { teacherId } = req.params
    const { plan, months = 1 } = req.body

    if (!['free', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "Plan: free, pro yoki premium bo'lishi kerak" })
    }

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    if (plan === 'free') {
      teacher.plan = 'free'
      teacher.planExpiresAt = null
    } else {
      const base = teacher.isPlanActive() && teacher.plan === plan
        ? teacher.planExpiresAt
        : new Date()

      const newExpiry = new Date(base)
      newExpiry.setMonth(newExpiry.getMonth() + Number(months))

      teacher.plan = plan
      teacher.planExpiresAt = newExpiry
    }

    const planRank = { free: 0, pro: 1, premium: 2 }
    if (planRank[plan] > planRank[teacher.highestPlanEver || 'free']) {
      teacher.highestPlanEver = plan
    }

    await teacher.save()
    await Class.updateMany({ teacher: teacherId }, { plan })

    res.json({
      message: `Plan yangilandi: ${plan}, ${months} oy`,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        plan: teacher.plan,
        planExpiresAt: teacher.planExpiresAt,
        daysLeft: teacher.daysLeft(),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Teacher bloklash
exports.deactivateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params
    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { isActive: false },
      { new: true }
    )
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    res.json({
      message: 'Teacher muvaffaqiyatli bloklandi',
      teacher: { id: teacher._id, name: teacher.name, isActive: teacher.isActive },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Teacher faollashtirish
exports.activateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params
    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { isActive: true },
      { new: true }
    )
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    res.json({ message: 'Teacher faollandi', teacher })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Tarif narxlari — REJIM bo'yicha ──────────────────────────
// Fond va LC narxlari boshqa: `?mode=learning_center` bilan LC
// jadvali qaytadi, aks holda Fond.
//
// ⚠️ Ro'yxat QO'LDA yozilmaydi — planHelper'dan yig'iladi. Ilgari
//    qattiq yozilgan edi va tarif o'zgarganda bu yer eskirib
//    qolardi (narx bir joyda, ro'yxat boshqa joyda).
exports.getPlanPrices = async (req, res) => {
  const mode = req.query.mode === LC ? LC : SCHOOL

  const LABELS = {
    multi_lang:       'Uch til (uz/ru/en)',
    monthly_reminder: 'Oylik eslatma',
    telegram:         'Telegram bot',
    export:           'Excel / Word export',
    import:           'Excel import',
    sms_reminder:     'SMS eslatma',
    branches:         'Filiallar',
    homework:         'Uy vazifasi va reyting',
    salaries:         'Maosh boshqaruvi',
    roles:            'Rollar va huquqlar',
    branch_stats:     'Filial statistikasi',
    reports:          'Hisobotlar va grafiklar',
    white_label:      "O'z logotipi (white-label)",
  }

  const NAMES = { free: 'Free', pro: 'Pro', premium: 'Premium' }
  // 999+ — amalda cheksiz. "Cheksiz ta o'quvchi" g'aliz, shuning
  // uchun sanoq so'zi ("ta") faqat aniq raqamda qo'yiladi.
  const count = (n, unit) => (n >= 999 ? 'Cheksiz ' + unit : n + ' ta ' + unit)

  const plans = ['free', 'pro', 'premium'].map((id) => {
    const limits = limitsFor(id, mode)
    const feats  = featuresFor(id, mode)

    const included = []
    const notIncluded = []
    for (const [key, label] of Object.entries(LABELS)) {
      if (!(key in feats)) continue
      if (feats[key]) included.push(label)
      else notIncluded.push(label)
    }

    const size = [
      count(limits.classes, mode === LC ? 'guruh' : 'sinf'),
      count(limits.students, "o'quvchi"),
    ]
    if (mode === LC && limits.staff) size.push(count(limits.staff, 'xodim'))

    return {
      id,
      name:     NAMES[id],
      price:    priceFor(id, mode).monthly,
      classes:  limits.classes,
      students: limits.students,
      staff:    limits.staff,
      branches: limits.branches,
      features: [...size, ...included],
      notIncluded,
    }
  })

  res.json({ mode, plans })
}

