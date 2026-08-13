// src/models/Enrollment.js
// ════════════════════════════════════════════════════════════
// BITTA O'QUVCHI — BIR NECHTA GURUH (reja 1.3)
//
// O'quv markazida bitta bola ingliz tiliga ham, matematikaga ham
// qatnashadi. Ilgari buni yozib bo'lmasdi: `Student.class` bitta
// guruhga ishora qilardi va bolani ikkinchi guruhga qo'shish uchun
// uni ikkinchi marta, boshqa ism bilan yaratish kerak edi.
//
// ── NEGA `Student.class` OLIB TASHLANMADI? ──────────────────
// Unga 23 ta joyda ishora bor (davomat, baho, to'lov, hisobot,
// bot, export). Uni yo'q qilish — 23 ta joyni bir vaqtda
// o'zgartirish va jonli bazani ko'chirish demakdir.
//
// Buning o'rniga QO'SHIMCHA yo'l tanlandi:
//
//   Student.class          → "asosiy guruh" (o'zgarishsiz ishlaydi)
//   Enrollment             → QO'SHIMCHA guruhlar
//   utils/enrollment.js    → ikkalasini birlashtirib beradi
//
// Natija: eski kod hech narsa sezmaydi, yangi kod esa to'liq
// ro'yxatni oladi. Migratsiya kerak emas — mavjud o'quvchilar
// avtomatik "asosiy guruhda" hisoblanadi.
//
// ⚠️ SHU SABAB: asosiy guruh uchun Enrollment yozuvi YARATILMAYDI.
//    Aks holda bitta o'quvchi ikki marta sanalardi. Guruh ro'yxatini
//    HAR DOIM `utils/enrollment.js` orqali oling — to'g'ridan-to'g'ri
//    `Student.find({ class })` yozsangiz qo'shimcha guruhdagilar
//    ko'rinmay qoladi.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

const STATUSES = ["active", "frozen", "left"];

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    // Guruh. `Class` kolleksiyasi — LC'da `Group` modeli ham
    // shu kolleksiyani o'qiydi (models/Group.js).
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    // Har bir so'rov direktor bo'yicha cheklanadi — boshqa
    // muassasaning yozuvi hech qachon ko'rinmasligi uchun
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    status: { type: String, enum: STATUSES, default: "active" },

    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },

    // Shu guruh uchun individual narx (chegirma, aka-uka chegirmasi,
    // shartnoma narxi). null bo'lsa guruhning umumiy narxi olinadi.
    priceOverride: { type: Number, default: null, min: 0 },

    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

// Bitta o'quvchi bitta guruhga ikki marta yozilmasin
enrollmentSchema.index({ student: 1, class: 1 }, { unique: true });
// Guruh ro'yxati — eng ko'p ishlatiladigan so'rov
enrollmentSchema.index({ class: 1, status: 1 });
// O'quvchining guruhlari
enrollmentSchema.index({ student: 1, status: 1 });
// Direktor/filial bo'yicha hisobotlar
enrollmentSchema.index({ director: 1, status: 1 });

module.exports =
  mongoose.models.Enrollment ||
  mongoose.model("Enrollment", enrollmentSchema);
module.exports.STATUSES = STATUSES;
