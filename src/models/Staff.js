// src/models/Staff.js
// Branch Manager, Teacher, Support Teacher va boshqa barcha xodimlar
// (Director EMAS — director bu Teacher modelining o'zi, institutionType='learning_center')
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const staffSchema = new mongoose.Schema({
  director: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true }, // qaysi muassasaga tegishli
  branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },    // qaysi filialga tegishli (null = director darajasida)
  role:     { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },

  name:     { type: String, required: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone:    { type: String, default: '' },

  // ── Email verifikatsiya ──────────────────────────────────
  emailVerified:       { type: Boolean, default: false },
  verificationToken:   { type: String, default: null, select: false },
  verificationSentAt:  { type: Date, default: null },

  // ── Director ham branch manager bo'lishi mumkin (flag) ──
  isAlsoDirector: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null }, // kim yaratdi (director yoki branch manager)

  isActive:  { type: Boolean, default: true },
}, { timestamps: true })

// Email — director doirasida unikal (bir xil email ikki muassasada bo'lishi mumkin emas, lekin biz global unique qo'yamiz xavfsizlik uchun)
staffSchema.index({ email: 1 }, { unique: true })
staffSchema.index({ director: 1, branch: 1 })

staffSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

staffSchema.methods.comparePassword = async function(p) {
  return bcrypt.compare(p, this.password)
}

module.exports = mongoose.model('Staff', staffSchema)