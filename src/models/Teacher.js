// src/models/Teacher.js — YAGONA VA TO'LIQ VERSIYA
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const teacherSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone:    String,

  plan: { type: String, enum: ['free','pro','premium'], default: 'free' },
  planExpiresAt:   { type: Date,   default: null },
  highestPlanEver: { type: String, enum: ['free','pro','premium'], default: 'free' },

  // ── FREEZE ──────────────────────────────────────────────
  freezeStartedAt:   { type: Date,   default: null },
  freezeRemainingMs: { type: Number, default: 0    },

  // ── ONBOARDING ──────────────────────────────────────────
  onboardingCompleted: { type: Boolean, default: false },
  institutionType:   { type: String, enum: ['school','learning_center',null], default: null },
  institutionName:   { type: String, default: '' },
  city:              { type: String, default: '' },
  studentCountRange: { type: String, enum: ['1-50','51-150','151-300','300+',null], default: null },

  // ── REFERRAL ✅ ─────────────────────────────────────────
  referralCode:      { type: String, default: null, sparse: true },
  referredBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  referralCount:     { type: Number, default: 0 },
  referralBonusDays: { type: Number, default: 0 },

  isActive:       { type: Boolean, default: true },
  registeredDate: { type: Date, default: Date.now },
  createdAt:      { type: Date, default: Date.now },
})

teacherSchema.index({ referralCode: 1 }, { unique: true, sparse: true })

teacherSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

teacherSchema.methods.comparePassword  = async function(p) { return bcrypt.compare(p, this.password) }
teacherSchema.methods.isPlanActive     = function() {
  if (this.plan === 'free') return true
  if (this.freezeStartedAt) return true
  if (!this.planExpiresAt) return false
  return new Date() < new Date(this.planExpiresAt)
}
teacherSchema.methods.daysLeft = function() {
  if (this.plan === 'free') return 0
  if (this.freezeStartedAt && this.freezeRemainingMs > 0)
    return Math.max(0, Math.ceil(this.freezeRemainingMs / 86400000))
  if (!this.planExpiresAt) return 0
  return Math.max(0, Math.ceil((new Date(this.planExpiresAt) - new Date()) / 86400000))
}
teacherSchema.methods.activePlan = function() { return this.isPlanActive() ? this.plan : 'free' }
teacherSchema.methods.isFrozen   = function() { return !!this.freezeStartedAt }

module.exports = mongoose.model('Teacher', teacherSchema)