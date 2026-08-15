// src/models/StaffAttendance.js
// ════════════════════════════════════════════════════════════
// XODIM DAVOMATI — ustoz ishga o'z vaqtida keldimi.
//
// NEGA BU KERAK: o'quv markazi egasining eng ko'p shikoyat
// qiladigan narsasi — ustozning kechikishi. Dars 15:00 da, ustoz
// 15:12 da keladi; ota-ona to'lagan pulning bir qismi shu yerda
// yo'qoladi. Hech bir CRM buni o'lchamaydi, chunki o'lchash
// noqulay: kimdir daftar tutishi kerak.
//
// Bizda o'lchash TEKIN, chunki jadval allaqachon bazada turibdi.
// "Kutilgan vaqt" — o'sha kundagi eng erta darsning boshlanishi.
// Xodim tugmani bosadi, qolganini tizim hisoblaydi.
//
// ⚠️ KECHIKISH VAQTI SAQLANADI, HISOBLANMAYDI. `lateMinutes` ni
//    keyinroq `arrivedAt − expectedAt` dan chiqarish mumkin
//    ko'rinadi, lekin jadval o'zgarishi mumkin: ustozning darsi
//    16:00 ga ko'chirilsa, o'tgan oydagi kechikishlar jimgina
//    yo'qolib qolardi va maosh hisobi buzilardi. Tarix o'sha
//    kundagi haqiqatni saqlashi kerak.
//
// ⚠️ `via` maydoni hozir doim "manual". U kelajakdagi QR bilan
//    o'zi belgilanish uchun oldindan qo'yilgan — keyin
//    migratsiya qilish kerak bo'lmasin.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const staffAttendanceSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    // "YYYY-MM-DD" — Toshkent vaqti bo'yicha
    date: { type: String, required: true },
    // Oylik hisobot uchun: "YYYY-MM". Sanadan chiqarish mumkin,
    // lekin har so'rovda regex ishlatishdan ko'ra indeks arzon.
    month: { type: String, required: true, index: true },

    // "09:00" — o'sha kundagi eng erta dars (yoki markaz ochilishi)
    expectedAt: { type: String, default: "" },
    // "09:12" — belgilangan payt
    arrivedAt: { type: String, default: "" },

    status: {
      type: String,
      enum: ["present", "late", "absent", "excused"],
      required: true,
    },
    // ⚠️ Yuqoridagi izohga qarang — saqlanadi, qayta hisoblanmaydi
    lateMinutes: { type: Number, default: 0, min: 0 },

    note: { type: String, default: "", trim: true, maxlength: 300 },

    // Kim belgiladi (filial boshqaruvchisi yoki direktor)
    markedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    via: {
      type: String,
      enum: ["manual", "qr"],
      default: "manual",
    },
  },
  { timestamps: true },
);

// Bir xodim uchun bir kunda bitta yozuv.
// ⚠️ Noyob indeks SHART: ikki xodim bir vaqtda belgilasa
//    ikkita yozuv paydo bo'lardi va oylik hisob ikki barobar
//    ko'rsatardi.
staffAttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
// Kunlik ekran: "bugun kim keldi"
staffAttendanceSchema.index({ director: 1, date: 1 });
// Maosh hisobi: "shu oyda necha marta kechikkan"
staffAttendanceSchema.index({ staff: 1, month: 1 });

module.exports =
  mongoose.models.StaffAttendance ||
  mongoose.model("StaffAttendance", staffAttendanceSchema);
