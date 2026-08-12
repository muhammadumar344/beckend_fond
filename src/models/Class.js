// backend/src/models/Class.js
const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  defaultAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  plan: {
    type: String,
    enum: ["free", "pro", "premium"],
    default: "free",
  },

  // ✅ YANGI: Saytdan foydalanishdan OLDIN yig'ilgan pul
  // Misol: V sinf saytdan avval 300,000 so'm yig'gan bo'lsa, shu yerga kiriladi
  // Barcha hisobotlarda bu pul ham hisobga olinadi
  initialBalance: {
    type: Number,
    default: 0,
    min: 0,
  },

  // ✅ YANGI: Boshlang'ich balans kiritilgan sana (qaysi oy uchun ekanligi)
  initialBalanceNote: {
    type: String,
    default: "",
    trim: true,
  },

  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
  },

  // ══════════════════════════════════════════════════════════
  // ✅ YANGI — FAQAT O'quv markazi (LC) rejimida ishlatiladi.
  // Fond (school) rejimida bular hech qachon to'ldirilmaydi (har doim
  // null qoladi) — chunki bitta director ilova ichida FAQAT bitta
  // rejimda bo'lishi mumkin (institutionType qulflangan, middleware/mode.js
  // orqali backend darajasida ham kafolatlanadi). Shu sabab bitta jadvalda
  // ikkala rejim maydonlari birga tursa ham, ular hech qachon aralashib
  // ketmaydi.
  // ══════════════════════════════════════════════════════════
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    default: null,
  },
  assignedTeacher: {
    // Guruhga tayinlangan asosiy ustoz (Staff, Direktorning o'zi emas)
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
  },
  capacity: {
    // Guruhdagi maksimal o'quvchilar soni (ixtiyoriy)
    type: Number,
    default: null,
    min: 1,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Har bir so'rov direktor bo'yicha cheklanadi, filialli xodimlarda
// ustiga branch qo'shiladi — bitta compound indeks ikkalasini qoplaydi
// (teacher prefiks sifatida ham ishlaydi).
classSchema.index({ teacher: 1, branch: 1 });

module.exports = mongoose.model("Class", classSchema);
