// backend/src/models/Expense.js
// ════════════════════════════════════════════════════════════
// XARAJAT.
//
// ⚠️ XARAJAT KASSAGA TEGADI — VA BU KECH QO'SHILDI.
//    Ilgari `Expense` kassa bilan hech qanday bog'liq emas edi.
//    Administrator kun bo'yi naqd pul yig'adi, tushdan keyin
//    o'sha qutidan 200 000 so'm olib marker sotib oladi,
//    xarajatni tizimga kiritadi. Kechqurun smenani yopadi — va
//    tizim "kamomad 200 000" deb yozadi.
//
//    Ya'ni halol ishlagan odam har safar o'g'ri bo'lib chiqardi,
//    direktor esa jurnalda haqiqiy kamomadni soxtasidan ajrata
//    olmasdi: ikkalasi bir xil ko'rinardi.
//
// ⚠️ `paidFrom` STANDART HOLDA BO'SH — va bu ataylab.
//    Eski xarajatlarda bu maydon yo'q. Ularni "naqd" deb
//    hisoblasak, o'tmishni qayta yozgan bo'lardik: bugun
//    kiritilgan eski xarajat kassadan chiqib, kutilmagan
//    ortiqcha yoki kamomad yasardi. Bo'sh maydon = kassaga
//    TEGMAYDI. Faqat ataylab `cash` deb belgilangan xarajat
//    naqd qoldiqdan ayiriladi.
//    (Interfeysda yangi xarajat uchun standart tanlov `cash` —
//    bu boshqa narsa: u aniq qiymat yozadi.)
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  description: String,

  // Pul qayerdan chiqdi. `null` = ko'rsatilmagan (eski yozuv).
  paidFrom: {
    type: String,
    enum: ['cash', 'card', 'bank', null],
    default: null,
  },

  // ⚠️ `createdAt` EMAS, ALOHIDA MAYDON. Xarajat ertasiga
  //    kiritilishi mumkin (kechqurun ulgurmadi). `createdAt` ga
  //    tayansak, o'sha pul bugungi kassadan chiqib, kechagi
  //    kunda tushunarsiz kamomad qolardi. `MonthlyPayment.paidDate`
  //    bilan bir xil sabab.
  spentDate: { type: Date, default: Date.now },

  // ⚠️ CHEK SURATI — XARAJATNING YAGONA ISBOTI.
  //    "Marker 120 000" — bu gap. Sinf fondida esa pul ota-onalarniki
  //    va eng ko'p beriladigan savol bitta: "pulimiz qayerga ketdi?".
  //    Surat bo'lmasa javob har doim o'qituvchining so'zi bo'lib
  //    qolaveradi.
  //
  // ⚠️ FAQAT CLOUDINARY ORQALI, base64 ZAXIRASI YO'Q — logotipdan
  //    farqi shu. Logotip bitta hisobga bitta va kichik, chek esa
  //    har oy o'nlab: bazaga base64 bo'lib yozilsa, `Expense.find()`
  //    har safar o'sha rasmlarni ham xotiraga tortardi va xarajatlar
  //    sahifasi asta-sekin sekinlashib borardi. Kalit yo'q bo'lsa
  //    tugma umuman ko'rsatilmaydi (Payme/SMS bilan bir xil qoida:
  //    yarim ishlaydigan holat yasamaymiz).
  receipt: { type: String, default: "" },
  receiptPublicId: { type: String, default: "" },

  // Kassadan pulni kim oldi. Ism NUSXA qilib saqlanadi — xodim
  // ishdan ketsa ham o'tgan smenalar egasiz qolmaydi
  // (`MonthlyPayment.receivedBy` bilan bir xil qolip).
  paidBy: {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    model: { type: String, enum: ['Teacher', 'Staff', null], default: null },
    name: { type: String, default: '' },
  },

  createdAt: { type: Date, default: Date.now }
});

// ✅ Xarajatlar sinf va davr bo'yicha so'raladi
expenseSchema.index({ class: 1, month: 1, year: 1 });
expenseSchema.index({ teacher: 1 });
// Kassa: kim, qaysi kuni, naqddan qancha chiqargan
expenseSchema.index({ teacher: 1, spentDate: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
