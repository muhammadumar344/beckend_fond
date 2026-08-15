// src/services/studentDigest.js
// ════════════════════════════════════════════════════════════
// Bot buyruqlari uchun QISQA xulosa.
//
// NEGA MINI APP YETARLI EMAS: ota-onaning katta qismi ilovani
// ochmaydi. Telegram allaqachon ochiq, xabar allaqachon
// ko'rinib turibdi — "/tolov" yozib bir soniyada javob olish
// ilovaga kirib, tab tanlashdan ancha tez. Mini App batafsil
// ko'rish uchun, bot esa "tez savol — tez javob" uchun.
//
// ⚠️ RUXSAT BU YERDA TEKSHIRILMAYDI. Chaqiruvchi (bot/handlers)
//    `canSee(link, section)` ni O'ZI tekshirishi SHART. Bu
//    fayl faqat ma'lumot yig'adi — xuddi controller'dagi
//    hisob-kitobning o'zi, lekin qisqartirilgan ko'rinishda.
//
// ⚠️ Hisoblash qoidalari `controllers/tmaController.js` bilan
//    BIR XIL bo'lishi shart. Ikki joyda ikki xil foiz chiqsa,
//    ota-ona qaysisiga ishonishni bilmaydi. Shu sababli
//    "sababli kelmagan kun foizni tushirmaydi" qoidasi bu
//    yerda ham takrorlangan.
// ════════════════════════════════════════════════════════════

const Grade = require("../models/Grade");
const Attendance = require("../models/Attendance");
const MonthlyPayment = require("../models/MonthlyPayment");
const Homework = require("../models/Homework");
const HomeworkResult = require("../models/HomeworkResult");
const SupportBooking = require("../models/SupportBooking");
const { getStudentGroupIds } = require("../utils/enrollment");

/** Oxirgi baholar va fan bo'yicha o'rtacha */
async function grades(studentId) {
  const list = await Grade.find({ student: studentId })
    .sort({ date: -1 })
    .limit(50)
    .select("subject score maxScore date")
    .lean();

  if (!list.length) return { count: 0, overall: null, recent: [], subjects: [] };

  const pct = (g) => (g.score / (g.maxScore || 100)) * 100;
  const overall = Math.round(list.reduce((s, g) => s + pct(g), 0) / list.length);

  const bySubject = new Map();
  for (const g of list) {
    const k = g.subject || "—";
    if (!bySubject.has(k)) bySubject.set(k, { sum: 0, n: 0 });
    const b = bySubject.get(k);
    b.sum += pct(g);
    b.n += 1;
  }

  return {
    count: list.length,
    overall,
    // Xabarga sig'adigani — batafsili ilovada
    recent: list.slice(0, 5).map((g) => ({
      subject: g.subject || "—",
      score: g.score,
      max: g.maxScore || 100,
      date: g.date,
    })),
    subjects: [...bySubject.entries()]
      .map(([subject, b]) => ({ subject, average: Math.round(b.sum / b.n) }))
      .sort((a, b) => a.average - b.average)
      .slice(0, 5),
  };
}

/** Shu oyning davomati */
async function attendance(studentId) {
  const now = new Date();
  const records = await Attendance.find({
    student: studentId,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  })
    .select("status")
    .lean();

  const n = (s) => records.filter((r) => r.status === s).length;
  const present = n("present");
  const late = n("late");
  const absent = n("absent");
  const excused = n("excused");

  // ⚠️ Sababli kelmagan kun maxrajdan chiqariladi — u bolaning
  //    aybi emas (tmaController bilan bir xil qoida).
  const counted = records.length - excused;

  return {
    total: records.length,
    present,
    late,
    absent,
    excused,
    percent: counted ? Math.round(((present + late) / counted) * 100) : null,
  };
}

/** Qarz va to'lanmagan oylar */
async function payments(studentId) {
  const list = await MonthlyPayment.find({ student: studentId })
    .sort({ year: -1, month: -1 })
    .limit(24)
    .select("month year amount status")
    .lean();

  const unpaid = list.filter((p) => p.status !== "paid");
  return {
    debt: unpaid.reduce((s, p) => s + (p.amount || 0), 0),
    unpaid: unpaid
      .map((p) => ({ month: p.month, year: p.year, amount: p.amount || 0 }))
      .slice(0, 6),
  };
}

/** Bajarilmagan uy vazifalari */
async function homework(studentId) {
  const groupIds = await getStudentGroupIds(studentId);
  if (!groupIds.length) return { pending: [], pendingCount: 0, overdueCount: 0 };

  const items = await Homework.find({ class: { $in: groupIds } })
    .sort({ dueDate: -1 })
    .limit(40)
    .select("title subject dueDate")
    .lean();
  if (!items.length) return { pending: [], pendingCount: 0, overdueCount: 0 };

  const results = await HomeworkResult.find({
    student: studentId,
    homework: { $in: items.map((h) => h._id) },
  })
    .select("homework status")
    .lean();
  const byHw = new Map(results.map((r) => [String(r.homework), r]));

  const today = new Date().toISOString().slice(0, 10);
  const pending = items
    .filter((h) => (byHw.get(String(h._id))?.status || "pending") === "pending")
    .map((h) => ({
      title: h.title,
      subject: h.subject || "",
      dueDate: h.dueDate,
      // ⚠️ "Muddati o'tgan" bazada saqlanmaydi — sanadan chiqadi
      overdue: h.dueDate < today,
    }));

  return {
    // Muddati yaqinlari birinchi
    pending: [...pending].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 6),
    pendingCount: pending.length,
    overdueCount: pending.filter((h) => h.overdue).length,
  };
}

/** Kelayotgan va oxirgi mashg'ulotlar */
async function bookings(studentId) {
  const today = new Date().toISOString().slice(0, 10);

  const list = await SupportBooking.find({ student: studentId })
    .sort({ date: -1, startTime: -1 })
    .limit(10)
    .populate("teacher", "name")
    .select("date startTime endTime status topic teacher")
    .lean();

  const shape = (b) => ({
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    topic: b.topic || "",
    teacherName: b.teacher?.name || "",
  });

  return {
    upcoming: list
      .filter(
        (b) =>
          b.date >= today && (b.status === "pending" || b.status === "confirmed"),
      )
      .map(shape)
      .reverse(),
    recent: list.slice(0, 3).map(shape),
  };
}

module.exports = { grades, attendance, payments, homework, bookings };
