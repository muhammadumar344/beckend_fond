// src/controllers/scheduleController.js — STAFF UCHUN TUZATILGAN
const Schedule = require("../models/Schedule");
const Class = require("../models/Class");
const Staff = require("../models/Staff");
const { resolveContext } = require("../utils/resolveContext");
const { findTeacherConflicts } = require("../utils/teacherAvailability"); // ✅ YANGI

const DAYS = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

// ── Jadval yaratish ──────────────────────────────────────────
exports.createSchedule = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId, dayOfWeek, startTime, endTime, subject, room, teacherId, force } =
      req.body;

    if (!classId || dayOfWeek === undefined || !startTime || !endTime) {
      return res
        .status(400)
        .json({
          success: false,
          error: "classId, dayOfWeek, startTime, endTime majburiy",
        });
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res
        .status(400)
        .json({
          success: false,
          error: "dayOfWeek 0-6 orasida bo'lishi kerak",
        });
    }

    // ✅ directorId orqali qidirish (teacherId emas)
    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId }).populate(
      "subject",
      "name",
    );
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });

    // ✅ Staff faqat o'z filialidagi sinflarga kira oladi
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Bu sinf sizning filialingizga tegishli emas",
        });
    }

    const existing = await Schedule.findOne({
      class: classId,
      dayOfWeek,
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `${DAYS[dayOfWeek]} kuni jadval allaqachon mavjud (${existing.startTime}-${existing.endTime})`,
      });
    }

    // ✅ TUZATILDI — endi haqiqiy ustoz (Staff) tayinlanadi, avval doim
    // ctx.directorId (direktor) yozilardi. Berilmasa, guruhga tayinlangan
    // asosiy ustoz ishlatiladi.
    const resolvedTeacherId = teacherId || cls.assignedTeacher;
    if (!resolvedTeacherId) {
      return res.status(400).json({
        success: false,
        error: "Avval ustoz tayinlang (teacherId) — jadval ustozsiz yaratilmaydi",
      });
    }
    const teacherDoc = await Staff.findOne({
      _id: resolvedTeacherId,
      director: ctx.directorId,
      isActive: true,
    });
    if (!teacherDoc) {
      return res.status(404).json({ success: false, error: "Ustoz topilmadi" });
    }

    const conflicts = await findTeacherConflicts({
      teacherId: resolvedTeacherId,
      directorId: ctx.directorId,
      daysOfWeek: [dayOfWeek],
      startTime,
      endTime,
    });
    if (conflicts.length && !force) {
      return res.status(409).json({
        success: false,
        error: "Ustoz shu vaqtda boshqa guruhda band",
        conflicts,
      });
    }

    const schedule = await Schedule.create({
      class: classId,
      teacher: resolvedTeacherId,
      dayOfWeek,
      startTime,
      endTime,
      subject: (subject || cls.subject?.name || "").trim(),
      room: (room || "").trim(),
    });

    res
      .status(201)
      .json({ success: true, message: "Jadval qo'shildi", schedule });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Sinf jadvali ─────────────────────────────────────────────
exports.getClassSchedule = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const schedules = await Schedule.find({
      class: classId,
      isActive: true,
    }).sort({ dayOfWeek: 1, startTime: 1 });

    const weekly = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      dayName: DAYS[i],
      schedules: schedules.filter((s) => s.dayOfWeek === i),
    }));

    res.json({
      success: true,
      classId,
      className: cls.name,
      weekly,
      total: schedules.length,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Barcha sinflar jadvali (haftalik) ────────────────────────
exports.getWeeklyOverview = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    // ✅ Director — barcha sinflar; Staff — faqat o'z filiali
    const classQuery = { teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;

    const classes = await Class.find(classQuery).select("name");
    const classIds = classes.map((c) => c._id);

    const scheduleQuery = {
      class: { $in: classIds },
      isActive: true,
    };
    // ✅ YANGI — ?mine=true bo'lsa, faqat shu xodim ustoz bo'lgan
    // darslarni qaytaradi ("Ustoz o'z guruhlarini ko'ra olishi kerak")
    if (req.query.mine === "true" && req.user.role === "staff") {
      scheduleQuery.teacher = req.user.id;
    }

    const schedules = await Schedule.find(scheduleQuery)
      .populate("class", "name")
      .sort({ dayOfWeek: 1, startTime: 1 });

    const weekly = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      dayName: DAYS[i],
      schedules: schedules
        .filter((s) => s.dayOfWeek === i)
        .map((s) => ({
          _id: s._id,
          class: s.class,
          teacher: s.teacher, // ✅ TUZATILDI — avval umuman qaytmasdi, edit rejimida ustoz tanlovi doim bo'sh chiqardi
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          room: s.room,
        })),
    }));

    res.json({ success: true, weekly });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Jadval yangilash ─────────────────────────────────────────
exports.updateSchedule = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { scheduleId } = req.params;
    const { startTime, endTime, subject, room, teacherId, force } = req.body;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule)
      return res
        .status(404)
        .json({ success: false, error: "Jadval topilmadi" });

    // ✅ TUZATILDI — egalikni schedule.teacher orqali emas, bog'langan
    // Class(guruh).teacher orqali tekshiramiz. Avvalgi kod schedule.teacher
    // har doim direktor ID'siga teng deb hisoblardi — endi haqiqiy ustoz
    // (Staff) bo'lgani uchun bu solishtirish noto'g'ri natija berardi.
    const cls = await Class.findOne({ _id: schedule.class, teacher: ctx.directorId });
    if (!cls)
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const nextStart = startTime || schedule.startTime;
    const nextEnd = endTime || schedule.endTime;
    const nextTeacherId = teacherId || String(schedule.teacher);

    if (teacherId || startTime || endTime) {
      const teacherDoc = await Staff.findOne({
        _id: nextTeacherId,
        director: ctx.directorId,
        isActive: true,
      });
      if (!teacherDoc)
        return res.status(404).json({ success: false, error: "Ustoz topilmadi" });

      const conflicts = await findTeacherConflicts({
        teacherId: nextTeacherId,
        directorId: ctx.directorId,
        daysOfWeek: [schedule.dayOfWeek],
        startTime: nextStart,
        endTime: nextEnd,
        excludeClassId: schedule.class,
      });
      if (conflicts.length && !force) {
        return res.status(409).json({
          success: false,
          error: "Ustoz shu vaqtda boshqa guruhda band",
          conflicts,
        });
      }
      schedule.teacher = nextTeacherId;
    }

    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (subject !== undefined) schedule.subject = subject.trim();
    if (room !== undefined) schedule.room = room.trim();
    await schedule.save();

    res.json({ success: true, message: "Jadval yangilandi", schedule });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Jadval o'chirish ─────────────────────────────────────────
exports.deleteSchedule = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule)
      return res
        .status(404)
        .json({ success: false, error: "Jadval topilmadi" });

    // ✅ TUZATILDI — xuddi updateSchedule'dagi kabi, Class orqali tekshiramiz
    const cls = await Class.findOne({ _id: schedule.class, teacher: ctx.directorId });
    if (!cls)
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    schedule.isActive = false;
    await schedule.save();
    res.json({ success: true, message: "Jadval o'chirildi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
