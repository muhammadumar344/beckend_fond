// src/utils/supportSlots.js
// ════════════════════════════════════════════════════════════
// Bo'sh vaqtlarni HISOBLASH.
//
// Bo'sh vaqtlar bazada saqlanmaydi — har safar hisoblanadi:
//
//     qabul oynasi  (SupportSlot)
//   − dars jadvali  (Schedule)          ← ustoz o'sha payt darsda
//   − band vaqtlar  (SupportBooking)    ← boshqa o'quvchi yozilgan
//   − o'tgan vaqt                       ← bugungi kun uchun
//   ─────────────────────────────────
//   = bo'sh vaqtlar
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
const SupportSlot = require("../models/SupportSlot");
const SupportBooking = require("../models/SupportBooking");
const { timesOverlap } = require("./teacherAvailability");

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
// mantiqsiz — tayyorlanish uchun oz bo'lsa-da vaqt kerak
const MIN_LEAD_MINUTES = 60;

/**
 * Berilgan ustoz va kun uchun bo'sh vaqtlar.
 *
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} p.teacherId   Staff._id
 * @param {string} p.date        "YYYY-MM-DD"
 * @returns {Promise<Array<{startTime, endTime}>>}
 */
async function freeSlots({ directorId, teacherId, date }) {
  if (!teacherId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return [];

  const dow = projectDayOfWeek(date);

  const [windows, lessons, booked] = await Promise.all([
    SupportSlot.find({
      director: directorId,
      teacher: teacherId,
      dayOfWeek: dow,
      isActive: true,
    }).lean(),
    // Ustozning o'sha kundagi darslari
    Schedule.find({
      teacher: teacherId,
      dayOfWeek: dow,
      isActive: { $ne: false },
    })
      .select("startTime endTime")
      .lean(),
    SupportBooking.find({
      teacher: teacherId,
      date,
      status: { $in: ["pending", "confirmed", "done"] },
    })
      .select("startTime endTime")
      .lean(),
  ]);

  if (!windows.length) return [];

  const today = isToday(date);
  const earliest = today ? nowMinutes() + MIN_LEAD_MINUTES : -1;

  const out = [];

  for (const w of windows) {
    const step = w.slotMinutes || 30;
    const from = toMin(w.startTime);
    const to = toMin(w.endTime);

    for (let s = from; s + step <= to; s += step) {
      const startTime = toTime(s);
      const endTime = toTime(s + step);

      if (today && s < earliest) continue;

      const clash =
        lessons.some((l) => timesOverlap(startTime, endTime, l.startTime, l.endTime)) ||
        booked.some((b) => timesOverlap(startTime, endTime, b.startTime, b.endTime));

      if (!clash) out.push({ startTime, endTime });
    }
  }

  // Bir nechta qabul oynasi bo'lsa vaqt bo'yicha tartiblab beramiz
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
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
  projectDayOfWeek,
  toMin,
  toTime,
  isToday,
  MIN_LEAD_MINUTES,
};
