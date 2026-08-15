// src/controllers/supportController.js
// ════════════════════════════════════════════════════════════
// Qo'shimcha mashg'ulot — CRM tomoni.
//
// Ustoz/xodim shu yerdan qabul vaqtini belgilaydi va kelgan
// yozuvlarni tasdiqlaydi. O'quvchi tomoni — tmaController.js
// ════════════════════════════════════════════════════════════

const SupportSlot = require("../models/SupportSlot");
const SupportBooking = require("../models/SupportBooking");
const Staff = require("../models/Staff");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { freeSlots, toMin } = require("../utils/supportSlots");
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
      .select("supportEnabled")
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

// PUT /api/lc/support/settings  { enabled }
exports.updateSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const enabled = Boolean(req.body?.enabled);

    const director = await Teacher.findById(ctx.directorId);
    if (!director) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }

    director.supportEnabled = enabled;
    await director.save();

    // ⚠️ O'chirilganda mavjud yozuvlar TEGILMAYDI. Ular tarixda
    //    qoladi va o'quvchilar allaqachon kelishga rozi bo'lgan.
    //    Yangi yozilish esa `requireSupport` bilan to'siladi.
    res.json({
      success: true,
      enabled,
      message: enabled ? "Xizmat yoqildi" : "Xizmat o'chirildi",
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ══ QABUL VAQTLARI ══════════════════════════════════════════

// GET /api/lc/support/slots
exports.getSlots = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    // Xodim faqat o'z qabul vaqtini ko'radi (agar boshqarish
    // huquqi bo'lmasa)
    if (!ctx.isDirector && !ctx.permissions?.includes("manageGroups")) {
      query.teacher = ctx.staffId;
    }

    const slots = await SupportSlot.find(query)
      .populate("teacher", "name")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    res.json({
      success: true,
      slots: slots.map((s) => ({
        ...s,
        dayName: DAY_NAMES[s.dayOfWeek],
      })),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// POST /api/lc/support/slots
exports.createSlot = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { teacherId, dayOfWeek, startTime, endTime, slotMinutes } = req.body;

    // ⚠️ Xodim O'ZIGA qabul vaqti qo'sha oladi. Boshqa ustozga
    //    qo'yish uchun `manageGroups` kerak — aks holda har kim
    //    hammaning jadvaliga aralashardi.
    const target = teacherId || ctx.staffId;
    if (String(target) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }
    if (!target) {
      return res.status(400).json({ success: false, error: "Ustoz tanlanmagan" });
    }

    const day = Number(dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return res.status(400).json({ success: false, error: "Hafta kuni noto'g'ri" });
    }
    if (!isTime(startTime) || !isTime(endTime)) {
      return res.status(400).json({ success: false, error: "Vaqt HH:MM formatida bo'lsin" });
    }
    if (toMin(endTime) <= toMin(startTime)) {
      return res.status(400).json({ success: false, error: "Tugash vaqti boshlanishdan keyin bo'lsin" });
    }

    const step = Number(slotMinutes) || 30;
    if (toMin(endTime) - toMin(startTime) < step) {
      return res.status(400).json({
        success: false,
        error: "Oraliq bitta uchrashuvga ham yetmaydi",
      });
    }

    // Ustoz shu markazniki ekanini tasdiqlaymiz
    const staff = await Staff.findOne({
      _id: target,
      director: ctx.directorId,
    }).select("branch");
    if (!staff) {
      return res.status(404).json({ success: false, error: "Ustoz topilmadi" });
    }

    // ⚠️ Qabul vaqti FAQAT support rolidagi xodimga qo'yiladi.
    //    Bo'lmasa vaqt yozilardi-yu, o'quvchi ro'yxatida u
    //    ko'rinmasdi (ro'yxat rolga qarab tuziladi) — direktor
    //    esa "nega ishlamayapti?" deb sababini topolmasdi.
    const { isSupportStaff } = require("../services/supportStaff");
    if (!(await isSupportStaff(ctx.directorId, target))) {
      return res.status(400).json({
        success: false,
        error:
          "Bu xodim support ustozi emas. Xodimlar bo'limida uning rolini " +
          "\"Support Teacher\" ga o'zgartiring.",
      });
    }

    const slot = await SupportSlot.create({
      director: ctx.directorId,
      branch: staff.branch || null,
      teacher: target,
      dayOfWeek: day,
      startTime,
      endTime,
      slotMinutes: step,
    });

    res.status(201).json({ success: true, slot });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// DELETE /api/lc/support/slots/:slotId
exports.deleteSlot = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const slot = await SupportSlot.findOne({
      _id: req.params.slotId,
      director: ctx.directorId,
    });
    if (!slot) {
      return res.status(404).json({ success: false, error: "Qabul vaqti topilmadi" });
    }
    if (String(slot.teacher) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }

    await slot.deleteOne();
    res.json({ success: true, message: "O'chirildi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

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
