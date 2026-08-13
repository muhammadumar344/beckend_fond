// src/controllers/branchController.js
const Branch = require("../models/Branch");
const Class = require("../models/Class");
const Student = require("../models/Student");
const { countUniqueStudents } = require("../utils/enrollment");
const Staff = require("../models/Staff");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const Attendance = require("../models/Attendance"); // ✅ LC statistikasi uchun
const Lead = require("../models/Lead");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");

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

// ── LC: filiallar bo'yicha to'liq statistika ─────────────────
// GET /api/lc/branches/stats?month=&year=
// Fond'dagi getBranches faqat moliyani beradi. LC uchun xodimlar, davomat
// va lidlar ham kerak — filiallarni solishtirish shu yerdan.
exports.getBranchStats = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewBranchStats");

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    // Filialga biriktirilgan xodim faqat o'z filialini ko'radi
    const branchQuery = { teacher: ctx.directorId, isActive: true };
    if (ctx.branchFilter) branchQuery._id = ctx.branchFilter;

    const branches = await Branch.find(branchQuery).sort({ createdAt: 1 });

    // Oyning davomat yozuvlari uchun sana oralig'i (YYYY-MM-DD matn)
    const mm = String(month).padStart(2, "0");
    const monthPrefix = `${year}-${mm}`;

    const stats = await Promise.all(
      branches.map(async (b) => {
        const classes = await Class.find({
          teacher: ctx.directorId,
          branch: b._id,
        }).select("_id capacity");
        const classIds = classes.map((c) => c._id);

        const [studentCount, staffCount, payments, expenses, attendance, leads] =
          await Promise.all([
            countUniqueStudents(classIds),
            Staff.countDocuments({
              director: ctx.directorId,
              branch: b._id,
              isActive: true,
            }),
            MonthlyPayment.find({
              class: { $in: classIds },
              month,
              year,
            }).select("amount status"),
            Expense.find({ class: { $in: classIds }, month, year }).select(
              "amount",
            ),
            Attendance.find({
              class: { $in: classIds },
              date: { $regex: `^${monthPrefix}` },
            }).select("status"),
            Lead.countDocuments({
              director: ctx.directorId,
              branch: b._id,
              status: { $nin: ["won", "lost"] },
            }),
          ]);

        const collected = payments
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amount, 0);
        const expected = payments.reduce((s, p) => s + p.amount, 0);
        const spent = expenses.reduce((s, e) => s + e.amount, 0);

        const present = attendance.filter(
          (a) => a.status === "present" || a.status === "late",
        ).length;

        // Sig'im belgilangan guruhlar bo'yicha to'ldirilish
        const withCapacity = classes.filter((c) => c.capacity > 0);
        const totalCapacity = withCapacity.reduce(
          (s, c) => s + (c.capacity || 0),
          0,
        );

        return {
          id: b._id,
          name: b.name,
          address: b.address || "",
          phone: b.phone || "",
          color: b.color || "#4299e1",
          groupCount: classes.length,
          studentCount,
          staffCount,
          activeLeads: leads,
          collected,
          expected,
          expenses: spent,
          profit: collected - spent,
          collectRate:
            expected > 0 ? Math.round((collected / expected) * 100) : 0,
          attendanceRate: attendance.length
            ? Math.round((present / attendance.length) * 100)
            : null,
          // Sig'im belgilanmagan bo'lsa null — 0% deb ko'rsatish yolg'on bo'lardi
          fillRate:
            totalCapacity > 0
              ? Math.round(
                  (studentCount / totalCapacity) * 100,
                )
              : null,
        };
      }),
    );

    // Filialsiz guruhlar — Direktor uchun ko'rinadi
    let unassigned = null;
    if (!ctx.branchFilter) {
      const orphanClasses = await Class.find({
        teacher: ctx.directorId,
        branch: null,
      }).select("_id");
      if (orphanClasses.length) {
        unassigned = {
          groupCount: orphanClasses.length,
          studentCount: await Student.countDocuments({
            class: { $in: orphanClasses.map((c) => c._id) },
          }),
        };
      }
    }

    const totals = stats.reduce(
      (acc, s) => ({
        groupCount: acc.groupCount + s.groupCount,
        studentCount: acc.studentCount + s.studentCount,
        staffCount: acc.staffCount + s.staffCount,
        collected: acc.collected + s.collected,
        expenses: acc.expenses + s.expenses,
      }),
      { groupCount: 0, studentCount: 0, staffCount: 0, collected: 0, expenses: 0 },
    );

    res.json({
      success: true,
      period: { month, year },
      branches: stats,
      unassigned,
      totals: { ...totals, profit: totals.collected - totals.expenses },
    });
  } catch (err) {
    console.error("getBranchStats error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
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
