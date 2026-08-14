// src/models/StudentLink.js
// ════════════════════════════════════════════════════════════
// Telegram foydalanuvchisini o'quvchiga bog'laydi.
//
// ⚠️ NEGA YANGI MODEL: eski `TelegramParent` hech qanday tekshiruv
//    talab qilmasdi — bot'da o'qituvchi emailini yozib, ro'yxatdan
//    ISTALGAN bolani tanlash mumkin edi. To'lov eslatmasi uchun bu
//    e'tiborsizlik edi; baho va davomat uchun esa begona odam
//    boshqa oilaning ma'lumotini o'qishi degani.
//
//    Shu sababli bog'lanish endi ISBOT talab qiladi:
//      · phone — Telegram'dan kelgan raqam `Student.parentPhone`
//                bilan mos keldi (ota-onalarning ko'pchiligi)
//      · code  — xodim CRM'da chiqargan bir martalik kod
//      · legacy — eski `TelegramParent` yozuvi, ISBOTLANMAGAN
//
// ⚠️ `legacy` faqat TO'LOVni ko'radi. Baho, davomat va uy vazifasi
//    uchun qaytadan tasdiqlash so'raladi. Eski eslatmalar ishlashda
//    davom etadi, lekin yangi maxfiy ma'lumot ochilmaydi.
//    Tekshiruv: utils/tmaAccess.js → canSee()
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const studentLinkSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // Telegram tomonidan imzolangan qiymat — soxtalashtirib bo'lmaydi
    telegramUserId: { type: String, required: true },
    // Xabar yuborish uchun (odatda telegramUserId bilan bir xil)
    telegramChatId: { type: String, default: "" },
    telegramUsername: { type: String, default: "" },

    // Kim: ota-ona yoki o'quvchining o'zi
    kind: {
      type: String,
      enum: ["parent", "student"],
      default: "parent",
    },

    // Qanday isbotlangani — ruxsat darajasi shunga bog'liq
    verifiedVia: {
      type: String,
      enum: ["phone", "code", "legacy"],
      required: true,
    },

    // Solishtirishda ishlatilgan raqam (utils/phone.js kaliti)
    phoneKey: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Bitta Telegram hisobi bitta o'quvchiga bir marta bog'lanadi.
// (Bir ota-onaning bir nechta farzandi bo'lishi mumkin — shuning
// uchun `telegramUserId` yolg'iz o'zi noyob EMAS.)
studentLinkSchema.index(
  { telegramUserId: 1, student: 1 },
  { unique: true },
);
// Mini App ochilganda: "bu odamning bolalari kimlar?"
studentLinkSchema.index({ telegramUserId: 1, isActive: 1 });
// Xabarnoma yuborishda: "bu o'quvchining ota-onalari kimlar?"
studentLinkSchema.index({ student: 1, isActive: 1 });

module.exports =
  mongoose.models.StudentLink ||
  mongoose.model("StudentLink", studentLinkSchema);
