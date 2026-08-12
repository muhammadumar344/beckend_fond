// backend/src/models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  parentPhone: String,
  rollNumber: Number,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Loyihadagi eng ko'p ishlatiladigan so'rov — Student.find({ class })
// va uning ustiga .sort({ rollNumber }). Ikkalasini bitta indeks qoplaydi.
studentSchema.index({ class: 1, rollNumber: 1 });

module.exports = mongoose.model('Student', studentSchema);