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

  // ⚠️ IKKI MAYDON, BITTA XONA — va bu ataylab.
  //    `roomRef` — haqiqiy xona (models/Room.js), bandlik shu
  //    bo'yicha tekshiriladi.
  //    `room` — nomning NUSXASI. Ikki sababga ko'ra saqlanadi:
  //    1) Bazada allaqachon matn bilan yozilgan darslar bor;
  //       maydonni olib tashlasak ular xonasiz qolardi.
  //    2) Xona arxivlansa ham jadvalda nomi ko'rinib turadi
  //       (AuditLog va CashShift dagi ism nusxasi bilan bir xil
  //       sabab).
  roomRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  room:     { type: String, default: '' },   // Xona nomi (nusxa)

  isActive: { type: Boolean, default: true },

}, { timestamps: true })

scheduleSchema.index({ class: 1, dayOfWeek: 1 })
scheduleSchema.index({ teacher: 1 })
// Xona bandligi kun bo'yicha qidiriladi
scheduleSchema.index({ roomRef: 1, dayOfWeek: 1 })

module.exports = mongoose.model('Schedule', scheduleSchema)