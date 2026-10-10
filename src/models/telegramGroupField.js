// src/models/telegramGroupField.js
// ════════════════════════════════════════════════════════════
// Sinf/guruhning ota-onalar Telegram GURUHI maydoni.
//
// ⚠️ NEGA ALOHIDA FAYL: bitta `classes` kolleksiyasini IKKITA model
//    o'qiydi — `Class` (Fond) va `Group` (LC, models/Group.js). Group
//    sxemasida bu maydon e'lon qilinmasa, Mongoose uni "noma'lum" deb
//    hisoblab `select: false` ni qo'llamaydi va LC'dagi `Group.find()`
//    natijasi `res.json` qilinganda guruh ID'si hamda token hash'i
//    frontendga chiqib ketardi. Ikkala sxema BIR XIL ta'rifdan
//    foydalansin deb shu yerga chiqarildi (test/telegramGroup.test.js
//    "classes" kolleksiyasidagi HAR BIR modelni tekshiradi).
//
// Guruh DIREKTORGA emas, SINFGA bog'lanadi. Aks holda bitta direktorning
// ikki sinfi bitta guruhga aralashib, bir sinf ota-onalari boshqa sinf
// o'quvchilarining ismini ko'rib qolardi.
//
// ⚠️ `chatId` va token `select: false`: `Class.find()` ni to'g'ridan-
//    to'g'ri `res.json` qiladigan joylar ko'p. Kerak bo'lganda
//    `.select('+telegramGroup.chatId')` deb so'raladi (faqat
//    services/groupTelegram.js).
//
// Token hash bo'lib saqlanadi va bir martalik (direktor ulanishi bilan
// bir xil qoida — services/directorTelegram.js).
// ════════════════════════════════════════════════════════════
module.exports = {
  chatId: { type: Number, default: null, select: false },
  title: { type: String, default: "" },
  linkedAt: { type: Date, default: null },
  lastMessageAt: { type: Date, default: null },
  linkTokenHash: { type: String, default: null, select: false },
  linkTokenExpires: { type: Date, default: null, select: false },
};
