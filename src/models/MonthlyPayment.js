const mongoose = require('mongoose');

const monthlyPaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ['paid', 'not_paid'],
    default: 'not_paid',
  },
  amount: { type: Number, default: 0 },
  paidDate: Date,
  createdAt: { type: Date, default: Date.now },
});

// Bir talaba bir oyda bir marta to'lov — takror yaratilmasin
monthlyPaymentSchema.index(
  { student: 1, class: 1, month: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model('MonthlyPayment', monthlyPaymentSchema);