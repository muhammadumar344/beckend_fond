// src/controllers/groupController.js
// ✅ YANGI — O'quv markazi (LC) uchun "Guruh" API'si.
// Ichkarida Class kolleksiyasidan foydalanadi (Fond bilan bir xil jadval,
// lekin bu route'lar requireLCMode orqali faqat LC muassasalarga ochiq —
// routes/lc.js'da), shu sabab hech qanday ma'lumot ko'chirish (migration)
// shart emas. Class'dagi subject/assignedTeacher/capacity maydonlari
// FAQAT shu controller orqali to'ldiriladi.

const Class = require("../models/Class");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const Staff = require("../models/Staff");
const Schedule = require("../models/Schedule");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const Teacher = require("../models/Teacher"); // ✅ YANGI
const XLSX = require("xlsx"); // ✅ YANGI
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { findTeacherConflicts } = require("../utils/teacherAvailability");
const { hasFeature } = require("../utils/planHelper"); // ✅ YANGI

const DAY_NAMES = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

// ── Tayinlash uchun ustozlar ro'yxati ───────────────────────────
exports.getAvailableTeachers = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const query = { director: ctx.directorId, isActive: true };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const staff = await Staff.find(query)
      .populate("role", "name slug")
      .select("name email role branch")
      .sort({ name: 1 });

    res.json({
      success: true,
      teachers: staff.map((s) => ({
        id: s._id,
        name: s.name,
        email: s.email,
        roleName: s.role?.name || "",
        roleSlug: s.role?.slug || "",
      })),
    });
  } catch (err) {
    console.error("getAvailableTeachers error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Ustoz bandligini oldindan tekshirish (forma to'ldirilayotganda) ──
exports.checkAvailability = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { teacherId, daysOfWeek, startTime, endTime, excludeGroupId } =
      req.body;

    const conflicts = await findTeacherConflicts({
      teacherId,
      directorId: ctx.directorId,
      daysOfWeek,
      startTime,
      endTime,
      excludeClassId: excludeGroupId || null,
    });

    res.json({ success: true, available: conflicts.length === 0, conflicts });
  } catch (err) {
    console.error("checkAvailability error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Guruh yaratish ───────────────────────────────────────────────
exports.createGroup = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");

    const {
      name,
      subjectId,
      branchId,
      assignedTeacherId,
      price,
      capacity,
      daysOfWeek, // number[] 0-6, ixtiyoriy
      startTime, // "18:00", ixtiyoriy
      endTime, // "19:30", ixtiyoriy
      force, // true bo'lsa, ustoz band bo'lsa ham davom etadi
    } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Guruh nomi majburiy" });
    }
    if (price === undefined || Number(price) < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Narx to'g'ri kiritilmagan" });
    }

    let subjectDoc = null;
    if (subjectId) {
      subjectDoc = await Subject.findOne({
        _id: subjectId,
        director: ctx.directorId,
      });
      if (!subjectDoc) {
        return res
          .status(404)
          .json({ success: false, error: "Fan topilmadi" });
      }
    }

    if (assignedTeacherId) {
      const teacherDoc = await Staff.findOne({
        _id: assignedTeacherId,
        director: ctx.directorId,
        isActive: true,
      });
      if (!teacherDoc) {
        return res
          .status(404)
          .json({ success: false, error: "Ustoz topilmadi" });
      }
    }

    const hasSchedule = daysOfWeek?.length && startTime && endTime;

    // ✅ Ustoz bandligini tekshirish — "force" berilmasa, band bo'lsa to'xtaydi
    let conflicts = [];
    if (hasSchedule && assignedTeacherId) {
      conflicts = await findTeacherConflicts({
        teacherId: assignedTeacherId,
        directorId: ctx.directorId,
        daysOfWeek,
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
    }
    if (hasSchedule && !assignedTeacherId) {
      return res.status(400).json({
        success: false,
        error: "Jadval belgilash uchun avval ustoz tayinlang",
      });
    }

    const resolvedBranch = ctx.branchFilter || branchId || null;

    const newGroup = new Class({
      name: name.trim(),
      teacher: ctx.directorId,
      defaultAmount: Number(price),
      subject: subjectDoc?._id || null,
      assignedTeacher: assignedTeacherId || null,
      capacity: capacity ? Number(capacity) : null,
      branch: resolvedBranch,
    });
    await newGroup.save();

    let createdSchedule = [];
    if (hasSchedule && assignedTeacherId) {
      createdSchedule = await Promise.all(
        daysOfWeek.map((d) =>
          new Schedule({
            class: newGroup._id,
            teacher: assignedTeacherId,
            dayOfWeek: d,
            startTime,
            endTime,
            subject: subjectDoc?.name || "",
          }).save(),
        ),
      );
    }

    res.status(201).json({
      success: true,
      message: "Guruh yaratildi",
      group: {
        ...newGroup.toObject(),
        subject: subjectDoc
          ? { id: subjectDoc._id, name: subjectDoc.name, color: subjectDoc.color }
          : null,
      },
      schedule: createdSchedule,
      conflictsIgnored: force ? conflicts : [],
    });
  } catch (err) {
    console.error("createGroup error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Guruhlar ro'yxati ────────────────────────────────────────────
exports.getGroups = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const query = { teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    // ✅ YANGI — ?mine=true: faqat shu xodim ustoz sifatida tayinlangan
    // guruhlar ("Ustoz o'z guruhlarini ko'ra olishi kerak")
    if (req.query.mine === "true" && req.user.role === "staff") {
      query.assignedTeacher = req.user.id;
    }

    const groups = await Class.find(query)
      .populate("subject", "name color")
      .populate("assignedTeacher", "name")
      .populate("branch", "name color")
      .sort({ createdAt: -1 });

    const withDetails = await Promise.all(
      groups.map(async (g) => {
        const now = new Date();
        const [studentCount, schedule, monthPayments] = await Promise.all([
          Student.countDocuments({ class: g._id }),
          Schedule.find({ class: g._id, isActive: { $ne: false } }).sort({
            dayOfWeek: 1,
          }),
          MonthlyPayment.find({
            class: g._id,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "paid",
          }),
        ]);
        const collectedThisMonth = monthPayments.reduce((s, p) => s + p.amount, 0);
        return {
          ...g.toObject(),
          studentCount,
          collectedThisMonth,
          schedule: schedule.map((s) => ({
            id: s._id,
            day: DAY_NAMES[s.dayOfWeek],
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        };
      }),
    );

    res.json({ success: true, groups: withDetails });
  } catch (err) {
    console.error("getGroups error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Bitta guruh (batafsil) ───────────────────────────────────────
exports.getGroupById = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { groupId } = req.params;

    const query = { _id: groupId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const group = await Class.findOne(query)
      .populate("subject", "name color")
      .populate("assignedTeacher", "name email")
      .populate("branch", "name color");
    if (!group)
      return res
        .status(404)
        .json({ success: false, error: "Guruh topilmadi" });

    const [studentCount, schedule] = await Promise.all([
      Student.countDocuments({ class: group._id }),
      Schedule.find({ class: group._id, isActive: { $ne: false } }).sort({
        dayOfWeek: 1,
      }),
    ]);

    res.json({
      success: true,
      group: {
        ...group.toObject(),
        studentCount,
        schedule: schedule.map((s) => ({
          id: s._id,
          day: DAY_NAMES[s.dayOfWeek],
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      },
    });
  } catch (err) {
    console.error("getGroupById error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Guruhni tahrirlash (nomi/fan/ustoz/narx/sig'im) ──────────────
exports.updateGroup = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");
    const { groupId } = req.params;
    const { name, subjectId, assignedTeacherId, price, capacity, force } =
      req.body;

    const query = { _id: groupId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const group = await Class.findOne(query);
    if (!group)
      return res
        .status(404)
        .json({ success: false, error: "Guruh topilmadi" });

    if (name !== undefined) {
      if (!name.trim())
        return res
          .status(400)
          .json({ success: false, error: "Guruh nomi bo'sh bo'lishi mumkin emas" });
      group.name = name.trim();
    }
    if (price !== undefined) {
      if (Number(price) < 0)
        return res
          .status(400)
          .json({ success: false, error: "Narx to'g'ri emas" });
      group.defaultAmount = Number(price);
    }
    if (capacity !== undefined) group.capacity = capacity ? Number(capacity) : null;

    if (subjectId !== undefined) {
      if (subjectId) {
        const subjectDoc = await Subject.findOne({
          _id: subjectId,
          director: ctx.directorId,
        });
        if (!subjectDoc)
          return res
            .status(404)
            .json({ success: false, error: "Fan topilmadi" });
        group.subject = subjectDoc._id;
      } else {
        group.subject = null;
      }
    }

    let conflicts = [];
    if (assignedTeacherId !== undefined) {
      if (assignedTeacherId) {
        const teacherDoc = await Staff.findOne({
          _id: assignedTeacherId,
          director: ctx.directorId,
          isActive: true,
        });
        if (!teacherDoc)
          return res
            .status(404)
            .json({ success: false, error: "Ustoz topilmadi" });

        // Guruhning MAVJUD jadvali bo'yicha yangi ustozni tekshiramiz
        const existingSchedule = await Schedule.find({
          class: group._id,
          isActive: { $ne: false },
        });
        for (const slot of existingSchedule) {
          const slotConflicts = await findTeacherConflicts({
            teacherId: assignedTeacherId,
            directorId: ctx.directorId,
            daysOfWeek: [slot.dayOfWeek],
            startTime: slot.startTime,
            endTime: slot.endTime,
            excludeClassId: group._id,
          });
          conflicts.push(...slotConflicts);
        }
        if (conflicts.length && !force) {
          return res.status(409).json({
            success: false,
            error: "Ustoz guruhning jadvalidagi vaqt(lar)da band",
            conflicts,
          });
        }
        group.assignedTeacher = teacherDoc._id;
        // ✅ Mavjud jadval slotlarini ham yangi ustozga o'tkazamiz
        await Schedule.updateMany(
          { class: group._id, isActive: { $ne: false } },
          { teacher: teacherDoc._id },
        );
      } else {
        group.assignedTeacher = null;
      }
    }

    await group.save();
    res.json({ success: true, message: "Guruh yangilandi", group });
  } catch (err) {
    console.error("updateGroup error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Dashboard uchun REAL statistika ──────────────────────────────
// ✅ YANGI — avval frontend /teacher/dashboard (Fond'ga mo'ljallangan)
// javobidan foydalanardi va bugungi davomat/o'qituvchilar soni kabi
// maydonlar UMUMAN kelmagani uchun 0 / qattiq yozilgan 1 ko'rsatilardi.
exports.getDashboardStats = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const query = { teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const groups = await Class.find(query);
    const groupIds = groups.map((g) => g._id);
    const todayStr = new Date().toISOString().slice(0, 10);

    const staffQuery = { director: ctx.directorId, isActive: true };
    if (ctx.branchFilter) staffQuery.branch = ctx.branchFilter;

    const [totalStudents, totalTeachers, todayAtt] = await Promise.all([
      Student.countDocuments({ class: { $in: groupIds } }),
      Staff.countDocuments(staffQuery),
      Attendance.find({ class: { $in: groupIds }, date: todayStr }),
    ]);

    const attended = (recs) =>
      recs.filter((a) => a.status === "present" || a.status === "late").length;

    const perGroupAttendance = {};
    for (const g of groups) {
      const recs = todayAtt.filter((a) => String(a.class) === String(g._id));
      perGroupAttendance[g._id] = recs.length
        ? Math.round((attended(recs) / recs.length) * 100)
        : null;
    }

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalGroups: groups.length,
        activeGroups: groups.length, // ✅ hozircha Class'da isActive maydoni yo'q — hammasi faol hisoblanadi
        totalTeachers,
        todayAttendancePercent: todayAtt.length
          ? Math.round((attended(todayAtt) / todayAtt.length) * 100)
          : null,
        presentToday: attended(todayAtt),
        totalTodayMarked: todayAtt.length,
        perGroupAttendance,
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Barcha guruhlar bo'yicha hisobot (Excel) ─────────────────────
// ✅ YANGI — avval Reports.vue faqat BIRINCHI guruhni eksport qilardi
// ("to'liq hisobot" deb ko'rsatilsa ham). Endi har bir guruh alohida
// varaqqa, ustiga umumiy ko'rinish varag'i bilan.
exports.exportGroupsReport = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { month, year } = req.query;

    const teacher = await Teacher.findById(ctx.directorId);
    if (!teacher)
      return res.status(404).json({ success: false, error: "Topilmadi" });
    if (!hasFeature(teacher, "export")) {
      return res.status(403).json({
        success: false,
        error: "Export faqat Premium uchun",
        requiresUpgrade: true,
      });
    }

    const query = { teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const groups = await Class.find(query).populate("subject", "name");
    if (!groups.length) {
      return res
        .status(400)
        .json({ success: false, error: "Hali guruh yo'q" });
    }

    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const wb = XLSX.utils.book_new();
    const overviewRows = [
      ["Guruh", "Fan", "O'quvchilar", "To'lagan", "Yig'ilgan (so'm)", "Kutilgan (so'm)"],
    ];

    const usedSheetNames = new Set();
    const safeSheetName = (name) => {
      let base = (name || "Guruh").replace(/[\\/?*[\]:]/g, "").slice(0, 28) || "Guruh";
      let candidate = base;
      let i = 2;
      while (usedSheetNames.has(candidate)) {
        candidate = `${base} (${i++})`.slice(0, 31);
      }
      usedSheetNames.add(candidate);
      return candidate;
    };

    for (const g of groups) {
      const students = await Student.find({ class: g._id }).sort({ rollNumber: 1 });
      const payments = await MonthlyPayment.find({
        class: g._id,
        month: m,
        year: y,
      }).populate("student", "name parentPhone rollNumber");

      const rows = students.map((s) => {
        const p = payments.find((x) => String(x.student?._id) === String(s._id));
        return {
          "№": s.rollNumber,
          "O'quvchi ismi": s.name,
          "Ota-ona telefoni": s.parentPhone || "—",
          "Summa (so'm)": p ? p.amount : g.defaultAmount,
          Holati: p?.status === "paid" ? "To'lagan" : "To'lamagan",
          "To'lagan sanasi": p?.paidDate
            ? new Date(p.paidDate).toLocaleDateString("uz-UZ")
            : "—",
        };
      });

      const paidCount = rows.filter((r) => r.Holati === "To'lagan").length;
      const collected = payments
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      const expected = students.length * g.defaultAmount;

      overviewRows.push([
        g.name,
        g.subject?.name || "—",
        students.length,
        `${paidCount}/${students.length}`,
        collected,
        expected,
      ]);

      const wsData = [
        ["№", "O'quvchi ismi", "Ota-ona telefoni", "Summa (so'm)", "Holati", "To'lagan sanasi"],
        ...rows.map((r) => Object.values(r)),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(g.name));
    }

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
    wsOverview["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsOverview, "Umumiy");
    // "Umumiy" varag'ini birinchi qilib qo'yamiz
    wb.SheetNames.unshift(wb.SheetNames.pop());

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer", compression: true });
    const fileName = encodeURIComponent(`hisobot_${m}_${y}.xlsx`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Length", buf.length);
    return res.end(buf);
  } catch (err) {
    console.error("exportGroupsReport error:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }
};
exports.deleteGroup = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGroups");
    const { groupId } = req.params;

    const query = { _id: groupId, teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    const group = await Class.findOne(query);
    if (!group)
      return res
        .status(404)
        .json({ success: false, error: "Guruh topilmadi" });

    await Promise.all([
      Student.deleteMany({ class: groupId }),
      MonthlyPayment.deleteMany({ class: groupId }),
      Expense.deleteMany({ class: groupId }),
      Schedule.deleteMany({ class: groupId }),
      Attendance.deleteMany({ class: groupId }),
      Grade.deleteMany({ class: groupId }),
    ]);
    await Class.findByIdAndDelete(groupId);

    res.json({ success: true, message: "Guruh va bog'liq barcha ma'lumotlar o'chirildi" });
  } catch (err) {
    console.error("deleteGroup error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};
