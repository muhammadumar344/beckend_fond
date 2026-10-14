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

  // ⚠️ "Ketish arafasida" ro'yxatidan vaqtincha olib turadi.
  //    Xodim qo'ng'iroq qilgach shu sana qo'yiladi va o'quvchi
  //    bir hafta ro'yxatda ko'rinmaydi.
  //
  //    Busiz ro'yxat ishlamay qolardi: bir marta chiqqan ism
  //    u yerda abadiy turib, xodim ro'yxatga umuman qaramay
  //    qo'yardi. Har kuni bir xil beshta ismni ko'rgan odam
  //    oltinchisini ham ko'rmaydi.
  riskContactedAt: { type: Date, default: null },

  // ⚠️ SHU O'QUVCHI UCHUN INDIVIDUAL NARX (chegirma, aka-uka
  //    chegirmasi, shartnoma narxi). `null` bo'lsa guruhning
  //    umumiy narxi olinadi.
  //
  //    Bu ASOSIY guruh uchun. Qo'shimcha guruhlarda narx
  //    `Enrollment.priceOverride` da — chunki bitta o'quvchi
  //    ikki guruhda ikki xil chegirma bilan o'qishi mumkin.
  //    Asosiy guruhga `Enrollment` yozuvi YARATILMAYDI (takror
  //    bo'lardi), shuning uchun narx shu yerda turadi.
  //
  //    ⚠️ Narx `utils/pricing.js` orqali hisoblanadi — uni
  //    qo'lda o'qimang, aks holda chegirma bir joyda ishlab,
  //    boshqasida ishlamay qoladi.
  priceOverride: { type: Number, default: null, min: 0 },

  // Xodim uchun qisqa izoh ("onasi bilan bog'laning", "shartnoma
  // bor"). Ilgari `updateStudent` buni yozishga urinardi, lekin
  // sxemada maydon YO'Q edi — Mongoose uni jimgina tashlab
  // yuborardi va izoh hech qachon saqlanmasdi.
  note: { type: String, default: "", trim: true },

  createdAt: { type: Date, default: Date.now }
});

// ✅ Loyihadagi eng ko'p ishlatiladigan so'rov — Student.find({ class })
// va uning ustiga .sort({ rollNumber }). Ikkalasini bitta indeks qoplaydi.
studentSchema.index({ class: 1, rollNumber: 1 });

module.exports = mongoose.model('Student', studentSchema);