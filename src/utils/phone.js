// src/utils/phone.js
// ════════════════════════════════════════════════════════════
// Telefon raqamini solishtirish uchun bir ko'rinishga keltirish.
//
// NEGA KERAK: ota-ona raqamini Telegram `+998901234567` deb beradi,
// direktor esa bazaga `90 123 45 67`, `+998 90 123-45-67` yoki
// `901234567` deb yozgan bo'lishi mumkin. To'g'ridan-to'g'ri
// solishtirsak deyarli hech qachon mos kelmaydi va ota-ona
// "raqamim topilmadi" degan xabarni olaveradi.
//
// Yechim: faqat raqamlarni qoldirib, OXIRGI 9 TASINI olamiz.
// O'zbekistonda milliy raqam aynan 9 xonali (90 123 45 67), 998
// esa mamlakat kodi. Shunday qilib yuqoridagi to'rt yozuv ham
// bitta `901234567` ga aylanadi.
//
// ⚠️ Bu faqat SOLISHTIRISH uchun. Ko'rsatish yoki SMS yuborish
//    uchun asl matn ishlatiladi.
// ════════════════════════════════════════════════════════════

const NATIONAL_LEN = 9;

/**
 * @param {string} raw
 * @returns {string} 9 xonali kalit, yoki juda qisqa bo'lsa bo'sh satr
 */
function phoneKey(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < NATIONAL_LEN) return "";
  return digits.slice(-NATIONAL_LEN);
}

/** Ikki raqam bir xil egaga tegishlimi */
function samePhone(a, b) {
  const ka = phoneKey(a);
  return Boolean(ka) && ka === phoneKey(b);
}

module.exports = { phoneKey, samePhone, NATIONAL_LEN };
