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
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { isSlotFree } = require("../utils/supportSlots");
const { isBookable } = require("../utils/supportWindow");
const { isSupportStaff } = require("./supportStaff");

// Kelmagan o'quvchi necha kun yozila olmaydi
const BLOCK_DAYS = 3;

// Mavzu eng kamida shuncha belgidan iborat bo'lsin.
// ⚠️ Nol emas: "." yoki "a" yozib o'tib ketishga yo'l qo'ymaymiz,
//    lekin uzun matn ham talab qilinmaydi — "logarifm" yetarli.
const TOPIC_MIN = 5;

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
  // ⚠️ Markazda bu xizmat umuman bor-yo'qligi. Interfeysni yashirish
  //    yetarli emas — so'rovni qo'lda yuborish mumkin.
  const director = await Teacher.findById(directorId).select("supportEnabled");
  if (!director?.supportEnabled) {
    return {
      ok: false,
      status: 403,
      error: "Bu markazda qo'shimcha mashg'ulot xizmati yo'q",
    };
  }

  // ⚠️ Kelmagani uchun bloklanganmi. Yozuvni bekor qilib bo'lmaydi,
  //    shuning uchun kelmaslikning yagona oqibati shu — aks holda
  //    o'quvchi joyni band qilib, kelmay, ertasiga yana yozilaverardi.
  const student = await Student.findById(studentId).select(
    "supportBlockedUntil name",
  );
  if (!student) {
    return { ok: false, status: 404, error: "O'quvchi topilmadi" };
  }
  if (student.supportBlockedUntil && student.supportBlockedUntil > new Date()) {
    const left = Math.ceil(
      (student.supportBlockedUntil - Date.now()) / 86400000,
    );
    return {
      ok: false,
      status: 403,
      error: `Oldingi mashg'ulotga kelmadingiz. Yana ${left} kundan keyin yozilishingiz mumkin.`,
      blockedUntil: student.supportBlockedUntil,
    };
  }

  // ⚠️ Quyidagi ikki qoida FAQAT O'QUVCHIGA tegishli.
  //    Xodim CRM'dan yozayotgan bo'lsa ular qo'llanmaydi: eshikdan
  //    kirib kelgan o'quvchini bugunga yozish — odatiy hol, va
  //    xodim mavzuni keyinroq to'ldirishi mumkin. O'quvchining
  //    o'zi uchun esa qoidalar qat'iy.
  const fromStudent = via === "app";

  // ⚠️ SANA OYNASI SERVERDA TEKSHIRILADI. Interfeysda faqat
  //    ertadan 7 kungacha ko'rsatiladi, lekin tugmani yashirish
  //    himoya emas — so'rovni qo'lda yuborib bugunga yoki bir
  //    oy keyinga yozib qo'yish mumkin edi.
  if (fromStudent) {
    const window = isBookable(date);
    if (!window.ok) {
      return { ok: false, status: 400, error: window.error };
    }
  }

  // ⚠️ MAVZU MAJBURIY. Bu shunchaki maydon emas — butun g'oyaning
  //    ma'nosi shunda: support ustozi bir kun oldin nima
  //    so'ralishini biladi va TAYYORLANADI. Mavzusiz uchrashuv
  //    "nima bilan yordam beray?" dan boshlanadi va 30 daqiqaning
  //    yarmi shunga ketadi.
  const cleanTopic = String(topic || "").trim();
  if (fromStudent && cleanTopic.length < TOPIC_MIN) {
    return {
      ok: false,
      status: 400,
      error: "Mavzuni yozing — ustoz shunga tayyorlanadi",
    };
  }

  // ⚠️ Xodim SUPPORT ROLIDAMI. Ro'yxatni interfeysda cheklash
  //    yetarli emas: so'rovga istalgan xodim id sini qo'yib
  //    yuborish mumkin va o'quvchi buxgalterga "qo'shimcha
  //    dars"ga yozilib olardi.
  if (!(await isSupportStaff(directorId, teacherId))) {
    return {
      ok: false,
      status: 403,
      error: "Bu xodim qo'shimcha mashg'ulot o'tkazmaydi",
    };
  }

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
      topic: cleanTopic.slice(0, 200),
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
 * Bekor qilish — FAQAT MARKAZ TOMONIDAN.
 *
 * ⚠️ O'QUVCHI BEKOR QILA OLMAYDI. Yozildingizmi — kelasiz.
 *    Sabab: bekor qilish erkin bo'lsa, o'quvchi vaqtni band
 *    qilib qo'yib, oxirgi daqiqada bekor qilardi va o'sha joyga
 *    boshqa hech kim ulgurmasdi. Kelmaslikning oqibati bor:
 *    3 kunlik bloklash (cron/supportCron.js).
 *
 *    Ustoz esa bekor qila oladi — u kasal bo'lib qolishi mumkin,
 *    va bu holda o'quvchi JAZOLANMAYDI.
 */
async function cancelBooking({ bookingId, by = "crm" }) {
  const booking = await SupportBooking.findById(bookingId);
  if (!booking) {
    return { ok: false, status: 404, error: "Yozuv topilmadi" };
  }

  if (!ACTIVE.includes(booking.status)) {
    return { ok: false, status: 400, error: "Bu yozuvni bekor qilib bo'lmaydi" };
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelledBy = by;
  await booking.save();

  return { ok: true, booking };
}

/** Kelmagani uchun bloklash sanasi */
const blockUntil = (from = new Date()) =>
  new Date(from.getTime() + BLOCK_DAYS * 24 * 60 * 60 * 1000);

module.exports = {
  bookSlot,
  cancelBooking,
  blockUntil,
  weekRange,
  MAX_ACTIVE_PER_WEEK,
  BLOCK_DAYS,
  TOPIC_MIN,
  ACTIVE,
};
