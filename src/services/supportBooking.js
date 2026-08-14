// src/services/supportBooking.js
// ════════════════════════════════════════════════════════════
// Yozilish qoidalari — CRM va Mini App UCHUN BIR XIL.
//
// ⚠️ Bu mantiq ikki joyda takrorlanmasin. Aks holda ota-ona
//    ilovadan yoza olmaydigan holatga xodim CRM'dan yozib
//    qo'yardi (yoki teskarisi) va qoidalar bir-biriga zid
//    bo'lib qolardi.
// ════════════════════════════════════════════════════════════

const SupportBooking = require("../models/SupportBooking");
const Staff = require("../models/Staff");
const { isSlotFree } = require("../utils/supportSlots");

// Bir o'quvchi haftada nechta faol yozuv qila oladi.
// ⚠️ Cheklovsiz bo'lsa bitta o'quvchi ustozning butun haftasini
//    band qilib qo'yardi va boshqalarga joy qolmasdi.
const MAX_ACTIVE_PER_WEEK = 1;

const ACTIVE = ["pending", "confirmed"];

/** "YYYY-MM-DD" sanasi tushgan haftaning dushanba va yakshanbasi */
function weekRange(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = Dushanba
  const mon = new Date(dt.getTime() - dow * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const iso = (x) => x.toISOString().slice(0, 10);
  return { from: iso(mon), to: iso(sun) };
}

/**
 * Vaqtni band qiladi.
 *
 * @returns {Promise<{ok: true, booking} | {ok: false, error, status}>}
 */
async function bookSlot({
  directorId,
  studentId,
  teacherId,
  date,
  startTime,
  topic = "",
  via = "app",
}) {
  // ⚠️ Bo'shligini QAYTA tekshiramiz: ro'yxat ko'rsatilgandan keyin
  //    boshqa o'quvchi o'sha vaqtni olgan bo'lishi mumkin.
  const slot = await isSlotFree({ directorId, teacherId, date, startTime });
  if (!slot) {
    return { ok: false, status: 409, error: "Bu vaqt endi bo'sh emas" };
  }

  const { from, to } = weekRange(date);
  const activeThisWeek = await SupportBooking.countDocuments({
    student: studentId,
    status: { $in: ACTIVE },
    date: { $gte: from, $lte: to },
  });

  if (activeThisWeek >= MAX_ACTIVE_PER_WEEK) {
    return {
      ok: false,
      status: 400,
      error: "Bu haftaga allaqachon yozilgansiz. Avval uni bekor qiling.",
    };
  }

  const staff = await Staff.findOne({
    _id: teacherId,
    director: directorId,
  }).select("branch");
  if (!staff) {
    return { ok: false, status: 404, error: "Ustoz topilmadi" };
  }

  try {
    const booking = await SupportBooking.create({
      director: directorId,
      branch: staff.branch || null,
      teacher: teacherId,
      student: studentId,
      date,
      startTime,
      endTime: slot.endTime,
      topic: String(topic || "").slice(0, 200),
      createdVia: via,
    });
    return { ok: true, booking };
  } catch (err) {
    // ⚠️ Ikki kishi bir vaqtda bosgan holat. Yuqoridagi tekshiruv
    //    bilan yozuv orasida tirqish bor — uni faqat noyob indeks
    //    yopadi (models/SupportBooking.js).
    if (err.code === 11000) {
      return { ok: false, status: 409, error: "Bu vaqt endi bo'sh emas" };
    }
    throw err;
  }
}

/**
 * Bekor qilish.
 * @param {object} p  { bookingId, studentIds, by }  studentIds — kimga ruxsat
 */
async function cancelBooking({ bookingId, studentIds, by = "app" }) {
  const booking = await SupportBooking.findById(bookingId);
  if (!booking) {
    return { ok: false, status: 404, error: "Yozuv topilmadi" };
  }

  // ⚠️ O'z farzandining yozuvimi — usiz istalgan yozuvni bekor
  //    qilish mumkin bo'lardi
  if (
    studentIds &&
    !studentIds.map(String).includes(String(booking.student))
  ) {
    return { ok: false, status: 403, error: "Ruxsat yo'q" };
  }

  if (!ACTIVE.includes(booking.status)) {
    return { ok: false, status: 400, error: "Bu yozuvni bekor qilib bo'lmaydi" };
  }

  // ⚠️ Oxirgi daqiqada bekor qilish — ustoz allaqachon kelgan
  //    va kutayotgan bo'ladi. Kamida 2 soat oldin.
  const when = new Date(`${booking.date}T${booking.startTime}:00+05:00`);
  if (when.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
    return {
      ok: false,
      status: 400,
      error: "Bekor qilish uchun kamida 2 soat qolishi kerak",
    };
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelledBy = by;
  await booking.save();

  return { ok: true, booking };
}

module.exports = {
  bookSlot,
  cancelBooking,
  weekRange,
  MAX_ACTIVE_PER_WEEK,
  ACTIVE,
};
