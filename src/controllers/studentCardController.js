// src/controllers/studentCardController.js
// ════════════════════════════════════════════════════════════
// BITTA O'QUVCHI HAQIDA HAMMA NARSA — bitta so'rovda.
//
// Bugun administrator bitta bola haqida bilish uchun besh
// sahifani aylanib chiqadi: to'lovlar, davomat, baholar, uy
// vazifasi, qo'shimcha mashg'ulot. Har birida qidiruv, har
// birida kutish. Kun bo'yi shu.
//
// ⚠️ HAMMASI BITTA SO'ROVDA. Oltita alohida endpoint qilsak,
//    sahifa oltita spinner bilan bo'lak-bo'lak ochilardi va
//    sekin internetda bu sezilarli. Ichkarida so'rovlar
//    parallel ketadi.
//
// ⚠️ Bu yerdan BOSHQA o'quvchining ma'lumoti chiqmasin. Har bir
//    so'rov `student` bo'yicha cheklangan, o'quvchining o'zi esa
//    markazga tegishliligi boshida tekshiriladi.
// ════════════════════════════════════════════════════════════

const Student = require("../models/Student");
const Class = require("../models/Class");
const Grade = require("../models/Grade");
const Attendance = require("../models/Attendance");
const MonthlyPayment = require("../models/MonthlyPayment");
const Homework = require("../models/Homework");
const HomeworkResult = require("../models/HomeworkResult");
const SupportBooking = require("../models/SupportBooking");
const StudentLink = require("../models/StudentLink");
const PaymentClaim = require("../models/PaymentClaim");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { getStudentGroupIds } = require("../utils/enrollment");
const { todayInTashkent } = require("../utils/supportWindow");

// ── GET /api/lc/student/:studentId/card ─────────────────────
exports.card = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewStudents");

    const { studentId } = req.params;

    const student = await Student.findById(studentId)
      .select("name class parentPhone rollNumber isActive supportBlockedUntil riskContactedAt createdAt")
      .lean();
    if (!student) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    }

    // ⚠️ MARKAZGA TEGISHLIMI. Bu tekshiruvsiz boshqa markazning
    //    bolasining butun tarixini ko'rish mumkin bo'lardi —
    //    id manzildan keladi.
    const mainGroup = await Class.findOne({
      _id: student.class,
      teacher: ctx.directorId,
      ...(ctx.branchFilter ? { branch: ctx.branchFilter } : {}),
    })
      .select("name defaultAmount assignedTeacher branch")
      .lean();
    if (!mainGroup) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const today = todayInTashkent();

    const groupIds = await getStudentGroupIds(studentId);

    const [
      payments,
      claims,
      attMonth,
      attRecent,
      grades,
      hwItems,
      bookings,
      links,
      allGroups,
    ] = await Promise.all([
      MonthlyPayment.find({ student: studentId })
        .sort({ year: -1, month: -1 })
        .limit(12)
        .select("month year amount status paidDate")
        .lean(),
      PaymentClaim.find({ student: studentId, status: "pending" })
        .select("month year amount")
        .lean(),
      Attendance.find({ student: studentId, month, year })
        .select("status")
        .lean(),
      Attendance.find({ student: studentId })
        .sort({ date: -1 })
        .limit(20)
        .select("date status note")
        .lean(),
      Grade.find({ student: studentId })
        .sort({ date: -1 })
        .limit(20)
        .select("subject score maxScore date note")
        .lean(),
      groupIds.length
        ? Homework.find({ class: { $in: groupIds } })
            .sort({ dueDate: -1 })
            .limit(20)
            .select("title subject dueDate")
            .lean()
        : [],
      SupportBooking.find({ student: studentId })
        .sort({ date: -1 })
        .limit(8)
        .populate("teacher", "name")
        .select("date startTime endTime status topic teacher")
        .lean(),
      StudentLink.find({ student: studentId, isActive: true })
        .select("kind verifiedVia telegramUsername lastSeenAt")
        .lean(),
      groupIds.length
        ? Class.find({ _id: { $in: groupIds } }).select("name").lean()
        : [],
    ]);

    // ── Uy vazifasi natijalari ──
    const hwResults = hwItems.length
      ? await HomeworkResult.find({
          student: studentId,
          homework: { $in: hwItems.map((h) => h._id) },
        })
          .select("homework status")
          .lean()
      : [];
    const hwStatus = new Map(hwResults.map((r) => [String(r.homework), r.status]));

    const homework = hwItems.map((h) => {
      const status = hwStatus.get(String(h._id)) || "pending";
      return {
        id: h._id,
        title: h.title,
        subject: h.subject || "",
        dueDate: h.dueDate,
        status,
        overdue: status === "pending" && h.dueDate < today,
      };
    });

    // ── Xulosalar ──
    const unpaid = payments.filter((p) => p.status !== "paid");
    const n = (s) => attMonth.filter((r) => r.status === s).length;
    const excused = n("excused");
    const counted = attMonth.length - excused;

    const pct = (g) => (g.score / (g.maxScore || 100)) * 100;
    const avgGrade = grades.length
      ? Math.round(grades.reduce((s, g) => s + pct(g), 0) / grades.length)
      : null;

    res.json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        parentPhone: student.parentPhone || "",
        rollNumber: student.rollNumber,
        isActive: student.isActive !== false,
        createdAt: student.createdAt,
        supportBlockedUntil: student.supportBlockedUntil,
      },
      group: {
        id: mainGroup._id,
        name: mainGroup.name,
        monthlyPrice: mainGroup.defaultAmount || 0,
      },
      // Qo'shimcha guruhlar — asosiysidan tashqarisi
      extraGroups: allGroups
        .filter((g) => String(g._id) !== String(mainGroup._id))
        .map((g) => ({ id: g._id, name: g.name })),

      summary: {
        debt: unpaid.reduce((s, p) => s + (p.amount || 0), 0),
        debtMonths: unpaid.length,
        pendingClaims: claims.length,
        attendancePercent: counted
          ? Math.round(((n("present") + n("late")) / counted) * 100)
          : null,
        absentThisMonth: n("absent"),
        avgGrade,
        homeworkPending: homework.filter((h) => h.status === "pending").length,
      },

      payments,
      pendingClaimMonths: claims.map((c) => `${c.year}-${c.month}`),
      attendance: attRecent,
      grades,
      homework,
      bookings: bookings.map((b) => ({
        id: b._id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        topic: b.topic || "",
        teacherName: b.teacher?.name || "",
      })),

      // ⚠️ Ota-ona Telegram'ga ulanganmi — administratorning eng
      //    ko'p beriladigan savoli. Ulanmagan bo'lsa hech qanday
      //    xabar bormaydi va u buni bilishi kerak.
      links: links.map((l) => ({
        kind: l.kind,
        verifiedVia: l.verifiedVia,
        username: l.telegramUsername || "",
        lastSeenAt: l.lastSeenAt,
      })),
    });
  } catch (e) {
    console.error("[card]", e);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/search?q= ───────────────────────────────────
//
// ⚠️ QULAYLIK UCHUN ENG MUHIM ENDPOINT. Administrator kun bo'yi
//    ism qidiradi: o'quvchilar sahifasini ochadi, ro'yxatni
//    kutadi, filtrni bosadi, yozadi. Endi istalgan sahifadan
//    yozib, to'g'ridan-to'g'ri kartochkaga o'tadi.
exports.search = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewStudents");

    const q = String(req.query.q || "").trim();
    // ⚠️ Ikki belgidan qisqa so'rov butun bazani qaytarardi
    if (q.length < 2) {
      return res.json({ success: true, students: [], groups: [] });
    }

    // ⚠️ Foydalanuvchi kiritgan matn REGEX ga tushadi — maxsus
    //    belgilar ekranlanmasa, `(` yozgan odam so'rovni
    //    yiqitardi (yoki og'ir qidiruv yasab qo'yardi).
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const groupQuery = { teacher: ctx.directorId };
    if (ctx.branchFilter) groupQuery.branch = ctx.branchFilter;
    const groups = await Class.find(groupQuery).select("name").lean();
    const groupIds = groups.map((g) => g._id);
    const groupName = new Map(groups.map((g) => [String(g._id), g.name]));

    const students = await Student.find({
      class: { $in: groupIds },
      isActive: { $ne: false },
      // Ism yoki ota-ona raqami bo'yicha
      $or: [{ name: rx }, { parentPhone: rx }],
    })
      .select("name class parentPhone")
      .limit(12)
      .lean();

    res.json({
      success: true,
      students: students.map((s) => ({
        id: s._id,
        name: s.name,
        className: groupName.get(String(s.class)) || "",
        parentPhone: s.parentPhone || "",
      })),
      groups: groups
        .filter((g) => rx.test(g.name))
        .slice(0, 6)
        .map((g) => ({ id: g._id, name: g.name })),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
