// backend/src/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now }
});

// ✅ Xarajatlar sinf va davr bo'yicha so'raladi
expenseSchema.index({ class: 1, month: 1, year: 1 });
expenseSchema.index({ teacher: 1 });

module.exports = mongoose.model('Expense', expenseSchema);