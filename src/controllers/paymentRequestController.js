// src/controllers/paymentRequestController.js
const PaymentRequest = require("../models/PaymentRequest");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
// ✅ XATO TUZATILDI: applyReferralBonus import qilinmagan edi
const { applyReferralBonus } = require("./referralController");

// ⚠️ Narx REJIMGA bog'liq (Fond va LC har xil) — qattiq yozilgan
// jadval LC direktoridan Fond narxini undirardi. Yagona manba:
// utils/planHelper.js
const { priceFor } = require("../utils/planHelper");

// ── TEACHER: So'rov yuborish ─────────────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { plan, months = 1, screenshot } = req.body;

    if (!["pro", "premium"].includes(plan)) {
      return res.status(400).json({ success: false, error: "Plan: 'pro' yoki 'premium'" });
    }
    if (!screenshot || !screenshot.startsWith("data:image/")) {
      return res.status(400).json({ success: false, error: "Screenshot (rasm) majburiy" });
    }

    const sizeBytes = Math.round((screenshot.length * 3) / 4);
    if (sizeBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: "Rasm hajmi 2MB dan oshmasligi kerak" });
    }

    const existing = await PaymentRequest.findOne({ teacher: teacherId, status: "pending" });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Sizda allaqachon kutilayotgan so'rov mavjud. Admin ko'rib chiqsin.",
      });
    }

    // Narx direktorning rejimiga qarab olinadi (Fond ≠ LC)
    const teacherDoc = await Teacher.findById(teacherId).select(
      "institutionType",
    );
    const amount = (priceFor(plan, teacherDoc)?.monthly || 0) * Number(months);

    const request = await PaymentRequest.create({
      teacher: teacherId,
      plan,
      months: Number(months),
      screenshot,
      screenshotSize: sizeBytes,
      amount,
    });

    res.status(201).json({
      success: true,
      message: "So'rov yuborildi! Admin ko'rib chiqadi.",
      request: {
        _id: request._id,
        plan: request.plan,
        months: request.months,
        amount: request.amount,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (e) {
    console.error("createRequest error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── TEACHER: O'z so'rovlarini ko'rish ────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await PaymentRequest.find({ teacher: req.user.id })
      .select("-screenshot")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, requests });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── ADMIN: Barcha so'rovlar ──────────────────────────────────
exports.getAllRequests = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const filter = {};
    if (status !== "all") filter.status = status;

    const requests = await PaymentRequest.find(filter)
      .populate("teacher", "name email plan planExpiresAt institutionName city")
      .select("-screenshot")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: requests.length, requests });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── ADMIN: Screenshotni alohida olish ────────────────────────
exports.getScreenshot = async (req, res) => {
  try {
    const request = await PaymentRequest.findById(req.params.id).select("screenshot teacher");
    if (!request) return res.status(404).json({ success: false, error: "So'rov topilmadi" });
    res.json({ success: true, screenshot: request.screenshot });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── ADMIN: Tasdiqlash ────────────────────────────────────────
exports.approveRequest = async (req, res) => {
  try {
    const { adminNote = "" } = req.body;

    const request = await PaymentRequest.findById(req.params.id).populate("teacher");
    if (!request) return res.status(404).json({ success: false, error: "So'rov topilmadi" });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, error: "Bu so'rov allaqachon ko'rib chiqilgan" });
    }

    const teacher = await Teacher.findById(request.teacher._id);
    if (!teacher) return res.status(404).json({ success: false, error: "Teacher topilmadi" });

    const base = teacher.isPlanActive() && teacher.plan === request.plan
      ? teacher.planExpiresAt
      : new Date();

    const newExpiry = new Date(base);
    newExpiry.setMonth(newExpiry.getMonth() + request.months);

    teacher.plan = request.plan;
    teacher.planExpiresAt = newExpiry;

    const planRank = { free: 0, pro: 1, premium: 2 };
    if (planRank[request.plan] > planRank[teacher.highestPlanEver || "free"]) {
      teacher.highestPlanEver = request.plan;
    }
    await teacher.save();

    // ✅ Referral bonus — endi to'g'ri import qilingan
    const prevApproved = await PaymentRequest.countDocuments({
      teacher: request.teacher._id,
      status: "approved",
      _id: { $ne: request._id },
    });
    if (prevApproved === 0 && teacher.referredBy) {
      await applyReferralBonus(teacher._id);
    }

    await Class.updateMany({ teacher: teacher._id }, { plan: request.plan });

    request.status = "approved";
    request.adminNote = adminNote.trim();
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    res.json({
      success: true,
      message: `✅ Tasdiqlandi! ${teacher.name} uchun ${request.plan.toUpperCase()} ${request.months} oyga faollashtirildi.`,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        plan: teacher.plan,
        planExpiresAt: teacher.planExpiresAt,
        daysLeft: teacher.daysLeft(),
      },
    });
  } catch (e) {
    console.error("approveRequest error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── ADMIN: Rad etish ─────────────────────────────────────────
exports.rejectRequest = async (req, res) => {
  try {
    const { adminNote = "" } = req.body;

    const request = await PaymentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "So'rov topilmadi" });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, error: "Bu so'rov allaqachon ko'rib chiqilgan" });
    }

    request.status = "rejected";
    request.adminNote = adminNote.trim() || "To'lov tasdiqlanmadi";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    res.json({ success: true, message: "So'rov rad etildi." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── ADMIN: Statistika ─────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      PaymentRequest.countDocuments({ status: "pending" }),
      PaymentRequest.countDocuments({ status: "approved" }),
      PaymentRequest.countDocuments({ status: "rejected" }),
    ]);

    const totalRevenue = await PaymentRequest.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      stats: { pending, approved, rejected, totalRevenue: totalRevenue[0]?.total || 0 },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};