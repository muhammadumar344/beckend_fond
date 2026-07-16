// src/controllers/gradeController.js — STAFF UCHUN TUZATILGAN
const Grade = require("../models/Grade");
const Class = require("../models/Class");
const Student = require("../models/Student");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");

// ── Baho qo'yish (bulk) ──────────────────────────────────────
exports.saveGrades = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGrades"); // ✅ TUZATILDI — throw qiladi, endi to'g'ri 403 qaytaradi

    const {
      classId,
      subject,
      date,
      type = "homework",
      maxScore = 100,
      grades,
    } = req.body;
    if (!classId || !date || !grades?.length) {
      return res
        .status(400)
        .json({
          success: false,
          error: "classId, date, grades majburiy",
        });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ success: false, error: "date: YYYY-MM-DD formatida" });
    }

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId }).populate(
      "subject",
      "name",
    );
    if (!cls)
      return res.status(404).json({ success: false, error: "Guruh topilmadi" });
    if (ctx.branchFilter && String(cls.branch) !== ctx.branchFilter) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Bu guruh sizning filialingizga tegishli emas",
        });
    }

    // ✅ YANGI — fan har safar qo'lda kiritilmasin: guruhga biriktirilgan
    // fan avtomatik ishlatiladi, faqat kerak bo'lsa qo'lda ustidan yozish
    // mumkin (masalan aralash guruhlarda).
    const resolvedSubject = (subject || cls.subject?.name || "").trim();
    if (!resolvedSubject) {
      return res.status(400).json({
        success: false,
        error:
          "Fan aniqlanmadi — avval guruhga fan biriktiring yoki 'subject' yuboring",
      });
    }

    const [year, month] = date.split("-").map(Number);
    let saved = 0;

    for (const g of grades) {
      if (g.score === undefined || g.score === null) continue;
      const score = Math.max(0, Math.min(Number(maxScore), Number(g.score)));
      await Grade.findOneAndUpdate(
        { class: classId, student: g.studentId, subject: resolvedSubject, date, type },
        {
          teacher: ctx.directorId,
          month,
          year,
          score,
          maxScore: Number(maxScore),
          note: (g.note || "").trim(),
        },
        { upsert: true, new: true },
      );
      saved++;
    }

    res.json({ success: true, message: `${saved} ta baho saqlandi`, saved });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── Kun bahosi ─────────────────────────────────────────────
exports.getDayGrades = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;
    const { date, subject, type = "homework" } = req.query;

    if (!date)
      return res.status(400).json({ success: false, error: "date majburiy" });

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Guruh topilmadi" });
    if (ctx.branchFilter && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const students = await Student.find({ class: classId }).sort({
      rollNumber: 1,
    });
    const query = { class: classId, date, type };
    if (subject) query.subject = subject;
    const grades = await Grade.find(query);

    const gMap = {};
    grades.forEach((g) => {
      gMap[g.student.toString()] = g;
    });

    const result = students.map((s) => ({
      studentId: s._id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      score: gMap[s._id.toString()]?.score ?? null,
      maxScore: gMap[s._id.toString()]?.maxScore ?? 100,
      note: gMap[s._id.toString()]?.note ?? "",
    }));

    res.json({ success: true, date, students: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Fanlar ro'yxati ──────────────────────────────────────────
exports.getSubjects = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;
    const subjects = await Grade.find({
      class: classId,
      teacher: ctx.directorId,
    }).distinct("subject");
    res.json({ success: true, subjects });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Oylik o'rtacha ────────────────────────────────────────────
exports.getMonthlyAverage = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { classId } = req.params;
    const { month, year, subject } = req.query;

    const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
    if (!cls)
      return res.status(404).json({ success: false, error: "Guruh topilmadi" });
    if (ctx.branchFilter && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const students = await Student.find({ class: classId }).sort({
      rollNumber: 1,
    });
    const query = { class: classId, month: m, year: y };
    if (subject) query.subject = subject;
    const grades = await Grade.find(query);

    const result = students.map((s) => {
      const studentGrades = grades.filter(
        (g) => g.student.toString() === s._id.toString(),
      );
      const avg =
        studentGrades.length > 0
          ? Math.round(
              studentGrades.reduce(
                (sum, g) => sum + (g.score / g.maxScore) * 100,
                0,
              ) / studentGrades.length,
            )
          : null;
      return {
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        gradeCount: studentGrades.length,
        average: avg,
        grades: studentGrades.map((g) => ({
          subject: g.subject,
          date: g.date,
          score: g.score,
          maxScore: g.maxScore,
          type: g.type,
        })),
      };
    });

    const classAvg =
      result.filter((r) => r.average !== null).length > 0
        ? Math.round(
            result
              .filter((r) => r.average !== null)
              .reduce((s, r) => s + r.average, 0) /
              result.filter((r) => r.average !== null).length,
          )
        : 0;

    res.json({
      success: true,
      month: m,
      year: y,
      classAverage: classAvg,
      students: result,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── O'quvchi tarixi ────────────────────────────────────────────
exports.getStudentGrades = async (req, res) => {
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
    if (ctx.branchFilter && String(cls.branch) !== ctx.branchFilter) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const query = { student: studentId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const grades = await Grade.find(query).sort({ date: -1 });
    const average =
      grades.length > 0
        ? Math.round(
            grades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) /
              grades.length,
          )
        : 0;

    res.json({
      success: true,
      student: { id: student._id, name: student.name },
      average,
      total: grades.length,
      grades,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── Baho o'chirish ───────────────────────────────────────────
exports.deleteGrade = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageGrades"); // ✅ TUZATILDI
    const { gradeId } = req.params;
    const grade = await Grade.findOneAndDelete({
      _id: gradeId,
      teacher: ctx.directorId,
    });
    if (!grade)
      return res.status(404).json({ success: false, error: "Baho topilmadi" });
    res.json({ success: true, message: "Baho o'chirildi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
