// src/controllers/scheduleExceptionController.js
// ════════════════════════════════════════════════════════════
// "Bu kuni dars bo'lmaydi" — bayram, kasal ustoz, ko'chirilgan
// dars.
//
// ⚠️ JADVAL O'ZGARMAYDI, ISTISNO YOZILADI. Sabab
//    `models/ScheduleException.js` boshida.
//
// ⚠️ SANA DARSNING KUNIGA TO'G'RI KELISHI TEKSHIRILADI.
//    Seshanbagi darsni "juma kuni bo'lmaydi" deb belgilash
//    mumkin bo'lsa, yozuv hech qachon ishlamasdi va nega
//    ishlamayotganini hech kim topa olmasdi.
// ════════════════════════════════════════════════════════════

const Schedule = require("../models/Schedule");
const ScheduleException = require("../models/ScheduleException");
const Class = require("../models/Class");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");
const { projectDayOfWeek } = require("../utils/supportSlots");
const {
  isDate,
  dateList,
  applyExceptions,
  overlapping,
} = require("../utils/scheduleDay");
const { resolveDay, listRange } = require("../services/scheduleExceptions");
const { roomKeyOf, resolveRoomChoice } = require("../utils/roomAvailability");
const { audit } = require("../services/audit");
const { notifyLessonChange, inBackground } = require("../services/notify");
const { todayInTashkent } = require("../utils/supportWindow");

// Bayram oralig'i uchun chegara. Yozgi ta'til (3 oy) bir marta
// belgilanadigan narsa emas — u guruhni to'xtatish, dars bekor
// qilish emas.
const MAX_HOLIDAY_DAYS = 31;

/** Direktorning (va xodim bo'lsa — filialining) guruhlari */
async function scopeClasses(ctx, branchId = null) {
  const q = { teacher: ctx.directorId };
  // Xodim faqat o'z filialini ko'radi; direktor bittasini tanlashi
  // mumkin (bayram bitta filialda bo'lishi mumkin — remont, ko'chish)
  const branch = ctx.branchFilter || branchId;
  if (branch) q.branch = branch;
  return Class.find(q).select("name branch").lean();
}

const classMapOf = (classes) =>
  new Map(classes.map((c) => [String(c._id), c]));

/** Istisnoni interfeys uchun tayyorlash */
const view = (e, classes) => ({
  _id: e._id,
  scheduleId: e.schedule,
  classId: e.class,
  className: classes.get(String(e.class))?.name || "",
  date: e.date,
  type: e.type,
  reason: e.reason,
  note: e.note,
  newDate: e.newDate || "",
  newStartTime: e.newStartTime || "",
  newEndTime: e.newEndTime || "",
  newRoom: e.newRoom || "",
  createdByName: e.createdByName || "", // bo'sh = direktor
  notifiedCount: e.notifiedCount || 0,
});

// ── Bir kundagi HAQIQIY darslar ──────────────────────────────
// GET /api/teacher/schedule/day?date=YYYY-MM-DD&mine=true
//
// ⚠️ Ruxsat talab qilinmaydi — haftalik jadval bilan bir xil
//    qoida: ustoz o'z kunini ko'ra olishi kerak. Filial cheklovi
//    esa saqlanadi.
exports.getDay = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const date = String(req.query.date || "").trim();
    if (!isDate(date)) {
      return res
        .status(400)
        .json({ success: false, error: "date: YYYY-MM-DD formatida bo'lsin" });
    }

    const classes = await scopeClasses(ctx);
    const classes_ = classMapOf(classes);
    const filter = { class: { $in: classes.map((c) => c._id) } };
    if (req.query.mine === "true" && req.user.role === "staff") {
      filter.teacher = req.user.id;
    }

    const { lessons, cancelled } = await resolveDay({
      directorId: ctx.directorId,
      date,
      filter,
    });

    // ⚠️ Shakl `/schedule/weekly` bilan AYNAN BIR XIL
    //    (`class` — obyekt). Ikkita boshqa shakl bo'lsa,
    //    "bugungi darslar" ni ko'rsatadigan uchta ekran uchta
    //    xil kod yozishga majbur bo'lardi.
    const shape = (l) => ({
      _id: l._id,
      class: {
        _id: l.class,
        name: classes_.get(String(l.class))?.name || "",
      },
      teacher: l.teacher,
      subject: l.subject,
      startTime: l.startTime,
      endTime: l.endTime,
      room: l.room,
      roomRef: l.roomRef,
      movedFrom: l.movedFrom || null,
      exception: l.exception ? view(l.exception, classes_) : null,
    });

    res.json({
      success: true,
      date,
      dayOfWeek: projectDayOfWeek(date),
      lessons: lessons.map(shape),
      cancelled: cancelled.map(shape),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Istisnolar ro'yxati ──────────────────────────────────────
// GET /api/teacher/schedule/exceptions?from=&to=
exports.list = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const from = String(req.query.from || todayInTashkent()).trim();
    const to = String(req.query.to || "").trim() || from;
    if (!isDate(from) || !isDate(to)) {
      return res
        .status(400)
        .json({ success: false, error: "from/to: YYYY-MM-DD formatida bo'lsin" });
    }

    const classes = await scopeClasses(ctx);
    const rows = await listRange({
      directorId: ctx.directorId,
      from,
      to,
      classIds: classes.map((c) => c._id),
    });

    const classes_ = classMapOf(classes);
    res.json({
      success: true,
      from,
      to,
      exceptions: rows.map((e) => view(e, classes_)),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

/** Dars + guruh egaligi va filial tekshiruvi */
async function loadLesson(ctx, scheduleId) {
  const lesson = await Schedule.findById(scheduleId).lean();
  if (!lesson) {
    const err = new Error("Jadval topilmadi");
    err.status = 404;
    throw err;
  }
  // ⚠️ Egalik `Schedule.teacher` orqali TEKSHIRILMAYDI — LC'da u
  //    Staff._id saqlaydi. Guruh orqali tekshiriladi
  //    (scheduleController dagi bilan bir xil qoida).
  const cls = await Class.findOne({
    _id: lesson.class,
    teacher: ctx.directorId,
  }).lean();
  if (!cls) {
    const err = new Error("Ruxsat yo'q");
    err.status = 403;
    throw err;
  }
  if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
    const err = new Error("Ruxsat yo'q");
    err.status = 403;
    throw err;
  }
  return { lesson, cls };
}

// ── Bitta dars: bekor qilish yoki ko'chirish ─────────────────
// POST /api/teacher/schedule/exceptions
exports.create = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageSchedule");

    const {
      scheduleId,
      date,
      type = "cancelled",
      reason = "other",
      note = "",
      newDate,
      newStartTime,
      newEndTime,
      roomId,
      room,
      notify = true,
      force,
      forceRoom,
    } = req.body;

    if (!scheduleId || !isDate(date)) {
      return res.status(400).json({
        success: false,
        error: "scheduleId va date (YYYY-MM-DD) majburiy",
      });
    }
    if (!["cancelled", "moved"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, error: "type: cancelled yoki moved" });
    }

    const { lesson, cls } = await loadLesson(ctx, scheduleId);

    // ⚠️ Sana darsning kuniga to'g'ri kelishi SHART — yuqoridagi
    //    izohga qarang.
    if (projectDayOfWeek(date) !== lesson.dayOfWeek) {
      return res.status(400).json({
        success: false,
        error: "Bu sana darsning hafta kuniga to'g'ri kelmaydi",
      });
    }

    const payload = {
      director: ctx.directorId,
      schedule: lesson._id,
      class: lesson.class,
      branch: cls.branch || null,
      date,
      type,
      reason: ["holiday", "teacher", "room", "other"].includes(reason)
        ? reason
        : "other",
      note: String(note || "").slice(0, 300),
      createdBy: ctx.staffId || null,
      createdByName: ctx.staffName || "",
    };

    if (type === "moved") {
      if (!isDate(newDate) || !newStartTime || !newEndTime) {
        return res.status(400).json({
          success: false,
          error: "Ko'chirilgan dars uchun yangi sana va vaqt majburiy",
        });
      }
      if (newStartTime >= newEndTime) {
        return res.status(400).json({
          success: false,
          error: "Tugash vaqti boshlanish vaqtidan keyin bo'lsin",
        });
      }

      const picked = await resolveRoomChoice(ctx, roomId, room);
      // Xona berilmagan bo'lsa darsning o'z xonasi qoladi
      const roomRef = roomId !== undefined || room !== undefined
        ? picked.roomRef
        : lesson.roomRef;
      const roomName = roomId !== undefined || room !== undefined
        ? picked.room
        : lesson.room;

      // ⚠️ ZIDDIYAT YANGI KUNDA TEKSHIRILADI, hafta kunida emas.
      //    Ko'chirilgan dars — bitta kunlik hodisa: o'sha kuni
      //    ustoz yoki xona band bo'lishi mumkin, boshqa
      //    haftalarda esa bo'sh. Haftalik tekshiruv bu yerda
      //    yolg'on javob berardi.
      const classes = await scopeClasses(ctx);
      const day = await resolveDay({
        directorId: ctx.directorId,
        date: newDate,
        filter: { class: { $in: classes.map((c) => c._id) } },
      });
      const classes_ = classMapOf(classes);
      const skipSelf = (l) => String(l._id) === String(lesson._id);

      const conflicts = overlapping({
        lessons: day.lessons,
        startTime: newStartTime,
        endTime: newEndTime,
        skip: skipSelf,
        match: (l) => String(l.teacher) === String(lesson.teacher),
      });
      if (conflicts.length && !force) {
        return res.status(409).json({
          success: false,
          error: "Ustoz shu vaqtda boshqa guruhda band",
          conflicts: conflicts.map((l) => ({
            groupName: classes_.get(String(l.class))?.name || "",
            startTime: l.startTime,
            endTime: l.endTime,
          })),
        });
      }

      const wantedKey = roomKeyOf({ roomRef, room: roomName });
      const roomConflicts = wantedKey
        ? overlapping({
            lessons: day.lessons,
            startTime: newStartTime,
            endTime: newEndTime,
            skip: skipSelf,
            match: (l) => roomKeyOf(l) === wantedKey,
          })
        : [];
      if (roomConflicts.length && !forceRoom) {
        return res.status(409).json({
          success: false,
          error: `${roomName} xonasi shu vaqtda band`,
          roomConflicts: roomConflicts.map((l) => ({
            groupName: classes_.get(String(l.class))?.name || "",
            startTime: l.startTime,
            endTime: l.endTime,
          })),
        });
      }

      Object.assign(payload, {
        newDate,
        newStartTime,
        newEndTime,
        newRoomRef: roomRef || null,
        newRoom: roomName || "",
      });
    }

    let doc;
    try {
      doc = await ScheduleException.create(payload);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "Bu dars uchun shu kunda o'zgarish allaqachon belgilangan",
        });
      }
      throw err;
    }

    audit(req, ctx, {
      action: type === "moved" ? "schedule.moved" : "schedule.cancelled",
      entity: "ScheduleException",
      entityId: doc._id,
      entityLabel: `${cls.name} — ${date}`,
      changes: [
        { field: "sana", from: date, to: type === "moved" ? newDate : null },
      ],
    });

    // ⚠️ O'TGAN KUN UCHUN XABAR YUBORILMAYDI. "Ertaga dars
    //    bo'lmaydi" degan xabar kechagi kun haqida kelsa,
    //    ota-ona bir marta o'qib, keyingisiga ishonmay qo'yadi.
    //
    // ⚠️ Ko'chirilgan darsda KEYINGI sana qaraladi: o'tgan
    //    haftadagi dars shu shanbaga ko'chirilsa, ota-ona buni
    //    bilishi SHART — asl kun o'tib ketgani xabarni to'xtatib
    //    qo'ymasin.
    const refDate =
      type === "moved" && newDate > date ? newDate : date;
    const willNotify = notify !== false && refDate >= todayInTashkent();
    if (willNotify) {
      inBackground(notifyLessonChange, {
        directorId: ctx.directorId,
        exceptionIds: [doc._id],
      });
    }

    res.status(201).json({
      success: true,
      message: type === "moved" ? "Dars ko'chirildi" : "Dars bekor qilindi",
      exception: view(doc.toObject(), classMapOf([cls])),
      notified: willNotify,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Bekor qilishni qaytarish ─────────────────────────────────
// DELETE /api/teacher/schedule/exceptions/:id
//
// ⚠️ YOZUV BUTUNLAY O'CHADI, "bekor qilindi" holati yozilmaydi.
//    Istisnoning o'zi — vaqtinchalik belgi; uni tarixda saqlash
//    "dars bo'lgan-bo'lmagani" savolini chalkashtirardi.
//    Jurnalda esa iz qoladi.
exports.remove = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageSchedule");

    const doc = await ScheduleException.findOne({
      _id: req.params.id,
      director: ctx.directorId,
    });
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: "O'zgarish topilmadi" });

    if (ctx.branchFilter && doc.branch && String(doc.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    await ScheduleException.deleteOne({ _id: doc._id });

    audit(req, ctx, {
      action: "schedule.restored",
      entity: "ScheduleException",
      entityId: doc._id,
      entityLabel: doc.date,
      changes: [{ field: "holat", from: doc.type, to: null }],
    });

    res.json({ success: true, message: "Dars jadvalga qaytarildi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Bayram: bir necha kunni birdan bekor qilish ──────────────
// POST /api/teacher/schedule/holiday
//
// ⚠️ AVVAL KO'RSATADI, KEYIN YOZADI (`apply: true`) — xonalar
//    importi bilan bir xil qoida. Bayram butun markazga tegadi;
//    "necha dars va nechta guruh" ni ko'rmasdan bosish qo'rqinchli
//    va odam umuman bosmay qo'yardi.
exports.holiday = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageSchedule");

    const {
      from,
      to,
      branchId = null,
      note = "",
      apply = false,
      notify = true,
    } = req.body;

    const start = String(from || "").trim();
    const end = String(to || start).trim();
    if (!isDate(start) || !isDate(end)) {
      return res
        .status(400)
        .json({ success: false, error: "from/to: YYYY-MM-DD formatida bo'lsin" });
    }
    if (end < start) {
      return res
        .status(400)
        .json({ success: false, error: "Tugash sanasi boshlanishidan oldin" });
    }

    const dates = dateList(start, end, MAX_HOLIDAY_DAYS);
    if (!dates.length) {
      return res.status(400).json({
        success: false,
        error: `Ko'pi bilan ${MAX_HOLIDAY_DAYS} kun belgilash mumkin`,
      });
    }

    const classes = await scopeClasses(ctx, branchId);
    if (!classes.length) {
      return res.json({ success: true, dates, days: [], total: 0, created: 0 });
    }
    const classes_ = classMapOf(classes);
    const classIds = classes.map((c) => c._id);

    const lessons = await Schedule.find({
      class: { $in: classIds },
      isActive: { $ne: false },
    }).lean();

    // Allaqachon belgilanganlar ikkinchi marta hisoblanmasin.
    // ⚠️ `type` va `newDate` ham kerak: bayram kuniga BOSHQA
    //    kundan ko'chirilgan dars ham bekor qilinishi shart.
    const existing = await ScheduleException.find({
      director: ctx.directorId,
      $or: [{ date: { $in: dates } }, { newDate: { $in: dates } }],
    })
      .select("schedule date type newDate newStartTime newEndTime")
      .lean();

    const days = [];
    const toCreate = [];
    // Bayram kuniga BOSHQA kundan ko'chirilgan darslar: ular
    // uchun istisno allaqachon bor (`moved`), yangisini yozib
    // bo'lmaydi. O'shalarni "ko'chirildi" dan "bekor qilindi" ga
    // aylantiramiz — markaz yopiq kuni qoplash darsi ham
    // bo'lmaydi.
    const toCancelMoves = [];
    for (const date of dates) {
      const { lessons: real } = applyExceptions({
        lessons,
        exceptions: existing,
        date,
        dayOfWeek: projectDayOfWeek(date),
      });
      const items = real.map((l) => ({
        scheduleId: l._id,
        classId: l.class,
        className: classes_.get(String(l.class))?.name || "",
        startTime: l.startTime,
        endTime: l.endTime,
        movedFrom: l.movedFrom || null,
      }));
      days.push({ date, lessons: items });

      for (const l of real) {
        if (l.movedFrom) {
          toCancelMoves.push(l.exception._id);
          continue;
        }
        toCreate.push({
          director: ctx.directorId,
          schedule: l._id,
          class: l.class,
          branch: classes_.get(String(l.class))?.branch || null,
          date,
          type: "cancelled",
          reason: "holiday",
          note: String(note || "").slice(0, 300),
          createdBy: ctx.staffId || null,
          createdByName: ctx.staffName || "",
        });
      }
    }

    const total = days.reduce((s, d) => s + d.lessons.length, 0);
    if (!apply) {
      return res.json({ success: true, dates, days, total, created: 0 });
    }
    if (!total) {
      return res.json({ success: true, dates, days, total: 0, created: 0 });
    }

    // ⚠️ `ordered: false` — bitta takror yozuv qolganini
    //    to'xtatmasin. Takrorlar (11000) jimgina o'tkazib
    //    yuboriladi: ular allaqachon belgilangan darslar.
    const startedAt = new Date();
    let created = 0;
    if (toCreate.length) {
      try {
        const inserted = await ScheduleException.insertMany(toCreate, {
          ordered: false,
        });
        created = inserted.length;
      } catch (err) {
        if (!err.writeErrors) throw err;
        created = toCreate.length - err.writeErrors.length;
      }
    }

    if (toCancelMoves.length) {
      const r = await ScheduleException.updateMany(
        { _id: { $in: toCancelMoves }, director: ctx.directorId },
        {
          $set: {
            type: "cancelled",
            reason: "holiday",
            newDate: "",
            newStartTime: "",
            newEndTime: "",
            newRoomRef: null,
            newRoom: "",
          },
        },
      );
      created += r.modifiedCount || 0;
    }

    audit(req, ctx, {
      action: "schedule.holiday",
      entity: "ScheduleException",
      entityId: null,
      entityLabel: dates.length > 1 ? `${start} — ${end}` : start,
      changes: [{ field: "bekor qilingan darslar", from: null, to: created }],
    });

    // ⚠️ Xabar uchun yozuvlar QAYTA O'QILADI, `insertMany`
    //    natijasidan olinmaydi: takror bo'lgan holatda u
    //    to'liq emas. `createdAt` bo'yicha chegara shu
    //    chaqiruvda yaratilganlarni ajratadi — avvalgi
    //    bayramda belgilanganlarga qayta xabar ketmasin.
    const willNotify = notify !== false && end >= todayInTashkent();
    if (willNotify && created) {
      const fresh = await ScheduleException.find({
        director: ctx.directorId,
        reason: "holiday",
        updatedAt: { $gte: startedAt },
      })
        .select("_id")
        .lean();
      if (fresh.length) {
        inBackground(notifyLessonChange, {
          directorId: ctx.directorId,
          exceptionIds: fresh.map((d) => d._id),
        });
      }
    }

    res.json({
      success: true,
      message: `${created} ta dars bekor qilindi`,
      dates,
      days,
      total,
      created,
      notified: willNotify,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
