// src/utils/tmaAccess.js
// ════════════════════════════════════════════════════════════
// Mini App'da kim nimani ko'ra oladi.
//
// Ruxsat bog'lanish QANDAY isbotlanganiga bog'liq
// (models/StudentLink.js dagi izohga qarang):
//
//   phone  — Telegram raqami bazadagi ota-ona raqami bilan mos
//   code   — xodim bergan bir martalik kod ishlatilgan
//   legacy — eski `TelegramParent` yozuvi, HECH QANDAY isbotsiz
//   approved — sinf havolasi + sinf rahbarining tasdig'i
//
// ⚠️ `legacy` ataylab cheklangan. Eski bot'da o'qituvchi emailini
//    bilgan har kim ro'yxatdan istalgan bolani tanlab, "ota-onasi"
//    bo'lib qo'ya olardi. O'sha yozuvlarga baho ochib berish —
//    bir necha yillik maxfiy ma'lumotni tarqatish bo'lardi.
//    To'lov eslatmasi esa avvaldan ishlab turgan, uni to'xtatsak
//    haqiqiy ota-onalarni ham jazolagan bo'lardik.
//
// ⚠️ YANGI BO'LIM QO'SHSANGIZ shu yerga ham qo'shing. Standart
//    javob `false` — ya'ni unutilgan bo'lim OCHILIB qolmaydi,
//    yopiq qoladi. Xato tomoni xavfsiz bo'lishi kerak.
// ════════════════════════════════════════════════════════════

/** Isbotlangan (to'liq huquqli) bog'lanish turlari */
//
// ⚠️ `approved` shu yerda: sinf havolasi orqali kelgan ota-onani
//    sinf rahbari QO'LDA tasdiqlagan. Bu kod bilan bir daraja —
//    ikkalasida ham "ha, bu o'sha bolaning otasi" degan qarorni
//    odam qabul qiladi. Havolaning O'ZI hech narsa ochmaydi:
//    tasdiqlanmagan so'rov `isActive: false` bo'lib turadi va
//    `canSee` uni birinchi qatorda to'xtatadi.
const VERIFIED = new Set(["phone", "code", "approved"]);

/** Bo'limlar → qaysi isbot darajasi yetadi */
const SECTIONS = {
  payments: () => true, // hammaga — eski eslatma shu asosda ishlagan
  grades: (via) => VERIFIED.has(via),
  attendance: (via) => VERIFIED.has(via),
  homework: (via) => VERIFIED.has(via),
  schedule: (via) => VERIFIED.has(via),
  booking: (via) => VERIFIED.has(via),
};

/**
 * @param {object} link  StudentLink hujjati
 * @param {string} section
 * @returns {boolean}
 */
function canSee(link, section) {
  if (!link || link.isActive === false) return false;
  const rule = SECTIONS[section];
  if (!rule) return false; // noma'lum bo'lim — yopiq
  return rule(link.verifiedVia);
}

/** Bog'lanish to'liq isbotlanganmi (interfeys "tasdiqlang" deb chiqarishi uchun) */
const isVerified = (link) => Boolean(link) && VERIFIED.has(link.verifiedVia);

/** Ushbu bog'lanish uchun ochiq bo'limlar ro'yxati */
function visibleSections(link) {
  return Object.keys(SECTIONS).filter((s) => canSee(link, s));
}

module.exports = { canSee, isVerified, visibleSections, SECTIONS };
