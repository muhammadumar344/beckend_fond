// src/controllers/referralController.js — TUZATILGAN
const Teacher        = require('../models/Teacher')
const PaymentRequest = require('../models/PaymentRequest')
const crypto         = require('crypto')

// Taklif havolasi FRONTEND_URL dan olinadi. Ilgari netlify domeni
// qattiq yozilgan edi — .uz ga o'tilgandan keyin ham eski manzilni
// ulashib yuboraverardi.
//
// ⚠️ Zaxira qiymat ataylab netlify manzili — u HAR DOIM ishlaydi.
//    Bu yerga hali sotib olinmagan domenni yozmang: env buzilgan
//    kunda taklif havolalari umuman ochilmay qoladi.
const FRONTEND = (process.env.FRONTEND_URL || 'https://schoolfonds.netlify.app')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '')   // oxiridagi "/" olib tashlanadi

const REFERRAL_BONUS_DAYS = 15   // Ikkalasiga beriladigan bonus

// ── Referral kod generatsiya ─────────────────────────────────
const generateCode = (name) => {
  const base   = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${base}-${suffix}`
}

// ── Teacher o'z referral ma'lumotlarini ko'radi ──────────────
exports.getMyReferral = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('name referralCode referralBonusDays referralCount')
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher topilmadi' })

    // Kod yo'q bo'lsa — yaratib berish
    if (!teacher.referralCode) {
      teacher.referralCode = generateCode(teacher.name)
      await teacher.save()
    }

    // Bu teacher tomonidan ro'yxatdan o'tganlar
    const referredTeachers = await Teacher.find({ referredBy: teacher._id })
      .select('name email plan planExpiresAt freezeStartedAt createdAt')
      .sort({ createdAt: -1 })

    // ✅ XATO TUZATILDI: t.planActive emas, t.isPlanActive() — bu method, field emas
    const paidReferrals = referredTeachers.filter(
      t => t.plan !== 'free' && t.isPlanActive()
    ).length

    res.json({
      success: true,
      referralCode:   teacher.referralCode,
      referralLink:   `${FRONTEND}?ref=${teacher.referralCode}`,
      bonusDays:      teacher.referralBonusDays || 0,
      referralCount:  referredTeachers.length,
      paidReferrals,
      // ✅ Frontend uchun planActive ni hisoblab qo'shamiz (field emas, lekin chiqishda kerak)
      referred: referredTeachers.map(t => ({
        _id:        t._id,
        name:       t.name,
        email:      t.email,
        plan:       t.plan,
        planActive: t.isPlanActive(),
        createdAt:  t.createdAt,
      })),
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Referral kodni tekshirish (landing page uchun) ───────────
exports.checkCode = async (req, res) => {
  try {
    const { code } = req.params
    const teacher = await Teacher.findOne({ referralCode: code.toUpperCase() })
      .select('name referralCode')

    if (!teacher) {
      return res.status(404).json({ success: false, error: "Referral kod topilmadi" })
    }
    res.json({ success: true, referrer: { name: teacher.name, code: teacher.referralCode } })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Admin: Referral kodni teacher ga qo'llash ────────────────
// paymentRequestController.js dan chaqiriladi (teacher birinchi marta plan sotib olganda)
exports.applyReferralBonus = async (newTeacherId) => {
  try {
    const newTeacher = await Teacher.findById(newTeacherId)
    if (!newTeacher?.referredBy) return

    const referrer = await Teacher.findById(newTeacher.referredBy)
    if (!referrer) return

    // Referrer ga bonus qo'shish
    const bonusMs = REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000

    if (referrer.plan !== 'free') {
      // Aktiv plan bor — ustiga qo'shamiz
      const base    = referrer.isPlanActive() ? referrer.planExpiresAt : new Date()
      const newDate = new Date(new Date(base).getTime() + bonusMs)
      referrer.planExpiresAt = newDate
    }

    referrer.referralBonusDays = (referrer.referralBonusDays || 0) + REFERRAL_BONUS_DAYS
    referrer.referralCount     = (referrer.referralCount || 0) + 1
    await referrer.save()

    // Yangi teacher ga ham bonus
    newTeacher.referralBonusDays = (newTeacher.referralBonusDays || 0) + REFERRAL_BONUS_DAYS
    await newTeacher.save()

    console.log(`✅ Referral bonus: ${referrer.name} → +${REFERRAL_BONUS_DAYS} kun`)
    return true
  } catch (e) {
    console.error('applyReferralBonus error:', e.message)
    return false
  }
}

// ── Admin: Barcha referral statistikasi ─────────────────────
exports.getReferralStats = async (req, res) => {
  try {
    const teachers = await Teacher.find({ referralCode: { $exists: true, $ne: null } })
      .select('name email referralCode referralCount referralBonusDays plan planExpiresAt freezeStartedAt')
      .sort({ referralCount: -1 })

    const totalReferrals  = teachers.reduce((s, t) => s + (t.referralCount || 0), 0)
    const totalBonusDays  = teachers.reduce((s, t) => s + (t.referralBonusDays || 0), 0)
    const topReferrers    = teachers
      .filter(t => (t.referralCount || 0) > 0)
      .slice(0, 10)
      .map(t => ({
        _id:               t._id,
        name:              t.name,
        email:             t.email,
        referralCode:      t.referralCode,
        referralCount:     t.referralCount,
        referralBonusDays: t.referralBonusDays,
        plan:              t.plan,
        // ✅ Bu yerda ham method to'g'ri chaqirildi
        planActive:        t.isPlanActive(),
      }))

    res.json({
      success: true,
      stats: { totalReferrals, totalBonusDays, activeReferrers: topReferrers.length },
      topReferrers,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}