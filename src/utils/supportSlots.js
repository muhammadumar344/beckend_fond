// src/utils/supportSlots.js
// ════════════════════════════════════════════════════════════
// Bo'sh vaqtlarni HISOBLASH.
//
// Bo'sh vaqtlar bazada saqlanmaydi — har safar hisoblanadi:
//
//     markaz ish vaqti (Teacher.supportHours)
//   − dars jadvali     (Schedule)          ← ustoz o'sha payt darsda
//   − band vaqtlar     (SupportBooking)    ← boshqa o'quvchi yozilgan
//   − o'tgan vaqt                          ← bugungi kun uchun
//   ─────────────────────────────────
//   = bo'sh vaqtlar
//
// ⚠️ ILGARI BIRINCHI QATOR "USTOZNING QABUL VAQTI" (SupportSlot)
//    EDI VA BU NOTO'G'RI MODEL EDI. Support ustozi — shu ish
//    uchun alohida olingan odam. U qachon qabul qilishini
//    tanlamaydi: ish vaqti davomida qabul HAR DOIM ochiq.
//    Eski modelda esa ustoz hech narsa qilmasdan o'zini
//    ro'yxatdan yashirib qo'ya olardi — qabul vaqti
//    belgilamasa, o'quvchi uni ko'rmasdi.
//
// ⚠️ Kesishishni aniqlash YANGIDAN YOZILMAYDI. `timesOverlap`
//    allaqachon bor va `test/schedule.test.js` da yettita holat
//    bo'yicha sinalgan — jumladan eng nozigi: ketma-ket darslar
//    (18:00–19:00 va 19:00–20:00) ziddiyat DEB HISOBLANMAYDI.
//
// ⚠️ HAFTA KUNI IKKI XIL SANALADI:
//      loyihada  0 = Dushanba … 6 = Yakshanba
//      JS da     0 = Yakshanba … 6 = Shanba
//    Aralashtirsak bo'sh vaqtlar bir kun surilib ketardi va
//    buni sezish juda qiyin bo'lardi. O'girish faqat shu yerda.
// ════════════════════════════════════════════════════════════

const Schedule = require("../models/Schedule");
const ScheduleException = require("../models/ScheduleException");
const SupportBooking = require("../models/SupportBooking");
const Teacher = require("../models/Teacher");
const { timesOverlap } = require("./teacherAvailability");
const { applyExceptions } = require("./scheduleDay");

/** "HH:MM" → kun boshidan beri daqiqalar */
const toMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

/** daqiqalar → "HH:MM" */
const toTime = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/**
 * "YYYY-MM-DD" → loyiha hafta kuni (0 = Dushanba).
 * ⚠️ Yuqoridagi izohga qarang.
 */
function projectDayOfWeek(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  // UTC — mahalliy vaqt mintaqasi kunni surib yubormasin
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Yakshanba
  return (js + 6) % 7; // 0 = Dushanba
}

/** Sana bugungimi (Toshkent vaqti bo'yicha) */
function isToday(dateStr) {
  const now = new Date();
  // Toshkent UTC+5, yil davomida o'zgarmaydi
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkent.toISOString().slice(0, 10) === dateStr;
}

/** Hozirgi vaqt daqiqalarda (Toshkent) */
function nowMinutes() {
  const t = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

// O'tgan vaqtga yozilmasin, lekin "10 daqiqadan keyin" ham
// mantiqsiz — tayyorlanish uchun oz bo'lsa-da vaqt kerak.
//
// ⚠️ O'quvchi baribir bugunga yozila olmaydi (utils/supportWindow.js).
//    Bu chegara xodim CRM'dan bugunga yozayotgan holat uchun.
const MIN_LEAD_MINUTES = 60;

// Markaz sozlamasi yo'q bo'lsa ishlatiladigan qiymatlar.
// ⚠️ Modeldagi `default` bilan BIR XIL bo'lishi shart: eski
//    hujjatlarda `supportHours` umuman bo'lmasligi mumkin va
//    Mongoose ularga standart qiymatni O'QISHDA qo'shmaydi.
const FALLBACK_HOURS = {
  start: "09:00",
  end: "18:00",
  days: [0, 1, 2, 3, 4, 5],
  slotMinutes: 30,
};

/** Markazning support ish vaqti (bo'sh maydonlar to'ldirilgan) */
function normalizeHours(raw) {
  const h = raw || {};
  return {
    start: h.start || FALLBACK_HOURS.start,
    end: h.end || FALLBACK_HOURS.end,
    days: Array.isArray(h.days) && h.days.length ? h.days : FALLBACK_HOURS.days,
    slotMinutes: h.slotMinutes || FALLBACK_HOURS.slotMinutes,
  };
}

/**
 * Berilgan ustoz va kun uchun bo'sh vaqtlar.
 *
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} p.teacherId   Staff._id
 * @param {string} p.date        "YYYY-MM-DD"
 * @param {object} [p.hours]     Tayyor sozlama (bir necha marta
 *                               chaqirilganda qayta so'ramaslik uchun)
 * @returns {Promise<Array<{startTime, endTime}>>}
 */
async function freeSlots({ directorId, teacherId, date, hours }) {
  if (!teacherId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return [];

  let cfg = hours;
  if (!cfg) {
    const director = await Teacher.findById(directorId)
      .select("supportHours")
      .lean();
    cfg = director?.supportHours;
  }
  const h = normalizeHours(cfg);

  const dow = projectDayOfWeek(date);
  // ⚠️ Dam olish kuni — markaz yopiq, hech qanday vaqt yo'q
  if (!h.days.includes(dow)) return [];

  // ⚠️ ISTISNOLAR SHU YERDA HAM HISOBGA OLINADI. Ustozning
  //    o'sha kungi darsi bekor qilingan bo'lsa, u vaqt BO'SH —
  //    qo'shimcha mashg'ulotga aynan o'sha payt yozilishi
  //    mumkin. Aksincha, boshqa kundan ko'chirilgan dars uni
  //    band qiladi. Faqat haftalik jadvalga qarasak, ikkala
  //    holatda ham yolg'on javob berardik.
  const exceptions = await ScheduleException.find({
    director: directorId,
    $or: [{ date }, { newDate: date }],
  })
    .select("schedule date type newDate newStartTime newEndTime")
    .lean();
  const movedInIds = exceptions
    .filter((e) => e.type === "moved" && e.newDate === date)
    .map((e) => e.schedule);

  const [raw, booked] = await Promise.all([
    // Ustozning o'sha kundagi darslari.
    // ⚠️ Support ustozi odatda dars o'tmaydi, lekin kichik
    //    markazda bitta odam ikkala ishni ham qilishi mumkin —
    //    o'sha paytga yozib qo'ymaylik.
    Schedule.find({
      teacher: teacherId,
      isActive: { $ne: false },
      $or: [
        { dayOfWeek: dow },
        ...(movedInIds.length ? [{ _id: { $in: movedInIds } }] : []),
      ],
    })
      .select("startTime endTime dayOfWeek")
      .lean(),
    SupportBooking.find({
      teacher: teacherId,
      date,
      status: { $in: ["pending", "confirmed", "done"] },
    })
      .select("startTime endTime")
      .lean(),
  ]);

  const { lessons } = applyExceptions({
    lessons: raw,
    exceptions,
    date,
    dayOfWeek: dow,
  });

  const today = isToday(date);
  const earliest = today ? nowMinutes() + MIN_LEAD_MINUTES : -1;

  const step = h.slotMinutes;
  const from = toMin(h.start);
  const to = toMin(h.end);

  const out = [];
  for (let s = from; s + step <= to; s += step) {
    const startTime = toTime(s);
    const endTime = toTime(s + step);

    if (today && s < earliest) continue;

    const clash =
      lessons.some((l) => timesOverlap(startTime, endTime, l.startTime, l.endTime)) ||
      booked.some((b) => timesOverlap(startTime, endTime, b.startTime, b.endTime));

    if (!clash) out.push({ startTime, endTime });
  }

  return out;
}

/**
 * Tanlangan vaqt rostdan bo'shmi.
 * ⚠️ Yozishdan OLDIN qayta tekshiriladi: ro'yxat ko'rsatilgandan
 *    keyin boshqa o'quvchi o'sha vaqtni olgan bo'lishi mumkin.
 */
async function isSlotFree({ directorId, teacherId, date, startTime }) {
  const slots = await freeSlots({ directorId, teacherId, date });
  return slots.find((s) => s.startTime === startTime) || null;
}

module.exports = {
  freeSlots,
  isSlotFree,
  normalizeHours,
  projectDayOfWeek,
  toMin,
  toTime,
  isToday,
  MIN_LEAD_MINUTES,
  FALLBACK_HOURS,
};
