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