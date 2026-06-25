// src/routes/teacher.js — TO'LIQ, Staff kira oladigan qilib tuzatilgan
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/teacherController");
const tgCtrl = require("../controllers/telegramController");
const gradeCtrl = require("../controllers/gradeController");
const branchCtrl = require("../controllers/branchController");
const refCtrl = require("../controllers/referralController");
const schedCtrl = require("../controllers/scheduleController");
const attCtrl = require("../controllers/attendanceController");
const prCtrl = require("../controllers/paymentRequestController");
const auth = require("../middleware/auth");
const roles = require("../middleware/roles");

const {
  exportPreviousYear,
  cleanupPreviousYear,
} = require("../controllers/freezeController");

// ✅ MUHIM: faqat auth (token bor-yo'qligi) — role cheklovi YO'Q
router.use(auth);

// ✅ Teacher (Director) VA Staff kira oladigan route lar uchun
const allowTeacherOrStaff = (req, res, next) => {
  if (["teacher", "staff"].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
};

// ✅ FAQAT Teacher (Director) — Staff kira olmaydi
const onlyTeacher = roles("teacher");

// ══ DASHBOARD — faqat Director ══════════════════════════════
router.get("/dashboard", onlyTeacher, ctrl.getDashboard);
router.get("/subscription", onlyTeacher, ctrl.getSubscriptionInfo);
router.put("/onboarding", onlyTeacher, ctrl.completeOnboarding);

// ══ FREEZE — faqat Director ═════════════════════════════════
router.get("/freeze-status", onlyTeacher, async (req, res) => {
  try {
    const FreezeSettings = require("../models/FreezeSettings");
    const Teacher = require("../models/Teacher");
    const [freeze, teacher] = await Promise.all([
      FreezeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }),
      Teacher.findById(req.user.id).select(
        "freezeStartedAt freezeRemainingMs planExpiresAt plan",
      ),
    ]);
    let daysLeft = 0;
    if (teacher?.freezeStartedAt && teacher?.freezeRemainingMs > 0) {
      daysLeft = Math.ceil(teacher.freezeRemainingMs / 86400000);
    } else if (teacher?.planExpiresAt) {
      daysLeft = Math.max(
        0,
        Math.ceil((new Date(teacher.planExpiresAt) - new Date()) / 86400000),
      );
    }
    res.json({
      success: true,
      freeze: freeze
        ? {
            _id: freeze._id,
            isActive: freeze.isActive,
            reason: freeze.reason,
            startedAt: freeze.startedAt,
          }
        : null,
      isActive: !!freeze,
      teacherFrozen: !!teacher?.freezeStartedAt,
      daysLeft,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.get("/export-previous-year", onlyTeacher, exportPreviousYear);
router.post("/cleanup-previous-year", onlyTeacher, cleanupPreviousYear);

// ══ CLASSES — faqat Director (Staff o'z huquqi bilan keyinroq) ══
router.post("/classes", onlyTeacher, ctrl.createClass);
router.get("/classes", onlyTeacher, ctrl.getMyClasses);
router.put(
  "/classes/:classId/amount",
  onlyTeacher,
  ctrl.updateClassDefaultAmount,
);
router.put(
  "/classes/:classId/initial-balance",
  onlyTeacher,
  ctrl.updateInitialBalance,
);
router.delete("/classes/:classId", onlyTeacher, ctrl.deleteClass);

// ══ STUDENTS — faqat Director ═══════════════════════════════
router.post("/classes/:classId/students", onlyTeacher, ctrl.addStudent);
router.get("/classes/:classId/students", onlyTeacher, ctrl.getClassStudents);
router.delete("/students/:studentId", onlyTeacher, ctrl.deleteStudent);

// ══ PAYMENTS — faqat Director ═══════════════════════════════
router.post(
  "/payments/create-monthly",
  onlyTeacher,
  ctrl.createMonthlyPayments,
);
router.get("/payments/class/:classId", onlyTeacher, ctrl.getClassPayments);
router.get("/payments", onlyTeacher, ctrl.getMonthlyPayments);
router.put(
  "/payments/:paymentId/status",
  onlyTeacher,
  ctrl.updatePaymentStatus,
);

// ══ REMINDER / SMS / EXPORT — faqat Director ════════════════
router.get("/reminder", onlyTeacher, ctrl.getMonthlyReminder);
router.post("/sms-reminder/send", onlyTeacher, ctrl.sendSmsReminders);
router.get("/export/:classId", onlyTeacher, ctrl.exportPayments);

// ══ EXPENSES — faqat Director ════════════════════════════════
router.post("/expenses", onlyTeacher, ctrl.addExpense);
router.get("/expenses", onlyTeacher, ctrl.getExpenses);
router.delete("/expenses/:expenseId", onlyTeacher, ctrl.deleteExpense);

// ══ TELEGRAM — faqat Director ════════════════════════════════
router.get("/telegram/bot-link", onlyTeacher, tgCtrl.getBotLink);
router.get("/telegram/parents", onlyTeacher, tgCtrl.getParents);
router.get(
  "/telegram/parents/class/:classId",
  onlyTeacher,
  tgCtrl.getParentsByClass,
);
router.post("/telegram/send-reminders", onlyTeacher, tgCtrl.sendRemindersNow);
router.post("/telegram/send-to-students", onlyTeacher, tgCtrl.sendToStudents);

// ══ REFERRAL — faqat Director ════════════════════════════════
router.get("/referral", onlyTeacher, refCtrl.getMyReferral);

// ══ PAYMENT REQUESTS — faqat Director ════════════════════════
router.post("/payment-requests", onlyTeacher, prCtrl.createRequest);
router.get("/payment-requests", onlyTeacher, prCtrl.getMyRequests);

// ══ BRANCHES — faqat Director ════════════════════════════════
router.post("/branches", onlyTeacher, branchCtrl.createBranch);
router.get("/branches", onlyTeacher, branchCtrl.getBranches);
router.put("/branches/:branchId", onlyTeacher, branchCtrl.updateBranch);
router.delete("/branches/:branchId", onlyTeacher, branchCtrl.deleteBranch);
router.put("/branches/assign/:classId", onlyTeacher, branchCtrl.assignClass);
router.put(
  "/branches/:branchId/manager",
  onlyTeacher,
  branchCtrl.assignManager,
);
router.put(
  "/branches/:branchId/become-manager",
  onlyTeacher,
  branchCtrl.becomeManagerToo,
);

// ══ SCHEDULE — ✅ Director VA Staff (ruxsat ichkarida tekshiriladi) ══
router.post("/schedule", allowTeacherOrStaff, schedCtrl.createSchedule);
router.get(
  "/schedule/weekly",
  allowTeacherOrStaff,
  schedCtrl.getWeeklyOverview,
);
router.get(
  "/schedule/class/:classId",
  allowTeacherOrStaff,
  schedCtrl.getClassSchedule,
);
router.put(
  "/schedule/:scheduleId",
  allowTeacherOrStaff,
  schedCtrl.updateSchedule,
);
router.delete(
  "/schedule/:scheduleId",
  allowTeacherOrStaff,
  schedCtrl.deleteSchedule,
);

// ══ ATTENDANCE — ✅ Director VA Staff ════════════════════════
router.post("/attendance", allowTeacherOrStaff, attCtrl.saveAttendance);
router.get(
  "/attendance/class/:classId",
  allowTeacherOrStaff,
  attCtrl.getDayAttendance,
);
router.get(
  "/attendance/class/:classId/monthly",
  allowTeacherOrStaff,
  attCtrl.getMonthlyStats,
);
router.get(
  "/attendance/student/:studentId/history",
  allowTeacherOrStaff,
  attCtrl.getStudentHistory,
);

// ══ GRADES — ✅ Director VA Staff ═════════════════════════════
router.post("/grades", allowTeacherOrStaff, gradeCtrl.saveGrades);
router.get(
  "/grades/class/:classId",
  allowTeacherOrStaff,
  gradeCtrl.getDayGrades,
);
router.get(
  "/grades/class/:classId/subjects",
  allowTeacherOrStaff,
  gradeCtrl.getSubjects,
);
router.get(
  "/grades/class/:classId/monthly",
  allowTeacherOrStaff,
  gradeCtrl.getMonthlyAverage,
);
router.get(
  "/grades/student/:studentId",
  allowTeacherOrStaff,
  gradeCtrl.getStudentGrades,
);
router.delete("/grades/:gradeId", allowTeacherOrStaff, gradeCtrl.deleteGrade);

module.exports = routerC;
