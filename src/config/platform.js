// src/config/platform.js
// ════════════════════════════════════════════════════════════
// PLATFORMANING O'Z REKVIZITLARI — direktor tarif uchun shu
// yerga pul o'tkazadi.
//
// ⚠️ ILGARI KARTA RAQAMI FRONTENDDA QOTIRIB YOZILGANDI:
//    `8600 1234 5678 9012`. Bu — haqiqiy karta emas, boshqa
//    ikki faylda `placeholder` sifatida turgan namuna matn.
//    Ya'ni Pro sotib olmoqchi bo'lgan direktor uni nusxa olib,
//    o'sha raqamga pul yuborardi. Pul hech qayerga bormasdi,
//    u esa chekni yuklab, tasdiqlashni kutib o'tirardi.
//
// ⚠️ SOXTA RAQAM KO'RSATGANDAN KO'RA HECH NARSA KO'RSATMAGAN
//    YAXSHI. Kalit qo'yilmagan bo'lsa `configured: false`
//    qaytadi va sahifa "rekvizitlar kiritilmagan, administrator
//    bilan bog'laning" deb yozadi — bu Payme/Click bilan bir
//    xil qoida (`config/payments.js`: yarim sozlangan holatda
//    pul qabul qilishga urinmaymiz).
//
// YOQISH UCHUN — Render → Environment:
//   PLATFORM_CARD=8600XXXXXXXXXXXX
//   PLATFORM_CARD_HOLDER=FAMILIYA ISM
//
// Boshqa hech narsa o'zgartirish shart emas.
// ════════════════════════════════════════════════════════════

const env = process.env;

/** Faqat raqamlar qoladi: "8600 1234" → "86001234" */
const digits = (s) => String(s || "").replace(/\D/g, "");

/** "8600123456789012" → "8600 1234 5678 9012" */
const formatCard = (raw) => {
  const d = digits(raw);
  if (!d) return "";
  return d.match(/.{1,4}/g).join(" ");
};

const card = digits(env.PLATFORM_CARD);
const holder = (env.PLATFORM_CARD_HOLDER || "").trim();

// ⚠️ O'zbekiston kartalari 16 xonali. Yarim yozilgan raqamni
//    ko'rsatsak, direktor o'shanga pul o'tkazishga urinardi.
const configured = card.length === 16;

module.exports = {
  configured,
  // Ko'rsatish uchun — bo'shliqlar bilan
  card: configured ? formatCard(card) : "",
  // Nusxa olish uchun — faqat raqamlar
  cardPlain: configured ? card : "",
  holder: configured ? holder : "",
  formatCard,
};
