// src/models/Role.js
// Har bir muassasa (Director) o'zining custom rollarini yaratishi mumkin
// + default rollar avtomatik beriladi
const mongoose = require('mongoose')

// ✅ Barcha mumkin bo'lgan ruxsat turlari — yangi permission qo'shilganda
// shu ro'yxatga ham qo'shing (masalan kelajakda 'manageSchedule' kabi)
const PERMISSION_TYPES = [
  'manageStaff',       // xodim qo'sha oladi
  'manageBranches',    // filiallarni boshqaradi
  'manageGroups',      // guruh yaratadi/tahrirlaydi
  'manageStudents',    // o'quvchi qo'shadi/tahrirlaydi
  'manageAttendance',  // davomat oladi
  'manageGrades',      // baho qo'yadi
  'managePayments',    // to'lovlarni boshqaradi
  'manageSalaries',    // xodimlar maoshini boshqaradi
  'manageSubjects',    // fanlar ro'yxatini boshqaradi (Rus tili, IT va h.k.)
  'viewBranchStats',   // o'z filiali statistikasi
  'viewAllStats',      // barcha filiallar statistikasi (odatda faqat director)
]

const roleSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    }, // muassasa egasi

    name: { type: String, required: true }, // "Branch Manager", "Ustoz", "Qabulxona"
    slug: { type: String, required: true }, // "branch_manager" — kod uchun

    // ✅ TUZATILDI: massiv (array) — controller shu formatda ishlaydi.
    // Masalan: ['manageGroups', 'manageStudents', 'managePayments']
    permissions: {
      type: [{ type: String, enum: PERMISSION_TYPES }],
      default: [],
    },

    // ✅ QO'SHILDI — createRole/updateRole controller shu maydonni kutadi,
    // lekin avvalgi modelda umuman yo'q edi
    color: {
      type: String,
      default: '#4299e1',
    },

    isDefault: { type: Boolean, default: false }, // tizim tomonidan avtomatik yaratilgan
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

roleSchema.index({ director: 1, slug: 1 }, { unique: true })

// Boshqa fayllarda (masalan frontend uchun) ro'yxatni ishlatish mumkin bo'lsin
roleSchema.statics.PERMISSION_TYPES = PERMISSION_TYPES

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema)