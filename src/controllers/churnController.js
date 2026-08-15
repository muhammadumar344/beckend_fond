// src/controllers/churnController.js
// ════════════════════════════════════════════════════════════
// "Ketish arafasida" ro'yxati — CRM tomoni.
//
// ⚠️ `viewStudents` yetarli: bu ro'yxatga qarash zarar
//    keltirmaydi va qancha ko'p odam ko'rsa, shuncha yaxshi.
//    "Qo'ng'iroq qildim" belgisi uchun esa `manageStudents`
//    kerak — u boshqalarning ro'yxatidan ism o'chiradi.
// ════════════════════════════════════════════════════════════

const { resolveContext, requirePermission } = require("../utils/resolveContext");
const svc = require("../services/churnRisk");

// ── GET /api/lc/at-risk ─────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewStudents");

    const rows = await svc.atRisk({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
      includeContacted: req.query.all === "1",
    });

    res.json({
      success: true,
      students: rows,
      count: rows.filter((r) => !r.contacted).length,
      rules: {
        streakAlert: svc.STREAK_ALERT,
        windowLessons: svc.WINDOW_LESSONS,
        missedAlert: svc.MISSED_ALERT,
        snoozeDays: svc.SNOOZE_DAYS,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── POST /api/lc/at-risk/:studentId/contacted ───────────────
exports.markContacted = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const r = await svc.markContacted({
      directorId: ctx.directorId,
      studentId: req.params.studentId,
    });
    if (!r.ok) {
      return res.status(r.status || 400).json({ success: false, error: r.error });
    }

    res.json({ success: true, message: "Belgilandi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
