// src/controllers/scheduleController.js — STAFF UCHUN TUZATILGAN
const Schedule = require("../models/Schedule");
const Class = require("../models/Class");
const Staff = require("../models/Staff");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { findTeacherConflicts } = require("../utils/teacherAvailability"); // ✅ YANGI
const {
  findRoomConflicts,
  resolveRoomChoice,
} = require("../utils/roomAvailability");
const { countGroupStudents } = require("../utils/enrollment");

// ⚠️ Xona tanlash `utils/roomAvailability.js` da — ichidagi
//    filial cheklovi jadval istisnolarida ham kerak va ikki
//    nusxa sekin-asta ajralib ketardi.
const resolveRoom = (ctx, roomId, roomText) =>
  resolveRoomChoice(ctx, roomId, roomText);

// ⚠️ SIG'IM TO'SIQ EMAS. 12 kishilik xonaga 14 bola sig'adi —
//    stul qo'yiladi. Bloklasak administrator xonani umuman
//    tanlamay qo'yardi va biz bandlik tekshiruvidan ayrilardik.
//    Shuning uchun javobda `warning` bo'lib qaytadi.
async function capacityWarning(roomDoc, classId) {
  if (!roomDoc || !roomDoc.capacity) return null;
  const count = await countGroupStudents(classId);
  if (count <= roomDoc.capacity) return null;
  return {
    type: "capacity",
    roomName: roomDoc.name,
    capacity: roomDoc.capacity,
    students: count,
  };
}

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
    // ⚠️ RUXSAT UMUMAN TEKSHIRILMASDI — 2026-08-20 da topilgan
    //    teshik. `manageSchedule` huquqi enum'da bor, interfeysda
    //    "Jadval tuzish" deb taklif qilinadi va `check:perms`
    //    yashil edi, chunki u faqat MENYU havolalarini qaraydi.
    //    Natijada davomat uchun qo'shilgan ustoz ham butun
    //    markazning jadvalini o'zgartira olardi: darsni ko'chirish,
    //    xonasini almashtirish, o'chirib yuborish.
    //    Ko'rish ochiq qoladi (ustoz o'z darsini bilishi kerak),
    //    YOZISH esa endi huquq talab qiladi.
    requirePermission(ctx, "manageSchedule");
    const {
      classId,
      dayOfWeek,
      startTime,
      endTime,
      subject,
      room,
      roomId,
      teacherId,
      force,
      // ⚠️ XONA UCHUN ALOHIDA BAYROQ — va bu muhim. Bitta `force`
      //    qoldirsak, xona ziddiyatini ataylab o'tkazgan odam
      //    o'zi bilmagan holda USTOZ ziddiyatini ham o'tkazib
      //    yuborardi: ustoz bir vaqtda ikki guruhda "dars o'tadi"
      //    bo'lib qolardi va buni hech kim ko'rmasdi.
      forceRoom,
    } = req.body;

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

    // ⚠️ XONA BANDLIGI — ustoz bandligi bilan bir xil qoida:
    //    409 va `force` bilan o'tkazish mumkin. Nega majburiy
    //    to'siq emas: katta xonada ikki kichik guruh haqiqatan
    //    birga o'tirishi mumkin (kompyuter sinfi). Lekin buni
    //    ATAYLAB qilish kerak, tasodifan emas.
    const { roomRef, room: roomName, doc: roomDoc } = await resolveRoom(
      ctx,
      roomId,
      room,
    );
    const roomConflicts = await findRoomConflicts({
      directorId: ctx.directorId,
      roomId: roomRef,
      roomName,
      daysOfWeek: [dayOfWeek],
      startTime,
      endTime,
    });
    if (roomConflicts.length && !forceRoom) {
      return res.status(409).json({
        success: false,
        error: `${roomName} xonasi shu vaqtda band`,
        roomConflicts,
      });
    }

    const schedule = await Schedule.create({
      class: classId,
      teacher: resolvedTeacherId,
      dayOfWeek,
      startTime,
      endTime,
      subject: (subject || cls.subject?.name || "").trim(),
      roomRef,
      room: roomName,
    });

    res.status(201).json({
      success: true,
      message: "Jadval qo'shildi",
      schedule,
      warning: await capacityWarning(roomDoc, classId),
    });
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
          roomRef: s.roomRef, // haqiqiy xona (bo'lsa)
          room: s.room, // ko'rsatiladigan nom — eski matn ham shu yerda
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
    requirePermission(ctx, "manageSchedule"); // yuqoridagi izohga qarang
    const { scheduleId } = req.params;
    // `forceRoom` — faqat XONA ziddiyatini o'tkazadi. Ustoz
    // ziddiyati uchun `force` alohida (yuqoridagi izohga qarang).
    const { startTime, endTime, subject, room, roomId, teacherId, force, forceRoom } =
      req.body;

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

    // Xona yoki vaqt o'zgarsa bandlikni qaytadan tekshiramiz.
    // `roomId` berilmasa hozirgi xona saqlanadi — vaqt surilganda
    // ham tekshirilishi shart: 18:00 dan 19:00 ga ko'chirilgan
    // dars boshqa guruhning ustiga tushishi mumkin.
    let roomDoc = null;
    if (roomId !== undefined || room !== undefined || startTime || endTime) {
      const resolved =
        roomId !== undefined || room !== undefined
          ? await resolveRoom(ctx, roomId, room)
          : { roomRef: schedule.roomRef, room: schedule.room, doc: null };

      const roomConflicts = await findRoomConflicts({
        directorId: ctx.directorId,
        roomId: resolved.roomRef,
        roomName: resolved.room,
        daysOfWeek: [schedule.dayOfWeek],
        startTime: nextStart,
        endTime: nextEnd,
        excludeScheduleId: schedule._id,
      });
      if (roomConflicts.length && !forceRoom) {
        return res.status(409).json({
          success: false,
          error: `${resolved.room} xonasi shu vaqtda band`,
          roomConflicts,
        });
      }

      schedule.roomRef = resolved.roomRef;
      schedule.room = resolved.room;
      roomDoc = resolved.doc;
    }

    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (subject !== undefined) schedule.subject = subject.trim();
    await schedule.save();

    res.json({
      success: true,
      message: "Jadval yangilandi",
      schedule,
      warning: await capacityWarning(roomDoc, schedule.class),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Jadval o'chirish ─────────────────────────────────────────
exports.deleteSchedule = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageSchedule"); // yuqoridagi izohga qarang
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
