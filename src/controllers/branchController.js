// src/controllers/branchController.js
const Branch = require("../models/Branch");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");

// ── Filial yaratish ──────────────────────────────────────────
exports.createBranch = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { name, address, phone, color } = req.body;

    if (!name?.trim())
      return res
        .status(400)
        .json({ success: false, error: "Filial nomi majburiy" });

    // Limit tekshirish (premium: 10, pro: 3, free: 1)
    const Teacher = require("../models/Teacher");
    const teacher = await Teacher.findById(teacherId);
    const plan = teacher?.activePlan() || "free";
    const limits = { free: 1, pro: 3, premium: 10 };

    const count = await Branch.countDocuments({
      teacher: teacherId,
      isActive: true,
    });
    if (count >= limits[plan]) {
      return res.status(403).json({
        success: false,
        error: `${plan.toUpperCase()} rejada maksimal ${limits[plan]} ta filial ochishingiz mumkin`,
        requiresUpgrade: true,
      });
    }

    const branch = await Branch.create({
      teacher: teacherId,
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      color: color || "#4299e1",
    });

    res
      .status(201)
      .json({ success: true, message: "Filial yaratildi", branch });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Barcha filiallar (statistika bilan) ──────────────────────
exports.getBranches = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const branches = await Branch.find({
      teacher: teacherId,
      isActive: true,
    }).sort({ createdAt: 1 });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const branchStats = await Promise.all(
      branches.map(async (b) => {
        const classes = await Class.find({ teacher: teacherId, branch: b._id });
        const classIds = classes.map((c) => c._id);

        const studentCount = await Student.countDocuments({
          class: { $in: classIds },
        });

        const payments = await MonthlyPayment.find({
          class: { $in: classIds },
          month: currentMonth,
          year: currentYear,
        });
        const paidPayments = payments.filter((p) => p.status === "paid");
        const collectedThisMonth = paidPayments.reduce(
          (s, p) => s + p.amount,
          0,
        );

        const allPaid = await MonthlyPayment.find({
          class: { $in: classIds },
          status: "paid",
        });
        const totalCollected = allPaid.reduce((s, p) => s + p.amount, 0);
        const totalInitial = classes.reduce(
          (s, c) => s + (c.initialBalance || 0),
          0,
        );

        const allExpenses = await Expense.find({
          teacher: teacherId,
          class: { $in: classIds },
        });
        const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);

        return {
          _id: b._id,
          name: b.name,
          address: b.address,
          phone: b.phone,
          color: b.color,
          classCount: classes.length,
          studentCount,
          paidCount: paidPayments.length,
          unpaidCount: payments.length - paidPayments.length,
          collectedThisMonth,
          totalCollected,
          totalInitial,
          totalExpenses,
          realBalance: totalInitial + totalCollected - totalExpenses,
          createdAt: b.createdAt,
        };
      }),
    );

    // Filialsiz sinflar (branch = null)
    const unassigned = await Class.find({ teacher: teacherId, branch: null });
    const unassignedIds = unassigned.map((c) => c._id);
    let unassignedStats = null;
    if (unassigned.length > 0) {
      const sc = await Student.countDocuments({
        class: { $in: unassignedIds },
      });
      unassignedStats = { classCount: unassigned.length, studentCount: sc };
    }

    res.json({
      success: true,
      branches: branchStats,
      unassigned: unassignedStats,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Filial yangilash ─────────────────────────────────────────
exports.updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, address, phone, color } = req.body;
    const teacherId = req.user.id;

    const branch = await Branch.findOne({ _id: branchId, teacher: teacherId });
    if (!branch)
      return res
        .status(404)
        .json({ success: false, error: "Filial topilmadi" });

    if (name) branch.name = name.trim();
    if (address !== undefined) branch.address = address.trim();
    if (phone !== undefined) branch.phone = phone.trim();
    if (color) branch.color = color;
    await branch.save();

    res.json({ success: true, message: "Filial yangilandi", branch });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Sinfni filiallga bog'lash ────────────────────────────────
exports.assignClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { branchId } = req.body; // null bo'lsa — filialsiz
    const teacherId = req.user.id;

    const cls = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        teacher: teacherId,
      });
      if (!branch)
        return res
          .status(404)
          .json({ success: false, error: "Filial topilmadi" });
    }

    cls.branch = branchId || null;
    await cls.save();

    res.json({
      success: true,
      message: branchId
        ? "Sinf filiallga biriktirildi"
        : "Sinf filialsiz qilindi",
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Filial o'chirish ─────────────────────────────────────────
exports.deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const teacherId = req.user.id;

    const branch = await Branch.findOne({ _id: branchId, teacher: teacherId });
    if (!branch)
      return res
        .status(404)
        .json({ success: false, error: "Filial topilmadi" });

    // Sinflarni filialsiz qilish (o'chirmay)
    await Class.updateMany(
      { teacher: teacherId, branch: branchId },
      { branch: null },
    );

    branch.isActive = false;
    await branch.save();

    res.json({
      success: true,
      message: "Filial o'chirildi. Sinflar saqlab qolindi.",
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.assignManager = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { staffId } = req.body; // null bo'lsa — managersiz qilish
    const directorId = req.user.id;

    const branch = await Branch.findOne({ _id: branchId, teacher: directorId });
    if (!branch)
      return res
        .status(404)
        .json({ success: false, error: "Filial topilmadi" });

    if (staffId) {
      const staff = await Staff.findOne({
        _id: staffId,
        director: directorId,
      }).populate("role");
      if (!staff)
        return res
          .status(404)
          .json({ success: false, error: "Xodim topilmadi" });
      if (staff.role.slug !== "branch_manager") {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Faqat "Branch Manager" rolidagi xodim tayinlanishi mumkin',
          });
      }
      // Staff ni shu filialga bog'lash
      staff.branch = branchId;
      await staff.save();
    }

    branch.manager = staffId || null;
    await branch.save();

    res.json({
      success: true,
      message: staffId ? "Manager tayinlandi" : "Manager olib tashlandi",
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Director: O'z-o'zini ham filial manageri qilish ──────────
exports.becomeManagerToo = async (req, res) => {
  try {
    const { branchId } = req.params;
    const directorId = req.user.id;

    const branch = await Branch.findOne({ _id: branchId, teacher: directorId });
    if (!branch)
      return res
        .status(404)
        .json({ success: false, error: "Filial topilmadi" });

    branch.directorIsManager = true;
    await branch.save();

    res.json({
      success: true,
      message: "Endi siz ham bu filial manageri hisoblanasiz",
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
