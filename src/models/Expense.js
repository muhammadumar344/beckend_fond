// ============================================================================
// FILE: src/models/Expense.js
// ============================================================================

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  reason: {
    type: String,
    required: [true, 'Xarajat sababi majburiy'],
  },
  amount: {
    type: Number,
    required: [true, 'Summa majburiy'],
    min: [0, 'Summa musbat bo\'lishi kerak'],
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Expense', expenseSchema);