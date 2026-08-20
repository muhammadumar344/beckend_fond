// src/services/notify.js
// ════════════════════════════════════════════════════════════
// Hodisa yuz berganda ota-onaga Telegram xabari.
//
// NEGA BU ENG QIMMATLI QISM: baho ko'rsatishni har qanday CRM
// qiladi. O'zbekistonda haqiqiy farq shundaki — ota-onaning
// telefonida Telegram bor va u xabarni DARHOL o'qiydi.
// modme'da ota-ona ilovani ochishi kerak; bu yerda xabar o'zi
// keladi. SMS puli ham to'lanmaydi.
//
// ⚠️ HECH QACHON SO'ROVNI KUTDIRMAYDI. Ustoz davomatni belgilab
//    "Saqlash" bosganda, javob 30 ta Telegram xabari yuborilishini
//    kutib turmasligi kerak. Shuning uchun barcha funksiyalar
//    fon rejimida ishlaydi va xatolarni o'zi yutadi — xabar
//    ketmagani davomatning saqlanishiga to'sqinlik qilmasin.
//
// ⚠️ FAQAT ISBOTLANGAN bog'lanishlarga yuboriladi (`phone`/`code`).
//    Eski `legacy` yozuvlar baho/davomat ko'ra olmaydi, demak
//    ular haqida xabar ham olmasligi kerak — aks holda ruxsat
//    tekshiruvini xabar orqali aylanib o'tgan bo'lardik.
// ════════════════════════════════════════════════════════════

const Student = require("../models/Student");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const StudentLink = require("../models/StudentLink");
const { sendMessage } = require("./telegramService");
const { hasFeature } = require("../utils/planHelper");
const { canSee } = require("../utils/tmaAccess");

/** Markazda Telegram xabarnomasi yoqilganmi (tarifga qarab) */
async function telegramAllowed(directorId) {
  const t = await Teacher.findById(directorId).select(
    "plan planExpiresAt institutionType",
  );
  if (!t) return false;
  return hasFeature(t, "telegram");
}

/**
 * Berilgan o'quvchilar uchun xabar oluvchilar.
 * ⚠️ `legacy` chiqarib tashlanadi — yuqoridagi izohga qarang.
 */
async function verifiedTargets(studentIds, section) {
  const links = await StudentLink.find({
    student: { $in: studentIds },
    isActive: true,
  })
    .select("student telegramChatId telegramUserId verifiedVia kind")
    .lean();

  return links
    .filter((l) => canSee(l, section))
    .map((l) => ({
      chatId: String(l.telegramChatId || l.telegramUserId),
      studentId: String(l.student),
      // ⚠️ O'quvchining O'ZI ham ulangan bo'lishi mumkin. Unga
      //    "farzandingiz kelmadi" deb yozish g'alati — xabar
      //    kimga borayotganiga qarab yoziladi.
      kind: l.kind || "parent",
    }))
    .filter((t) => t.chatId);
}

/** Ism va guruh nomlarini bir so'rovda olish */
async function labels(studentIds) {
  const students = await Student.find({ _id: { $in: studentIds } })
    .select("name class")
    .lean();
  const classes = await Class.find({
    _id: { $in: students.map((s) => s.class).filter(Boolean) },
  })
    .select("name")
    .lean();

  const className = new Map(classes.map((c) => [String(c._id), c.name]));
  return new Map(
    students.map((s) => [
      String(s._id),
      { name: s.name, className: className.get(String(s.class)) || "" },
    ]),
  );
}

const fmtDate = (d) => {
  const [y, m, day] = String(d).split("-");
  const M = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
  return `${Number(day)} ${M[Number(m) - 1] || ""} ${y}`;
};

// ── Davomat ─────────────────────────────────────────────────
const ABSENCE_TEXT = {
  absent: ["❗️", "darsga kelmadi"],
  late: ["⏰", "darsga kechikdi"],
  excused: ["📄", "sababli kelmadi"],
};

/**
 * Xabar berishga arziydigan o'zgarishlar.
 *
 * ⚠️ "Keldi" haqida xabar YUBORILMAYDI. Har kuni "farzandingiz
 *    darsga keldi" degan xabar — shovqin. Ota-ona uni bir hafta
 *    o'qiydi, keyin botni o'chirib qo'yadi va rostdan muhim
 *    xabarni ham ko'rmay qoladi.
 */
const notableChanges = (changes) =>
  (changes || []).filter((c) => c && ABSENCE_TEXT[c.status]);

/**
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} p.date        "YYYY-MM-DD"
 * @param {Array}  p.changes     [{ studentId, status }] — FAQAT o'zgarganlar
 */
async function notifyAttendance({ directorId, date, changes }) {
  const notable = notableChanges(changes);
  if (!notable.length) return;
  if (!(await telegramAllowed(directorId))) return;

  const ids = notable.map((c) => c.studentId);
  const targets = await verifiedTargets(ids, "attendance");
  if (!targets.length) return;

  const info = await labels(ids);
  const statusOf = new Map(notable.map((c) => [String(c.studentId), c.status]));

  for (const t of targets) {
    const s = info.get(t.studentId);
    const st = statusOf.get(t.studentId);
    if (!s || !st) continue;

    const [icon, text] = ABSENCE_TEXT[st];
    // ⚠️ O'quvchining O'ZI ulangan bo'lishi mumkin — unga
    //    "farzandingiz kelmadi" deyish g'alati chiqardi
    const who =
      t.kind === "student" ? `Siz (*${s.name}*)` : `Farzandingiz *${s.name}*`;

    await sendMessage(
      t.chatId,
      `${icon} *Davomat*\n\n` +
        `${who} ${fmtDate(date)} kuni ${text}.\n` +
        (s.className ? `🏫 Guruh: ${s.className}\n` : "") +
        `\n_Batafsil ma'lumot ilovada._`,
    );
  }
}

// ── Baholar ─────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} p.subject
 * @param {Array}  p.entries  [{ studentId, score, maxScore }]
 */
async function notifyGrades({ directorId, subject, entries }) {
  if (!entries?.length) return;
  if (!(await telegramAllowed(directorId))) return;

  const ids = entries.map((e) => e.studentId);
  const targets = await verifiedTargets(ids, "grades");
  if (!targets.length) return;

  const info = await labels(ids);
  const gradeOf = new Map(entries.map((e) => [String(e.studentId), e]));

  for (const t of targets) {
    const s = info.get(t.studentId);
    const g = gradeOf.get(t.studentId);
    if (!s || !g) continue;

    const max = g.maxScore || 100;
    const pct = Math.round((g.score / max) * 100);
    const icon = pct >= 80 ? "🟢" : pct >= 60 ? "🟡" : "🔴";

    await sendMessage(
      t.chatId,
      `${icon} *Yangi baho*\n\n` +
        `👤 *${s.name}*\n` +
        `📚 ${subject || "Fan"}: *${g.score}/${max}*\n` +
        (s.className ? `🏫 Guruh: ${s.className}\n` : "") +
        `\n_Barcha baholarni ilovada ko'rishingiz mumkin._`,
    );
  }
}

// ── Mashg'ulotga yozilish ───────────────────────────────────
const BOOKING_TEXT = {
  confirmed: ["✅", "tasdiqlandi"],
  cancelled: ["❌", "bekor qilindi"],
};

/**
 * @param {object} p  { directorId, bookingId, status }
 */
async function notifyBooking({ directorId, bookingId, status }) {
  const text = BOOKING_TEXT[status];
  if (!text) return;
  if (!(await telegramAllowed(directorId))) return;

  const SupportBooking = require("../models/SupportBooking");
  const booking = await SupportBooking.findById(bookingId)
    .populate("teacher", "name")
    .lean();
  if (!booking) return;

  const targets = await verifiedTargets([booking.student], "booking");
  if (!targets.length) return;

  const info = await labels([booking.student]);
  const [icon, word] = text;

  for (const t of targets) {
    const s = info.get(t.studentId);
    if (!s) continue;

    await sendMessage(
      t.chatId,
      `${icon} *Qo'shimcha mashg'ulot ${word}*\n\n` +
        `👤 *${s.name}*\n` +
        `📅 ${fmtDate(booking.date)}, *${booking.startTime}–${booking.endTime}*\n` +
        (booking.teacher?.name ? `👨‍🏫 Ustoz: ${booking.teacher.name}\n` : "") +
        (booking.topic ? `📝 Mavzu: ${booking.topic}\n` : "") +
        (booking.note ? `\n💬 ${booking.note}` : ""),
    );
  }
}

/**
 * Kelmadi — jazo bilan birga.
 * @param {object} p  { directorId, bookingId, blockDays }
 */
async function notifyNoShow({ directorId, bookingId, blockDays }) {
  if (!(await telegramAllowed(directorId))) return;

  const SupportBooking = require("../models/SupportBooking");
  const booking = await SupportBooking.findById(bookingId).lean();
  if (!booking) return;

  const targets = await verifiedTargets([booking.student], "booking");
  if (!targets.length) return;

  const info = await labels([booking.student]);

  for (const t of targets) {
    const s = info.get(t.studentId);
    if (!s) continue;

    await sendMessage(
      t.chatId,
      `🚫 *Mashg'ulotga kelmadingiz*\n\n` +
        `👤 *${s.name}*\n` +
        `📅 ${fmtDate(booking.date)}, ${booking.startTime}–${booking.endTime}\n\n` +
        `Kelganingizni tasdiqlash uchun ustozning QR kodini ` +
        `skanerlash kerak edi.\n\n` +
        `⏳ Endi *${blockDays} kun* davomida qo'shimcha mashg'ulotga ` +
        `yozila olmaysiz.`,
    );
  }
}

// ── To'lov so'rovi ──────────────────────────────────────────
/**
 * Xodim "to'ladim" so'rovini ko'rib chiqdi.
 *
 * ⚠️ Rad etilganda SABAB yuboriladi. Sababsiz "rad etildi"
 *    xabari ota-onani markazga qo'ng'iroq qilishga majburlaydi —
 *    ya'ni butun xususiyat hal qilmoqchi bo'lgan narsa qaytib
 *    keladi.
 *
 * @param {object} p  { directorId, claimId, decision }
 */
async function notifyPaymentClaim({ directorId, claimId, decision }) {
  if (!(await telegramAllowed(directorId))) return;

  const PaymentClaim = require("../models/PaymentClaim");
  const claim = await PaymentClaim.findById(claimId).lean();
  if (!claim) return;

  const targets = await verifiedTargets([claim.student], "payments");
  if (!targets.length) return;

  const info = await labels([claim.student]);
  const M = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
  const period = `${M[claim.month - 1] || claim.month} ${claim.year}`;
  const sum = new Intl.NumberFormat("uz-UZ").format(claim.amount || 0);

  for (const t of targets) {
    const s = info.get(t.studentId);
    if (!s) continue;

    const text =
      decision === "confirmed"
        ? `✅ *To'lov tasdiqlandi*\n\n` +
          `👤 *${s.name}*\n` +
          `📅 ${period}\n` +
          `💳 ${sum} so'm\n\n` +
          `Rahmat! Qarz yopildi.`
        : `❌ *To'lov tasdiqlanmadi*\n\n` +
          `👤 *${s.name}*\n` +
          `📅 ${period}\n\n` +
          (claim.reviewNote
            ? `💬 ${claim.reviewNote}`
            : `Markazga murojaat qiling.`);

    await sendMessage(t.chatId, text);
  }
}

// ── Dars bo'lmaydi / ko'chirildi ─────────────────────────────
//
// ⚠️ BU XABAR ENG KUTILGANI. Bayram yoki kasal ustoz sababli
//    dars bo'lmasa, ota-ona buni ERTALAB bilishi kerak — aks
//    holda u bolasini olib keladi va eshik yopiq bo'ladi.
//    Ilgari administrator yigirmata odamga qo'lda qo'ng'iroq
//    qilardi va yarmiga yetib bormasdi.
//
// ⚠️ BITTA GURUHGA BITTA XABAR. Bayram uch kun bo'lsa, uchta
//    alohida xabar yuborish — shovqin ("keldi" xabari bilan
//    bir xil xato). Kunlar bitta xabarda ro'yxat bo'lib ketadi.

const REASON_TEXT = {
  holiday: "bayram",
  teacher: "ustoz sababli",
  room: "xona sababli",
};

/**
 * Xabar matni — SOF funksiya, `test/scheduleException.test.js`
 * uni qulflaydi.
 *
 * @param {object} p
 * @param {string} p.className
 * @param {string[]} p.cancelled  ["2026-03-21", ...]
 * @param {Array}  p.moved        [{ date, newDate, newStartTime }]
 * @param {string} [p.reason]
 * @param {string} [p.note]
 */
function buildLessonMessage({ className, cancelled = [], moved = [], reason, note }) {
  const lines = [`📅 *Dars o'zgarishi*`, ``];
  if (className) lines.push(`🏫 Guruh: *${className}*`, ``);

  for (const d of cancelled) {
    lines.push(`❌ ${fmtDate(d)} — dars bo'lmaydi`);
  }
  for (const m of moved) {
    lines.push(
      `🔄 ${fmtDate(m.date)} kungi dars ${fmtDate(m.newDate)}` +
        (m.newStartTime ? `, ${m.newStartTime}` : "") +
        ` ga ko'chirildi`,
    );
  }

  const why = REASON_TEXT[reason];
  if (why) lines.push(``, `Sabab: ${why}`);
  if (note) lines.push(``, `💬 ${note}`);

  return lines.join("\n");
}

/**
 * @param {object} p
 * @param {string} p.directorId
 * @param {Array}  p.exceptionIds
 */
async function notifyLessonChange({ directorId, exceptionIds }) {
  if (!exceptionIds?.length) return;
  if (!(await telegramAllowed(directorId))) return;

  const ScheduleException = require("../models/ScheduleException");
  const { getGroupStudents } = require("../utils/enrollment");

  // ⚠️ `notifiedAt: null` — takror xabar yubormaslikning yagona
  //    kafolati. Bayram ikki marta belgilansa (birinchisi qisman
  //    o'tgan bo'lishi mumkin), ota-ona bir xil xabarni ikki
  //    marta olmasin.
  const rows = await ScheduleException.find({
    _id: { $in: exceptionIds },
    director: directorId,
    notifiedAt: null,
  }).lean();
  if (!rows.length) return;

  const byClass = new Map();
  for (const e of rows) {
    const k = String(e.class);
    if (!byClass.has(k)) byClass.set(k, []);
    byClass.get(k).push(e);
  }

  const classDocs = await Class.find({ _id: { $in: [...byClass.keys()] } })
    .select("name")
    .lean();
  const classNames = new Map(classDocs.map((c) => [String(c._id), c.name]));

  for (const [classId, items] of byClass) {
    const students = await getGroupStudents(classId);
    const ids = students.map((s) => s._id);
    if (!ids.length) continue;

    const targets = await verifiedTargets(ids, "schedule");
    if (!targets.length) continue;

    const text = buildLessonMessage({
      className: classNames.get(classId) || "",
      cancelled: items.filter((e) => e.type !== "moved").map((e) => e.date),
      moved: items.filter((e) => e.type === "moved"),
      reason: items[0].reason,
      note: items[0].note,
    });

    for (const t of targets) {
      await sendMessage(t.chatId, text);
    }

    await ScheduleException.updateMany(
      { _id: { $in: items.map((i) => i._id) } },
      { $set: { notifiedAt: new Date() }, $inc: { notifiedCount: targets.length } },
    );
  }
}

/**
 * Fon rejimida chaqirish uchun o'ram.
 *
 * ⚠️ Xato yuzaga chiqmaydi va so'rovni yiqitmaydi: xabar ketmagani
 *    davomatning saqlanishiga to'sqinlik qilmasligi kerak.
 */
function inBackground(fn, args) {
  Promise.resolve()
    .then(() => fn(args))
    .catch((err) => console.error("[notify]", fn.name, err.message));
}

module.exports = {
  notifyAttendance,
  notifyGrades,
  notifyBooking,
  notifyNoShow,
  notifyPaymentClaim,
  notifyLessonChange,
  buildLessonMessage,
  inBackground,
  notableChanges,
  // test uchun
  verifiedTargets,
};
