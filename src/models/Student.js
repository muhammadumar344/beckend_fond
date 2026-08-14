// backend/src/models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  parentPhone: String,
  rollNumber: Number,
  isActive: { type: Boolean, default: true },

  // ⚠️ Qo'shimcha mashg'ulotga yozilib KELMAGAN o'quvchi shu
  // sanagacha qayta yozila olmaydi (3 kun). Ustoz bekorga kutib
  // o'tirmasligi uchun — joy band bo'lib, boshqa bola yozila
  // olmay qolgan edi.
  //
  // Cron o'zi qo'yadi: cron/supportCron.js
  supportBlockedUntil: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

// ✅ Loyihadagi eng ko'p ishlatiladigan so'rov — Student.find({ class })
// va uning ustiga .sort({ rollNumber }). Ikkalasini bitta indeks qoplaydi.
studentSchema.index({ class: 1, rollNumber: 1 });

module.exports = mongoose.model('Student', studentSchema);