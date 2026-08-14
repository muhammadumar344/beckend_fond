// src/models/InviteCode.js
// ════════════════════════════════════════════════════════════
// Bir martalik taklif kodi — telefon raqami mos kelmaganda.
//
// Qachon kerak bo'ladi:
//   · Ota-ona bazadagidan boshqa raqamdan yozilgan
//   · Ikkinchi ota-ona (bobo, amma) ham ko'rmoqchi
//   · O'quvchining o'zi ulanmoqchi (uning raqami bazada yo'q)
//
// ⚠️ Kod PAROL bilan tengdir — u bilan bolaning baholari ochiladi.
//    Shuning uchun: qisqa muddat, bir martalik, taxmin qilib
//    bo'lmaydigan alifbo.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const crypto = require("crypto");

// ⚠️ Chalkashadigan belgilar YO'Q: 0/O, 1/I/L, 5/S, 8/B.
//    Kodni telefonda og'zaki aytib berishadi — "nol" va "O" ni
//    farqlab bo'lmasa, xodimga qo'ng'iroq ko'payadi.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXYZ2346789";
const CODE_LEN = 8; // 28^8 ≈ 3.8·10^11 — taxmin qilib bo'lmaydi

/** `LM-A3F7-K9QW` ko'rinishidagi kod */
function generateCode() {
  const bytes = crypto.randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `LM-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Solishtirish uchun: chiziqcha va katta-kichik harf ahamiyatsiz */
function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const inviteCodeSchema = new mongoose.Schema(
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

    // Chiziqchasiz, katta harfda — qidiruv shu maydon bo'yicha
    code: { type: String, required: true, unique: true },
    // Ko'rsatish uchun chiroyli ko'rinishi
    display: { type: String, required: true },

    kind: { type: String, enum: ["parent", "student"], default: "parent" },

    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedByTelegramId: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

// Ishlatilmagan kodlarni ro'yxatlash (xodim ekranida)
inviteCodeSchema.index({ student: 1, usedAt: 1 });

// ⚠️ Muddati o'tgan kodlarni MongoDB o'zi o'chiradi — bizga cron
//    kerak emas. `expireAfterSeconds: 0` = `expiresAt` kelganda.
inviteCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = Object.assign(
  mongoose.models.InviteCode ||
    mongoose.model("InviteCode", inviteCodeSchema),
  { generateCode, normalizeCode },
);
