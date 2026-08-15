// src/services/churnRisk.js
// ════════════════════════════════════════════════════════════
// KETISH ARAFASIDAGI O'QUVCHILAR.
//
// O'quv markazi o'quvchini yo'qotganini u ketgandan KEYIN
// biladi — odatda navbatdagi to'lov kelmaganda, ya'ni bir oy
// o'tib. O'sha paytda qaytarib bo'lmaydi.
//
// Lekin belgilar oldin ko'rinadi va ular allaqachon bazamizda:
// bola ketishdan oldin KELMAY QO'YADI. Ketma-ket uch dars —
// bu tasodif emas, bu qaror. Bir qo'ng'iroq o'sha qarorni
// qaytarishi mumkin.
//
// ⚠️ SABABLI kelmagan kun hisobga OLINMAYDI. Ota-ona "kasal"
//    deb aytgan bo'lsa, bu ketish belgisi emas — aksincha,
//    aloqa borligi belgisi. (Davomat foizida ham shunday
//    qoida: utils dagi izohlarga qarang.)
//
// ⚠️ RO'YXAT QISQA BO'LISHI SHART. Ellikta ismli ro'yxatga
//    hech kim qaramaydi. Shuning uchun chegara qat'iy va
//    "qo'ng'iroq qilindi" tugmasi bor — bir hafta ko'rinmaydi.
// ════════════════════════════════════════════════════════════

const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Class = require("../models/Class");
const MonthlyPayment = require("../models/MonthlyPayment");
const { todayInTashkent, addDays } = require("../utils/supportWindow");

// Ketma-ket shuncha dars kelmasa — kuchli belgi
const STREAK_ALERT = 3;
// Oxirgi shuncha darsdan...
const WINDOW_LESSONS = 5;
// ...shunchasiga kelmagan bo'lsa — surilib ketyapti
const MISSED_ALERT = 3;
// Shuncha oy to'lamagan bo'lsa — moliyaviy belgi
const DEBT_MONTHS_ALERT = 2;
// Qo'ng'iroq qilingandan keyin shuncha kun ko'rinmaydi
const SNOOZE_DAYS = 7;
// Necha kunlik davomat qaraladi
const LOOKBACK_DAYS = 45;

/**
 * Xavf ostidagi o'quvchilar.
 *
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} [p.branchId]
 * @param {boolean} [p.includeContacted]  Qo'ng'iroq qilinganlar ham
 * @returns {Promise<Array>}
 */
async function atRisk({ directorId, branchId = null, includeContacted = false }) {
  const groupQuery = { teacher: directorId };
  if (branchId) groupQuery.branch = branchId;

  const groups = await Class.find(groupQuery).select("name").lean();
  if (!groups.length) return [];

  const groupIds = groups.map((g) => g._id);
  const groupName = new Map(groups.map((g) => [String(g._id), g.name]));

  const students = await Student.find({
    class: { $in: groupIds },
    isActive: { $ne: false },
  })
    .select("name class parentPhone riskContactedAt")
    .lean();
  if (!students.length) return [];

  const today = todayInTashkent();
  const from = addDays(today, -LOOKBACK_DAYS);

  const studentIds = students.map((s) => s._id);

  // ⚠️ Bitta so'rov — o'quvchi boshiga alohida so'rov yuborsak,
  //    500 ta o'quvchili markazda 500 ta so'rov bo'lardi.
  const [records, unpaid] = await Promise.all([
    Attendance.find({
      student: { $in: studentIds },
      date: { $gte: from },
    })
      .select("student date status")
      .sort({ date: 1 })
      .lean(),
    MonthlyPayment.find({
      student: { $in: studentIds },
      status: { $ne: "paid" },
    })
      .select("student amount month year")
      .lean(),
  ]);

  const byStudent = new Map();
  for (const r of records) {
    const k = String(r.student);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(r);
  }

  const debtBy = new Map();
  for (const p of unpaid) {
    const k = String(p.student);
    if (!debtBy.has(k)) debtBy.set(k, { months: 0, amount: 0 });
    const d = debtBy.get(k);
    d.months += 1;
    d.amount += p.amount || 0;
  }

  const snoozeCut = new Date(Date.now() - SNOOZE_DAYS * 86400000);
  const out = [];

  for (const s of students) {
    const k = String(s._id);
    const contacted = s.riskContactedAt && s.riskContactedAt > snoozeCut;
    if (contacted && !includeContacted) continue;

    // ⚠️ Sababli kelmagan kunlar butunlay chiqarib tashlanadi —
    //    ular na "keldi", na "kelmadi" deb sanaladi. Ota-ona
    //    ogohlantirgan bo'lsa, bu aloqa borligi belgisi.
    const marks = (byStudent.get(k) || []).filter((r) => r.status !== "excused");
    if (!marks.length) continue;

    const missedMark = (r) => r.status === "absent";

    // Oxiridan boshlab ketma-ket kelmaganlar
    let streak = 0;
    for (let i = marks.length - 1; i >= 0; i--) {
      if (missedMark(marks[i])) streak += 1;
      else break;
    }

    const window = marks.slice(-WINDOW_LESSONS);
    const missed = window.filter(missedMark).length;

    const debt = debtBy.get(k) || { months: 0, amount: 0 };

    // ── Sabablar ─────────────────────────────────────────────
    const reasons = [];
    if (streak >= STREAK_ALERT) reasons.push("streak");
    else if (window.length >= WINDOW_LESSONS && missed >= MISSED_ALERT) {
      reasons.push("drifting");
    }
    if (debt.months >= DEBT_MONTHS_ALERT) reasons.push("debt");

    // ⚠️ FAQAT QARZ yetarli emas. To'lov kechikishi odatiy hol
    //    va u bilan ketish orasida bog'liqlik zaif. Ro'yxat
    //    davomat belgisi bilan boshlanadi — aks holda u
    //    qarzdorlar ro'yxatiga aylanib qolardi, u esa
    //    allaqachon boshqa sahifada bor.
    const hasAttendanceSignal =
      reasons.includes("streak") || reasons.includes("drifting");
    if (!hasAttendanceSignal) continue;

    const last = marks[marks.length - 1];
    const lastPresent = [...marks].reverse().find((r) => !missedMark(r));

    out.push({
      studentId: s._id,
      name: s.name,
      className: groupName.get(String(s.class)) || "",
      parentPhone: s.parentPhone || "",
      reasons,
      absentStreak: streak,
      missedOfWindow: missed,
      windowSize: window.length,
      lastMarkDate: last?.date || "",
      lastPresentDate: lastPresent?.date || "",
      debtMonths: debt.months,
      debtAmount: debt.amount,
      contacted: Boolean(contacted),
      contactedAt: s.riskContactedAt || null,
      // Tartiblash uchun: ketma-ket kelmaslik eng og'ir belgi
      score: streak * 10 + missed * 3 + Math.min(debt.months, 4),
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** "Qo'ng'iroq qildim" — bir haftaga ro'yxatdan olib turadi */
async function markContacted({ directorId, studentId }) {
  // ⚠️ O'quvchi SHU markazniki ekani tekshiriladi: id manzildan
  //    keladi va tekshiruvsiz boshqa markazning yozuviga
  //    tegib qo'yish mumkin bo'lardi.
  const student = await Student.findById(studentId).select("class").lean();
  if (!student) return { ok: false, status: 404, error: "O'quvchi topilmadi" };

  const group = await Class.findOne({
    _id: student.class,
    teacher: directorId,
  }).select("_id");
  if (!group) return { ok: false, status: 404, error: "O'quvchi topilmadi" };

  await Student.updateOne(
    { _id: studentId },
    { $set: { riskContactedAt: new Date() } },
  );
  return { ok: true };
}

module.exports = {
  atRisk,
  markContacted,
  STREAK_ALERT,
  WINDOW_LESSONS,
  MISSED_ALERT,
  DEBT_MONTHS_ALERT,
  SNOOZE_DAYS,
};
