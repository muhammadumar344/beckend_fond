const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const teacherSchema = new mongoose.Schema({
  userId:           { type: String, default: null, index: true }, // optional: external auth id
  name:             { type: String, required: true },
  email:            { type: String, required: true, unique: true, lowercase: true },
  password:         { type: String, required: true, select: false },
  phone:            { type: String, default: '' },

  // ✅ YANGI — ro'yxatdan o'tishda email tasdiqlash uchun
  emailVerified:           { type: Boolean, default: false },
  verificationCode:        { type: String, select: false },
  verificationCodeExpires: { type: Date,   select: false },

  // ✅ Parol tiklash. Ilgari bu maydonlar FAQAT Staff'da bor edi va
  // direktorning parolni tiklash imkoni umuman yo'q edi: "Parolni
  // unutdingizmi?" formasi Staff kolleksiyasidan qidirar, direktorni
  // topa olmas, lekin xavfsizlik uchun "xat yuborildi" deb javob
  // qaytarardi. Ya'ni xato jimgina yutilardi — foydalanuvchi xat
  // kutib qolardi.
  resetPasswordToken:   { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date,   default: null, select: false },

  plan:             { type: String, enum: ['free','pro','premium'], default: 'free' },
  planExpiresAt:    { type: Date, default: null },
  highestPlanEver:  { type: String, enum: ['free','pro','premium'], default: 'free' },

  freezeStartedAt:   { type: Date,   default: null },
  freezeRemainingMs: { type: Number, default: 0 },

  onboardingCompleted: { type: Boolean, default: false },
  institutionType:     { type: String, enum: ['school','learning_center', null], default: null },
  institutionName:     { type: String, default: '' },
  city:                { type: String, default: '' },

  // ✅ Muassasa brendi (white-label) — o'quv markazi o'z logotipini
  // qo'yadi va sidebar'da Lumo nomi o'rniga o'zi ko'rinadi.
  //
  // `logo` IKKI xil qiymat tutishi mumkin:
  //   1. Cloudinary manzili — `https://res.cloudinary.com/...`  (yangi)
  //   2. base64 data URL  — `data:image/png;base64,...`         (eski)
  //
  // Ikkalasi ham <img src> ga to'g'ridan-to'g'ri tushadi, shuning
  // uchun frontend uchun farqi yo'q va migratsiya shart emas.
  // Cloudinary yoqilganda yangi yuklamalar 1-turga o'tadi; eski
  // yozuvlarni ko'chirish uchun: scripts/migrate-logos-cloudinary.js
  //
  // Sozlash: config/cloudinary.js
  logo:      { type: String, default: '' },
  logoSize:  { type: Number, default: 0 },   // bytes
  // Cloudinary'dagi identifikator — almashtirishda/o'chirishda eskisini
  // tozalash uchun kerak. base64 logotipda bo'sh.
  logoPublicId: { type: String, default: '' },
  // Brend rangi — sidebar sarlavhasi va urg'u elementlari uchun
  brandColor: { type: String, default: '' },
  studentCountRange:   { type: String, enum: ['1-50','51-150','151-300','300+', null], default: null },

  referralCode:        { type: String, default: null, sparse: true },
  referredBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  referralCount:       { type: Number, default: 0 },
  referralBonusDays:   { type: Number, default: 0 },

  isActive:       { type: Boolean, default: true },

  // ── Hisobni o'chirish (30 kunlik muhlat bilan) ──────────────
  // `deletionScheduledFor` qo'yilgan bo'lsa hisobga KIRIB BO'LMAYDI,
  // lekin ma'lumot hali joyida — shu sanagacha tiklash mumkin.
  // Muhlat o'tgach cron/accountCleanupCron.js butunlay o'chiradi.
  //
  // ⚠️ `isActive` GA TEGILMAYDI. U admin blokirovkasi uchun. Ikkalasini
  //    bitta maydonga yig'sak, admin bloklagan direktor "tiklash"
  //    tugmasini bosib o'zini o'zi ochib olardi.
  deletionRequestedAt:  { type: Date, default: null },
  deletionScheduledFor: { type: Date, default: null },

  registeredDate: { type: Date, default: Date.now },
}, {
  timestamps: true
})

teacherSchema.index({ referralCode: 1 }, { unique: true, sparse: true })

teacherSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  try {
    this.password = await bcrypt.hash(this.password, 10)
  } catch (e) {
    return next(e)
  }
  next()
})

teacherSchema.methods.comparePassword = async function(p) {
  return bcrypt.compare(p, this.password)
}

teacherSchema.methods.isPlanActive = function() {
  if (this.plan === 'free') return true
  if (this.freezeStartedAt) return true
  if (!this.planExpiresAt) return false
  return new Date() < new Date(this.planExpiresAt)
}

teacherSchema.methods.daysLeft = function() {
  if (this.plan === 'free') return 0
  if (this.freezeStartedAt && this.freezeRemainingMs > 0) {
    return Math.max(0, Math.ceil(this.freezeRemainingMs / 86400000))
  }
  if (!this.planExpiresAt) return 0
  return Math.max(0, Math.ceil((new Date(this.planExpiresAt) - new Date()) / 86400000))
}

teacherSchema.methods.activePlan = function() { return this.isPlanActive() ? this.plan : 'free' }
teacherSchema.methods.isFrozen = function() { return !!this.freezeStartedAt }

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema)