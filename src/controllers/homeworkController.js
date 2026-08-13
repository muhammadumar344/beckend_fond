// src/controllers/homeworkController.js
// Uy vazifalari + har bir o'quvchi bo'yicha bajarilish holati va ochkolar.
const Homework = require("../models/Homework");
const HomeworkResult = require("../models/HomeworkResult");
const Class = require("../models/Class");
const Student = require("../models/Student");
const { getGroupStudents } = require("../utils/enrollment");
const TelegramParent = require("../models/TelegramParent");
const { sendHomeworkReport } = require("../services/telegramService");
const {
  resolveContext,
  requirePermission,
} = require("../utils/resolveContext");

const STATUSES = HomeworkResult.STATUSES;

/** O'qish uchun viewHomework yoki manageHomework dan biri yetarli */
function requireHomeworkRead(ctx) {
  if (ctx.isDirector) return;
  const perms = Array.isArray(ctx.permissions) ? ctx.permissions : [];
  if (!perms.includes("viewHomework") && !perms.includes("manageHomework")) {
    const err = new Error("Ruxsat yo'q: \"viewHomework\" huquqi kerak");
    err.status = 403;
    throw err;
  }
}

/** Guruh shu direktorga tegishli va xodimning filialiga mosmi */
async function findOwnedClass(ctx, classId) {
  const cls = await Class.findOne({ _id: classId, teacher: ctx.directorId });
  if (!cls) {
    const err = new Error("Guruh topilmadi");
    err.status = 404;
    throw err;
  }
  if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
    const err = new Error("Bu guruh sizning filialingizga tegishli emas");
    err.status = 403;
    throw err;
  }
  return cls;
}

/** 'late' uchun yarim ochko — reyting adolatli bo'lsin */
function pointsFor(status, max) {
  if (status === "done") return max;
  if (status === "late") return Math.round(max / 2);
  return 0;
}

// ── RO'YXAT ───────────────────────────────────────────────────
// GET /api/lc/homework?classId=&from=&to=
exports.getHomeworks = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requireHomeworkRead(ctx);

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    if (req.query.classId) {
      await findOwnedClass(ctx, req.query.classId);
      query.class = req.query.classId;
    }
    if (req.query.from || req.query.to) {
      query.dueDate = {};
      if (req.query.from) query.dueDate.$gte = req.query.from;
      if (req.query.to) query.dueDate.$lte = req.query.to;
    }

    const homeworks = await Homework.find(query)
      .populate("class", "name")
      .populate("createdBy", "name")
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(200);

    // Har bir topshiriq uchun bajarilish xulosasi
    const ids = homeworks.map((h) => h._id);
    const results = await HomeworkResult.find({
      homework: { $in: ids },
    }).select("homework status");

    const withStats = homeworks.map((h) => {
      const rows = results.filter((r) => String(r.homework) === String(h._id));
      const done = rows.filter((r) => r.status === "done").length;
      const late = rows.filter((r) => r.status === "late").length;
      return {
        ...h.toObject(),
        stats: {
          total: rows.length,
          done,
          late,
          missed: rows.filter((r) => r.status === "missed").length,
          pending: rows.filter((r) => r.status === "pending").length,
          // Bajarilgan deb kech topshirganlar ham hisoblanadi
          percent: rows.length
            ? Math.round(((done + late) / rows.length) * 100)
            : 0,
        },
      };
    });

    res.json({ success: true, homeworks: withStats });
  } catch (err) {
    console.error("getHomeworks error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── YARATISH ──────────────────────────────────────────────────
// POST /api/lc/homework
exports.createHomework = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageHomework");

    const { classId, title, description, subject, assignedDate, dueDate, points } =
      req.body;

    if (!classId || !title?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Guruh va sarlavha majburiy" });
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(assignedDate || "") || !dateRe.test(dueDate || "")) {
      return res
        .status(400)
        .json({ success: false, error: "Sana YYYY-MM-DD formatida bo'lsin" });
    }
    if (dueDate < assignedDate) {
      return res.status(400).json({
        success: false,
        error: "Topshirish sanasi berilgan sanadan oldin bo'lishi mumkin emas",
      });
    }

    const cls = await findOwnedClass(ctx, classId);

    const homework = await Homework.create({
      director: ctx.directorId,
      class: classId,
      branch: cls.branch || null,
      title: title.trim(),
      description: (description || "").trim(),
      subject: (subject || "").trim(),
      assignedDate,
      dueDate,
      points: points === undefined ? 10 : Number(points),
      createdBy: ctx.staffId || null,
    });

    // Guruhdagi barcha o'quvchiga "kutilmoqda" yozuvi ochamiz —
    // shunda ustoz keyin faqat belgilashi kifoya.
    const students = await getGroupStudents(classId);
    if (students.length) {
      await HomeworkResult.insertMany(
        students.map((s) => ({
          homework: homework._id,
          student: s._id,
          class: classId,
          director: ctx.directorId,
          status: "pending",
          points: 0,
        })),
        { ordered: false },
      );
    }

    res.status(201).json({
      success: true,
      message: `Vazifa berildi (${students.length} o'quvchi)`,
      homework,
    });
  } catch (err) {
    console.error("createHomework error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── YANGILASH ─────────────────────────────────────────────────
// PUT /api/lc/homework/:homeworkId
exports.updateHomework = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageHomework");

    const query = { _id: req.params.homeworkId, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const hw = await Homework.findOne(query);
    if (!hw)
      return res.status(404).json({ success: false, error: "Vazifa topilmadi" });

    const { title, description, subject, assignedDate, dueDate, points } = req.body;
    if (title !== undefined && title.trim()) hw.title = title.trim();
    if (description !== undefined) hw.description = description.trim();
    if (subject !== undefined) hw.subject = subject.trim();
    if (assignedDate !== undefined) hw.assignedDate = assignedDate;
    if (dueDate !== undefined) hw.dueDate = dueDate;
    if (points !== undefined) hw.points = Number(points);

    if (hw.dueDate < hw.assignedDate) {
      return res.status(400).json({
        success: false,
        error: "Topshirish sanasi berilgan sanadan oldin bo'lishi mumkin emas",
      });
    }

    await hw.save();
    res.json({ success: true, message: "Vazifa yangilandi", homework: hw });
  } catch (err) {
    console.error("updateHomework error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── O'CHIRISH ─────────────────────────────────────────────────
// DELETE /api/lc/homework/:homeworkId
exports.deleteHomework = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageHomework");

    const query = { _id: req.params.homeworkId, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const hw = await Homework.findOneAndDelete(query);
    if (!hw)
      return res.status(404).json({ success: false, error: "Vazifa topilmadi" });

    // Bog'liq natijalar ham o'chadi — yetim yozuv qolmasin
    await HomeworkResult.deleteMany({ homework: hw._id });

    res.json({ success: true, message: "Vazifa o'chirildi" });
  } catch (err) {
    console.error("deleteHomework error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── BITTA VAZIFA: O'QUVCHILAR RO'YXATI ────────────────────────
// GET /api/lc/homework/:homeworkId/results
exports.getHomeworkResults = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requireHomeworkRead(ctx);

    const query = { _id: req.params.homeworkId, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const hw = await Homework.findOne(query).populate("class", "name");
    if (!hw)
      return res.status(404).json({ success: false, error: "Vazifa topilmadi" });

    const students = await getGroupStudents(hw.class._id);
    const results = await HomeworkResult.find({ homework: hw._id });

    const map = {};
    results.forEach((r) => {
      map[String(r.student)] = r;
    });

    res.json({
      success: true,
      homework: hw,
      students: students.map((s) => ({
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        status: map[String(s._id)]?.status || "pending",
        points: map[String(s._id)]?.points || 0,
        note: map[String(s._id)]?.note || "",
      })),
    });
  } catch (err) {
    console.error("getHomeworkResults error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── NATIJALARNI SAQLASH ───────────────────────────────────────
// POST /api/lc/homework/:homeworkId/results
// Body: { records: [{ studentId, status, note }] }
exports.saveHomeworkResults = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageHomework");

    const query = { _id: req.params.homeworkId, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const hw = await Homework.findOne(query);
    if (!hw)
      return res.status(404).json({ success: false, error: "Vazifa topilmadi" });

    const { records } = req.body;
    if (!Array.isArray(records) || !records.length) {
      return res
        .status(400)
        .json({ success: false, error: "records majburiy" });
    }

    let saved = 0;
    for (const rec of records) {
      if (!STATUSES.includes(rec.status)) continue;
      await HomeworkResult.findOneAndUpdate(
        { homework: hw._id, student: rec.studentId },
        {
          class: hw.class,
          director: ctx.directorId,
          status: rec.status,
          points: pointsFor(rec.status, hw.points),
          note: (rec.note || "").trim(),
          checkedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      saved++;
    }

    res.json({ success: true, message: `${saved} ta natija saqlandi`, saved });
  } catch (err) {
    console.error("saveHomeworkResults error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

/**
 * Reytingni hisoblaydi. getLeaderboard va notifyParents ikkovi ham shuni
 * ishlatadi — hisob-kitob bitta joyda tursin.
 */
async function computeLeaderboard(ctx, { classId, from, to } = {}) {
  const clsQuery = { teacher: ctx.directorId };
  if (ctx.branchFilter) clsQuery.branch = ctx.branchFilter;
  if (classId) {
    await findOwnedClass(ctx, classId);
    clsQuery._id = classId;
  }

  const classes = await Class.find(clsQuery).select("_id name");
  const classIds = classes.map((c) => c._id);

  // Davr bo'yicha filtr — topshiriqning dueDate'i bo'yicha
  const hwQuery = { class: { $in: classIds }, director: ctx.directorId };
  if (from || to) {
    hwQuery.dueDate = {};
    if (from) hwQuery.dueDate.$gte = from;
    if (to) hwQuery.dueDate.$lte = to;
  }
  const homeworks = await Homework.find(hwQuery).select("_id class points");
  const hwIds = homeworks.map((h) => h._id);

  const results = await HomeworkResult.find({
    homework: { $in: hwIds },
  }).populate("student", "name rollNumber");

  const byStudent = {};
  for (const r of results) {
    if (!r.student) continue; // o'chirilgan o'quvchi
    const key = String(r.student._id);
    if (!byStudent[key]) {
      byStudent[key] = {
        studentId: r.student._id,
        studentName: r.student.name,
        rollNumber: r.student.rollNumber,
        classId: r.class,
        className:
          classes.find((c) => String(c._id) === String(r.class))?.name || "",
        points: 0,
        done: 0,
        late: 0,
        missed: 0,
        total: 0,
      };
    }
    const s = byStudent[key];
    s.points += r.points || 0;
    s.total += 1;
    if (r.status === "done") s.done += 1;
    else if (r.status === "late") s.late += 1;
    else if (r.status === "missed") s.missed += 1;
  }

  const maxPossible = homeworks.reduce((sum, h) => sum + (h.points || 0), 0);

  const leaderboard = Object.values(byStudent)
    .map((s) => ({
      ...s,
      percent: maxPossible > 0 ? Math.round((s.points / maxPossible) * 100) : 0,
    }))
    .sort((a, b) => b.points - a.points || a.rollNumber - b.rollNumber)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    leaderboard,
    summary: {
      homeworkCount: homeworks.length,
      maxPossiblePoints: maxPossible,
      studentCount: leaderboard.length,
    },
  };
}

// ── REYTING (ochko jadvali) ───────────────────────────────────
// GET /api/lc/homework/leaderboard?classId=&from=&to=
exports.getLeaderboard = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requireHomeworkRead(ctx);

    const data = await computeLeaderboard(ctx, {
      classId: req.query.classId,
      from: req.query.from,
      to: req.query.to,
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getLeaderboard error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── OTA-ONALARGA TELEGRAM HISOBOTI ────────────────────────────
// POST /api/lc/homework/notify-parents   Body: { classId?, from?, to?, period? }
exports.notifyParents = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageHomework");

    const { classId, from, to, period } = req.body;
    const { leaderboard, summary } = await computeLeaderboard(ctx, {
      classId,
      from,
      to,
    });

    if (!leaderboard.length) {
      return res
        .status(400)
        .json({ success: false, error: "Yuboriladigan ma'lumot yo'q" });
    }

    // Faqat Telegram'ga ulangan va faol ota-onalar
    const connected = await TelegramParent.find({
      teacherId: ctx.directorId,
      isActive: true,
    });

    const byStudent = {};
    connected.forEach((p) => {
      byStudent[String(p.studentId)] = p;
    });

    let sent = 0;
    let skipped = 0;

    for (const s of leaderboard) {
      const parent = byStudent[String(s.studentId)];
      if (!parent) {
        skipped++;
        continue;
      }

      const ok = await sendHomeworkReport(parent.telegramChatId, {
        studentName: s.studentName,
        className: s.className,
        period: period || defaultPeriodLabel(),
        done: s.done,
        late: s.late,
        missed: s.missed,
        points: s.points,
        maxPoints: summary.maxPossiblePoints,
        percent: s.percent,
        rank: s.rank,
        totalStudents: summary.studentCount,
      });

      if (ok) {
        sent++;
        parent.lastNotifiedAt = new Date();
        await parent.save();
      }
    }

    res.json({
      success: true,
      message: `${sent} ta ota-onaga yuborildi`,
      sent,
      skipped, // Telegram'ga ulanmagan o'quvchilar
      total: leaderboard.length,
    });
  } catch (err) {
    console.error("notifyParents error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

/** "Avgust 2026" ko'rinishidagi joriy davr nomi */
function defaultPeriodLabel() {
  const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
