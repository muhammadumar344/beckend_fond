// src/models/Grade.js
const mongoose = require('mongoose')

const gradeSchema = new mongoose.Schema({
  class:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },

  subject: { type: String, required: true },       // "Matematika"
  date:    { type: String, required: true },        // "2025-06-15"
  month:   { type: Number, required: true },
  year:    { type: Number, required: true },

  score:    { type: Number, required: true, min: 0, max: 100 },  // 0-100 baho
  maxScore: { type: Number, default: 100 },

  type: {
    type: String,
    enum: ['homework', 'quiz', 'exam', 'project', 'participation'],
    default: 'homework',
  },

  note: { type: String, default: '' },
}, { timestamps: true })

gradeSchema.index({ class: 1, student: 1, date: 1 })
gradeSchema.index({ teacher: 1, month: 1, year: 1 })

module.exports = mongoose.model('Grade', gradeSchema)