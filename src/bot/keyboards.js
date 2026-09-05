// src/bot/keyboards.js
// ════════════════════════════════════════════════════════════
// ⚠️ ESKI SINF/O'QUVCHI TANLASH KLAVIATURALARI OLIB TASHLANDI.
//    Ular isbotsiz bog'lanish oqimiga tegishli edi: o'qituvchi
//    emailini bilgan har kim ro'yxatdan istalgan bolani tanlab,
//    "ota-onasi" bo'lib qolardi. Oqim o'chirilgan, klaviaturalari
//    esa qolib ketgan edi — o'chirilmasa, kimdir "tayyor kod
//    ekan" deb qaytadan ulab yuborishi mumkin.
// ════════════════════════════════════════════════════════════

const { t } = require("./texts");

/**
 * Raqam so'rash tugmasi.
 *
 * ⚠️ `request_contact` — bog'lanishning ASOSIY yo'li. Telegram
 *    raqamni O'ZI yuboradi, foydalanuvchi qo'lda terib boshqa
 *    birovning raqamini yozib qo'ya olmaydi. Aynan shu narsa
 *    "men shu bolaning ota-onasiman" degan da'voni isbotga
 *    aylantiradi.
 *
 * ⚠️ `one_time_keyboard` ATAYLAB YO'Q. Ilgari bor edi va tugma
 *    bir bosilgach yo'qolardi: raqami ro'yxatda topilmagan
 *    ota-ona boshqa urinolmasdi — qaytadan /start yozishi
 *    kerakligini esa hech kim aytmagan edi.
 */
const phoneKeyboard = (lang) => ({
  keyboard: [[{ text: t(lang, "btnPhone"), request_contact: true }]],
  resize_keyboard: true,
});

/** Oddiy klaviaturani yopish */
const removeKeyboard = () => ({ remove_keyboard: true });

/**
 * Bog'langan foydalanuvchining asosiy menyusi.
 *
 * ⚠️ Hammasi BITTA inline klaviaturada. Sabab: Telegram bitta
 *    xabarga faqat bitta `reply_markup` beradi — ya'ni pastdagi
 *    doimiy klaviatura va inline tugmalarni birga yuborib
 *    bo'lmaydi. Inline tanlandi, chunki `web_app` tugmasi shu
 *    yerda ishonchli ishlaydi va xabar bilan birga saqlanadi:
 *    foydalanuvchi yuqoriga surib topa oladi.
 *
 * @param {string} url  https bo'lishi SHART — Telegram http'ni ochmaydi.
 *                      Bo'sh bo'lsa "Ochish" tugmasi umuman qo'shilmaydi
 *                      (buzuq tugmadan ko'ra tugmasiz xabar yaxshiroq).
 */
const mainKeyboard = (lang, url) => {
  const rows = [];
  if (url) rows.push([{ text: t(lang, "btnOpen"), web_app: { url } }]);
  rows.push([
    { text: t(lang, "btnRelink"), callback_data: "relink" },
    { text: t(lang, "btnHelp"), callback_data: "help" },
  ]);
  return { inline_keyboard: rows };
};

/**
 * Sinf ro'yxati — ota-ona farzandini tanlaydi.
 *
 * ⚠️ ESKI, OLIB TASHLANGAN KLAVIATURA BILAN ADASHTIRMANG (fayl
 *    boshidagi izoh). U yerda tanlashning O'ZI bog'lanish edi;
 *    bu yerda tanlash faqat SO'ROV yaratadi — yozuv
 *    `isActive: false` bo'lib turadi va sinf rahbari
 *    tasdiqlamaguncha hech narsa ochilmaydi.
 *
 * ⚠️ Ikki ustun: bitta ustunda 30 ta bola ekranni to'ldirib
 *    yuboradi va ota-ona pastga surib charchaydi.
 *
 * ⚠️ `callback_data` 64 baytdan oshmasligi kerak (Telegram
 *    cheklovi) — `pick_` + 24 belgili ObjectId = 29 bayt.
 */
const rosterKeyboard = (students) => {
  const rows = [];
  for (let i = 0; i < students.length; i += 2) {
    rows.push(
      students.slice(i, i + 2).map((s) => ({
        text: String(s.name || "—").slice(0, 40),
        callback_data: `pick_${s._id}`,
      })),
    );
  }
  return { inline_keyboard: rows };
};

/** "Rostdan uzamizmi?" — tasodifan bosib yuborishga qarshi */
const confirmResetKeyboard = (lang) => ({
  inline_keyboard: [
    [
      { text: t(lang, "btnYes"), callback_data: "relink_yes" },
      { text: t(lang, "btnNo"), callback_data: "relink_no" },
    ],
  ],
});

module.exports = {
  phoneKeyboard,
  removeKeyboard,
  mainKeyboard,
  rosterKeyboard,
  confirmResetKeyboard,
};
