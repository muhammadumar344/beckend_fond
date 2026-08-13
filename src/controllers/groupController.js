// src/controllers/groupController.js
// ✅ O'quv markazi (LC) uchun "Guruh" API'si.
//
// `Group` modeli — `classes` kolleksiyasining LC ko'rinishi: bir xil
// hujjatlar, lekin sxemada FAQAT LC maydonlari bor (`initialBalance`
// kabi Fond maydonlari yo'q, shu sabab bu yerdan ularga teg olinmaydi).
// Ma'lumot ko'chirilmagan — batafsil: models/Group.js va
// docs/GROUP_MIGRATION.md.
//
// ⚠️ So'rov FILTRLARIDA haqiqiy maydon nomlari ishlatiladi
//    (`teacher`, `defaultAmount`) — `director`/`monthlyPrice` emas.
//    Sabab models/Group.js dagi "ALIAS TUZOG'I" izohida.

const Group = require("../models/Group");
const Student = require("../models/Student");
const {
  getGroupStudents,
  countGroupStudents,
  countUniqueStudents,
  buildGroupStudentMap,
} = require("../utils/enrollment");
const Subject = require("../models/Subject");
const Staff = require("../models/Staff");
const Schedule = require("../models/Schedule");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const Teacher = require("../models/Teacher"); // ✅ YANGI
const Lead = require("../models/Lead"); // ✅ YANGI — dashboard voronkasi uchun
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

    // ✅ TUZATILDI: `plan` ilgari umuman yozilmasdi va sxema "free"
    // qo'yardi. Natijada Premium LC hisobi ham guruhiga 30 tadan ortiq
    // o'quvchi qo'sha olmasdi (Fond tomonida bu maydon yozilardi).
    // planHelper endi hozirgi tarif bilan solishtiradi, shu sabab eski
    // guruhlar ham tuzaladi — lekin yangilarini manbada to'g'ri yozamiz.
    const director = await Teacher.findById(ctx.directorId);
    const activePlan =
      director && director.isPlanActive() ? director.plan : "free";

    const newGroup = new Group({
      name: name.trim(),
      teacher: ctx.directorId,
      defaultAmount: Number(price),
      plan: activePlan,
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

    const groups = await Group.find(query)
      .populate("subject", "name color")
      .populate("assignedTeacher", "name")
      .populate("branch", "name color")
      .sort({ createdAt: -1 });

    const withDetails = await Promise.all(
      groups.map(async (g) => {
        const now = new Date();
        const [studentCount, schedule, monthPayments] = await Promise.all([
          countGroupStudents(g._id),
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

    const group = await Group.findOne(query)
      .populate("subject", "name color")
      .populate("assignedTeacher", "name email")
      .populate("branch", "name color");
    if (!group)
      return res
        .status(404)
        .json({ success: false, error: "Guruh topilmadi" });

    const [studentCount, schedule] = await Promise.all([
      countGroupStudents(group._id),
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
    const group = await Group.findOne(query);
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

    const groups = await Group.find(query);
    const groupIds = groups.map((g) => g._id);
    const todayStr = new Date().toISOString().slice(0, 10);

    const staffQuery = { director: ctx.directorId, isActive: true };
    if (ctx.branchFilter) staffQuery.branch = ctx.branchFilter;

    const [totalStudents, totalTeachers, todayAtt] = await Promise.all([
      countUniqueStudents(groupIds),
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

    // ══ ANALITIKA ═══════════════════════════════════════════════
    const now = new Date();
    const MONTH_SHORT = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

    // ── 1. Tushum dinamikasi — oxirgi 6 oy ────────────────────
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    const trendPayments = await MonthlyPayment.find({
      class: { $in: groupIds },
      $or: months.map((m) => ({ month: m.month, year: m.year })),
    }).select("month year amount status");

    const revenueTrend = months.map((m) => {
      const rows = trendPayments.filter(
        (p) => p.month === m.month && p.year === m.year,
      );
      return {
        month: m.month,
        year: m.year,
        label: MONTH_SHORT[m.month - 1],
        collected: rows
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amount, 0),
        expected: rows.reduce((s, p) => s + p.amount, 0),
      };
    });

    // ── 2. Davomat dinamikasi — oxirgi 14 kun ─────────────────
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const trendAtt = await Attendance.find({
      class: { $in: groupIds },
      date: { $in: days },
    }).select("date status");

    const attendanceTrend = days.map((date) => {
      const recs = trendAtt.filter((a) => a.date === date);
      return {
        date,
        total: recs.length,
        present: attended(recs),
        percent: recs.length
          ? Math.round((attended(recs) / recs.length) * 100)
          : null,
      };
    });

    // ── 3. Qarzdorlar — shu oy to'lamaganlar ──────────────────
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const debtQuery = {
      class: { $in: groupIds },
      month: curMonth,
      year: curYear,
      status: "not_paid",
    };

    const [allDebts, topDebtors] = await Promise.all([
      MonthlyPayment.find(debtQuery).select("amount"),
      MonthlyPayment.find(debtQuery)
        .populate("student", "name parentPhone")
        .populate("class", "name")
        .sort({ amount: -1 })
        .limit(8),
    ]);

    // ── 4. Lidlar voronkasi ───────────────────────────────────
    const leadQuery = { director: ctx.directorId };
    if (ctx.branchFilter) leadQuery.branch = ctx.branchFilter;
    const allLeads = await Lead.find(leadQuery).select("status");

    const leadFunnel = Lead.STATUSES.reduce((acc, s) => {
      acc[s] = allLeads.filter((l) => l.status === s).length;
      return acc;
    }, {});
    const closedLeads = leadFunnel.won + leadFunnel.lost;

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

        // ✅ YANGI — analitika
        revenueTrend,
        attendanceTrend,
        debt: {
          count: allDebts.length,
          total: allDebts.reduce((s, p) => s + p.amount, 0),
          top: topDebtors.map((p) => ({
            id: p._id,
            studentName: p.student?.name || "—",
            phone: p.student?.parentPhone || "",
            groupName: p.class?.name || "—",
            amount: p.amount,
          })),
        },
        leads: {
          funnel: leadFunnel,
          total: allLeads.length,
          conversionRate:
            closedLeads > 0
              ? Math.round((leadFunnel.won / closedLeads) * 100)
              : 0,
        },
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Oylik hisobot xulosasi ───────────────────────────────────────
// GET /api/lc/reports/summary?month=&year=
// ⚠️ Avval Reports.vue /teacher/dashboard'ni chaqirardi — u oy/yil
// parametrini umuman qabul qilmaydi, shuning uchun sahifadagi oy
// tanlagichi hech narsa qilmasdi. Bu endpoint aynan tanlangan davrni
// hisoblaydi.
exports.getReportSummary = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewReports");

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: "Oy 1–12 orasida" });
    }

    const query = { teacher: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const groups = await Group.find(query)
      .populate("subject", "name")
      .sort({ name: 1 });
    const groupIds = groups.map((g) => g._id);

    // ⚠️ Bu yerda har bir guruh uchun alohida so'rov yubormaymiz —
    // `buildGroupStudentMap` hammasini ikkita so'rovda yig'adi
    // (qo'shimcha guruhlar ham hisobga olinadi).
    const [payments, expenses, studentMap] = await Promise.all([
      MonthlyPayment.find({ class: { $in: groupIds }, month, year }).select(
        "class amount status",
      ),
      Expense.find({ class: { $in: groupIds }, month, year }).select(
        "class amount",
      ),
      buildGroupStudentMap(groupIds),
    ]);

    const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);

    const groupRows = groups.map((g) => {
      const gid = String(g._id);
      const p = payments.filter((x) => String(x.class) === gid);
      const e = expenses.filter((x) => String(x.class) === gid);
      const studentCount = studentMap.get(gid)?.size || 0;

      const collected = sum(p.filter((x) => x.status === "paid"));
      // To'lov varaqasi hali yaratilmagan bo'lsa, kutilganini o'quvchi
      // soni × guruh narxidan hisoblaymiz
      const expected = p.length ? sum(p) : studentCount * (g.defaultAmount || 0);

      return {
        id: g._id,
        name: g.name,
        subject: g.subject?.name || null,
        studentCount,
        paidCount: p.filter((x) => x.status === "paid").length,
        unpaidCount: p.filter((x) => x.status !== "paid").length,
        collected,
        expected,
        expenses: sum(e),
        percent: expected > 0 ? Math.round((collected / expected) * 100) : 0,
      };
    });

    // ── 6 oylik dinamika ──────────────────────────────────────
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      trendMonths.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
    const MONTH_SHORT = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
    const periodFilter = trendMonths.map((m) => ({ month: m.month, year: m.year }));

    const [trendPay, trendExp] = await Promise.all([
      MonthlyPayment.find({
        class: { $in: groupIds },
        $or: periodFilter,
      }).select("month year amount status"),
      Expense.find({ class: { $in: groupIds }, $or: periodFilter }).select(
        "month year amount",
      ),
    ]);

    const trend = trendMonths.map((m) => {
      const pick = (arr) =>
        arr.filter((x) => x.month === m.month && x.year === m.year);
      const collected = sum(pick(trendPay).filter((x) => x.status === "paid"));
      const spent = sum(pick(trendExp));
      return {
        month: m.month,
        year: m.year,
        label: MONTH_SHORT[m.month - 1],
        collected,
        expenses: spent,
        profit: collected - spent,
      };
    });

    const totalCollected = groupRows.reduce((s, g) => s + g.collected, 0);
    const totalExpected = groupRows.reduce((s, g) => s + g.expected, 0);
    const totalExpenses = sum(expenses);
    const initialBalance = groups.reduce((s, g) => s + (g.initialBalance || 0), 0);

    res.json({
      success: true,
      period: { month, year, label: MONTH_SHORT[month - 1] },
      summary: {
        collected: totalCollected,
        expected: totalExpected,
        remaining: Math.max(totalExpected - totalCollected, 0),
        expenses: totalExpenses,
        profit: totalCollected - totalExpenses,
        initialBalance,
        balance: initialBalance + totalCollected - totalExpenses,
        studentCount: students.length,
        groupCount: groups.length,
        paidCount: groupRows.reduce((s, g) => s + g.paidCount, 0),
        unpaidCount: groupRows.reduce((s, g) => s + g.unpaidCount, 0),
        collectRate:
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 100)
            : 0,
      },
      groups: groupRows,
      trend,
    });
  } catch (err) {
    console.error("getReportSummary error:", err);
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
    const groups = await Group.find(query).populate("subject", "name");
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
      const students = await getGroupStudents(g._id);
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
    const group = await Group.findOne(query);
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
    await Group.findByIdAndDelete(groupId);

    res.json({ success: true, message: "Guruh va bog'liq barcha ma'lumotlar o'chirildi" });
  } catch (err) {
    console.error("deleteGroup error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};
