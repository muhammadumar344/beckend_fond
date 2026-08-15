// src/models/Staff.js
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const staffSchema = new mongoose.Schema({
  director: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  role:     { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },

  name:     { type: String, required: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone:    { type: String, default: '' },

  // ── Email verifikatsiya ──────────────────────────────────
  emailVerified:      { type: Boolean, default: false },
  verificationToken:  { type: String, default: null, select: false },
  verificationSentAt: { type: Date,   default: null },

  // ── Parol tiklash ✅ YANGI ───────────────────────────────
  resetPasswordToken:   { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date,   default: null },

  // ── Maosh qoidasi ───────────────────────────────────────
  //
  // ⚠️ HAQIQIY MARKAZLAR USTOZGA FOIZ TO'LAYDI. Hozirgacha
  //    maosh qo'lda yoziladigan qat'iy son edi va shu sababli
  //    buxgalter Excel'ni tashlamasdi: har oy har bir ustozning
  //    guruhlaridan tushgan pulni sanab, foizini hisoblab
  //    o'tirardi. CRM esa faqat natijani saqlardi.
  //
  // ⚠️ Foiz TUSHGAN puldan olinadi, hisoblangan puldan emas.
  //    Markaz ustozga o'zi olmagan puldan to'lay olmaydi. Bu
  //    ustozning ham manfaatini davomat va saqlab qolishga
  //    bog'laydi.
  //
  // Ikkalasi birga ishlaydi: `fixedAmount` — kafolatlangan
  // asos, `percent` — ustiga qo'shiladigan qism. Bittasi nol
  // bo'lsa faqat ikkinchisi qoladi.
  salaryRule: {
    // Guruh daromadining foizi (0–100)
    percent: { type: Number, default: 0, min: 0, max: 100 },
    // Qat'iy qism (so'm)
    fixedAmount: { type: Number, default: 0, min: 0 },
  },

  // ── Director ham branch manager bo'lishi mumkin ──────────
  isAlsoDirector: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  isActive:  { type: Boolean, default: true },

  // Parol oxirgi marta qachon almashgan — bundan OLDIN berilgan
  // tokenlar yaroqsiz (middleware/auth.js). Quyidagi pre('save')
  // hook o'zi to'ldiradi.
  passwordChangedAt: { type: Date, default: null },
}, { timestamps: true })

staffSchema.index({ email: 1 }, { unique: true })
staffSchema.index({ director: 1, branch: 1 })

staffSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  // Eski tokenlarni o'lik qilish uchun — Teacher.js dagi izohga qarang
  this.passwordChangedAt = new Date(Date.now() - 2000)
  next()
})

staffSchema.methods.comparePassword = async function(p) {
  return bcrypt.compare(p, this.password)
}

module.exports = mongoose.model('Staff', staffSchema)