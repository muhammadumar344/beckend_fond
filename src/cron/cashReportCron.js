// src/cron/cashReportCron.js
// ════════════════════════════════════════════════════════════
// Kunlik kassa xabari — direktorga Telegram orqali.
//
// ⚠️ SOAT 21:00 TOSHKENT. Markazlarning kechki darsi odatda
//    20:00–20:30 da tugaydi; undan oldin yuborsak xabar
//    yarim kunlik bo'lib chiqardi va direktor unga ishonmay
//    qo'yardi.
//
// ⚠️ FAQAT ULANGAN VA YOQIB QO'YGAN direktorlarga. `mode`
//    standart holda `problems` — ya'ni ulanishning o'zi xabar
//    oqimini ochib yubormaydi, lekin muhim kun jimgina o'tib
//    ham ketmaydi.
//
// ⚠️ Bitta direktordagi xato qolganlarini to'xtatmaydi. Har
//    biri alohida `try` ichida: Telegram bitta chatni bloklagan
//    bo'lsa (bot o'chirilgan, chat o'chirilgan) butun sikl
//    yiqilmasin.
// ════════════════════════════════════════════════════════════

const cron = require("node-cron");
const Teacher = require("../models/Teacher");
const { getBot } = require("../bot/bot");
const { buildReport, collect } = require("../services/cashReport");
const { todayInTashkent } = require("../utils/supportWindow");

const sendCashReports = async () => {
  const bot = getBot();
  if (!bot) {
    console.warn("⚠️  Kassa xabari: bot ishlamayapti, o'tkazib yuborildi");
    return { sent: 0, skipped: 0 };
  }

  const day = todayInTashkent();

  // ⚠️ Faqat LC rejimi. Fond'da kassa tushunchasi yo'q —
  //    sinf rahbariga "smena yopilmagan" deb yozish ma'nosiz.
  const directors = await Teacher.find({
    institutionType: "learning_center",
    "telegram.chatId": { $ne: null },
    "cashReport.mode": { $in: ["problems", "daily"] },
    deletionScheduledFor: null,
    isActive: { $ne: false },
  })
    .select("name telegram cashReport")
    .lean();

  let sent = 0;
  let skipped = 0;

  for (const dir of directors) {
    try {
      const data = await collect(dir, day);
      const { hasProblems, text } = buildReport(data);

      // ⚠️ Bu yerda butun funksiyaning ma'nosi. `problems`
      //    rejimida jim kun — JIM QOLADI.
      if (dir.cashReport?.mode === "problems" && !hasProblems) {
        skipped += 1;
        continue;
      }

      await bot.sendMessage(dir.telegram.chatId, text, {
        parse_mode: "Markdown",
      });
      sent += 1;
    } catch (e) {
      // ⚠️ 403 = direktor botni bloklagan. Bu xato emas, holat:
      //    ulanishni tozalab qo'yamiz, aks holda har kuni
      //    log'ga bir xil xato yozilib turardi.
      if (e.response?.body?.error_code === 403) {
        await Teacher.updateOne(
          { _id: dir._id },
          { $set: { "telegram.chatId": null, "telegram.linkedAt": null } },
        );
        console.warn(`ℹ️  Kassa xabari: ${dir.name} botni bloklagan, ulanish uzildi`);
      } else {
        console.error(`⚠️  Kassa xabari (${dir.name}):`, e.message);
      }
    }
  }

  if (sent || skipped) {
    console.log(`📊 Kassa xabari: ${sent} yuborildi, ${skipped} jim kun`);
  }
  return { sent, skipped };
};

const startCashReportCron = () => {
  cron.schedule("0 21 * * *", sendCashReports, { timezone: "Asia/Tashkent" });
  console.log("⏰ Kassa xabari cron ishga tushdi (har kuni 21:00 Toshkent)");
};

module.exports = { startCashReportCron, sendCashReports };
