// src/models/Group.js
// ════════════════════════════════════════════════════════════
// LC (o'quv markazi) GURUHI.
//
// ⚠️ ENG MUHIM FAKT: bu model `classes` KOLLEKSIYASIGA bog'langan —
//    ya'ni `Class` bilan bir xil hujjatlarni o'qiydi va yozadi.
//    Ma'lumot ko'chirilmagan, nusxalanmagan. Bu — reja 1.2 ning
//    "A varianti" (docs/GROUP_MIGRATION.md).
//
// NEGA ALOHIDA KOLLEKSIYA EMAS?
// C varianti (haqiqiy ajratish) jonli bazada migratsiya + kod
// deploy'ini BIR VAQTDA talab qiladi, staging muhit esa yo'q.
// A varianti esa ma'lumotga umuman tegmaydi, orqaga qaytarish —
// oddiy kod qaytarish. Va A — C ning boshlang'ich qismi: LC kodi
// allaqachon `Group` deb yozilgani uchun keyinchalik C ga o'tish
// faqat kolleksiya nomini o'zgartirish + nusxa ko'chirishdan iborat
// bo'ladi.
//
// ARALASHIB KETMAYDIMI?
// Yo'q. Har bir so'rov `teacher: ctx.directorId` bilan cheklanadi
// (groupController da istisnosiz), direktor esa faqat bitta rejimda
// bo'ladi (Teacher.institutionType qulflangan). Ya'ni LC direktorining
// so'rovi Fond sinflarini hech qachon ko'rmaydi.
//
// ── ALIAS TUZOG'I — O'QING ──────────────────────────────────
// `director` va `monthlyPrice` — bu ALIAS'lar. Bazada maydonlar
// `teacher` va `defaultAmount` deb saqlanadi.
//
//   ✅ ISHLAYDI    doc.monthlyPrice          (hujjat xossasi)
//   ✅ ISHLAYDI    new Group({ director })   (yozishda)
//   ✅ ISHLAYDI    Group.find({ director })  (quyidagi pre-hook tufayli)
//   ❌ ISHLAMAYDI  .sort({ monthlyPrice: 1 })
//   ❌ ISHLAMAYDI  .select("director")
//   ❌ ISHLAMAYDI  updateOne({}, { monthlyPrice: 5 })   ← yangi maydon yozadi!
//   ❌ ISHLAMAYDI  aggregate([...])
//
// Mongoose alias'ni faqat hujjat darajasida va (hook orqali) so'rov
// FILTRIDA tarjima qiladi. Sort/select/update-payload/aggregate da
// HAQIQIY nomni yozing: `teacher`, `defaultAmount`.
//
// Shu sabab groupController filtrlarda ham haqiqiy nomlarni
// ishlatadi — kod hook'siz ham to'g'ri ishlaydi, hook esa kelajakdagi
// xatoni ushlab qoladigan himoya sifatida turadi.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // Bazada: `teacher`. LC'da guruhni ustoz emas, muassasa egasi ochadi.
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
    alias: "director",
  },

  // Bazada: `defaultAmount`. LC'da bu — oylik kurs narxi.
  defaultAmount: {
    type: Number,
    required: true,
    min: 0,
    alias: "monthlyPrice",
  },

  // Guruh ochilgandagi tarif. Limitlar uchun kerak — `planHelper`
  // buni direktorning hozirgi tarifi bilan solishtiradi va
  // kattarog'ini oladi.
  //
  // ⚠️ Bu maydon ilgari LC'da UMUMAN yozilmasdi va sxema `"free"`
  //    qo'yardi — natijada Premium hisob ham guruhiga 30 tadan
  //    ortiq o'quvchi qo'sha olmasdi. `createGroup` endi uni yozadi.
  plan: {
    type: String,
    enum: ["free", "pro", "premium"],
    default: "free",
  },

  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
  },

  // ── LC'ga xos maydonlar ────────────────────────────────────
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    default: null,
  },
  // Guruhga tayinlangan ustoz (Staff — Direktorning o'zi emas)
  assignedTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
  },
  capacity: { type: Number, default: null, min: 1 },

  // Arxiv — `Class` dagi bilan bir xil maydon (bitta kolleksiya).
  // Kurs tugagach guruh yopiladi, lekin davomat, baho va to'lov
  // tarixi joyida qoladi (`deleteGroup` esa hammasini o'chiradi).
  archivedAt: { type: Date, default: null },

  // `Class` dagi bilan bir xil bo'lishi shart — bitta kolleksiya.
  // `timestamps: true` ATAYLAB ishlatilmadi: u `updatedAt` qo'shib,
  // Class orqali yozilgan hujjatlardan farq qiladigan shakl yasardi.
  createdAt: { type: Date, default: Date.now },
});

// ⚠️ `initialBalance` va `initialBalanceNote` bu yerda ATAYLAB YO'Q —
// ular faqat Fond maydonlari. Sxemada bo'lmagani uchun LC kodi ularga
// tasodifan ham teg olmaydi. Kolleksiyada esa ular saqlanib qoladi
// (Mongoose noma'lum maydonlarni o'chirmaydi).

// So'rov filtridagi alias nomlarini haqiqiy maydonga o'giradi.
// Busiz `Group.find({ director: x })` JIMGINA bo'sh massiv qaytaradi —
// xato bermaydi, shunchaki hech narsa topmaydi.
groupSchema.pre(/^(find|count|update|delete|replace)/, function () {
  this.setQuery(this.model.translateAliases(this.getQuery()));
});

// Indekslar `Class` da allaqachon e'lon qilingan (bitta kolleksiya) —
// bu yerda takrorlanmaydi.

module.exports =
  mongoose.models.Group || mongoose.model("Group", groupSchema, "classes");
