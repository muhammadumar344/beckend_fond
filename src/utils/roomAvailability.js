// src/utils/roomAvailability.js
// ════════════════════════════════════════════════════════════
// Xona bandligi. `teacherAvailability.js` bilan bir xil naqsh —
// faqat u ODAMni, bu XONAni tekshiradi.
//
// ⚠️ ESKI JADVALLAR MATN XONA BILAN YOZILGAN. Bazada allaqachon
//    `room: "205"` ko'rinishidagi yuzlab yozuv bor va ularda
//    `roomRef` yo'q. Agar faqat `roomRef` bo'yicha solishtirsak,
//    yangi xona bilan yozilgan dars eski matn darsning ustiga
//    tushib ketardi va tekshiruv "bo'sh" derdi — ya'ni funksiya
//    aynan o'zi hal qilishi kerak bo'lgan muammoni yaratardi.
//
//    Shuning uchun har bir dars uchun BITTA KALIT hisoblanadi:
//    `roomRef` bo'lsa — uning id'si, bo'lmasa — nomning
//    soddalashtirilgan shakli. Ikkalasi bir xil kalit bersa,
//    ular bitta xona.
//
//    Bu to'liq emas: "205" va "205-xona" har xil kalit beradi.
//    Shuning uchun `POST /lc/rooms/import` bor — eski matnlarni
//    bir marta haqiqiy xonaga aylantirib, noaniqlikni butunlay
//    yopadi.
// ════════════════════════════════════════════════════════════

const Schedule = require("../models/Schedule");
const Class = require("../models/Class");
const Room = require("../models/Room");

const DAY_NAMES = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

// "HH:MM" zero-padded bo'lgani uchun matn solishtiruvi to'g'ri
// ishlaydi (teacherAvailability.js dagi bilan bir xil qoida).
const timesOverlap = (start1, end1, start2, end2) =>
  start1 < end2 && start2 < end1;

/**
 * Xona nomini solishtirish uchun soddalashtiradi: registr, ortiqcha
 * bo'shliq va tire farqi bitta xonani ikkitaga bo'lib yubormasin.
 * "Lab - 1", "lab-1", "LAB 1" → "lab1"
 */
function normaliseRoomName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[\s\-_.]+/g, "")
    .trim();
}

/**
 * Dars qaysi xonani egallaganini bitta kalit bilan bildiradi.
 * Xonasiz dars `null` beradi — u hech kimga xalaqit qilmaydi.
 */
function roomKeyOf({ roomRef, room }) {
  if (roomRef) return `id:${String(roomRef)}`;
  const n = normaliseRoomName(room);
  return n ? `name:${n}` : null;
}

/**
 * ⚠️ SOF FUNKSIYA — bazaga tegmaydi, test shuni tekshiradi.
 *
 * @param {Array} schedules  shu kundagi darslar
 * @param {string} wantedKey roomKeyOf() natijasi
 * @param {string} startTime "18:00"
 * @param {string} endTime   "19:30"
 * @param {string} [excludeScheduleId] tahrirlanayotgan darsning o'zi
 */
function pickRoomConflicts(schedules, wantedKey, startTime, endTime, excludeScheduleId) {
  if (!wantedKey) return [];
  return schedules
    .filter((s) => !excludeScheduleId || String(s._id) !== String(excludeScheduleId))
    .filter((s) => roomKeyOf(s) === wantedKey)
    .filter((s) => timesOverlap(startTime, endTime, s.startTime, s.endTime));
}

/**
 * Direktorning tanlangan kunlardagi barcha faol darslari.
 *
 * ⚠️ Avval sinf id'lari olinadi, keyin darslar. `Schedule` da
 *    direktor maydoni yo'q (`teacher` — bu Staff), shuning uchun
 *    kun bo'yicha to'g'ridan-to'g'ri qidirsak boshqa markazlarning
 *    darslari ham kelardi va ularni JS'da filtrlashga to'g'ri
 *    kelardi — ya'ni baza o'sgani sayin so'rov sekinlashardi.
 */
async function loadDaySchedules(directorId, daysOfWeek) {
  const classIds = await Class.find({ teacher: directorId }).distinct("_id");
  if (!classIds.length) return [];

  return Schedule.find({
    class: { $in: classIds },
    dayOfWeek: { $in: daysOfWeek },
    isActive: { $ne: false },
  })
    .populate("class", "name")
    .lean();
}

function describeConflict(s) {
  return {
    day: DAY_NAMES[s.dayOfWeek] || s.dayOfWeek,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    groupId: s.class?._id || null,
    groupName: s.class?.name || "",
    scheduleId: s._id,
  };
}

/**
 * Xona tanlangan kun(lar) va vaqtda band emasligini tekshiradi.
 *
 * @returns {Promise<Array>} bo'sh massiv = xona bo'sh
 */
async function findRoomConflicts({
  directorId,
  roomId = null,
  roomName = "",
  daysOfWeek,
  startTime,
  endTime,
  excludeScheduleId = null,
}) {
  const wantedKey = roomKeyOf({ roomRef: roomId, room: roomName });
  if (!wantedKey || !daysOfWeek?.length || !startTime || !endTime) return [];

  const schedules = await loadDaySchedules(directorId, daysOfWeek);

  return pickRoomConflicts(
    schedules,
    wantedKey,
    startTime,
    endTime,
    excludeScheduleId,
  ).map(describeConflict);
}

/**
 * Berilgan vaqtda har bir xona bo'shmi yoki bandmi.
 *
 * ⚠️ BAND XONALARNI RO'YXATDAN OLIB TASHLAMAYDI. Administrator
 *    "205 yo'q" degan xulosa chiqarmasligi kerak — u "205 band,
 *    Ingliz A2 o'tirgan" ni ko'rsin. Aks holda u xonani qidirib
 *    yurgan payt sababini bilmaydi va boshqa xonaga o'tkazish
 *    o'rniga direktorni bezovta qiladi.
 */
async function roomsAvailability({
  directorId,
  rooms,
  dayOfWeek,
  startTime,
  endTime,
  excludeScheduleId = null,
}) {
  const schedules = await loadDaySchedules(directorId, [dayOfWeek]);

  return rooms.map((r) => {
    const busy = pickRoomConflicts(
      schedules,
      roomKeyOf({ roomRef: r._id }),
      startTime,
      endTime,
      excludeScheduleId,
    ).map(describeConflict);

    return { ...r, busy: busy.length > 0, busyWith: busy };
  });
}

/**
 * Tanlangan xonani tekshiradi va nom nusxasini qaytaradi.
 *
 * ⚠️ BU TEKSHIRUV BITTA JOYDA TURISHI SHART. Ichida filial
 *    cheklovi bor: xodim boshqa filialning xonasiga dars qo'ya
 *    olmaydi. Ikkinchi nusxa yozilsa, nusxalar sekin-asta
 *    ajralib ketadi va tekshiruvning yo'qolgani faqat begona
 *    filialda dars paydo bo'lganda bilinardi.
 *
 * `roomId` berilmasa eski xatti-harakat saqlanadi: erkin matn.
 *
 * @returns {Promise<{roomRef, room, doc}>}
 */
async function resolveRoomChoice(ctx, roomId, roomText) {
  if (!roomId) return { roomRef: null, room: (roomText || "").trim(), doc: null };

  const doc = await Room.findOne({
    _id: roomId,
    director: ctx.directorId,
    isActive: true,
  });
  if (!doc) {
    const err = new Error("Xona topilmadi");
    err.status = 404;
    throw err;
  }
  // Filialsiz xona (markazning umumiy xonasi) hammaga ochiq.
  if (ctx.branchFilter && doc.branch && String(doc.branch) !== ctx.branchFilter) {
    const err = new Error("Bu xona sizning filialingizga tegishli emas");
    err.status = 403;
    throw err;
  }
  return { roomRef: doc._id, room: doc.name, doc };
}

module.exports = {
  findRoomConflicts,
  roomsAvailability,
  loadDaySchedules,
  pickRoomConflicts,
  resolveRoomChoice,
  roomKeyOf,
  normaliseRoomName,
  timesOverlap,
  DAY_NAMES,
};
