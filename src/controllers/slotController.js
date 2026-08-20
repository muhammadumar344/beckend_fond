// src/controllers/slotController.js
// ════════════════════════════════════════════════════════════
// Bo'sh vaqt qidirgichi — "yangi guruhni qachon ochsam bo'ladi?"
//
// Mantiq `utils/slotFinder.js` da va u SOF: bu yerda faqat
// ma'lumot yig'iladi va parametrlar tozalanadi.
//
// ⚠️ RUXSAT — `manageSchedule`. Bu o'qish so'rovi, lekin ochiq
//    qoldirilmaydi: javobda BUTUN markazning ustozlari, xonalari
//    va ular qachon bandligi bor. Davomat uchun qo'shilgan ustoz
//    o'z tokeni bilan butun markazning ish tartibini yig'ib
//    olardi.
// ════════════════════════════════════════════════════════════
const Staff = require("../models/Staff");
const Room = require("../models/Room");
const Schedule = require("../models/Schedule");
const Class = require("../models/Class");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { findFreeSlots, countUnlinkedLessons } = require("../utils/slotFinder");

// Qidiruv oynasining standart chegaralari. Administrator
// odatda ularni tor qiladi ("18:00 dan keyin"), kengaytirmaydi.
const DEFAULTS = {
  from: "09:00",
  to: "21:00",
  duration: 90,
  step: 30,
  days: [0, 1, 2, 3, 4, 5], // Dushanba–Shanba
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const cleanTime = (v, fallback) => (HHMM.test(String(v)) ? String(v) : fallback);

const cleanDays = (v) => {
  if (v === undefined || v === null || v === "") return DEFAULTS.days;
  const raw = Array.isArray(v) ? v : String(v).split(",");
  const days = [...new Set(raw.map((d) => Number(d)))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  return days.length ? days : DEFAULTS.days;
};

const cleanIds = (v) => {
  if (!v) return null;
  const raw = Array.isArray(v) ? v : String(v).split(",");
  const ids = raw.map((s) => String(s).trim()).filter(Boolean);
  return ids.length ? ids : null;
};

// GET /api/lc/schedule/free-slots
//   ?days=0,2,4&from=18:00&to=21:00&duration=90&students=12&teacherIds=a,b
const freeSlots = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageSchedule");

    const days = cleanDays(req.query.days);
    const from = cleanTime(req.query.from, DEFAULTS.from);
    const to = cleanTime(req.query.to, DEFAULTS.to);

    // ⚠️ Chegaralar shart: `duration=1` bo'lsa javobda minglab
    //    oyna paydo bo'lardi va sahifa qotib qolardi.
    const duration = Math.min(
      480,
      Math.max(15, Number(req.query.duration) || DEFAULTS.duration),
    );
    const step = Math.min(120, Math.max(15, Number(req.query.step) || DEFAULTS.step));
    const students = Math.max(0, Number(req.query.students) || 0);

    if (from >= to) {
      return res.status(400).json({
        success: false,
        error: "Qidiruv oynasi noto'g'ri: boshlanish tugashdan keyin",
      });
    }

    // ── Ustozlar ──
    // ⚠️ Standart holda BARCHA faol xodim. Yangi ishga olingan
    //    ustozning hali darsi yo'q — aynan u uchun bo'sh vaqt
    //    qidiriladi, shuning uchun "darsi borlar" bilan
    //    cheklash eng kerakli odamni ro'yxatdan chiqarib
    //    yuborardi. Tanlashni interfeys qiladi.
    const staffQuery = { director: ctx.directorId, isActive: true };
    if (ctx.branchFilter) staffQuery.branch = ctx.branchFilter;

    const teacherIds = cleanIds(req.query.teacherIds);
    if (teacherIds) staffQuery._id = { $in: teacherIds };

    const teachers = await Staff.find(staffQuery).select("name branch").lean();
    if (!teachers.length) {
      return res.status(400).json({ success: false, error: "Ustoz topilmadi" });
    }

    // ── Xonalar ──
    const roomQuery = { director: ctx.directorId, isActive: true };
    if (ctx.branchFilter) {
      roomQuery.$or = [{ branch: ctx.branchFilter }, { branch: null }];
    }
    const rooms = await Room.find(roomQuery).select("name capacity branch").lean();

    // ── Darslar ──
    // `Schedule` da direktor maydoni yo'q (`teacher` — bu Staff),
    // shuning uchun avval sinf id'lari (roomAvailability dagi
    // `loadDaySchedules` bilan bir xil sabab).
    const classIds = await Class.find({ teacher: ctx.directorId }).distinct("_id");
    const schedules = classIds.length
      ? await Schedule.find({
          class: { $in: classIds },
          dayOfWeek: { $in: days },
          isActive: { $ne: false },
        })
          .select("dayOfWeek startTime endTime teacher roomRef room")
          .lean()
      : [];

    // Xona umuman yo'q bo'lsa qidiruvning ma'nosi qolmaydi:
    // har bir oyna "xona yo'q" bo'lib chiqardi va foydalanuvchi
    // sababini tushunmasdi.
    if (!rooms.length) {
      return res.json({
        success: true,
        needsRooms: true,
        days: days.map((d) => ({ dayOfWeek: d, slots: [] })),
        blocked: [],
        unlinkedLessons: countUnlinkedLessons(schedules),
        query: { days, from, to, duration, step, students },
      });
    }

    const { days: found, blocked } = findFreeSlots({
      schedules,
      teachers,
      rooms,
      days,
      from,
      to,
      duration,
      step,
      students,
    });

    const total = found.reduce((n, d) => n + d.slots.length, 0);

    res.json({
      success: true,
      needsRooms: false,
      days: found,
      total,
      // ⚠️ `blocked` faqat hech nima topilmaganda kerak. Topilgan
      //    holatda uni ham yuborish javobni bir necha barobar
      //    kattalashtirardi va foydasi bo'lmasdi.
      blocked: total === 0 ? blocked.slice(0, 40) : [],
      // Nol bo'lmasa natija to'liq emas — matn xonalar ko'rinmaydi
      unlinkedLessons: countUnlinkedLessons(schedules),
      query: { days, from, to, duration, step, students },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = { freeSlots };
