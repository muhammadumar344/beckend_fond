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
//
// ⚠️ BITTA O'QUVCHIDA BIR NECHTA QABUL QILUVCHI BO'LISHI MUMKIN
//    (ota, ona, o'quvchining o'zi). Eski kod `byStudent[id] = p`
//    deb bittasini yozardi va qolganlari jimgina tushib qolardi.
//    `groupByStudent` massiv qaytaradi.
// ════════════════════════════════════════════════════════════

const TelegramParent = require("../models/TelegramParent");
const StudentLink = require("../models/StudentLink");

/**
 * @typedef {object} Target
 * @property {string} chatId
 * @property {string} studentId
 * @property {'link'|'legacy'} source
 * @property {any} linkId
 * @property {string} username
 * @property {Date|null} linkedAt
 * @property {Date|null} lastNotifiedAt
 * @property {'phone'|'code'|'legacy'} verifiedVia   `legacy` — isbotlanmagan
 * @property {'parent'|'student'} kind
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
    StudentLink.find(linkQuery)
      .select(
        "student telegramChatId telegramUserId telegramUsername kind verifiedVia lastNotifiedAt createdAt",
      )
      .lean(),
    TelegramParent.find(legacyQuery)
      .select("studentId telegramChatId telegramUsername lastNotifiedAt registeredAt")
      .lean(),
  ]);

  const seen = new Set();
  const out = [];

  const push = (chatId, studentId, source, linkId, extra) => {
    if (!chatId || !studentId) return;
    const k = `${chatId}:${studentId}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      chatId: String(chatId),
      studentId: String(studentId),
      source,
      linkId,
      ...extra,
    });
  };

  // ⚠️ Yangi ro'yxat BIRINCHI — takror bo'lsa o'sha saqlanib qolsin
  for (const l of links) {
    // Eski yozuvlarda chatId bo'sh bo'lishi mumkin; Telegram'da
    // shaxsiy chat id foydalanuvchi id siga teng
    push(l.telegramChatId || l.telegramUserId, l.student, "link", l._id, {
      username: l.telegramUsername || "",
      linkedAt: l.createdAt || null,
      lastNotifiedAt: l.lastNotifiedAt || null,
      verifiedVia: l.verifiedVia || "code",
      kind: l.kind || "parent",
    });
  }
  for (const p of legacy) {
    push(p.telegramChatId, p.studentId, "legacy", p._id, {
      username: p.telegramUsername || "",
      linkedAt: p.registeredAt || null,
      lastNotifiedAt: p.lastNotifiedAt || null,
      verifiedVia: "legacy",
      kind: "parent",
    });
  }

  return out;
}

/**
 * ⚠️ SOF FUNKSIYA. `collectTargets` natijasini o'quvchi bo'yicha
 * guruhlaydi — qiymat MASSIV, chunki bitta bolada ota ham, ona
 * ham ulangan bo'lishi mumkin.
 *
 * @param {Target[]} targets
 * @returns {Map<string, Target[]>}
 */
function groupByStudent(targets = []) {
  const map = new Map();
  for (const t of targets) {
    const list = map.get(t.studentId);
    if (list) list.push(t);
    else map.set(t.studentId, [t]);
  }
  return map;
}

/**
 * "Yuborildi" belgisini TO'G'RI jadvalga yozadi.
 *
 * ⚠️ Bu ikki qatorlik `Model = t.source === 'link' ? ... : ...`
 *    naqshi to'rt joyda takrorlanardi. Bitta joyda unutilsa
 *    "oxirgi xabar" ustuni jimgina eskirib qolardi.
 */
async function markNotified(target, when = new Date()) {
  if (!target?.linkId) return;
  const Model = target.source === "link" ? StudentLink : TelegramParent;
  await Model.updateOne({ _id: target.linkId }, { $set: { lastNotifiedAt: when } });
}

module.exports = { collectTargets, groupByStudent, markNotified };
