// src/models/Role.js
// Har bir muassasa (Director) o'zining custom rollarini yaratishi mumkin
// + default rollar avtomatik beriladi
const mongoose = require('mongoose')

// ✅ Barcha mumkin bo'lgan ruxsat turlari — yangi permission qo'shilganda
// shu ro'yxatga ham qo'shing (masalan kelajakda 'manageSchedule' kabi)
// ✅ TUZATILDI — StaffManagement.vue'dagi 25 ta ruxsat (view/manage
// granularity) bilan bir xil qilindi. Oldin bu yerda faqat 11 tasi bor edi,
// StaffManagement.vue orqali yuborilgan qolgan ruxsatlar (viewGroups,
// viewStudents, manageSchedule va h.k.) enum tomonidan jimgina o'chirilib
// ketardi.
const PERMISSION_TYPES = [
  // Guruhlar
  'manageGroups',      // guruh yaratadi/tahrirlaydi/o'chiradi
  'viewGroups',        // faqat ko'radi
  // O'quvchilar
  'manageStudents',    // o'quvchi qo'shadi/tahrirlaydi/o'chiradi
  'viewStudents',      // faqat ko'radi
  // Davomat
  'manageAttendance',  // davomat oladi
  'viewAttendance',    // faqat ko'radi
  // Baholar
  'manageGrades',      // baho qo'yadi
  'viewGrades',        // faqat ko'radi
  // To'lovlar / xarajatlar
  'managePayments',    // to'lovlarni boshqaradi
  'viewPayments',      // faqat ko'radi
  'manageExpenses',    // xarajat kiritadi
  // Xodimlar
  'manageStaff',       // xodim qo'sha oladi
  'viewStaff',         // faqat ko'radi
  // Maoshlar
  'manageSalaries',    // xodimlar maoshini boshqaradi
  'viewOwnSalary',      // faqat o'z maoshini ko'radi
  // Filiallar
  'manageBranches',    // filiallarni boshqaradi
  'viewBranchStats',   // o'z filiali statistikasi
  // Jadval
  'manageSchedule',    // jadval tuzadi
  'viewSchedule',      // faqat ko'radi
  // Xabarlar
  'sendSMS',
  'sendTelegram',
  // Hisobotlar
  'viewReports',
  'exportData',
  // Lidlar (CRM voronkasi)
  'manageLeads',       // lid qo'shadi/tahrirlaydi/o'quvchiga aylantiradi
  'viewLeads',         // faqat ko'radi
  // Vazifalar (kelgusi funksiya uchun zamin)
  'manageHomework',
  'viewHomework',
  // Umumiy
  'manageSubjects',    // fanlar ro'yxatini boshqaradi (Rus tili, IT va h.k.)
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