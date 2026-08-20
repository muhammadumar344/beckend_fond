// src/services/scheduleExceptions.js
// ════════════════════════════════════════════════════════════
// Istisnolarni bazadan olib, jadval bilan birlashtiradi.
// Hisobning O'ZI sof modulda (`utils/scheduleDay.js`) — bu yer
// faqat so'rovlar.
//
// ⚠️ KO'CHIB KELGAN DARSNI QIDIRISH TARTIBI MUHIM. Ko'chirilgan
//    darsning `dayOfWeek` i BOSHQA kun bo'ladi (seshanbadan
//    shanbaga ko'chirilgan dars sxemada hamon "seshanba").
//    Shuning uchun avval istisnolar o'qiladi, keyin jadval
//    so'roviga o'sha darslarning id'lari QO'SHILADI. Faqat
//    `dayOfWeek` bo'yicha qidirsak, ko'chirilgan dars yangi
//    kunida hech qachon chiqmasdi.
// ════════════════════════════════════════════════════════════

const Schedule = require("../models/Schedule");
const ScheduleException = require("../models/ScheduleException");
const { projectDayOfWeek } = require("../utils/supportSlots");
const { applyExceptions } = require("../utils/scheduleDay");

/**
 * Berilgan kunga tegishli istisnolar: o'sha kuni bekor
 * qilinganlar VA o'sha kunga ko'chirilganlar.
 */
async function exceptionsOn({ directorId, date }) {
  return ScheduleException.find({
    director: directorId,
    $or: [{ date }, { newDate: date }],
  }).lean();
}

/**
 * Bir kundagi haqiqiy darslar.
 *
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} p.date     "YYYY-MM-DD"
 * @param {object} [p.filter] `Schedule` uchun qo'shimcha filtr
 *   (masalan `{ teacher: { $in: staffIds } }` yoki
 *   `{ class: { $in: classIds } }`).
 *   ⚠️ Ichida `$or` ISHLATMANG — quyida `$or` band.
 * @returns {Promise<{lessons, cancelled, movedIn, exceptions}>}
 */
async function resolveDay({ directorId, date, filter = {} }) {
  const dayOfWeek = projectDayOfWeek(date);
  const exceptions = await exceptionsOn({ directorId, date });

  const movedInIds = exceptions
    .filter((e) => e.type === "moved" && e.newDate === date)
    .map((e) => e.schedule);

  const query = {
    ...filter,
    isActive: { $ne: false },
    $or: [{ dayOfWeek }, ...(movedInIds.length ? [{ _id: { $in: movedInIds } }] : [])],
  };

  const lessons = await Schedule.find(query).lean();
  return {
    ...applyExceptions({ lessons, exceptions, date, dayOfWeek }),
    exceptions,
  };
}

/**
 * Shu kuni bekor qilingan (yoki boshqa kunga ko'chirilgan)
 * darslarning id to'plami. Davomat va xodim davomatida
 * "bu kuni dars yo'q" degan javob shundan chiqadi.
 */
async function skippedScheduleIds({ directorId, date }) {
  const rows = await ScheduleException.find({ director: directorId, date })
    .select("schedule")
    .lean();
  return new Set(rows.map((r) => String(r.schedule)));
}

/**
 * Guruhning shu kundagi darsi bekor qilinganmi.
 *
 * ⚠️ Guruhda bir kunda BITTA dars bo'ladi (`createSchedule`
 *    ikkinchisini qo'ymaydi), shuning uchun bitta yozuv yetarli.
 *    Bu qoida o'zgarsa, bu yerda `schedule` id ham kerak bo'ladi.
 */
async function isClassCancelled({ directorId, classId, date }) {
  const ex = await ScheduleException.findOne({
    director: directorId,
    class: classId,
    date,
  }).lean();
  return ex || null;
}

/** Davr ichidagi barcha istisnolar (ro'yxat ekrani uchun) */
async function listRange({ directorId, from, to, classIds = null }) {
  const q = {
    director: directorId,
    $or: [
      { date: { $gte: from, $lte: to } },
      { newDate: { $gte: from, $lte: to } },
    ],
  };
  if (classIds) q.class = { $in: classIds };
  return ScheduleException.find(q).sort({ date: 1 }).lean();
}

module.exports = {
  exceptionsOn,
  resolveDay,
  skippedScheduleIds,
  isClassCancelled,
  listRange,
};
