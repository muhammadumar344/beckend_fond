// src/models/Role.js
// Har bir muassasa (Director) o'zining custom rollarini yaratishi mumkin
// + default rollar avtomatik beriladi
const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  director: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true }, // muassasa egasi
  name:     { type: String, required: true },        // "Branch Manager", "Ustoz", "Qabulxona"
  slug:     { type: String, required: true },         // "branch_manager" — kod uchun

  // ── Ruxsatlar (permissions) ──────────────────────────────
  permissions: {
    manageStaff:      { type: Boolean, default: false }, // xodim qo'sha oladi
    manageBranches:   { type: Boolean, default: false },
    manageGroups:      { type: Boolean, default: false },
    manageStudents:    { type: Boolean, default: false },
    manageAttendance:  { type: Boolean, default: false },
    manageGrades:      { type: Boolean, default: false },
    managePayments:    { type: Boolean, default: false },
    manageSalaries:    { type: Boolean, default: false },
    viewBranchStats:   { type: Boolean, default: false }, // o'z filiali statistikasi
    viewAllStats:      { type: Boolean, default: false }, // barcha filiallar (faqat director)
  },

  isDefault: { type: Boolean, default: false }, // tizim tomonidan avtomatik yaratilgan
  isActive:  { type: Boolean, default: true },
}, { timestamps: true })

roleSchema.index({ director: 1, slug: 1 }, { unique: true })

module.exports = mongoose.model('Role', roleSchema)