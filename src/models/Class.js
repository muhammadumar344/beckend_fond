// backend/src/models/Class.js
const mongoose = require("mongoose");
const telegramGroupField = require("./telegramGroupField");

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

  // ✅ YANGI — shu sinf/guruh ota-onalarining Telegram guruhi.
  // Ta'rif va XAVFSIZLIK izohi: ./telegramGroupField.js (Group modeli
  // bilan umumiy — ikkalasi bitta kolleksiyani o'qiydi).
  telegramGroup: telegramGroupField,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Har bir so'rov direktor bo'yicha cheklanadi, filialli xodimlarda
// ustiga branch qo'shiladi — bitta compound indeks ikkalasini qoplaydi
// (teacher prefiks sifatida ham ishlaydi).
classSchema.index({ teacher: 1, branch: 1 });

// ⚠️ Bitta Telegram guruh FAQAT BITTA sinfga ulanadi.
//
//    `partialFilterExpression: { $lt: 0 }` — ataylab: Telegram guruh/
//    supergroup ID'lari doim MANFIY (shaxsiy chat ID'lari musbat, ularni
//    hech qachon ulamaymiz). `$lt` — har qanday MongoDB versiyasida
//    qisman indeksda ishlaydigan eng oddiy shart va null/yo'q qiymatni
//    avtomatik chiqarib tashlaydi: `default: null` tufayli hujjatlarda
//    maydon null bo'lib turadi, oddiy unique/sparse indeks esa ikkinchi
//    sinfda "duplicate key" berardi.
//
//    ⚠️ Indeks serverni ishga tushirishda quriladi; qurilmay qolsa
//    Mongoose xatosi butun jarayonni yiqitishi mumkin — shuning uchun
//    bu yerda FAQAT bitta, eng sodda indeks. Token bo'yicha qidiruvga
//    indeks yo'q: bu kamdan-kam so'rov, `classes` esa kichik kolleksiya.
classSchema.index(
  { "telegramGroup.chatId": 1 },
  {
    unique: true,
    partialFilterExpression: { "telegramGroup.chatId": { $lt: 0 } },
  },
);

module.exports = mongoose.model("Class", classSchema);
