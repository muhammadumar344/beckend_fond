// src/services/directorTelegram.js
// ════════════════════════════════════════════════════════════
// DIREKTORNI TELEGRAM'GA ULASH.
//
// Bot ilgari faqat ota-ona va o'quvchi uchun edi — direktorga
// tizimdan xabar yuborishning umuman yo'li yo'q edi. U hamma
// narsani saytga kirib ko'rishi kerak edi va kunda kirmasdi.
//
// ⚠️ Bu ulanish BITTA funksiya uchun emas. Kunlik kassa xabari
//    birinchisi, xolos: keyin ketish arafasidagi o'quvchi,
//    tasdiqlanmagan to'lov va boshqalari ham shu kanal orqali
//    ketadi.
//
// ⚠️ CHUQUR HAVOLA (deep link) ISHLATILADI, kod emas. Direktor
//    CRM'da tugmani bosadi, Telegram ochiladi va ulanish
//    tugaydi. Ota-onalarda kod bor, chunki ular boshqa
//    qurilmada bo'lishi mumkin; direktor esa aynan o'sha
//    brauzerda o'tirgan bo'ladi.
//
// ⚠️ TOKEN HASH BO'LIB SAQLANADI (parol tiklash bilan bir xil
//    qoida) va BIR MARTALIK. Telegram havolasi yozishmada
//    qolib ketadi; muddatsiz token o'sha yozishmani ko'rgan
//    har kimga markaz xabarlarini ochib berardi.
// ════════════════════════════════════════════════════════════
const crypto = require("crypto");
const Teacher = require("../models/Teacher");

// 15 daqiqa. Direktor tugmani bosib, o'sha zahoti Telegram'ni
// ochadi — bundan uzun muddat foyda bermaydi, faqat xavfni
// oshiradi.
const TOKEN_TTL_MS = 15 * 60 * 1000;

const hash = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

/**
 * Bir martalik ulanish tokeni yaratadi.
 * Ochiq token FAQAT shu yerdan qaytadi, bazada hash qoladi.
 *
 * @returns {Promise<{ token: string, expiresAt: Date }>}
 */
async function createLinkToken(directorId) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await Teacher.updateOne(
    { _id: directorId },
    {
      $set: {
        "telegram.linkTokenHash": hash(token),
        "telegram.linkTokenExpires": expiresAt,
      },
    },
  );

  return { token, expiresAt };
}

/**
 * Tokenni ishlatadi va Telegram hisobini bog'laydi.
 *
 * ⚠️ TOKEN DARHOL O'CHIRILADI — muvaffaqiyatli bo'lsa ham,
 *    bo'lmasa ham emas: faqat topilgan holatda. Aks holda
 *    bir xil havolani ikki kishi ochsa ikkovi ham ulanardi.
 *
 * @returns {Promise<object|null>} bog'langan direktor yoki null
 */
async function consumeLinkToken(token, { chatId, username }) {
  if (!token) return null;

  // Shartli yangilash: token mos VA muddati o'tmagan bo'lsa
  // hujjatni bir amalda egallaymiz. Tekshiruv bilan yozuv
  // orasida tirqish qolmaydi — ikki kishi bir vaqtda ochsa
  // faqat biri o'tadi.
  const director = await Teacher.findOneAndUpdate(
    {
      "telegram.linkTokenHash": hash(token),
      "telegram.linkTokenExpires": { $gt: new Date() },
    },
    {
      $set: {
        "telegram.chatId": chatId,
        "telegram.username": username || "",
        "telegram.linkedAt": new Date(),
        "telegram.linkTokenHash": null,
        "telegram.linkTokenExpires": null,
      },
    },
    { new: true },
  ).select("name email institutionType telegram cashReport");

  return director || null;
}

/**
 * Ulanishni uzadi.
 *
 * ⚠️ `chatId` tozalanadi, sozlama (`cashReport.mode`) esa
 *    QOLADI. Direktor telefonini almashtirib qayta ulansa,
 *    tanlovini boshqatdan qilishi shart emas.
 */
async function unlink(directorId) {
  await Teacher.updateOne(
    { _id: directorId },
    {
      $set: {
        "telegram.chatId": null,
        "telegram.username": "",
        "telegram.linkedAt": null,
        "telegram.linkTokenHash": null,
        "telegram.linkTokenExpires": null,
      },
    },
  );
}

/** Shu Telegram hisobiga bog'langan direktor bormi */
function findByChat(chatId) {
  return Teacher.findOne({ "telegram.chatId": chatId })
    .select("name institutionType telegram cashReport")
    .lean();
}

module.exports = {
  createLinkToken,
  consumeLinkToken,
  unlink,
  findByChat,
  TOKEN_TTL_MS,
};
