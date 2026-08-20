// src/models/Role.js
// Har bir muassasa (Director) o'zining custom rollarini yaratishi mumkin
// + default rollar avtomatik beriladi
const mongoose = require('mongoose')

// Barcha mumkin bo'lgan ruxsat turlari.
//
// ⚠️ RO'YXAT UCH JOYDA MOS BO'LISHI SHART:
//    1. shu enum
//    2. backend'da `requirePermission` / `requireAnyPermission`
//    3. frontend `lc/StaffManagement.vue` dagi taklif ro'yxati
//
//    2026-08-20 da audit qilindi va uch xil nomuvofiqlik topildi:
//    · sakkizta huquq interfeysda taklif qilinardi, lekin hech
//      qayerda TEKSHIRILMASDI — direktor bergan huquq hech narsa
//      ochmasdi ("Xabar yuborish", "Jadvalni ko'rish" va h.k.).
//      Ular olib tashlandi.
//    · `manageSubjects` va `manageRooms` tekshiriladi, lekin
//      interfeysda TAKLIF QILINMASDI — ya'ni ularni berib
//      bo'lmasdi. Interfeysga qo'shildi.
//    · `viewGrades` va `viewStaff` taklif qilinardi-yu ishlamasdi
//      — endi haqiqiy "faqat ko'rish" darajasi.
//
//    Yangi huquq qo'shsangiz uchala joyni ham yangilang.
//    `npm run check:perms` (frontend) buni nazorat qiladi.
const PERMISSION_TYPES = [
  // Guruhlar
  'manageGroups',      // guruh yaratadi/tahrirlaydi/o'chiradi
  // O'quvchilar
  'manageStudents',    // o'quvchi qo'shadi/tahrirlaydi/o'chiradi
  'viewStudents',      // faqat ko'radi
  // Davomat
  'manageAttendance',  // davomat oladi
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
  // Filiallar
  'manageBranches',    // filiallarni boshqaradi
  'viewBranchStats',   // o'z filiali statistikasi
  // Jadval
  'manageSchedule',    // jadval tuzadi
  // ⚠️ Xonalar. Bu `manageSchedule` dan ALOHIDA huquq: jadval
  //    tuzadigan odam dars qo'yadi, lekin binoni qayta
  //    rejalashtirmaydi. Xonani arxivlash butun jadvalga
  //    tegadi — o'sha xonadagi darslar bandligi tekshirilmaydigan
  //    matnga aylanadi.
  //    Xona ro'yxatini KO'RISH uchun huquq kerak emas: jadval
  //    sahifasi uni har safar o'qiydi.
  'manageRooms',       // xona qo'shadi/tahrirlaydi/arxivlaydi
  // Hisobotlar
  'viewReports',
  // Lidlar (CRM voronkasi)
  'manageLeads',       // lid qo'shadi/tahrirlaydi/o'quvchiga aylantiradi
  'viewLeads',         // faqat ko'radi
  // Vazifalar (kelgusi funksiya uchun zamin)
  'manageHomework',
  'viewHomework',
  // Umumiy
  'manageSubjects',    // fanlar ro'yxatini boshqaradi (Rus tili, IT va h.k.)
  // ⚠️ O'zgarishlar tarixi. Direktorda bu huquq AVTOMATIK bor.
  //    Xodimga berishdan oldin o'ylab ko'ring: o'z izini ko'ra
  //    oladigan administrator uchun jurnal ogohlantirishga
  //    aylanadi va u tekshiruvdan oldin izini yashira boshlaydi.
  'viewAudit',         // kim nimani o'zgartirganini ko'radi
  // ⚠️ Kassa. O'Z smenasini yopish uchun bu huquq KERAK EMAS —
  //    `managePayments` yetadi: pul olgan odam o'zi sanaydi.
  //    `viewCash` — BOSHQALARNING kassasini ko'rish, ya'ni
  //    nazorat. Filial rahbariga berish mantiqiy, kassaning
  //    o'ziga esa — yo'q.
  'viewCash',          // hamma xodimning kunlik kassasini ko'radi
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

    // ── Qo'shimcha mashg'ulot ────────────────────────────────
    // Shu roldagi xodimlar o'quvchiga "qo'shimcha dars"ga
    // yozilish ro'yxatida chiqadi.
    //
    // ⚠️ HAR QANDAY USTOZ SUPPORT USTOZI EMAS. Ilgari o'quvchiga
    //    o'z guruhlarining ustozlari ko'rsatilardi — ya'ni dars
    //    o'tayotgan ustoz ustiga-ustak qo'shimcha mashg'ulot ham
    //    o'tkazishi kutilardi. Markazlarda esa buning uchun
    //    ALOHIDA odam olinadi. Endi ro'yxat rolga qarab tuziladi.
    //
    // ⚠️ Bayroq ROLDA, xodimda emas: markaz "Support Teacher"
    //    rolini bir marta belgilaydi, keyin unga qancha odam
    //    qo'shsa ham qo'shimcha sozlash kerak emas.
    isSupport: { type: Boolean, default: false },

    isDefault: { type: Boolean, default: false }, // tizim tomonidan avtomatik yaratilgan
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

roleSchema.index({ director: 1, slug: 1 }, { unique: true })

// ⚠️ ESKIRGAN HUQUQLAR JIMGINA TASHLANADI, xato bermaydi.
//    2026-08-20 da sakkizta huquq ro'yxatdan olib tashlandi —
//    ular interfeysda taklif qilinardi, lekin backend'da hech
//    qayerda tekshirilmasdi (`sendSMS`, `viewSchedule` va h.k.).
//    Bazadagi eski rollarda ular hali ham yotibdi. Enum xato
//    tashlasa, direktor eski rolni tahrirlashga urinib
//    "validation failed" olardi va o'zi hech narsa qila
//    olmasdi. Shuning uchun yozishda jimgina tozalanadi.
roleSchema.pre('validate', function (next) {
  if (Array.isArray(this.permissions)) {
    this.permissions = this.permissions.filter((p) =>
      PERMISSION_TYPES.includes(p),
    )
  }
  next()
})


// Boshqa fayllarda (masalan frontend uchun) ro'yxatni ishlatish mumkin bo'lsin
roleSchema.statics.PERMISSION_TYPES = PERMISSION_TYPES

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema)