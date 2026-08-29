// src/cron/billingAlertCron.js
// ════════════════════════════════════════════════════════════
// Oy boshidagi "varaqa yaratilmagan" xabari — direktorga.
//
// ⚠️ 2-SANA 09:00 TOSHKENT. Sabab `services/billingAlert.js`
//    boshida yozilgan: 1-sanada hali hech bir guruhda varaqa
//    yo'q va xabar hamma guruhni sanab shovqinga aylanardi.
//
// ⚠️ BO'SH RO'YXAT — XABAR YO'Q (kassa xabaridagi `problems`
//    rejimi bilan bir xil qoida).
//
// ⚠️ Bitta direktordagi xato qolganlarini to'xtatmaydi.
// ════════════════════════════════════════════════════════════

const cron = require("node-cron");
const Teacher = require("../models/Teacher");
const { getBot } = require("../bot/bot");
const { buildAlert, collect, crmLink } = require("../services/billingAlert");

const sendBillingAlerts = async () => {
  const bot = getBot();
  if (!bot) {
    console.warn("⚠️  Varaqa xabari: bot ishlamayapti, o'tkazib yuborildi");
    return { sent: 0, skipped: 0 };
  }

  // ⚠️ IKKALA REJIM HAM — `institutionType` bo'yicha filtr YO'Q.
  //    Varaqani unutish Fond'da ham xuddi shunday ko'rinmas.
  //
  // ⚠️ `$ne: "off"` — `"monthly"` deb yozib bo'lmaydi. Mongoose
  //    standart qiymatni faqat hujjat SAQLANGANDA yozadi, ya'ni
  //    mavjud hisoblarda `billingAlert` maydoni bazada UMUMAN
  //    YO'Q. Aniq qiymat bo'yicha qidirsak, xususiyat faqat
  //    yangi hisoblarda ishlagan bo'lardi — va buni hech kim
  //    sezmasdi, chunki xabar kelmasligi xatoga o'xshamaydi.
  const directors = await Teacher.find({
    "telegram.chatId": { $ne: null },
    "billingAlert.mode": { $ne: "off" },
    deletionScheduledFor: null,
    isActive: { $ne: false },
  })
    .select("name telegram billingAlert institutionType")
    .lean();

  let sent = 0;
  let skipped = 0;

  for (const dir of directors) {
    try {
      const isLC = dir.institutionType === "learning_center";
      const data = await collect(dir, { link: crmLink(isLC) });
      const { hasGaps, text } = buildAlert(data);

      // Hamma guruhga varaqa bor — jim qolamiz.
      if (!hasGaps) {
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
        console.warn(
          `ℹ️  Varaqa xabari: ${dir.name} botni bloklagan, ulanish uzildi`,
        );
      } else {
        console.error(`⚠️  Varaqa xabari (${dir.name}):`, e.message);
      }
    }
  }

  if (sent || skipped) {
    console.log(`🧾 Varaqa xabari: ${sent} yuborildi, ${skipped} toza markaz`);
  }
  return { sent, skipped };
};

const startBillingAlertCron = () => {
  cron.schedule("0 9 2 * *", sendBillingAlerts, { timezone: "Asia/Tashkent" });
  console.log("⏰ Varaqa xabari cron ishga tushdi (2-sana, 09:00 Toshkent)");
};

module.exports = { startBillingAlertCron, sendBillingAlerts };
