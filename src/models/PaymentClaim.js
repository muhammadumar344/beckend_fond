// src/models/PaymentClaim.js
// ════════════════════════════════════════════════════════════
// OTA-ONA "TO'LADIM" DEYDI — xodim tasdiqlaydi.
//
// NEGA BU MODEL KERAK: bugun O'zbekistonda kichik o'quv markazi
// pulni kartaga o'tkazma bilan oladi. Oqim shunday: administrator
// qo'ng'iroq qiladi → ota-ona kartaga tashlaydi → chekni rasmga
// olib yuboradi → administrator daftariga belgilaydi. Har bir
// to'lov uchun bitta qo'ng'iroq va bitta suhbat.
//
// Bu model o'sha suhbatni olib tashlaydi. Ota-ona ilovada karta
// raqamini ko'radi, o'tkazadi va "to'ladim" tugmasini bosadi.
// Administratorda ro'yxat paydo bo'ladi — u faqat tasdiqlaydi.
//
// ⚠️ TASDIQLASH QADAMI OLIB TASHLANMAYDI. Pul haqiqatan
//    kelganini faqat markaz biladi — bank hisobini biz
//    ko'rmaymiz. "To'ladim" tugmasi to'lovni tasdiqlasa,
//    istalgan odam qarzini bir bosishda o'chirib qo'yardi.
//
// ⚠️ Merchant (Payme/Click) ulanganda ham SHU MODEL ishlatiladi,
//    faqat `status` webhook orqali darrov `confirmed` bo'ladi.
//    Shuning uchun `via` maydoni oldindan turibdi — keyin
//    migratsiya qilish kerak bo'lmasin.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const paymentClaimSchema = new mongoose.Schema(
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
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // Qaysi oy uchun. `MonthlyPayment` bilan bir xil shakl.
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Ota-ona ko'rsatgan summa (so'mda)
    amount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
      index: true,
    },

    // "Karta oxiri 4821 dan yubordim" kabi izoh
    note: { type: String, default: "", trim: true, maxlength: 300 },

    // Kim yubordi — Telegram hisobi
    claimedByTelegramId: { type: String, default: "" },

    // Kim ko'rib chiqdi
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    reviewedAt: { type: Date, default: null },
    // Rad etilgan bo'lsa sababi — ota-onaga shu yuboriladi
    reviewNote: { type: String, default: "", trim: true, maxlength: 300 },

    via: {
      type: String,
      enum: ["transfer", "payme", "click"],
      default: "transfer",
    },
  },
  { timestamps: true },
);

// ⚠️ Bitta oyga BITTA kutilayotgan da'vo. Ota-ona tugmani
//    ikki marta bossa yoki ikkala ota-ona ham bossa, xodimda
//    ikkita bir xil qator paydo bo'lardi va u qaysi birini
//    tasdiqlashni bilmasdi.
paymentClaimSchema.index(
  { student: 1, month: 1, year: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
// Xodim ekrani: "tasdiqlanmaganlar"
paymentClaimSchema.index({ director: 1, status: 1, createdAt: -1 });

module.exports =
  mongoose.models.PaymentClaim ||
  mongoose.model("PaymentClaim", paymentClaimSchema);
