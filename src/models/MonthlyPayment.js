// src/models/MonthlyPayment.js
const mongoose = require('mongoose');

const monthlyPaymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'not_paid'],
    default: 'not_paid'
  },
  month: Number,
  year: Number,
  paidDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MonthlyPayment', monthlyPaymentSchema);