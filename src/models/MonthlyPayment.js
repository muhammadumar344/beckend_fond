// backend/src/models/MonthlyPayment.js
const mongoose = require('mongoose');

const monthlyPaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  amount: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ['paid', 'not_paid'],
    default: 'not_paid'
  },
  paidDate: Date,
  createdAt: { type: Date, default: Date.now }
});

// ✅ To'lovlar, hisobotlar, dashboard va filial statistikasi — hammasi
// { class, month, year } bo'yicha so'raydi.
monthlyPaymentSchema.index({ class: 1, month: 1, year: 1 });
// "Qarzdorlar" va "to'langanlar" ro'yxatlari uchun
monthlyPaymentSchema.index({ class: 1, status: 1 });
// Telegram eslatmasi: o'quvchining to'lanmagan oylari
monthlyPaymentSchema.index({ student: 1, status: 1 });
monthlyPaymentSchema.index({ teacher: 1, month: 1, year: 1 });

module.exports = mongoose.model('MonthlyPayment', monthlyPaymentSchema);