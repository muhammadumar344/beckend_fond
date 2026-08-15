// src/controllers/staffAttendanceController.js
// ════════════════════════════════════════════════════════════
// Xodim davomati — CRM tomoni.
//
// ⚠️ EGASI — FILIAL BOSHQARUVCHISI. Direktor Toshkentda, ustoz
//    esa Samarqanddagi filialda kechikadi; buni kunda ko'radigan
//    odam o'sha filialda o'tiradi. Shuning uchun `manageStaff`
//    ruxsati talab qilinadi va ro'yxat filial bo'yicha
//    cheklanadi.
//
// ⚠️ Ustozning O'ZI o'zini "keldi" deb belgilay olmaydi. Bu
//    ataylab: o'zini o'zi belgilash — daftarga o'zi yozib
//    qo'yish bilan bir xil, hech qanday ma'no bermaydi.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const StaffAttendance = require("../models/StaffAttendance");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const svc = require("../services/staffAttendance");
const { todayInTashkent } = require("../utils/supportWindow");

const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));

/** Kim boshqara oladi — direktor yoki `manageStaff` li xodim */
const canManage = (ctx) =>
  Boolean(ctx.isDirector || ctx.permissions?.includes("manageStaff"));

// ── GET /api/lc/staff-attendance/settings ───────────────────
exports.getSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const director = await Teacher.findById(ctx.directorId)
      .select("staffAttendance")
      .lean();

    res.json({
      success: true,
      settings: svc.normalizeSettings(director?.staffAttendance),
      canEdit: canManage(ctx),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── PUT /api/lc/staff-attendance/settings ───────────────────
exports.updateSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    if (!canManage(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Bu sozlamani direktor yoki filial boshqaruvchisi o'zgartiradi",
      });
    }

    const director = await Teacher.findById(ctx.directorId);
    if (!director) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }

    const cur = svc.normalizeSettings(director.staffAttendance);
    const b = req.body || {};

    const workStart = b.workStart ?? cur.workStart;
    const graceMinutes = Number(b.graceMinutes ?? cur.graceMinutes);
    const latePenalty = Number(b.latePenalty ?? cur.latePenalty);
    const absentPenalty = Number(b.absentPenalty ?? cur.absentPenalty);

    if (!isTime(workStart)) {
      return res
        .status(400)
        .json({ success: false, error: "Vaqt HH:MM formatida bo'lsin" });
    }
    if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 60) {
      return res.status(400).json({
        success: false,
        error: "Kechikish chegarasi 0–60 daqiqa oralig'ida",
      });
    }
    for (const [name, v] of [
      ["Kechikish jarimasi", latePenalty],
      ["Kelmaganlik jarimasi", absentPenalty],
    ]) {
      if (!Number.isFinite(v) || v < 0) {
        return res
          .status(400)
          .json({ success: false, error: `${name} manfiy bo'lmasin` });
      }
    }

    director.staffAttendance = {
      enabled: b.enabled !== undefined ? Boolean(b.enabled) : cur.enabled,
      graceMinutes,
      workStart,
      latePenalty,
      absentPenalty,
    };
    await director.save();

    res.json({
      success: true,
      settings: svc.normalizeSettings(director.staffAttendance),
      message: "Saqlandi",
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/staff-attendance/day?date= ──────────────────
exports.getDay = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStaff");

    const date = req.query.date || todayInTashkent();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: "Sana noto'g'ri" });
    }

    const view = await svc.dayView({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
      date,
    });

    // ⚠️ Bugungi sana ham qaytariladi: interfeys "bugun"mi yoki
    //    o'tgan kunmi — shunga qarab tugmalarni yoqadi. Brauzer
    //    soatiga tayanib bo'lmaydi, u boshqa mintaqada bo'lishi
    //    mumkin.
    res.json({ success: true, today: todayInTashkent(), ...view });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── POST /api/lc/staff-attendance/mark ──────────────────────
exports.mark = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStaff");

    const { staffId, date, status, arrivedAt, note } = req.body || {};
    if (!staffId) {
      return res.status(400).json({ success: false, error: "Xodim tanlanmagan" });
    }
    const allowed = ["present", "late", "absent", "excused"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Holat noto'g'ri" });
    }
    if (arrivedAt && !isTime(arrivedAt)) {
      return res
        .status(400)
        .json({ success: false, error: "Vaqt HH:MM formatida bo'lsin" });
    }

    const r = await svc.mark({
      directorId: ctx.directorId,
      staffId,
      date,
      status,
      arrivedAt,
      note,
      markedBy: ctx.staffId || ctx.directorId,
    });

    if (!r.ok) {
      return res.status(r.status || 400).json({ success: false, error: r.error });
    }
    res.json({ success: true, record: r.record });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/staff-attendance/month?month=YYYY-MM ────────
//
// Maosh sahifasi shu yerdan raqam oladi.
exports.getMonth = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    // ⚠️ Xodim O'Z raqamlarini ko'ra oladi — "nega maoshim kam?"
    //    degan savolga javob unga ham kerak. Boshqalarniki uchun
    //    `manageStaff` shart.
    const mine = !canManage(ctx) && !ctx.permissions?.includes("manageSalaries");

    const month = req.query.month || svc.monthOf(todayInTashkent());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: "Oy noto'g'ri" });
    }

    const { settings, byStaff } = await svc.monthSummary({
      directorId: ctx.directorId,
      month,
      staffIds: mine && ctx.staffId ? [ctx.staffId] : null,
    });

    res.json({
      success: true,
      month,
      settings,
      // Map → obyekt (JSON Map ni tashiy olmaydi)
      byStaff: Object.fromEntries(byStaff),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
