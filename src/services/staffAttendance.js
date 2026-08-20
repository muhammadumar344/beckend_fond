// src/services/staffAttendance.js
// ════════════════════════════════════════════════════════════
// Xodim davomatining MANTIG'I — controller'dan alohida.
//
// Ikkita savolga javob beradi:
//   1. Bugun kim, soat nechada kelishi kerak?  (jadvaldan)
//   2. Kelgan vaqti kechikishmi?               (grace bilan)
//
// ⚠️ "KUTILGAN VAQT" JADVALDAN CHIQADI. Xodimga alohida ish
//    grafigi yozdirmaymiz: markaz allaqachon dars jadvalini
//    to'ldirgan, ikkinchi marta o'sha ma'lumotni kiritish —
//    ikkita haqiqat manbai va ular albatta ajralib ketadi.
//
// ⚠️ Darsi yo'q xodim (buxgalter, qabulxona) ham kuzatiladi:
//    ular uchun markazning ochilish vaqti olinadi.
// ════════════════════════════════════════════════════════════

const Schedule = require("../models/Schedule");
const Staff = require("../models/Staff");
// ⚠️ Ishlatilmaydiganday ko'rinadi, LEKIN KERAK: quyida
//    `.populate("role", ...)` bor va Mongoose modelni NOMI
//    bo'yicha qidiradi. Model hech qayerda `require` qilinmasa
//    ro'yxatdan o'tmaydi va populate `MissingSchemaError` bilan
//    yiqiladi. Hozir u boshqa fayl orqali tasodifan ro'yxatga
//    tushib turibdi — bunday tasodifga tayanmaymiz.
require("../models/Role");
const StaffAttendance = require("../models/StaffAttendance");
const ScheduleException = require("../models/ScheduleException");
const Teacher = require("../models/Teacher");
const { projectDayOfWeek, toMin, toTime } = require("../utils/supportSlots");
const { applyExceptions } = require("../utils/scheduleDay");
const { todayInTashkent } = require("../utils/supportWindow");

const FALLBACK = {
  enabled: false,
  graceMinutes: 5,
  workStart: "09:00",
  latePenalty: 0,
  absentPenalty: 0,
};

/** Sozlama — bo'sh maydonlar to'ldirilgan holda */
function normalizeSettings(raw) {
  const s = raw || {};
  return {
    enabled: Boolean(s.enabled),
    graceMinutes: s.graceMinutes ?? FALLBACK.graceMinutes,
    workStart: s.workStart || FALLBACK.workStart,
    latePenalty: s.latePenalty ?? FALLBACK.latePenalty,
    absentPenalty: s.absentPenalty ?? FALLBACK.absentPenalty,
  };
}

/** "YYYY-MM-DD" → "YYYY-MM" */
const monthOf = (date) => String(date).slice(0, 7);

/**
 * Hozirgi vaqt "HH:MM" ko'rinishida (Toshkent).
 * ⚠️ Server UTC da ishlaydi — mahalliy vaqtga tayanib bo'lmaydi.
 */
function nowTime() {
  const t = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Berilgan kun uchun har bir xodimning kutilgan kelish vaqti.
 *
 * @returns {Promise<Map<string, {expectedAt, lessons}>>}
 */
async function expectedTimes({ directorId, date, staffIds, workStart }) {
  const dow = projectDayOfWeek(date);

  // ⚠️ BEKOR QILINGAN DARS KUTILGAN VAQTNI BELGILAMAYDI.
  //    Bayram kuni yoki ustoz kasal bo'lgan kunda ham "soat
  //    9:00 da kelishi kerak edi" deb yozilsa, tizim uni
  //    kechikkan yoki kelmagan deb belgilardi va bu maoshdan
  //    jarima bo'lib ushlanardi. Aksincha, boshqa kundan
  //    ko'chirilgan dars o'sha kuni kutilgan vaqtni oldinga
  //    surishi mumkin.
  const exceptions = await ScheduleException.find({
    director: directorId,
    $or: [{ date }, { newDate: date }],
  })
    .select("schedule date type newDate newStartTime newEndTime")
    .lean();
  const movedInIds = exceptions
    .filter((e) => e.type === "moved" && e.newDate === date)
    .map((e) => e.schedule);

  // ⚠️ `Schedule.teacher` sxemada `Teacher` ga ref qilingan, lekin
  //    LC'da u aslida `Staff._id` saqlaydi (tarixiy nomuvofiqlik).
  //    Shuning uchun populate QILINMAYDI — faqat id solishtiriladi.
  const raw = await Schedule.find({
    teacher: { $in: staffIds },
    isActive: { $ne: false },
    $or: [
      { dayOfWeek: dow },
      ...(movedInIds.length ? [{ _id: { $in: movedInIds } }] : []),
    ],
  })
    .select("teacher startTime endTime class subject dayOfWeek")
    .lean();

  const { lessons } = applyExceptions({
    lessons: raw,
    exceptions,
    date,
    dayOfWeek: dow,
  });

  const byStaff = new Map();
  for (const l of lessons) {
    const k = String(l.teacher);
    if (!byStaff.has(k)) byStaff.set(k, []);
    byStaff.get(k).push(l);
  }

  const out = new Map();
  for (const id of staffIds) {
    const k = String(id);
    const mine = (byStaff.get(k) || []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    out.set(k, {
      // Darsi bo'lsa — eng ertasi; bo'lmasa markaz ochilishi
      expectedAt: mine.length ? mine[0].startTime : workStart,
      lessons: mine.map((l) => ({
        startTime: l.startTime,
        endTime: l.endTime,
        subject: l.subject || "",
      })),
    });
  }
  return out;
}

/**
 * Kelgan vaqt kechikishmi.
 *
 * @returns {{status: 'present'|'late', lateMinutes: number}}
 */
function judge(expectedAt, arrivedAt, graceMinutes) {
  if (!expectedAt || !arrivedAt) {
    return { status: "present", lateMinutes: 0 };
  }
  const diff = toMin(arrivedAt) - toMin(expectedAt);

  // ⚠️ Grace ichida kelgan — KECHIKKAN EMAS va daqiqasi ham
  //    yozilmaydi. Aks holda hisobotda "2 daqiqa kechikdi"
  //    turardi-yu, jarima yo'q edi — bu chalkashlik tug'diradi.
  if (diff <= graceMinutes) return { status: "present", lateMinutes: 0 };
  return { status: "late", lateMinutes: diff };
}

/**
 * Bugungi ro'yxat: kim kutilyapti, kim keldi.
 *
 * ⚠️ RO'YXAT HAR SAFAR JADVALDAN QURILADI, bazadagi yozuvlardan
 *    emas. Sabab: yangi ishga olingan xodim darrov ro'yxatda
 *    ko'rinishi kerak, uni "davomatga qo'shish" degan alohida
 *    qadam bo'lmasin.
 */
async function dayView({ directorId, branchId = null, date }) {
  const day = date || todayInTashkent();

  const director = await Teacher.findById(directorId)
    .select("staffAttendance")
    .lean();
  const settings = normalizeSettings(director?.staffAttendance);

  const staffQuery = { director: directorId, isActive: { $ne: false } };
  if (branchId) staffQuery.$or = [{ branch: branchId }, { branch: null }];

  const staff = await Staff.find(staffQuery)
    .populate("role", "name isSupport slug")
    .select("name role branch phone")
    .sort({ name: 1 })
    .lean();

  if (!staff.length) return { date: day, settings, rows: [] };

  const ids = staff.map((s) => s._id);
  const [expected, marks] = await Promise.all([
    expectedTimes({
      directorId,
      date: day,
      staffIds: ids,
      workStart: settings.workStart,
    }),
    StaffAttendance.find({ staff: { $in: ids }, date: day }).lean(),
  ]);

  const byStaff = new Map(marks.map((m) => [String(m.staff), m]));

  const rows = staff.map((s) => {
    const k = String(s._id);
    const exp = expected.get(k) || { expectedAt: settings.workStart, lessons: [] };
    const m = byStaff.get(k);

    return {
      staffId: s._id,
      name: s.name,
      roleName: s.role?.name || "",
      expectedAt: exp.expectedAt,
      lessonCount: exp.lessons.length,
      firstLesson: exp.lessons[0] || null,
      // Belgilanmagan bo'lsa `status: null` — interfeys shunga
      // qarab "belgilash" tugmalarini ko'rsatadi
      status: m?.status || null,
      arrivedAt: m?.arrivedAt || "",
      lateMinutes: m?.lateMinutes || 0,
      note: m?.note || "",
    };
  });

  return { date: day, settings, rows };
}

/**
 * Belgilash. Bir kun — bir yozuv (upsert).
 *
 * @param {object} p
 * @param {'present'|'late'|'absent'|'excused'} [p.status]
 *        Berilmasa — kelgan vaqtdan o'zi aniqlanadi
 */
async function mark({
  directorId,
  staffId,
  date,
  status,
  arrivedAt,
  note = "",
  markedBy = null,
}) {
  const day = date || todayInTashkent();

  const staff = await Staff.findOne({
    _id: staffId,
    director: directorId,
  }).select("branch");
  if (!staff) return { ok: false, status: 404, error: "Xodim topilmadi" };

  const director = await Teacher.findById(directorId)
    .select("staffAttendance")
    .lean();
  const settings = normalizeSettings(director?.staffAttendance);

  const exp = await expectedTimes({
    directorId,
    date: day,
    staffIds: [staffId],
    workStart: settings.workStart,
  });
  const expectedAt = exp.get(String(staffId))?.expectedAt || settings.workStart;

  let finalStatus = status;
  let lateMinutes = 0;
  let arrived = arrivedAt || "";

  if (status === "present" || status === "late" || !status) {
    // ⚠️ Vaqt berilmasa HOZIRGI vaqt olinadi. "Keldi" tugmasi
    //    o'sha daqiqada bosiladi — qo'lda vaqt terishni talab
    //    qilsak, hech kim ishlatmaydi.
    arrived = arrived || nowTime();
    const j = judge(expectedAt, arrived, settings.graceMinutes);
    // Xodim ataylab "kechikdi" desa — uni bekor qilmaymiz
    finalStatus = status === "late" ? "late" : j.status;
    lateMinutes = finalStatus === "late" ? j.lateMinutes || 1 : 0;
  } else {
    // absent / excused — kelgan vaqti yo'q
    arrived = "";
  }

  const doc = await StaffAttendance.findOneAndUpdate(
    { staff: staffId, date: day },
    {
      $set: {
        director: directorId,
        branch: staff.branch || null,
        month: monthOf(day),
        expectedAt,
        arrivedAt: arrived,
        status: finalStatus,
        lateMinutes,
        note: String(note || "").slice(0, 300),
        markedBy,
        via: "manual",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { ok: true, record: doc };
}

/**
 * Oylik xulosa — maosh sahifasi uchun.
 *
 * @returns {Promise<Map<string, {present, late, absent, excused, lateMinutes, penalty}>>}
 */
async function monthSummary({ directorId, month, staffIds = null }) {
  const director = await Teacher.findById(directorId)
    .select("staffAttendance")
    .lean();
  const settings = normalizeSettings(director?.staffAttendance);

  const query = { director: directorId, month };
  if (staffIds?.length) query.staff = { $in: staffIds };

  const rows = await StaffAttendance.find(query)
    .select("staff status lateMinutes")
    .lean();

  const out = new Map();
  const blank = () => ({
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    lateMinutes: 0,
    penalty: 0,
  });

  for (const r of rows) {
    const k = String(r.staff);
    if (!out.has(k)) out.set(k, blank());
    const b = out.get(k);
    b[r.status] = (b[r.status] || 0) + 1;
    b.lateMinutes += r.lateMinutes || 0;
  }

  // ⚠️ Jarima FAQAT HISOBLANADI, hech qayerga yozilmaydi.
  //    Maoshdan ushlab qolishni odam tasdiqlaydi — tizim
  //    jimgina pul kamaytirsa, birinchi xatoda unga bo'lgan
  //    ishonch butunlay yo'qoladi.
  for (const b of out.values()) {
    b.penalty = b.late * settings.latePenalty + b.absent * settings.absentPenalty;
  }

  return { settings, byStaff: out };
}

module.exports = {
  dayView,
  mark,
  monthSummary,
  expectedTimes,
  judge,
  normalizeSettings,
  monthOf,
  nowTime,
  FALLBACK,
};
