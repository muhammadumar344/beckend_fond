// src/cron/accountCleanupCron.js
// ════════════════════════════════════════════════════════════
// Muhlati o'tgan o'chirish so'rovlarini bajaradi.
//
// Direktor hisobni o'chirishga qo'yganda ma'lumot DARHOL
// yo'qolmaydi — 30 kun turadi (controllers/accountController.js).
// Shu cron har kuni kelib, muhlati o'tganlarni butunlay o'chiradi.
//
// ⚠️ Kechikkani zarar qilmaydi. Server bir hafta o'chib tursa,
//    keyingi ishga tushishida hammasi bir yo'la bajariladi —
//    shart `deletionScheduledFor <= hozir`, ya'ni "o'tgan kun"
//    tushib qolmaydi.
// ════════════════════════════════════════════════════════════

const cron = require("node-cron");
const { purgeExpiredAccounts } = require("../controllers/accountController");

const runCleanup = async () => {
  try {
    const results = await purgeExpiredAccounts();
    if (results.length) {
      const ok = results.filter((r) => r.ok).length;
      console.log(
        `🗑️  Hisob tozalash: ${ok}/${results.length} o'chirildi`,
      );
    }
  } catch (err) {
    console.error("accountCleanup xatosi:", err);
  }
};

const startAccountCleanupCron = () => {
  // Har kuni 03:30 (Toshkent) — tunda, yuk kam paytda
  cron.schedule("30 3 * * *", runCleanup, { timezone: "Asia/Tashkent" });
  console.log("⏰ Hisob tozalash cron ishga tushdi (har kuni 03:30)");
};

module.exports = { startAccountCleanupCron, runCleanup };
