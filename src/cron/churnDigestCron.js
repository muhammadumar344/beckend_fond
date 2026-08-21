// src/cron/churnDigestCron.js
// ════════════════════════════════════════════════════════════
// Haftalik "ketish arafasida" xabari — direktorga Telegram orqali.
//
// ⚠️ DUSHANBA 09:00 TOSHKENT. Hafta rejalashtiriladigan kun va
//    qo'ng'iroq qilish uchun eng qulay vaqt: ota-ona ishga
//    ketgan bo'lsa ham telefonini ko'radi, kechqurungi kabi
//    "bezovta qildim" bo'lmaydi.
//
// ⚠️ BO'SH RO'YXAT — XABAR YO'Q. Kassa xabaridagi `problems`
//    rejimi bilan bir xil qoida: xabar kelsa — ish bor.
//
// ⚠️ Bitta direktordagi xato qolganlarini to'xtatmaydi
//    (`cashReportCron` bilan bir xil naqsh).
// ════════════════════════════════════════════════════════════

const cron = require("node-cron");
const Teacher = require("../models/Teacher");
const { getBot } = require("../bot/bot");
const { buildDigest, collect, crmLink } = require("../services/churnDigest");

const sendChurnDigests = async () => {
  const bot = getBot();
  if (!bot) {
    console.warn("⚠️  Ketish xabari: bot ishlamayapti, o'tkazib yuborildi");
    return { sent: 0, skipped: 0 };
  }

  // ⚠️ Faqat LC rejimi. Fond — bitta sinf rahbari uchun va
  //    u bolalarni har kuni ko'radi; unga "kelmay qo'ydi" deb
  //    yozish ma'nosiz.
  // ⚠️ `$ne: "off"` — `"weekly"` deb yozib bo'lmaydi. Mongoose
  //    standart qiymatni faqat hujjat SAQLANGANDA yozadi, ya'ni
  //    mavjud hisoblarda `churnDigest` maydoni bazada UMUMAN
  //    YO'Q. Aniq qiymat bo'yicha qidirsak, xususiyat faqat
  //    yangi hisoblarda ishlagan bo'lardi — va buni hech kim
  //    sezmasdi, chunki xabar kelmasligi xatoga o'xshamaydi.
  const directors = await Teacher.find({
    institutionType: "learning_center",
    "telegram.chatId": { $ne: null },
    "churnDigest.mode": { $ne: "off" },
    deletionScheduledFor: null,
    isActive: { $ne: false },
  })
    .select("name telegram churnDigest")
    .lean();

  const link = crmLink();
  let sent = 0;
  let skipped = 0;

  for (const dir of directors) {
    try {
      const data = await collect(dir, link);
      const { hasRisk, text } = buildDigest(data);

      // Jim hafta — jim qoladi.
      if (!hasRisk) {
        skipped += 1;
        continue;
      }

      await bot.sendMessage(dir.telegram.chatId, text, {
        parse_mode: "Markdown",
      });
      sent += 1;
    } catch (e) {
      // ⚠️ 403 = direktor botni bloklagan. Xato emas, holat:
      //    ulanishni tozalaymiz (kassa xabari bilan bir xil).
      if (e.response?.body?.error_code === 403) {
        await Teacher.updateOne(
          { _id: dir._id },
          { $set: { "telegram.chatId": null, "telegram.linkedAt": null } },
        );
        console.warn(`ℹ️  Ketish xabari: ${dir.name} botni bloklagan, ulanish uzildi`);
      } else {
        console.error(`⚠️  Ketish xabari (${dir.name}):`, e.message);
      }
    }
  }

  if (sent || skipped) {
    console.log(`📉 Ketish xabari: ${sent} yuborildi, ${skipped} jim hafta`);
  }
  return { sent, skipped };
};

const startChurnDigestCron = () => {
  cron.schedule("0 9 * * 1", sendChurnDigests, { timezone: "Asia/Tashkent" });
  console.log("⏰ Ketish xabari cron ishga tushdi (dushanba 09:00 Toshkent)");
};

module.exports = { startChurnDigestCron, sendChurnDigests };
