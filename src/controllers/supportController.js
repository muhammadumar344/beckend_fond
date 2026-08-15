// src/controllers/supportController.js
// ════════════════════════════════════════════════════════════
// Qo'shimcha mashg'ulot — CRM tomoni.
//
// Ustoz/xodim shu yerdan qabul vaqtini belgilaydi va kelgan
// yozuvlarni tasdiqlaydi. O'quvchi tomoni — tmaController.js
// ════════════════════════════════════════════════════════════

const SupportBooking = require("../models/SupportBooking");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { freeSlots, toMin, normalizeHours } = require("../utils/supportSlots");
const { notifyBooking, inBackground } = require("../services/notify");
const { currentToken, WINDOW_SEC } = require("../services/supportQr");
const { MIN_DAYS_AHEAD, MAX_DAYS_AHEAD } = require("../utils/supportWindow");

const DAY_NAMES = [
  "Dushanba", "Seshanba", "Chorshanba",
  "Payshanba", "Juma", "Shanba", "Yakshanba",
];

const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));

// ══ MARKAZ SOZLAMASI ════════════════════════════════════════
// ⚠️ Bu ikkalasi `requireSupport` dan O'TMAYDI — o'chirilgan
//    xizmatni qayta yoqish uchun yo'l ochiq qolishi kerak.

// GET /api/lc/support/settings
exports.getSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const director = await Teacher.findById(ctx.directorId)
      .select("supportEnabled supportHours")
      .lean();

    // ⚠️ Support ustozlari ro'yxati ham qaytariladi. Sabab:
    //    xizmatni yoqish YETARLI EMAS — o'quvchiga ro'yxat
    //    rolga qarab tuziladi, ya'ni "Support Teacher" rolidagi
    //    xodim bo'lmasa o'quvchi bo'sh ekran ko'radi. Direktor
    //    buni sozlamalar sahifasidayoq bilsin, o'quvchi
    //    shikoyat qilgandan keyin emas.
    const { listSupportStaff } = require("../services/supportStaff");
    const staff = await listSupportStaff({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
    });

    res.json({
      success: true,
      enabled: Boolean(director?.supportEnabled),
      canEdit: ctx.isDirector,
      staff,
      // ⚠️ Eski hujjatlarda `supportHours` umuman bo'lmasligi
      //    mumkin — Mongoose standart qiymatni O'QISHDA qo'shmaydi.
      //    `normalizeHours` bo'sh maydonlarni to'ldiradi.
      hours: normalizeHours(director?.supportHours),
      dayNames: DAY_NAMES,
      // Interfeys "ertadan 7 kungacha" deb yozib qo'yishi uchun
      window: {
        minDaysAhead: MIN_DAYS_AHEAD,
        maxDaysAhead: MAX_DAYS_AHEAD,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// PUT /api/lc/support/settings  { enabled, hours }
exports.updateSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const director = await Teacher.findById(ctx.directorId);
    if (!director) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }

    if (req.body?.enabled !== undefined) {
      director.supportEnabled = Boolean(req.body.enabled);
    }

    // ── Ish vaqti ────────────────────────────────────────────
    // ⚠️ Bu MARKAZ sozlamasi, ustozniki emas. Support ustozi
    //    qachon qabul qilishini tanlamaydi — ish vaqti davomida
    //    qabul har doim ochiq.
    if (req.body?.hours) {
      const h = req.body.hours;
      const cur = normalizeHours(director.supportHours);

      const start = h.start ?? cur.start;
      const end = h.end ?? cur.end;
      const slotMinutes = Number(h.slotMinutes ?? cur.slotMinutes);
      const days = Array.isArray(h.days) ? h.days.map(Number) : cur.days;

      if (!isTime(start) || !isTime(end)) {
        return res.status(400).json({
          success: false,
          error: "Vaqt HH:MM formatida bo'lsin",
        });
      }
      if (toMin(end) <= toMin(start)) {
        return res.status(400).json({
          success: false,
          error: "Tugash vaqti boshlanishdan keyin bo'lsin",
        });
      }
      if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 120) {
        return res.status(400).json({
          success: false,
          error: "Uchrashuv davomiyligi 10–120 daqiqa oralig'ida",
        });
      }
      if (toMin(end) - toMin(start) < slotMinutes) {
        return res.status(400).json({
          success: false,
          error: "Ish vaqti bitta uchrashuvga ham yetmaydi",
        });
      }
      if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return res.status(400).json({
          success: false,
          error: "Kamida bitta ish kuni tanlansin",
        });
      }

      director.supportHours = {
        start,
        end,
        slotMinutes,
        days: [...new Set(days)].sort((a, b) => a - b),
      };
    }

    await director.save();

    // ⚠️ O'chirilganda mavjud yozuvlar TEGILMAYDI. Ular tarixda
    //    qoladi va o'quvchilar allaqachon kelishga rozi bo'lgan.
    //    Yangi yozilish esa `requireSupport` bilan to'siladi.
    //
    // ⚠️ Ish vaqti QISQARTIRILGANDA ham mavjud yozuvlar qoladi.
    //    Ular o'quvchi bilan kelishilgan va bekor qilinsa,
    //    o'quvchi sababini bilmay qolardi. Xodim kerak bo'lsa
    //    yozuvlar ro'yxatidan qo'lda bekor qiladi.
    res.json({
      success: true,
      enabled: director.supportEnabled,
      hours: normalizeHours(director.supportHours),
      message: "Saqlandi",
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ══ QABUL VAQTLARI YO'Q ═════════════════════════════════════
//
// ⚠️ `getSlots` / `createSlot` / `deleteSlot` OLIB TASHLANDI va
//    `SupportSlot` modeli ham o'chirildi.
//
//    Sabab: support ustozi — shu ish uchun alohida olingan odam.
//    U qachon qabul qilishini TANLAMAYDI: markazning ish vaqti
//    davomida qabul har doim ochiq, faqat boshqa o'quvchi band
//    qilgan 30 daqiqa bandligicha qoladi.
//
//    Eski modelda ustoz qabul vaqti belgilamasa — o'quvchi uni
//    umuman ko'rmasdi. Ya'ni ishga olingan odam hech narsa
//    qilmasdan o'zini ro'yxatdan yashirib qo'ya olardi.
//
//    Ish vaqti endi markaz darajasida: `Teacher.supportHours`
//    (yuqoridagi `updateSettings`).

// ══ YOZUVLAR ════════════════════════════════════════════════

// GET /api/lc/support/bookings?date=&status=
exports.getBookings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    if (!ctx.isDirector && !ctx.permissions?.includes("manageGroups")) {
      query.teacher = ctx.staffId;
    }
    if (req.query.date) query.date = req.query.date;
    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const bookings = await SupportBooking.find(query)
      .populate("student", "name")
      .populate("teacher", "name")
      .sort({ date: -1, startTime: 1 })
      .limit(200)
      .lean();

    res.json({ success: true, bookings });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// PUT /api/lc/support/bookings/:bookingId
// Body: { status, note }
exports.updateBooking = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { status, note } = req.body;

    const allowed = ["confirmed", "cancelled", "done", "no_show"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Holat noto'g'ri" });
    }

    const booking = await SupportBooking.findOne({
      _id: req.params.bookingId,
      director: ctx.directorId, // ⚠️ boshqa markazning yozuviga tegmasin
    });
    if (!booking) {
      return res.status(404).json({ success: false, error: "Yozuv topilmadi" });
    }
    if (String(booking.teacher) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }

    const before = booking.status;

    if (status) {
      booking.status = status;
      if (status === "cancelled") {
        booking.cancelledAt = new Date();
        booking.cancelledBy = "crm";
      }
    }
    if (note !== undefined) booking.note = String(note).slice(0, 300);
    await booking.save();

    // Holat o'zgargandagina xabar — izoh tahriri uchun emas
    if (status && status !== before && ["confirmed", "cancelled"].includes(status)) {
      inBackground(notifyBooking, {
        directorId: ctx.directorId,
        bookingId: booking._id,
        status,
      });
    }

    res.json({ success: true, booking });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/support/bookings/:bookingId/qr ──────────────
// Ustoz o'quvchi kartochkasini bosganda ochiladigan QR.
// Interfeys buni har ~10 soniyada qayta so'raydi.
exports.getQr = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const booking = await SupportBooking.findOne({
      _id: req.params.bookingId,
      director: ctx.directorId,
    });
    if (!booking) {
      return res.status(404).json({ success: false, error: "Yozuv topilmadi" });
    }
    if (String(booking.teacher) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }
    if (booking.attendedAt) {
      return res.json({
        success: true,
        alreadyAttended: true,
        attendedAt: booking.attendedAt,
      });
    }
    if (!["pending", "confirmed"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, error: "Bu yozuv uchun QR berilmaydi" });
    }

    const t = currentToken(String(booking._id));
    res.json({
      success: true,
      payload: t.payload,
      expiresIn: t.expiresIn,
      windowSec: WINDOW_SEC,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// GET /api/lc/support/free?teacherId=&date=
// Xodim CRM'dan o'quvchi nomidan yozib qo'yishi uchun
exports.getFree = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { teacherId, date } = req.query;
    if (!teacherId || !date) {
      return res.status(400).json({ success: false, error: "teacherId va date majburiy" });
    }

    const slots = await freeSlots({
      directorId: ctx.directorId,
      teacherId,
      date,
    });
    res.json({ success: true, date, slots });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// POST /api/lc/support/bookings — xodim o'quvchi nomidan yozadi
exports.createBooking = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId, teacherId, date, startTime, topic } = req.body;
    if (!studentId || !teacherId || !date || !startTime) {
      return res.status(400).json({
        success: false,
        error: "studentId, teacherId, date, startTime majburiy",
      });
    }

    const student = await Student.findById(studentId).select("name");
    if (!student) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    }

    const { bookSlot } = require("../services/supportBooking");
    const result = await bookSlot({
      directorId: ctx.directorId,
      studentId,
      teacherId,
      date,
      startTime,
      topic,
      via: "crm",
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    // Xodim yozganda darhol tasdiqlangan hisoblanadi
    result.booking.status = "confirmed";
    await result.booking.save();

    res.status(201).json({ success: true, booking: result.booking });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
