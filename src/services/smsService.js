// src/services/smsService.js
// ════════════════════════════════════════════════════════════
// SMS YUBORISH — provayder ulanmagan (`config/sms.js` ga qarang).
//
// ⚠️ ILGARI BU FAYL "SOXTA MUVAFFAQIYAT" QAYTARARDI: har bir
//    o'quvchi uchun `status: 'failed'` yozib, xato tashlamasdi.
//    Controller esa buni `success: true` bilan yuborardi —
//    Premium sotib olgan direktor "25 tadan 0 tasi yuborildi"
//    ni ko'rib, sababini hech qachon bilmasdi.
//
//    Endi sozlanmagan holat AYTILADI (`configured: false`),
//    chaqiruvchi 503 qaytaradi.
//
// ⚠️ PROVAYDER ULANGANDA shu ikki funksiyaning ICHI yoziladi,
//    chaqiruvchi kod o'zgarmaydi — Payme/Click bilan bir xil
//    naqsh.
// ════════════════════════════════════════════════════════════

const sms = require("../config/sms");

/** Provayder ulanganmi — controller shu bo'yicha 503 qaytaradi */
const isConfigured = () => sms.configured;

const sendBulkReminders = async (students, className, month, year) => {
  if (!sms.configured) {
    // ⚠️ Bu yerga yetib kelmasligi kerak: controller oldindan
    //    tekshiradi. Yetib kelsa — halol xato, jim `failed` emas.
    const err = new Error("SMS xizmati sozlanmagan");
    err.status = 503;
    throw err;
  }

  // TODO(provayder): eskiz/playmobile API chaqiruvi shu yerda.
  const err = new Error("SMS xizmati sozlanmagan");
  err.status = 503;
  throw err;
};

const sendSingle = async (phone, message) => {
  if (!sms.configured) {
    const err = new Error("SMS xizmati sozlanmagan");
    err.status = 503;
    throw err;
  }
  const err = new Error("SMS xizmati sozlanmagan");
  err.status = 503;
  throw err;
};

module.exports = { isConfigured, sendBulkReminders, sendSingle };
