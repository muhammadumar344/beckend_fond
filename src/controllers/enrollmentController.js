// src/controllers/enrollmentController.js
// O'quvchini qo'shimcha guruhlarga yozish (reja 1.3).
//
// Asosiy guruh (`Student.class`) bu yerda O'ZGARTIRILMAYDI — u eski
// kodning tayanchi. Bu controller faqat QO'SHIMCHA yozuvlar bilan
// ishlaydi. Batafsil: models/Enrollment.js
const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Teacher = require("../models/Teacher");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { countGroupStudents, getStudentGroupIds } = require("../utils/enrollment");
const {
  limitsFor,
  canAddStudent,
  effectivePlan,
} = require("../utils/planHelper");

/**
 * O'quvchi va guruh shu direktorga tegishlimi — ikkalasini ham
 * tekshiradi. Filialli xodim bo'lsa filial ham mos kelishi shart.
 */
async function loadPair(ctx, studentId, classId) {
  const groupQuery = { _id: classId, teacher: ctx.directorId };
  if (ctx.branchFilter) groupQuery.branch = ctx.branchFilter;

  const [student, group] = await Promise.all([
    Student.findById(studentId),
    Group.findOne(groupQuery),
  ]);

  if (!group) {
    const e = new Error("Guruh topilmadi yoki ruxsat yo'q");
    e.status = 404;
    throw e;
  }
  if (!student) {
    const e = new Error("O'quvchi topilmadi");
    e.status = 404;
    throw e;
  }

  // O'quvchi shu direktorning biror guruhida bo'lishi shart —
  // aks holda boshqa muassasaning bolasini yozib qo'yish mumkin edi
  const ownGroupIds = await getStudentGroupIds(student._id);
  const owned = await Group.countDocuments({
    _id: { $in: ownGroupIds },
    teacher: ctx.directorId,
  });
  if (!owned) {
    const e = new Error("O'quvchi topilmadi");
    e.status = 404;
    throw e;
  }

  return { student, group };
}

// ── O'quvchini guruhga yozish ────────────────────────────────────
exports.enroll = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId, classId, priceOverride, note } = req.body;
    if (!studentId || !classId) {
      return res
        .status(400)
        .json({ success: false, error: "studentId va classId majburiy" });
    }

    const { student, group } = await loadPair(ctx, studentId, classId);

    // Asosiy guruhga qayta yozish — takror bo'lardi
    if (String(student.class) === String(group._id)) {
      return res.status(409).json({
        success: false,
        error: "O'quvchi allaqachon shu guruhda",
      });
    }

    const existing = await Enrollment.findOne({
      student: student._id,
      class: group._id,
    });
    if (existing && existing.status === "active") {
      return res.status(409).json({
        success: false,
        error: "O'quvchi allaqachon shu guruhda",
      });
    }

    // Tarif limiti — o'quvchi qo'shish bilan bir xil qoida
    const director = await Teacher.findById(ctx.directorId);
    const count = await countGroupStudents(group._id);
    if (!canAddStudent(group.plan, count, director)) {
      const limit =
        limitsFor(effectivePlan(group.plan, director), director);
      return res.status(403).json({
        success: false,
        error: `Bu guruhga maksimal ${limit.students} ta o'quvchi qo'shish mumkin`,
        requiresUpgrade: true,
      });
    }

    // Guruh sig'imi (LC'ga xos, tarifdan alohida)
    if (group.capacity && count >= group.capacity) {
      return res.status(409).json({
        success: false,
        error: "Guruh to'lgan",
      });
    }

    let enrollment;
    if (existing) {
      // Ilgari chiqib ketgan — qaytadan faollashtiramiz
      existing.status = "active";
      existing.leftAt = null;
      existing.joinedAt = new Date();
      if (priceOverride !== undefined)
        existing.priceOverride = priceOverride === null ? null : Number(priceOverride);
      if (note !== undefined) existing.note = String(note).trim();
      existing.branch = group.branch || null;
      enrollment = await existing.save();
    } else {
      enrollment = await Enrollment.create({
        student: student._id,
        class: group._id,
        director: ctx.directorId,
        branch: group.branch || null,
        priceOverride:
          priceOverride === undefined || priceOverride === null
            ? null
            : Number(priceOverride),
        note: (note || "").trim(),
      });
    }

    res.status(201).json({
      success: true,
      message: "O'quvchi guruhga yozildi",
      enrollment,
    });
  } catch (err) {
    console.error("enroll error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Guruhdan chiqarish ───────────────────────────────────────────
exports.unenroll = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId, classId } = req.params;
    const { hard } = req.query;

    const { student, group } = await loadPair(ctx, studentId, classId);

    if (String(student.class) === String(group._id)) {
      return res.status(400).json({
        success: false,
        error: "Asosiy guruhdan chiqarib bo'lmaydi — o'quvchini o'chiring",
      });
    }

    const enrollment = await Enrollment.findOne({
      student: student._id,
      class: group._id,
    });
    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi bu guruhda emas" });
    }

    if (hard === "true") {
      // Butunlay o'chirish — tarix ham qolmaydi
      await Enrollment.deleteOne({ _id: enrollment._id });
    } else {
      // Odatdagi holat: tarix saqlanadi, ro'yxatdan chiqadi
      enrollment.status = "left";
      enrollment.leftAt = new Date();
      await enrollment.save();
    }

    res.json({ success: true, message: "O'quvchi guruhdan chiqarildi" });
  } catch (err) {
    console.error("unenroll error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── O'quvchining guruhlari ───────────────────────────────────────
exports.getStudentGroups = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });
    }

    const enrollments = await Enrollment.find({
      student: studentId,
      status: "active",
    }).select("class priceOverride note joinedAt");

    const classIds = [
      ...(student.class ? [student.class] : []),
      ...enrollments.map((e) => e.class),
    ];

    const groupQuery = { _id: { $in: classIds }, teacher: ctx.directorId };
    if (ctx.branchFilter) groupQuery.branch = ctx.branchFilter;
    const groups = await Group.find(groupQuery)
      .populate("subject", "name color")
      .populate("branch", "name color");

    if (!groups.length) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi topilmadi" });
    }

    const byId = new Map(enrollments.map((e) => [String(e.class), e]));

    res.json({
      success: true,
      student: { id: student._id, name: student.name },
      groups: groups.map((g) => {
        const e = byId.get(String(g._id));
        const isPrimary = String(student.class) === String(g._id);
        return {
          id: g._id,
          name: g.name,
          subject: g.subject || null,
          branch: g.branch || null,
          // Asosiy guruh — chiqarib bo'lmaydi, frontend shuni ko'rsatadi
          isPrimary,
          price: e?.priceOverride ?? g.defaultAmount,
          hasCustomPrice: e?.priceOverride != null,
          note: e?.note || "",
          joinedAt: e?.joinedAt || student.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error("getStudentGroups error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// ── Yozuvni tahrirlash (narx / izoh) ─────────────────────────────
exports.updateEnrollment = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId, classId } = req.params;
    const { priceOverride, note } = req.body;

    await loadPair(ctx, studentId, classId);

    const enrollment = await Enrollment.findOne({
      student: studentId,
      class: classId,
    });
    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, error: "O'quvchi bu guruhda emas" });
    }

    if (priceOverride !== undefined) {
      if (priceOverride === null || priceOverride === "") {
        enrollment.priceOverride = null;
      } else if (Number(priceOverride) < 0) {
        return res
          .status(400)
          .json({ success: false, error: "Narx to'g'ri emas" });
      } else {
        enrollment.priceOverride = Number(priceOverride);
      }
    }
    if (note !== undefined) enrollment.note = String(note).trim();

    await enrollment.save();
    res.json({ success: true, message: "Saqlandi", enrollment });
  } catch (err) {
    console.error("updateEnrollment error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};
