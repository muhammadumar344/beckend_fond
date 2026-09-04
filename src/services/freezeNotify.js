// src/services/freezeNotify.js
// ════════════════════════════════════════════════════════════
// OBUNA MUZLATILGANDA DIREKTORGA XABAR.
//
// Admin yozgi tatil uchun freeze yoqadi — o'sha daqiqada har bir
// to'lovchi direktorning obuna soati to'xtaydi. Ular buni faqat
// saytga kirib bilardi (Dashboard'dagi modal). Kirmagani esa
// hech narsa bilmasdi: "obunam tugab qolmadimi?" degan savol
// bilan qo'ng'iroq qilardi.
//
// ⚠️ XABAR MATNI ALLAQACHON YOZILGAN EDI — `telegramService.js`
//    dagi `sendFreezeNotification` / `sendUnfreezeNotification`.
//    Lekin ular hech qayerdan CHAQIRILMAGAN: yozilgan paytda
//    direktorga xabar yuboradigan kanalning o'zi yo'q edi
//    (bot faqat ota-onalar uchun ishlardi). Kanal 2026-08-21 da
//    paydo bo'ldi — endi ulandi.
//
// ⚠️ REJIM TANLOVIGA QARAMAYDI. `cashReport.mode` va
//    `churnDigest.mode` — bu kunlik/haftalik xabarlar uchun,
//    ya'ni "shovqin" darajasi. Obuna muzlatilishi esa HISOB
//    haqidagi xabar: uni o'chirib qo'ygan odam ham bilishi
//    kerak, chunki bu uning puliga tegadi.
//
// ⚠️ FONI'da yuboriladi (`inBackground`). Admin freeze tugmasini
//    bosganda 200 ta hisob saqlanadi va 200 ta Telegram xabari
//    ketadi — so'rov shuncha kutib turmasin.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const {
  sendFreezeNotification,
  sendUnfreezeNotification,
} = require("./telegramService");

// Telegram sekundiga ~30 xabarni ko'taradi. Har 20 tadan keyin
// qisqa tanaffus — chegaraga urilib, xabarlar yo'qolmasin.
const CHUNK = 20;
const PAUSE_MS = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ⚠️ SOF FUNKSIYA. Kimga xabar ketishini ajratadi.
 *
 * Telegram'ga ulanmagan direktorga yuborib bo'lmaydi; hisobi
 * o'chirilayotganini bezovta qilishning ma'nosi yo'q.
 */
function pickRecipients(teachers = []) {
  return teachers.filter(
    (t) => t?.telegram?.chatId && !t.deletionScheduledFor && t.isActive !== false,
  );
}

/** Muzlatilgani haqida xabar (403 bo'lsa ulanish tozalanadi) */
async function notifyFrozen({ teachers, reason }) {
  return send(teachers, (t) =>
    sendFreezeNotification(t.telegram.chatId, t.name, reason),
  );
}

/** Qayta faollashgani haqida xabar */
async function notifyRestored({ teachers }) {
  return send(teachers, (t) => {
    // Qolgan kunlar — direktor uchun eng muhim raqam
    const daysLeft = t.planExpiresAt
      ? Math.max(0, Math.ceil((new Date(t.planExpiresAt) - Date.now()) / 86400000))
      : 0;
    return sendUnfreezeNotification(t.telegram.chatId, t.name, daysLeft);
  });
}

async function send(teachers, fn) {
  const list = pickRecipients(teachers);
  let sent = 0;

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    try {
      const ok = await fn(t);
      if (ok) sent += 1;
    } catch (e) {
      // ⚠️ 403 = botni bloklagan. Xato emas, holat: ulanishni
      //    tozalaymiz (kassa xabari bilan bir xil qoida).
      if (e.response?.body?.error_code === 403) {
        await Teacher.updateOne(
          { _id: t._id },
          { $set: { "telegram.chatId": null, "telegram.linkedAt": null } },
        );
      } else {
        console.error(`⚠️  Freeze xabari (${t.name}):`, e.message);
      }
    }
    if ((i + 1) % CHUNK === 0) await sleep(PAUSE_MS);
  }

  if (sent) console.log(`❄️  Freeze xabari: ${sent} direktorga yuborildi`);
  return { sent, total: list.length };
}

module.exports = { pickRecipients, notifyFrozen, notifyRestored, CHUNK };
