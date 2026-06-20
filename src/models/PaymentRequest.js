// src/models/PaymentRequest.js
const mongoose = require('mongoose')

const paymentRequestSchema = new mongoose.Schema({
  teacher:  { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  plan:     { type: String, enum: ['pro', 'premium'], required: true },
  months:   { type: Number, default: 1, min: 1, max: 12 },

  // To'lov screenshoti — base64 (max ~2MB)
  screenshot:     { type: String, required: true },
  screenshotSize: { type: Number, default: 0 },   // bytes

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },

  // Admin javobi
  adminNote:   { type: String, default: '' },
  reviewedAt:  { type: Date, default: null },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

  // Qancha summa to'landi (ma'lumot uchun)
  amount: { type: Number, default: 0 },

}, { timestamps: true })

// Index — teacher bo'yicha tez qidirish
paymentRequestSchema.index({ teacher: 1, status: 1 })
paymentRequestSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema)