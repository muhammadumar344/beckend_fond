// src/models/Schedule.js
const mongoose = require('mongoose')

const scheduleSchema = new mongoose.Schema({
  class:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },

  // Hafta kuni: 0=Dushanba, 1=Seshanba ... 5=Shanba, 6=Yakshanba
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },

  startTime: { type: String, required: true },  // "09:00"
  endTime:   { type: String, required: true },  // "10:30"

  subject:  { type: String, default: '' },   // Fan nomi
  room:     { type: String, default: '' },   // Xona raqami
  isActive: { type: Boolean, default: true },

}, { timestamps: true })

scheduleSchema.index({ class: 1, dayOfWeek: 1 })
scheduleSchema.index({ teacher: 1 })

module.exports = mongoose.model('Schedule', scheduleSchema)