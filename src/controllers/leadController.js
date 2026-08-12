// src/controllers/leadController.js
// Lidlar (CRM voronkasi) — qiziqish bildirgan mijozdan o'quvchigacha
const Lead = require("../models/Lead");
const Class = require("../models/Class");
const Student = require("../models/Student");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");
const { PLAN_LIMITS, canAddStudent } = require("../utils/planHelper");

const STATUSES = Lead.STATUSES;

/**
 * Lidlarni KO'RISH uchun 'viewLeads' yoki 'manageLeads' dan biri yetarli.
 * requirePermission bitta huquqni tekshiradi, shuning uchun alohida helper.
 */
function requireLeadRead(ctx) {
  if (ctx.isDirector) return;
  const perms = Array.isArray(ctx.permissions) ? ctx.permissions : [];
  if (!perms.includes("viewLeads") && !perms.includes("manageLeads")) {
    const err = new Error("Ruxsat yo'q: \"viewLeads\" huquqi kerak");
    err.status = 403;
    throw err;
  }
}

/** Filialga biriktirilgan xodim faqat o'z filiali lidlarini ko'radi */
function scopeQuery(ctx, extra = {}) {
  const query = { director: ctx.directorId, ...extra };
  if (ctx.branchFilter) query.branch = ctx.branchFilter;
  return query;
}

// ── RO'YXAT + VORONKA STATISTIKASI ───────────────────────────
// GET /api/lc/leads?status=&q=&branchId=
const getLeads = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requireLeadRead(ctx);

    const query = scopeQuery(ctx);

    // Direktor filial bo'yicha filtrlashi mumkin
    if (req.query.branchId && ctx.isDirector) query.branch = req.query.branchId;
    if (req.query.status && STATUSES.includes(req.query.status)) {
      query.status = req.query.status;
    }

    // Ism yoki telefon bo'yicha qidiruv
    const q = (req.query.q || "").trim();
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query)
      .populate("subject", "name")
      .populate("branch", "name color")
      .populate("assignedTo", "name")
      .populate("convertedStudent", "name")
      .sort({ updatedAt: -1 });

    // Voronka statistikasi — qidiruv/status filtridan mustaqil
    const all = await Lead.find(scopeQuery(ctx)).select("status createdAt");
    const byStatus = STATUSES.reduce((acc, s) => {
      acc[s] = all.filter((l) => l.status === s).length;
      return acc;
    }, {});

    const closed = byStatus.won + byStatus.lost;

    res.json({
      success: true,
      leads,
      stats: {
        total: all.length,
        byStatus,
        // Yopilgan lidlardan nechtasi o'quvchiga aylandi
        conversionRate: closed > 0 ? Math.round((byStatus.won / closed) * 100) : 0,
        active: all.length - closed,
      },
    });
  } catch (err) {
    console.error("getLeads error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── YARATISH ──────────────────────────────────────────────────
// POST /api/lc/leads
const createLead = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageLeads");

    const { name, phone, source, subjectId, note, trialDate, branchId, status } =
      req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Ism majburiy" });
    }
    if (!phone || !phone.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Telefon raqam majburiy" });
    }
    if (status && !STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ success: false, error: "Noto'g'ri status" });
    }

    // Xodim o'z filialiga biriktiradi, direktor tanlashi mumkin
    const branch = ctx.branchFilter || branchId || null;

    // Bir xil raqam bilan ochiq lid bo'lsa — bloklamaymiz, ogohlantiramiz
    const duplicate = await Lead.findOne(
      scopeQuery(ctx, {
        phone: phone.trim(),
        status: { $nin: ["won", "lost"] },
      }),
    ).select("name status");

    const lead = await Lead.create({
      director: ctx.directorId,
      branch,
      name: name.trim(),
      phone: phone.trim(),
      source: source || "other",
      status: status || "new",
      subject: subjectId || null,
      note: (note || "").trim(),
      trialDate: trialDate ? new Date(trialDate) : null,
      assignedTo: ctx.staffId || null,
    });

    res.status(201).json({
      success: true,
      message: "Lid qo'shildi",
      lead,
      duplicateWarning: duplicate
        ? `Bu raqam bilan ochiq lid allaqachon bor: ${duplicate.name}`
        : null,
    });
  } catch (err) {
    console.error("createLead error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── YANGILASH (status o'zgartirish ham shu yerda) ─────────────
// PUT /api/lc/leads/:leadId
const updateLead = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageLeads");

    const lead = await Lead.findOne(scopeQuery(ctx, { _id: req.params.leadId }));
    if (!lead) {
      return res.status(404).json({ success: false, error: "Lid topilmadi" });
    }

    const { name, phone, source, status, subjectId, note, trialDate, lostReason } =
      req.body;

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, error: "Noto'g'ri status" });
      }
      // 'won' faqat convert orqali qo'yiladi — o'quvchi yaratilishi shart
      if (status === "won" && !lead.convertedStudent) {
        return res.status(400).json({
          success: false,
          error: "'Yozildi' holati uchun lidni o'quvchiga aylantiring",
        });
      }
      if (status !== "new" && lead.status === "new") {
        lead.lastContactedAt = new Date();
      }
      lead.status = status;
    }

    if (name !== undefined && name.trim()) lead.name = name.trim();
    if (phone !== undefined && phone.trim()) lead.phone = phone.trim();
    if (source !== undefined) lead.source = source;
    if (subjectId !== undefined) lead.subject = subjectId || null;
    if (note !== undefined) lead.note = note.trim();
    if (lostReason !== undefined) lead.lostReason = lostReason.trim();
    if (trialDate !== undefined) {
      lead.trialDate = trialDate ? new Date(trialDate) : null;
    }

    await lead.save();
    await lead.populate([
      { path: "subject", select: "name" },
      { path: "branch", select: "name color" },
      { path: "assignedTo", select: "name" },
      { path: "convertedStudent", select: "name" },
    ]);

    res.json({ success: true, message: "Lid yangilandi", lead });
  } catch (err) {
    console.error("updateLead error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── O'CHIRISH ─────────────────────────────────────────────────
// DELETE /api/lc/leads/:leadId
const deleteLead = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageLeads");

    const lead = await Lead.findOneAndDelete(
      scopeQuery(ctx, { _id: req.params.leadId }),
    );
    if (!lead) {
      return res.status(404).json({ success: false, error: "Lid topilmadi" });
    }

    res.json({ success: true, message: "Lid o'chirildi" });
  } catch (err) {
    console.error("deleteLead error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── O'QUVCHIGA AYLANTIRISH ────────────────────────────────────
// POST /api/lc/leads/:leadId/convert   Body: { classId }
const convertLead = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageLeads");

    const lead = await Lead.findOne(scopeQuery(ctx, { _id: req.params.leadId }));
    if (!lead) {
      return res.status(404).json({ success: false, error: "Lid topilmadi" });
    }
    if (lead.convertedStudent) {
      return res
        .status(400)
        .json({ success: false, error: "Bu lid allaqachon o'quvchiga aylantirilgan" });
    }

    const { classId } = req.body;
    if (!classId) {
      return res
        .status(400)
        .json({ success: false, error: "Guruhni tanlang (classId majburiy)" });
    }

    const classQuery = { _id: classId, teacher: ctx.directorId };
    if (ctx.branchFilter) classQuery.branch = ctx.branchFilter;
    const cls = await Class.findOne(classQuery);
    if (!cls) {
      return res
        .status(404)
        .json({ success: false, error: "Guruh topilmadi yoki ruxsat yo'q" });
    }

    // Tarif limitini o'quvchi qo'shish bilan bir xil tekshiramiz
    const studentCount = await Student.countDocuments({ class: classId });
    if (!canAddStudent(cls.plan, studentCount)) {
      const limit = PLAN_LIMITS[cls.plan] || PLAN_LIMITS.free;
      return res.status(403).json({
        success: false,
        error: `Bu guruhga maksimal ${limit.students} ta o'quvchi qo'shish mumkin`,
        requiresUpgrade: true,
      });
    }

    const student = await Student.create({
      name: lead.name,
      class: classId,
      parentPhone: lead.phone,
      rollNumber: studentCount + 1,
    });

    lead.convertedStudent = student._id;
    lead.status = "won";
    await lead.save();

    res.status(201).json({
      success: true,
      message: `${lead.name} "${cls.name}" guruhiga o'quvchi sifatida qo'shildi`,
      lead,
      student,
    });
  } catch (err) {
    console.error("convertLead error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  convertLead,
};
