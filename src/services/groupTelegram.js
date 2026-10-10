// src/services/groupTelegram.js
// ════════════════════════════════════════════════════════════
// SINF OTA-ONALARINING TELEGRAM GURUHIGA XABAR YUBORISH.
//
// Bot ilgari faqat ota-onaga ALOHIDA (shaxsiy chatda) yozardi.
// Bu yerda esa bitta sinfning umumiy guruhiga: direktor tugmani
// bosadi, server o'zi to'lamagan o'quvchilarni topadi va guruhga
// ro'yxat yozadi.
//
// ⚠️ MA'LUMOT ALOHIDALIGI (eng muhim joy):
//    · Guruh DIREKTORGA emas, SINFGA bog'lanadi (`Class.telegramGroup`).
//    · Har bir so'rov `{ _id: classId, teacher: directorId }` bilan
//      qidiriladi — boshqa direktorning sinfi ID'si bilan so'ralsa
//      "Sinf topilmadi" chiqadi, ma'lumot ham, guruh ham ochilmaydi.
//    · O'quvchilar ro'yxatini FRONTEND yubormaydi — server o'zi
//      bazadan oladi.
//    · Bitta Telegram guruh faqat bitta sinfga ulanadi (unikal indeks
//      + kodda tekshiruv).
//
// ⚠️ ULASH — bir martalik token (services/directorTelegram.js bilan
//    bir xil qoida): direktor Lumo'da tugmani bosadi, Telegram
//    `?startgroup=grp_<token>` havolasi bilan guruh tanlanadi, bot
//    guruhda `/start grp_<token>` oladi. Token hash bo'lib saqlanadi,
//    15 daqiqada eskiradi va bir marta ishlaydi.
//
// ⚠️ To'lov holati YANGI tizim emas: `MonthlyPayment` + narx qoidasi
//    (`utils/pricing.js`) — dashboard va "qarzdorlar" hisobi bilan
//    aynan bir xil manba.
// ════════════════════════════════════════════════════════════
const crypto = require("crypto");
const mongoose = require("mongoose");

const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const MonthlyPayment = require("../models/MonthlyPayment");
const Enrollment = require("../models/Enrollment");
const { getGroupStudents } = require("../utils/enrollment");
const { priceMap } = require("../utils/pricing");
const { hasFeature } = require("../utils/planHelper");
const { TOKEN_TTL_MS, hash } = require("./directorTelegram");
const { MONTHS } = require("./telegramService");

// ⚠️ bot/handlers.js shu faylni, shu fayl esa bot/bot.js ni talab qiladi —
//    doira. Yuqorida `const { getBot } = require(...)` deb yozsak, doira
//    paytida u `undefined` bo'lib qolardi. Shuning uchun bot kerak bo'lgan
//    paytda (funksiya ichida) olinadi.
const liveBot = () => require("../bot/bot").getBot();

// Telegram bitta xabarni 4096 belgigacha qabul qiladi. Zaxira bilan.
const MAX_LEN = 3800;
// Juda uzun ism xabarni portlatib yubormasin
const MAX_NAME_LEN = 120;

/** Frontend tushunadigan xato: `code` mashina uchun, `message` odam uchun */
class GroupError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = "GroupError";
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

// ── Sof funksiyalar (bazaga/Telegram'ga tegmaydi — testda sinaladi) ──

/**
 * Telegram (eski) Markdown uchun ismni xavfsiz qiladi.
 *
 * ⚠️ NEGA KERAK: o'quvchi ismini ustoz qo'lda yozadi. "Ali_Vali" yoki
 *    "Sevinch*" kabi ism Markdown'ni buzib, Telegram butun xabarni
 *    "can't parse entities" bilan rad etardi — ya'ni ro'yxatdagi bitta
 *    ism sabab hech kim ogohlantirilmay qolardi.
 *    Hujjatga ko'ra `_ * ` [` belgilari oldiga `\` qo'yiladi.
 */
function escapeMd(value) {
  return String(value ?? "")
    .replace(/\\/g, "") // yolg'iz teskari chiziq keyingi belgini "yutib" yuborardi
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LEN)
    .replace(/([_*`[])/g, "\\$1");
}

/**
 * Qaysi o'quvchilar to'lamagan.
 *
 * Qoidalar dashboard bilan bir xil: shu oy uchun `paid` yozuvi YO'Q
 * o'quvchi — to'lamagan (yozuv umuman yaratilmagan bo'lsa ham).
 *
 * ⚠️ Narxi 0 bo'lgan (individual chegirma bilan bepul) o'quvchi
 *    ro'yxatga TUSHMAYDI: to'lashi kerak narsa yo'q, unga umumiy
 *    guruhda "to'lamadi" deyish noto'g'ri va yoqimsiz.
 *
 * @param {object} p
 * @param {Array}  p.students     getGroupStudents() natijasi
 * @param {Array}  p.records      shu sinf+oy+yil MonthlyPayment yozuvlari
 * @param {object} p.cls          Class hujjati (defaultAmount)
 * @param {Array}  p.enrollments  shu sinfning faol Enrollment yozuvlari
 */
function computeUnpaid({ students, records, cls, enrollments = [] }) {
  const prices = priceMap(students, cls, enrollments);
  const paid = new Set();
  const owedByRecord = new Map();
  for (const r of records) {
    const id = String(r.student);
    if (r.status === "paid") paid.add(id);
    else owedByRecord.set(id, Number(r.amount) || 0);
  }

  return students.filter((s) => {
    const id = String(s._id);
    if (paid.has(id)) return false;
    const owed = owedByRecord.has(id)
      ? owedByRecord.get(id)
      : Number(prices.get(id)?.amount) || 0;
    return owed > 0;
  });
}

/**
 * Guruhga ketadigan xabar(lar).
 *
 * Mavjud botdagi uslub saqlangan: emoji sarlavha + qalin (Markdown)
 * matn. Ro'yxat uzun bo'lsa bir nechta xabarga bo'linadi — Telegram
 * 4096 belgidan uzun xabarni qabul qilmaydi. Salom va sarlavha birinchi
 * xabarda, "Rahmat!" oxirgisida.
 *
 * @param {object} p
 * @param {string} p.className
 * @param {number} p.month
 * @param {number} p.year
 * @param {string[]} p.names  to'lamagan o'quvchilar ismi
 * @param {string} [p.mode]   'learning_center' bo'lsa "fond" so'zi ishlatilmaydi
 * @returns {string[]}
 */
function buildUnpaidMessages({ className, month, year, names, mode }) {
  const isLC = mode === "learning_center";
  const period = `${MONTHS[month - 1]} ${year}`;
  const where = `🏫 Sinf: *${escapeMd(className)}* · 📅 ${period}`;

  if (!names.length) {
    const title = isLC ? "To'lov holati" : "Fond to'lovi";
    const body = isLC
      ? "Barcha o'quvchilarning to'lovlari amalga oshirilgan."
      : "Barcha o'quvchilarning fond to'lovlari amalga oshirilgan.";
    return [`✅ *${title}*\n${where}\n\n${body}`];
  }

  const title = isLC ? "Oylik to'lov haqida" : "Fond to'lovi haqida";
  const intro = isLC
    ? "Quyidagi o'quvchilarning oylik to'lovi hali amalga oshirilmagan:"
    : "Quyidagi o'quvchilarning fond to'lovi hali amalga oshirilmagan:";
  const ask = isLC
    ? "Iltimos, to'lovni amalga oshiring."
    : "Iltimos, fond uchun to'lovni amalga oshiring.";

  const head =
    `📢 *${title}*\n${where}\n\n` +
    `Assalomu alaykum, hurmatli ota-onalar!\n\n${intro}\n`;
  const tail = `${ask}\n\nRahmat!`;
  const lines = names.map((n, i) => `${i + 1}. ${escapeMd(n)}`);

  // Har bir xabarda "oxirgi qism" uchun joy qoldiramiz — qaysi biri
  // oxirgi bo'lishini oldindan bilmaymiz.
  const budget = MAX_LEN - tail.length - 2;
  const parts = [];
  let cur = head;
  for (const line of lines) {
    if (cur.length + line.length + 1 > budget && cur !== head) {
      parts.push(cur);
      cur = line;
    } else {
      cur += (cur.endsWith("\n") || cur === "" ? "" : "\n") + line;
    }
  }
  parts.push(`${cur}\n\n${tail}`);
  return parts;
}

/**
 * Telegram xatosini frontend tushunadigan xatoga o'giradi.
 * Telegram'ning xom matni foydalanuvchiga chiqarilmaydi (logda qoladi).
 */
function mapTelegramError(err) {
  const body = err?.response?.body || {};
  const desc = String(body.description || err?.message || "").toLowerCase();

  if (body.parameters?.migrate_to_chat_id || desc.includes("upgraded to a supergroup")) {
    return new GroupError(
      "GROUP_UPGRADED",
      409,
      "Guruh supergroup'ga aylangan. Guruhni qayta ulang.",
    );
  }
  if (body.error_code === 429 || desc.includes("too many requests")) {
    return new GroupError(
      "TELEGRAM_RATE_LIMIT",
      429,
      "Telegram vaqtincha cheklov qo'ydi. Birozdan keyin qayta urinib ko'ring.",
      { retryAfter: body.parameters?.retry_after || null },
    );
  }
  if (/kicked|not a member|chat not found|group is deactivated|chat was deleted/.test(desc)) {
    return new GroupError(
      "BOT_NOT_IN_GROUP",
      409,
      "Bot guruhda yo'q. Botni guruhga qayta qo'shib, guruhni qayta ulang.",
    );
  }
  if (/not enough rights|have no rights|rights to send|can't send|cannot send|write_forbidden/.test(desc)) {
    return new GroupError(
      "BOT_NO_PERMISSION",
      409,
      "Botda guruhga xabar yuborish huquqi yo'q. Guruh sozlamalarida botga xabar yuborishga ruxsat bering.",
    );
  }
  return new GroupError(
    "TELEGRAM_ERROR",
    502,
    "Telegram xabarni yubora olmadi. Birozdan keyin qayta urinib ko'ring.",
  );
}

/** Oy/yil: berilmasa — hozirgi oy. Noto'g'ri bo'lsa 400. */
function periodOf(month, year, now = new Date()) {
  const blank = (v) => v === undefined || v === null || v === "";
  const m = blank(month) ? now.getMonth() + 1 : Number(month);
  const y = blank(year) ? now.getFullYear() : Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2020 || y > 2100) {
    throw new GroupError("INVALID_PERIOD", 400, "Oy va yil noto'g'ri");
  }
  return { month: m, year: y };
}

// ── Bazaga tegadigan qismlar ─────────────────────────────────

const classNotFound = () => new GroupError("CLASS_NOT_FOUND", 404, "Sinf topilmadi");

/** Tarifda Telegram bormi (services/notify.js dagi qoida bilan bir xil) */
async function assertTelegramPlan(directorId) {
  const teacher = await Teacher.findById(directorId).select(
    "plan planExpiresAt institutionType",
  );
  if (!teacher) throw new GroupError("TEACHER_NOT_FOUND", 404, "Teacher topilmadi");
  if (!hasFeature(teacher, "telegram")) {
    throw new GroupError("UPGRADE_REQUIRED", 403, "Bu funksiya Pro va Premium tarifda", {
      requiresUpgrade: true,
    });
  }
  return teacher;
}

/** Sinf shu direktorniki ekaniga ishonch hosil qiladi. Aks holda — 404. */
async function ownClass(directorId, classId, select) {
  if (!mongoose.isValidObjectId(classId)) throw classNotFound();
  const cls = await Class.findOne({ _id: classId, teacher: directorId }).select(select);
  if (!cls) throw classNotFound();
  return cls;
}

/** Shu oy to'lamagan o'quvchilar. `total` — sinfdagi jami o'quvchi. */
async function findUnpaid(cls, directorId, month, year) {
  const students = await getGroupStudents(cls._id);
  if (!students.length) return { total: 0, unpaid: [] };

  const [records, enrollments] = await Promise.all([
    MonthlyPayment.find({ class: cls._id, teacher: directorId, month, year })
      .select("student status amount")
      .lean(),
    Enrollment.find({ class: cls._id, status: "active" })
      .select("student priceOverride")
      .lean(),
  ]);
  return { total: students.length, unpaid: computeUnpaid({ students, records, cls, enrollments }) };
}

/** Barcha sinflar uchun ulanish holati. ⚠️ `chatId` frontendga CHIQMAYDI. */
async function listGroups(directorId) {
  const classes = await Class.find({ teacher: directorId })
    .select("name telegramGroup.title telegramGroup.linkedAt telegramGroup.lastMessageAt +telegramGroup.chatId")
    .sort({ name: 1 })
    .lean();

  return classes.map((c) => {
    const g = c.telegramGroup || {};
    const linked = g.chatId !== null && g.chatId !== undefined;
    return {
      classId: c._id,
      className: c.name,
      linked,
      title: linked ? g.title || "" : "",
      linkedAt: linked ? g.linkedAt || null : null,
      lastMessageAt: linked ? g.lastMessageAt || null : null,
    };
  });
}

/** Bir martalik ulash havolasini yaratadi. Ochiq token faqat shu javobda ketadi. */
async function createGroupLink({ directorId, classId }, deps = {}) {
  const bot = (deps.getBot || liveBot)();
  if (!bot) throw new GroupError("BOT_OFFLINE", 503, "Bot ishlamayapti");
  await assertTelegramPlan(directorId);
  await ownClass(directorId, classId, "_id");

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const r = await Class.updateOne(
    { _id: classId, teacher: directorId },
    {
      $set: {
        "telegramGroup.linkTokenHash": hash(token),
        "telegramGroup.linkTokenExpires": expiresAt,
      },
    },
  );
  if (!r.matchedCount) throw classNotFound();

  const info = await bot.getMe();
  return {
    link: `https://t.me/${info.username}?startgroup=grp_${token}`,
    // Bot guruhda allaqachon bo'lsa — guruhga shu buyruqni yozish yetadi
    command: `/link grp_${token}`,
    expiresAt,
  };
}

/**
 * Botga guruhda kelgan tokenni ishlatadi (bot/handlers.js chaqiradi).
 *
 * ⚠️ Token FAQAT muvaffaqiyatli ulanganda o'chadi. Guruh allaqachon
 *    boshqa sinfda bo'lsa ("taken") hech narsa yozilmaydi — begona
 *    token bilan band guruhni "tortib olib" bo'lmaydi.
 *
 * @returns {Promise<{status:'ok'|'invalid'|'taken', className?:string}>}
 */
async function consumeGroupToken(token, { chatId, title }) {
  if (!token) return { status: "invalid" };
  const h = hash(token);

  const pending = await Class.findOne({
    "telegramGroup.linkTokenHash": h,
    "telegramGroup.linkTokenExpires": { $gt: new Date() },
  }).select("_id name");
  if (!pending) return { status: "invalid" };

  const taken = await Class.findOne({ "telegramGroup.chatId": chatId }).select("_id");
  if (taken && String(taken._id) !== String(pending._id)) return { status: "taken" };

  try {
    // Shartli yangilash: tekshiruv bilan yozuv orasida tirqish yo'q —
    // ikki kishi bir vaqtda ishlatsa faqat biri o'tadi.
    const cls = await Class.findOneAndUpdate(
      {
        _id: pending._id,
        "telegramGroup.linkTokenHash": h,
        "telegramGroup.linkTokenExpires": { $gt: new Date() },
      },
      {
        $set: {
          "telegramGroup.chatId": chatId,
          "telegramGroup.title": String(title || "").slice(0, 200),
          "telegramGroup.linkedAt": new Date(),
          "telegramGroup.linkTokenHash": null,
          "telegramGroup.linkTokenExpires": null,
        },
      },
      { new: true },
    ).select("name");
    if (!cls) return { status: "invalid" };
    return { status: "ok", className: cls.name };
  } catch (e) {
    if (e.code === 11000) return { status: "taken" }; // unikal indeks — poyga
    throw e;
  }
}

/** Bu Telegram guruh allaqachon biror sinfga ulanganmi (bot guruhga qo'shilganda salomlashish uchun) */
async function isChatLinked(chatId) {
  return Boolean(await Class.exists({ "telegramGroup.chatId": chatId }));
}

/** Ulanishni uzadi. Botning o'zi guruhda qoladi (uni guruhdan chiqarish — guruh egasi ishi). */
async function unlinkGroup({ directorId, classId }) {
  if (!mongoose.isValidObjectId(classId)) throw classNotFound();
  const r = await Class.updateOne(
    { _id: classId, teacher: directorId },
    {
      $set: {
        "telegramGroup.chatId": null,
        "telegramGroup.title": "",
        "telegramGroup.linkedAt": null,
        "telegramGroup.lastMessageAt": null,
        "telegramGroup.linkTokenHash": null,
        "telegramGroup.linkTokenExpires": null,
      },
    },
  );
  if (!r.matchedCount) throw classNotFound();
}

/** Xabar(lar)ni ketma-ket yuboradi. Xatoni mapTelegramError bilan o'giradi. */
async function sendTexts(bot, chatId, texts) {
  let sent = 0;
  for (const text of texts) {
    try {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      sent += 1;
    } catch (err) {
      console.error("Guruhga xabar yuborish xatosi:", err?.response?.body?.description || err?.message);
      const mapped = mapTelegramError(err);
      mapped.sentParts = sent;
      throw mapped;
    }
  }
}

/**
 * Asosiy amal: sinf guruhiga to'lamaganlar ro'yxatini yuboradi.
 *
 * @returns {Promise<{className, month, year, total, unpaidCount, parts}>}
 */
async function sendUnpaidReport({ directorId, classId, month, year }, deps = {}) {
  const bot = (deps.getBot || liveBot)();
  const teacher = await assertTelegramPlan(directorId);
  const period = periodOf(month, year, deps.now);
  const cls = await ownClass(directorId, classId, "name teacher +telegramGroup.chatId");

  const chatId = cls.telegramGroup?.chatId;
  if (chatId === null || chatId === undefined) {
    throw new GroupError(
      "GROUP_NOT_LINKED",
      409,
      "Bu sinf uchun Telegram guruh ulanmagan. Avval guruhni ulang.",
    );
  }
  if (!bot) throw new GroupError("BOT_OFFLINE", 503, "Bot ishlamayapti");

  const { total, unpaid } = await findUnpaid(cls, directorId, period.month, period.year);
  if (!total) throw new GroupError("NO_STUDENTS", 400, "Bu sinfda o'quvchi yo'q");

  const texts = buildUnpaidMessages({
    className: cls.name,
    month: period.month,
    year: period.year,
    names: unpaid.map((s) => s.name),
    mode: teacher.institutionType,
  });
  await sendTexts(bot, chatId, texts);

  await Class.updateOne(
    { _id: cls._id, teacher: directorId },
    { $set: { "telegramGroup.lastMessageAt": new Date() } },
  );

  return {
    className: cls.name,
    month: period.month,
    year: period.year,
    total,
    unpaidCount: unpaid.length,
    parts: texts.length,
  };
}

module.exports = {
  GroupError,
  escapeMd,
  computeUnpaid,
  buildUnpaidMessages,
  mapTelegramError,
  periodOf,
  listGroups,
  createGroupLink,
  consumeGroupToken,
  isChatLinked,
  unlinkGroup,
  sendUnpaidReport,
};
