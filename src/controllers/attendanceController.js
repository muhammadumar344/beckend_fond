// src/controllers/attendanceController.js — STAFF UCHUN TUZATILGAN
const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const Student = require("../models/Student");
const { getGroupStudents } = require("../utils/enrollment");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");

// ── Davomat saqlash ───────────────────────────────────────────
exports.saveAttendance = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    // ✅ Ruxsat tekshirish — faqat manageAttendance bo'lganlar belgilashi mumkin
    // (ruxsat yo'q bo'lsa o'zi 403 xato tashlaydi, pastdagi catch uni tutadi)
    requirePermission(ctx, "manageAttendance");

    const { classId, date, records } = req.body;
    if (!classId || !date || !records?.length) {
      return res
        .status(400)
        .json({ success: false, error: "classId, date, records majburiy" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ success: false, error: "date: YYYY-MM-DD formatida bo'lsin" });
    }

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Bu sinf sizning filialingizga tegishli emas",
        });
    }

    const [year, month] = date.split("-").map(Number);
    const validStatuses = ["present", "absent", "late", "excused"];
    let saved = 0;
    const errors = [];

    for (const rec of records) {
      if (!validStatuses.includes(rec.status)) continue;
      try {
        await Attendance.findOneAndUpdate(
          { class: classId, student: rec.studentId, date },
          {
            teacher: ctx.directorId,
            month,
            year,
            status: rec.status,
            note: (rec.note || "").trim(),
          },
          { upsert: true, new: true },
        );
        saved++;
      } catch (e) {
        errors.push(rec.studentId);
      }
    }

    res.json({
      success: true,
      message: `${saved} ta davomat saqlandi`,
      saved,
      errors,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Kun davomati ──────────────────────────────────────────────
exports.getDayAttendance = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;
    const { date } = req.query;

    if (!date)
      return res.status(400).json({ success: false, error: "date majburiy" });

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const students = await getGroupStudents(classId);
    const attendance = await Attendance.find({ class: classId, date });

    const attMap = {};
    attendance.forEach((a) => {
      attMap[a.student.toString()] = a;
    });

    const result = students.map((s) => ({
      studentId: s._id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      status: attMap[s._id.toString()]?.status || null,
      note: attMap[s._id.toString()]?.note || "",
    }));

    const summary = {
      total: students.length,
      present: result.filter((r) => r.status === "present").length,
      absent: result.filter((r) => r.status === "absent").length,
      late: result.filter((r) => r.status === "late").length,
      excused: result.filter((r) => r.status === "excused").length,
      unmarked: result.filter((r) => !r.status).length,
    };

    res.json({
      success: true,
      date,
      class: { id: cls._id, name: cls.name },
      students: result,
      summary,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Oylik statistika ──────────────────────────────────────────
exports.getMonthlyStats = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;
    const { month, year } = req.query;

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Sinf topilmadi" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const students = await getGroupStudents(classId);
    const attendance = await Attendance.find({
      class: classId,
      month: m,
      year: y,
    });

    const statsMap = {};
    students.forEach((s) => {
      statsMap[s._id.toString()] = {
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        percent: 0,
      };
    });

    attendance.forEach((a) => {
      const key = a.student.toString();
      if (statsMap[key]) {
        statsMap[key][a.status]++;
        statsMap[key].total++;
      }
    });

    const uniqueDates = [...new Set(attendance.map((a) => a.date))];
    Object.values(statsMap).forEach((s) => {
      s.percent =
        uniqueDates.length > 0
          ? Math.round(((s.present + s.late) / uniqueDates.length) * 100)
          : 0;
    });

    const studentStats = Object.values(statsMap).sort(
      (a, b) => a.rollNumber - b.rollNumber,
    );
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(
      (a) => a.status === "present",
    ).length;
    const absentCount = attendance.filter((a) => a.status === "absent").length;
    const lateCount = attendance.filter((a) => a.status === "late").length;

    res.json({
      success: true,
      month: m,
      year: y,
      class: { id: cls._id, name: cls.name },
      totalDays: uniqueDates.length,
      uniqueDates: uniqueDates.sort(),
      summary: {
        total: totalRecords,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        avgAttendance:
          totalRecords > 0
            ? Math.round(((presentCount + lateCount) / totalRecords) * 100)
            : 0,
      },
      students: studentStats,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── O'quvchi tarixi ──────────────────────────────────────────
exports.getStudentHistory = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { studentId } = req.params;
    const { month, year } = req.query;

    const student = await Student.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });

    const cls = await Class.findOne({
      _id: student.class,
      teacher: ctx.directorId,
    });
    if (!cls)
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const query = { student: studentId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const records = await Attendance.find(query).sort({ date: -1 });

    res.json({
      success: true,
      student: { id: student._id, name: student.name },
      total: records.length,
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late").length,
      records,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
