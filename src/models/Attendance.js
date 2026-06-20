// src/models/Attendance.js
const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema({
  class:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },

  date:  { type: String, required: true },  // "2025-06-15" (YYYY-MM-DD)
  month: { type: Number, required: true },  // 6
  year:  { type: Number, required: true },  // 2025

  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'present',
  },

  note: { type: String, default: '' },  // "Kasalligi bor"
}, { timestamps: true })

// Bir kunda bir o'quvchi uchun faqat bitta yozuv
attendanceSchema.index({ class: 1, student: 1, date: 1 }, { unique: true })
attendanceSchema.index({ class: 1, date: 1 })
attendanceSchema.index({ teacher: 1, month: 1, year: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)