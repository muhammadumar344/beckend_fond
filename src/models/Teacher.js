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

  // ✅ Qo'shimcha mashg'ulot (support) — HAR BIR MARKAZDA BO'LMAYDI.
  // Ba'zi o'quv markazlarida bunday xizmat umuman yo'q, shuning
  // uchun standart holda O'CHIQ: yo'q xizmatning menyusi, tabi va
  // "bo'sh vaqt yo'q" degan bo'sh ekranlari ko'rinib turmasin.
  //
  // Yoqilganda: CRM'da menyu paydo bo'ladi, Mini App'da "Yozilish"
  // tabi chiqadi. O'chiq bo'lsa API ham 403 qaytaradi — faqat
  // interfeysni yashirish yetarli emas.
  supportEnabled: { type: Boolean, default: false },

  // ── Support qabul vaqti — MARKAZ BO'YICHA, ustoz bo'yicha emas ──
  //
  // ⚠️ ILGARI HAR USTOZ O'ZIGA "QABUL VAQTI" QO'YARDI (SupportSlot)
  //    va bu NOTO'G'RI model edi. Support ustozi — alohida ishga
  //    olingan odam; uning butun ish kuni shu ish uchun. U qachon
  //    qabul qilishini tanlamaydi: ish vaqti davomida qabul HAR
  //    DOIM ochiq, faqat boshqa o'quvchi band qilgan 30 daqiqa
  //    bandligicha qoladi.
  //
  //    Eski modelda ustoz qabul vaqtini belgilamasa — o'quvchi
  //    uni umuman ko'rmasdi. Ya'ni ishga olingan odam, hech narsa
  //    qilmasdan, o'zini ro'yxatdan yashirib qo'ya olardi.
  //
  // ⚠️ "Har doim ochiq" ham chegarasiz emas: markaz kechasi soat
  //    3 da ishlamaydi. Shu sababli ish vaqti va ish kunlari
  //    markaz darajasida bir marta belgilanadi.
  supportHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    // ⚠️ 0 = DUSHANBA … 6 = Yakshanba — loyihadagi `Schedule`
    //    bilan bir xil. JS `getDay()` boshqacha (0 = Yakshanba).
    //    Standart: dushanbadan shanbagacha.
    days: { type: [Number], default: [0, 1, 2, 3, 4, 5] },
    // Bitta uchrashuv necha daqiqa
    slotMinutes: { type: Number, default: 30, min: 10, max: 120 },
  },

  // ── Xodim davomati ─────────────────────────────────────────
  // Ustoz ishga o'z vaqtida keldimi — filial boshqaruvchisi
  // kuzatadi, maosh hisobiga ta'sir qiladi.
  //
  // ⚠️ Standart holda O'CHIQ. Bu nozik xususiyat: xodim
  //    kuzatilayotganini bilishi kerak va markaz o'zi qaror
  //    qilsin. Yoqilmagan bo'lsa menyuda ham ko'rinmaydi.
  //
  // ⚠️ Jarima MIQDORI nolga teng bo'lishi mumkin va standart
  //    shunday. Kechikish sanaladi, lekin puldan ushlab qolish —
  //    markazning o'z qarori. Jimgina pul ushlab qoladigan
  //    tizim ishonchni buzadi.
  staffAttendance: {
    enabled: { type: Boolean, default: false },
    // Shuncha daqiqagacha kechikish "kechikish" deb sanalmaydi.
    // Nol bo'lsa bir daqiqalik kechikish ham jarima bo'lardi va
    // xodimlar tizimga ishonmay qo'yardi.
    graceMinutes: { type: Number, default: 5, min: 0, max: 60 },
    // Darsi yo'q xodimlar (buxgalter, qabulxona) uchun
    workStart: { type: String, default: "09:00" },
    // Bir marta kechikkani uchun (so'm). 0 = jarima yo'q
    latePenalty: { type: Number, default: 0, min: 0 },
    // Sababsiz kelmagan kun uchun (so'm)
    absentPenalty: { type: Number, default: 0, min: 0 },
  },

  // ── Markazning to'lov rekvizitlari ─────────────────────────
  // Ota-ona ilovada shuni ko'radi va shu kartaga o'tkazadi.
  //
  // ⚠️ PUL BIZDAN O'TMAYDI. Ota-ona to'g'ridan-to'g'ri markazning
  //    kartasiga o'tkazadi. Boshqa odamlarning pulini ushlab
  //    turish O'zbekistonda alohida litsenziya talab qiladi va
  //    biz uni olishga urinmaymiz — bizning ishimiz hisob
  //    yuritish, pul tashish emas.
  //
  // ⚠️ Karta raqami MAXFIY EMAS: u ota-onalarga berish uchun
  //    mo'ljallangan. Shunga qaramay faqat bog'langan ota-onaga
  //    ko'rsatiladi, ochiq sahifada emas.
  paymentDetails: {
    cardNumber: { type: String, default: "", trim: true },
    cardHolder: { type: String, default: "", trim: true },
    // "To'lovdan keyin chekni administratorga yuboring" kabi
    instructions: { type: String, default: "", trim: true },
  },

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

  // Parol oxirgi marta qachon almashgan — bundan OLDIN berilgan
  // tokenlar yaroqsiz (middleware/auth.js). Quyidagi pre('save')
  // hook o'zi to'ldiradi, qo'lda yozish shart emas.
  passwordChangedAt: { type: Date, default: null },

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
  // Parol almashgan payt — eski tokenlarni o'lik qilish uchun
  // (middleware/auth.js). Bu YAGONA joy: parol qaysi yo'l bilan
  // o'zgarmasin (o'zi, admin, "parolni unutdim") shu hook o'tadi.
  //
  // ⚠️ 2 soniya orqaga surilgan: JWT dagi `iat` SONIYAda yoziladi,
  //    shu soniyada berilgan token o'zini "eski" deb topib,
  //    foydalanuvchi parolni almashtirishi bilan o'zi chiqib ketardi.
  this.passwordChangedAt = new Date(Date.now() - 2000)
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