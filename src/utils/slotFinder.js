// src/utils/slotFinder.js
// ════════════════════════════════════════════════════════════
// "YANGI GURUHNI QACHON OCHSAM BO'LADI?"
//
// Hozirgacha jarayon teskari edi: administrator vaqtni TAXMIN
// qiladi, tizim "ustoz band" yoki "xona band" deydi, u yana
// taxmin qiladi. Ota-ona telefonda kutib turadi va beshinchi
// urinishda "keyin qo'ng'iroq qilaman" deb qo'yiladi — lid
// aynan shu daqiqada sovib ketadi.
//
// Bu yerda yangi ma'lumot yo'q. Uchala cheklov allaqachon
// kodda bor, ular shunchaki HECH QACHON KESISHTIRILMAGAN:
//
//     qidiruv oynasi (administrator beradi: "18:00 dan keyin")
//   − ustoz bandligi   (Schedule.teacher)
//   − xona bandligi    (Schedule.roomRef / room)
//   − xona sig'imi     (Room.capacity)
//   ─────────────────────────────────
//   = bo'sh oynalar
//
// ⚠️ ISH VAQTI `Teacher.supportHours` DAN OLINMAYDI. U —
//    qo'shimcha mashg'ulot qabul vaqti, boshqa narsa. Direktor
//    qabulni 14:00–16:00 qilib qo'ysa, guruh jadvali ham
//    o'shanga qisilib qolardi. Qidiruv oynasini administrator
//    o'zi beradi — u markazning ish vaqtini ham, ota-onaning
//    shartini ham biladi.
//
// ⚠️ BO'SH NATIJA HECH QACHON SHUNCHAKI "HECH NARSA YO'Q"
//    BO'LMAYDI. Hech nima topilmasa `blocked` qaytadi: qaysi
//    oynada nima to'sqinlik qilgani. "Payshanba 18:00 da ustoz
//    bor, xona yo'q" — bu javob, "topilmadi" esa javob emas:
//    administrator undan keyin nima qilishini bilmaydi.
//
// ⚠️ SOF MODUL — bazaga tegmaydi. Shuning uchun `test/slotFinder.test.js`
//    uni to'liq sinay oladi.
// ════════════════════════════════════════════════════════════

const { timesOverlap } = require("./teacherAvailability");
const { roomKeyOf } = require("./roomAvailability");

/** "HH:MM" → kun boshidan beri daqiqalar */
const toMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

/** daqiqalar → "HH:MM" (zero-padded — matn solishtiruvi shunga tayanadi) */
const toTime = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/**
 * Berilgan oynada band bo'lmagan ustozlar.
 * `teacher` — Staff._id, `Schedule.teacher` bilan bir xil.
 */
function freeTeachersAt(teachers, daySchedules, startTime, endTime) {
  const busy = new Set(
    daySchedules
      .filter((s) => timesOverlap(startTime, endTime, s.startTime, s.endTime))
      .map((s) => String(s.teacher)),
  );
  return teachers.filter((t) => !busy.has(String(t._id)));
}

/**
 * Berilgan oynada bo'sh VA sig'imi yetadigan xonalar.
 *
 * ⚠️ Sig'imi yetmaydigan xona ro'yxatdan CHIQARILADI, chunki bu
 *    yerda savol boshqa: "qayerda dars o'tsam bo'ladi?". Mavjud
 *    darsga xona tanlashda esa sig'im faqat ogohlantiradi
 *    (scheduleController) — u yerda dars allaqachon bor va uni
 *    to'xtatish foyda bermaydi.
 *    Sig'imi 0 (belgilanmagan) xona har doim qoladi: noma'lumni
 *    "kichik" deb hisoblash yolg'on bo'lardi.
 */
function freeRoomsAt(rooms, daySchedules, startTime, endTime, students = 0) {
  const busyKeys = new Set(
    daySchedules
      .filter((s) => timesOverlap(startTime, endTime, s.startTime, s.endTime))
      .map((s) => roomKeyOf(s))
      .filter(Boolean),
  );

  return rooms.filter((r) => {
    if (busyKeys.has(`id:${String(r._id)}`)) return false;
    if (students && r.capacity && r.capacity < students) return false;
    return true;
  });
}

/**
 * Nomzod oynalarni yasaydi: from dan to gacha, `step` qadam bilan.
 * Oxirgi oyna `to` dan oshib ketmaydi.
 */
function candidateWindows(from, to, duration, step) {
  const start = toMin(from);
  const end = toMin(to);
  const out = [];
  for (let s = start; s + duration <= end; s += step) {
    out.push({ startTime: toTime(s), endTime: toTime(s + duration) });
  }
  return out;
}

const REASON = {
  NO_TEACHER: "no_teacher",
  NO_ROOM: "no_room",
  NO_BOTH: "no_both",
};

/**
 * Bo'sh oynalarni topadi.
 *
 * @param {Object} p
 * @param {Array}  p.schedules  barcha faol darslar (kun bo'yicha filtrlanmagan)
 * @param {Array}  p.teachers   [{ _id, name }]
 * @param {Array}  p.rooms      [{ _id, name, capacity }]
 * @param {number[]} p.days     0..6 (0 = Dushanba)
 * @param {string} p.from       "09:00"
 * @param {string} p.to         "21:00"
 * @param {number} p.duration   daqiqada
 * @param {number} p.step       qadam, daqiqada
 * @param {number} [p.students] guruhdagi bolalar soni (0 = ahamiyatsiz)
 * @param {number} [p.limit]    kuniga eng ko'pi bilan nechta oyna
 */
function findFreeSlots({
  schedules,
  teachers,
  rooms,
  days,
  from,
  to,
  duration,
  step,
  students = 0,
  limit = 24,
}) {
  const result = [];
  const blocked = [];

  for (const day of days) {
    const daySchedules = schedules.filter((s) => s.dayOfWeek === day);
    const slots = [];

    for (const w of candidateWindows(from, to, duration, step)) {
      const t = freeTeachersAt(teachers, daySchedules, w.startTime, w.endTime);
      const r = freeRoomsAt(rooms, daySchedules, w.startTime, w.endTime, students);

      if (t.length && r.length) {
        if (slots.length < limit) {
          slots.push({ ...w, teachers: t, rooms: r });
        }
        continue;
      }

      // Nega bo'lmadi — javobsiz qoldirmaymiz (yuqoridagi izoh).
      blocked.push({
        dayOfWeek: day,
        ...w,
        reason: !t.length && !r.length
          ? REASON.NO_BOTH
          : !t.length
            ? REASON.NO_TEACHER
            : REASON.NO_ROOM,
      });
    }

    result.push({ dayOfWeek: day, slots });
  }

  return { days: result, blocked };
}

/**
 * Xonaga bog'lanmagan (faqat matn bilan yozilgan) darslar soni.
 *
 * ⚠️ Bu son NOL BO'LMASA natija to'liq emas: matn dars haqiqiy
 *    xonani band qilib turgan bo'lishi mumkin, lekin tizim buni
 *    ko'rmaydi va o'sha xonani "bo'sh" deb ko'rsatadi. Javobda
 *    ogohlantirish sifatida qaytadi va foydalanuvchi
 *    `POST /lc/rooms/import` ga yo'naltiriladi.
 */
function countUnlinkedLessons(schedules) {
  return schedules.filter((s) => !s.roomRef && String(s.room || "").trim()).length;
}

module.exports = {
  findFreeSlots,
  freeTeachersAt,
  freeRoomsAt,
  candidateWindows,
  countUnlinkedLessons,
  toMin,
  toTime,
  REASON,
};
