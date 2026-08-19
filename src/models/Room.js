// src/models/Room.js
// ════════════════════════════════════════════════════════════
// XONA (kabinet).
//
// Ilgari xona `Schedule.room` da oddiy MATN edi. Ustoz bandligi
// tekshirilardi, xona bandligi esa — yo'q. Ya'ni ikki guruhni bir
// vaqtda bitta xonaga qo'yish mumkin edi va bu faqat dars
// boshlanganda, eshik oldida ikkita ustoz va yigirmata bola
// turganda bilinardi.
//
// Matnning ikkinchi kasali — bir xil xona har xil yoziladi:
// "205", "205-xona", "205 ", "Lab-1", "lab 1". Tizim ularni
// boshqa-boshqa xona deb biladi, ya'ni ziddiyatni topolmaydi ham.
//
// ⚠️ XONA O'CHIRILMAYDI, ARXIVLANADI (`isActive: false`).
//    Unga ishora qilgan jadvallar bor. Hujjatni o'chirsak
//    o'tgan darslar "xonasiz" bo'lib qoladi va nima bo'lganini
//    hech kim tushuntira olmaydi.
//
// ⚠️ SIG'IM TO'SIQ EMAS, OGOHLANTIRISH. 12 kishilik xonaga 14
//    bola sig'adi — stul qo'yiladi. Bloklasak administrator
//    xonani umuman tanlamay qo'yardi va biz eng muhimidan —
//    bandlik tekshiruvidan — ayrilardik.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },

    // Filialga bog'liq: turli filiallarda bir xil raqamli xona
    // bo'lishi odatiy hol ("205" ikkala binoda ham bor).
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    name: { type: String, required: true, trim: true }, // "205", "Lab-1"

    // 0 = belgilanmagan. Interfeys buni "—" deb ko'rsatadi va
    // sig'im ogohlantirishini umuman chiqarmaydi: noma'lum
    // sig'imni "cheksiz" deb hisoblash yolg'on bo'lardi.
    capacity: { type: Number, default: 0, min: 0 },

    note: { type: String, default: "", trim: true }, // "Proyektor bor"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Bitta filialda bitta nom bir marta. Faqat interfeysda tekshirish
// yetarli emas: ikki administrator bir vaqtda "205" yaratsa ikkita
// xona paydo bo'lardi va bandlik tekshiruvi ikkovini boshqa-boshqa
// deb bilardi — ya'ni butun ish behuda ketardi.
roomSchema.index({ director: 1, branch: 1, name: 1 }, { unique: true });
roomSchema.index({ director: 1, isActive: 1 });

module.exports = mongoose.model("Room", roomSchema);
