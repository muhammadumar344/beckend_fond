// src/models/Salary.js
const mongoose = require('mongoose')

const salarySchema = new mongoose.Schema({
  staff:   { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  branch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  director:{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },

  baseSalary: { type: Number, required: true, min: 0 },   // belgilangan oylik maosh
  bonus:      { type: Number, default: 0 },                 // bonus (agar bo'lsa)
  deduction:  { type: Number, default: 0 },                 // ushlab qolingan summa

  month: { type: Number, required: true },
  year:  { type: Number, required: true },

  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidAt: { type: Date, default: null },
  note:   { type: String, default: '' },
}, { timestamps: true })

salarySchema.index({ staff: 1, month: 1, year: 1 }, { unique: true })
salarySchema.index({ branch: 1, month: 1, year: 1 })

module.exports = mongoose.model('Salary', salarySchema)