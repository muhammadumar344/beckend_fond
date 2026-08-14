// src/utils/notifyTargets.js
// ════════════════════════════════════════════════════════════
// "Bu o'quvchi haqida kimga xabar yuborilsin?" — YAGONA javob.
//
// ⚠️ NEGA KERAK: hozir ikkita manba bor.
//      · `TelegramParent` — eski bot ro'yxati (isbotlanmagan)
//      · `StudentLink`    — yangi, isbotlangan bog'lanish
//
//    Yangi ota-onalar faqat ikkinchisiga tushadi. Eslatma cron'i
//    esa birinchisini o'qirdi — ya'ni yangi bog'langan har bir
//    ota-ona to'lov eslatmasini JIMGINA olmay qolardi. Pro
//    tarifda sotilayotgan xususiyat ishlamay turardi va buni
//    hech kim sezmasdi.
//
//    Shuning uchun xabar yuboradigan HAR QANDAY kod shu yerdan
//    ro'yxat oladi, to'g'ridan-to'g'ri modelga bormaydi.
//
// ⚠️ Bitta odam ikkala jadvalda ham bo'lishi mumkin (eski
//    ro'yxatda edi, keyin raqamini tasdiqladi). `chatId+student`
//    bo'yicha takror olib tashlanadi — aks holda bitta ota-ona
//    ikkita bir xil xabar olardi.
// ════════════════════════════════════════════════════════════

const TelegramParent = require("../models/TelegramParent");
const StudentLink = require("../models/StudentLink");

/**
 * @typedef {{chatId: string, studentId: string, source: 'link'|'legacy', linkId: any}} Target
 */

/**
 * Barcha faol qabul qiluvchilar.
 * @param {object} [filter]  { studentIds?: string[], directorId?: string }
 * @returns {Promise<Target[]>}
 */
async function collectTargets(filter = {}) {
  const linkQuery = { isActive: true };
  const legacyQuery = { isActive: true };

  if (filter.studentIds?.length) {
    linkQuery.student = { $in: filter.studentIds };
    legacyQuery.studentId = { $in: filter.studentIds };
  }
  if (filter.directorId) {
    linkQuery.director = filter.directorId;
    legacyQuery.teacherId = filter.directorId;
  }

  const [links, legacy] = await Promise.all([
    StudentLink.find(linkQuery).select("student telegramChatId telegramUserId").lean(),
    TelegramParent.find(legacyQuery).select("studentId telegramChatId").lean(),
  ]);

  const seen = new Set();
  const out = [];

  const push = (chatId, studentId, source, linkId) => {
    if (!chatId || !studentId) return;
    const k = `${chatId}:${studentId}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ chatId: String(chatId), studentId: String(studentId), source, linkId });
  };

  // ⚠️ Yangi ro'yxat BIRINCHI — takror bo'lsa o'sha saqlanib qolsin
  for (const l of links) {
    // Eski yozuvlarda chatId bo'sh bo'lishi mumkin; Telegram'da
    // shaxsiy chat id foydalanuvchi id siga teng
    push(l.telegramChatId || l.telegramUserId, l.student, "link", l._id);
  }
  for (const p of legacy) {
    push(p.telegramChatId, p.studentId, "legacy", p._id);
  }

  return out;
}

/** Bitta o'quvchi bo'yicha — xabarnomalar uchun qulay qisqartma */
const targetsForStudent = (studentId) =>
  collectTargets({ studentIds: [studentId] });

module.exports = { collectTargets, targetsForStudent };
