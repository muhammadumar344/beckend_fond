// src/models/Transaction.js
// ════════════════════════════════════════════════════════════
// Payme / Click tranzaksiyasi.
//
// Har ikkala tizim ham IKKI BOSQICHLI ishlaydi: avval "tayyorlash"
// (pul bloklanadi), keyin "yakunlash" (pul yechiladi). Oradagi
// holatni saqlash shart — aks holda tizim qayta so'rov yuborganda
// (ular buni tez-tez qiladi) pul ikki marta yechilishi mumkin.
//
// ⚠️ IDEMPOTENTLIK: `providerTransactionId` unique. Payme/Click
//    bir xil so'rovni bir necha marta yuborishi NORMAL holat —
//    javob har safar bir xil bo'lishi kerak, yangi yozuv emas.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

// Ichki holat mashinasi — provayderlarning o'z kodlaridan mustaqil
const STATES = [
  "pending", // yaratildi, hali to'lanmadi
  "paid", // muvaffaqiyatli
  "cancelled", // bekor qilindi (to'lovdan oldin)
  "refunded", // qaytarildi (to'lovdan keyin)
];

const transactionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["payme", "click"], required: true },

    // Provayderdagi tranzaksiya ID'si — takrorlanmasligi shart
    providerTransactionId: { type: String, required: true },

    // Kim to'layapti
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },

    // Nima uchun to'layapti. Hozircha faqat obuna; keyinchalik
    // o'quvchi to'lovi ham shu yerga qo'shiladi.
    purpose: {
      type: String,
      enum: ["subscription", "student_fee"],
      default: "subscription",
    },
    plan: { type: String, enum: ["pro", "premium", null], default: null },
    months: { type: Number, default: 1, min: 1 },

    // Summa HAR DOIM so'mda saqlanadi. Payme tiyinda yuboradi —
    // konvertatsiya provayder servisida bo'ladi, bu yerda emas.
    amount: { type: Number, required: true, min: 0 },

    state: { type: String, enum: STATES, default: "pending" },

    // Provayder yuborgan xom vaqtlar (ms) — nizo bo'lsa kerak bo'ladi
    createTime: { type: Number, default: 0 },
    performTime: { type: Number, default: 0 },
    cancelTime: { type: Number, default: 0 },
    cancelReason: { type: Number, default: null },

    // Tekshirish uchun provayderdan kelgan xom so'rov
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// Idempotentlikning asosiy kafolati
transactionSchema.index(
  { provider: 1, providerTransactionId: 1 },
  { unique: true },
);
transactionSchema.index({ teacher: 1, state: 1 });
transactionSchema.index({ state: 1, createdAt: -1 });

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
module.exports.STATES = STATES;
