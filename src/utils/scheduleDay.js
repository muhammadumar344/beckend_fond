// src/utils/scheduleDay.js
// ════════════════════════════════════════════════════════════
// BIR KUNDAGI HAQIQIY DARSLAR.
//
// `Schedule` haftalik takrorlanuvchi yozuv, `ScheduleException`
// esa bitta kunga tegishli o'zgarish. Ikkalasini birlashtirmasa
// hech bir ekran to'g'ri javob bera olmaydi:
//
//     haftalik jadval  −  bekor qilinganlar  +  ko'chib kelganlar
//     ────────────────────────────────────────────────────────
//                  = o'sha kuni haqiqatan bo'ladigan darslar
//
// ⚠️ BU FAYL SOF: bazaga ham, vaqtga ham tegmaydi. Hamma
//    ma'lumot parametr bo'lib kiradi. Sabab — aynan shu hisob
//    davomat, maosh, bo'sh vaqt va ota-onaga ketadigan xabarni
//    boshqaradi; uni test bilan qulflab qo'yish kerak
//    (`test/scheduleException.test.js`).
//
// ⚠️ HAFTA KUNI BU YERDA HISOBLANMAYDI — `dayOfWeek` parametr
//    bo'lib keladi. Loyihada 0 = Dushanba, JS `getDay()` da
//    0 = Yakshanba va o'girish FAQAT `utils/supportSlots.js`
//    dagi `projectDayOfWeek()` da. Ikkinchi nusxa yozilsa,
//    bir kun surilib ketgan xatoni topib bo'lmaydi.
// ════════════════════════════════════════════════════════════

const { timesOverlap } = require("./teacherAvailability");
// ⚠️ Sana arifmetikasi qayta yozilmaydi — `supportWindow.js` da
//    allaqachon bor va u UTC da hisoblaydi (mahalliy mintaqa
//    kunni surib yubormasligi uchun).
const { addDays } = require("./supportWindow");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sana "YYYY-MM-DD" ko'rinishidami */
const isDate = (s) => DATE_RE.test(String(s || ""));

/**
 * Ikki sana orasidagi kunlar ro'yxati (ikkalasi ham kiradi).
 *
 * ⚠️ `max` — himoya chegarasi. Bayram oralig'iga adashib
 *    "2026-01-01 → 2030-01-01" yozilsa, tizim minglab istisno
 *    yozuvini yaratib qo'yardi.
 */
function dateList(from, to, max = 62) {
  if (!isDate(from) || !isDate(to) || to < from) return [];
  const out = [];
  let cur = from;
  while (cur <= to && out.length < max) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Istisnolarni `schedule + date` kaliti bo'yicha xaritaga soladi */
function exceptionMap(exceptions) {
  const m = new Map();
  for (const e of exceptions || []) {
    m.set(`${String(e.schedule)}|${e.date}`, e);
  }
  return m;
}

/**
 * Bir kundagi haqiqiy darslar.
 *
 * @param {object} p
 * @param {Array}  p.lessons     `Schedule` yozuvlari (istalgan kun)
 * @param {Array}  p.exceptions  `ScheduleException` yozuvlari
 * @param {string} p.date        "YYYY-MM-DD"
 * @param {number} p.dayOfWeek   0 = Dushanba (yuqoridagi izohga qarang)
 * @returns {{ lessons: Array, cancelled: Array, movedIn: Array }}
 *
 * Qaytgan darsda vaqt va xona ALLAQACHON istisno bilan
 * almashtirilgan — chaqiruvchi qayta hisoblamasin.
 */
function applyExceptions({ lessons, exceptions, date, dayOfWeek }) {
  const byKey = exceptionMap(exceptions);
  const byId = new Map((lessons || []).map((l) => [String(l._id), l]));

  const out = [];
  const cancelled = [];

  for (const l of lessons || []) {
    if (l.dayOfWeek !== dayOfWeek) continue;
    const ex = byKey.get(`${String(l._id)}|${date}`);

    if (!ex) {
      out.push({ ...l, exception: null, movedFrom: null });
      continue;
    }
    // Ko'chirilgan dars o'z kunida BO'LMAYDI — u `newDate` da
    // chiqadi (pastdagi halqa). Bekor qilingani ham chiqmaydi.
    cancelled.push({ ...l, exception: ex });
  }

  // ── Boshqa kundan KO'CHIB KELGANLAR ──────────────────────
  // ⚠️ Bu qism bo'lmasa, ko'chirilgan dars hech qayerda
  //    ko'rinmaydi: eski kunidan chiqib ketadi, yangisida esa
  //    paydo bo'lmaydi. Ustoz "bugun darsim yo'q" deb o'ylaydi.
  const movedIn = [];
  for (const e of exceptions || []) {
    if (e.type !== "moved" || e.newDate !== date) continue;
    const l = byId.get(String(e.schedule));
    if (!l) continue; // dars o'chirilgan — istisno ham ma'nosiz
    movedIn.push({
      ...l,
      startTime: e.newStartTime || l.startTime,
      endTime: e.newEndTime || l.endTime,
      roomRef: e.newRoomRef ?? l.roomRef,
      room: e.newRoom || l.room,
      exception: e,
      movedFrom: e.date,
    });
  }

  out.push(...movedIn);
  out.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  return { lessons: out, cancelled, movedIn };
}

/**
 * Berilgan vaqt oralig'i bilan kesishadigan darslar.
 *
 * @param {object}   p
 * @param {Array}    p.lessons   `applyExceptions` qaytargan ro'yxat
 * @param {string}   p.startTime "18:00"
 * @param {string}   p.endTime   "19:30"
 * @param {Function} [p.match]   qo'shimcha shart (ustoz / xona)
 * @param {Function} [p.skip]    hisobga olinmaydigan dars (o'zi)
 *
 * ⚠️ Kesishish YANGIDAN YOZILMAYDI — `timesOverlap` allaqachon
 *    bor va `test/schedule.test.js` da sinalgan (jumladan
 *    ketma-ket darslar ziddiyat EMASligi).
 */
function overlapping({ lessons, startTime, endTime, match, skip }) {
  return (lessons || []).filter(
    (l) =>
      (!skip || !skip(l)) &&
      (!match || match(l)) &&
      timesOverlap(startTime, endTime, l.startTime, l.endTime),
  );
}

module.exports = {
  isDate,
  addDays,
  dateList,
  exceptionMap,
  applyExceptions,
  overlapping,
};
