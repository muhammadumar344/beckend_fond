// src/config/cloudinary.js
// ════════════════════════════════════════════════════════════
// Cloudinary — rasm saqlash xizmati (logotiplar uchun).
//
// ⚠️ KALIT YO'Q BO'LSA — O'CHIQ, lekin sayt ISHLAYVERADI.
//    Bu holda logotip avvalgidek base64 sifatida bazaga
//    yoziladi. Ya'ni kalit qo'yilmaguncha hech narsa buzilmaydi,
//    faqat rasm bazada qoladi (eski xatti-harakat).
//
// YOQISH UCHUN:
//   1. cloudinary.com da bepul hisob oching (Free tier: 25GB).
//   2. Dashboard → "Product Environment Credentials" bo'limidan
//      uchta qiymatni ko'chiring.
//   3. Render → Environment ga qo'ying va qayta deploy qiling:
//
//        CLOUDINARY_CLOUD_NAME=...
//        CLOUDINARY_API_KEY=...
//        CLOUDINARY_API_SECRET=...
//        CLOUDINARY_FOLDER=lumo      ← ixtiyoriy, standart "lumo"
//
//   Boshqa hech narsa o'zgartirish shart emas.
//
// NEGA `cloudinary` npm paketi emas: bizga faqat ikkita amal
// kerak — yuklash va o'chirish. Ikkalasi ham oddiy imzolangan
// POST. `axios` allaqachon bog'liqlikda bor, `crypto` esa Node
// ichida. Bitta paketdan qutuldik.
// ════════════════════════════════════════════════════════════

const env = process.env;

/** Barcha qiymatlar bo'lsagina true */
const allSet = (...keys) => keys.every((k) => Boolean(env[k] && env[k].trim()));

const enabled = allSet(
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
);

const cloudName = (env.CLOUDINARY_CLOUD_NAME || "").trim();
const folder = (env.CLOUDINARY_FOLDER || "lumo").trim();

module.exports = {
  enabled,
  cloudName,
  apiKey: (env.CLOUDINARY_API_KEY || "").trim(),
  apiSecret: (env.CLOUDINARY_API_SECRET || "").trim(),
  folder,

  // Papkalar — hisob ichida tartib bo'lishi uchun
  folders: {
    logos: `${folder}/logos`,
    receipts: `${folder}/receipts`,
  },

  apiBase: `https://api.cloudinary.com/v1_1/${cloudName}`,
};
