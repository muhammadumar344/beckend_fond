// src/routes/teacher.js — TO'LIQ TUZATILGAN
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/teacherController");
const tgCtrl = require("../controllers/telegramController");
const gradeCtrl = require("../controllers/gradeController");
const branchCtrl = require("../controllers/branchController");
const refCtrl = require("../controllers/referralController");
const schedCtrl = require("../controllers/scheduleController"); // ✅ QO'SHILDI
const attCtrl = require("../controllers/attendanceController"); // ✅ QO'SHILDI
const prCtrl = require("../controllers/paymentRequestController"); // ✅ QO'SHILDI
const auth = require("../middleware/auth");
const roles = require("../middleware/roles");

const {
  exportPreviousYear,
  cleanupPreviousYear,
} = require("../controllers/freezeController");

router.use(auth, roles("teacher")); // ← Auth middleware HAMMAGA qo'llaniladi
// ══ DASHBOARD ═══════════════════════════════════════════════
router.get("/dashboard", ctrl.getDashboard);
router.get("/subscription", ctrl.getSubscriptionInfo);
// src/routes/teacher.js — 23-qatorni TUZATING
router.put("/onboarding", ctrl.onboarding);
router.get("/profile", ctrl.getProfile);

// ══ FREEZE ══════════════════════════════════════════════════
router.get("/freeze-status", async (req, res) => {
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
      daysLeft = Math.ceil(teacher.freezeRemainingMs / (1000 * 60 * 60 * 24));
    } else if (teacher?.planExpiresAt) {
      const diff = new Date(teacher.planExpiresAt) - new Date();
      daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
router.get("/export-previous-year", exportPreviousYear);
router.post("/cleanup-previous-year", cleanupPreviousYear);

// ══ CLASSES ═════════════════════════════════════════════════
router.post("/classes", ctrl.createClass);
router.get("/classes", ctrl.getMyClasses);
router.put("/classes/:classId/amount", ctrl.updateClassDefaultAmount);
router.put("/classes/:classId/initial-balance", ctrl.updateInitialBalance);
router.delete("/classes/:classId", ctrl.deleteClass);

// ══ STUDENTS ════════════════════════════════════════════════
router.post("/classes/:classId/students", ctrl.addStudent);
router.get("/classes/:classId/students", ctrl.getClassStudents);
router.delete("/students/:studentId", ctrl.deleteStudent);

// ══ PAYMENTS ════════════════════════════════════════════════
router.post("/payments/create-monthly", ctrl.createMonthlyPayments);
router.get("/payments/class/:classId", ctrl.getClassPayments);
router.get("/payments", ctrl.getMonthlyPayments);
router.put("/payments/:paymentId/status", ctrl.updatePaymentStatus);

// ══ REMINDER / SMS / EXPORT ════════════════════════════════
router.get("/reminder", ctrl.getMonthlyReminder);
router.post("/sms-reminder/send", ctrl.sendSmsReminders);
router.get("/export/:classId", ctrl.exportPayments);

// ══ EXPENSES ════════════════════════════════════════════════
router.post("/expenses", ctrl.addExpense);
router.get("/expenses", ctrl.getExpenses);
router.delete("/expenses/:expenseId", ctrl.deleteExpense);

// ══ TELEGRAM ════════════════════════════════════════════════
router.get("/telegram/bot-link", tgCtrl.getBotLink);
router.get("/telegram/parents", tgCtrl.getParents);
router.get("/telegram/parents/class/:classId", tgCtrl.getParentsByClass);
router.post("/telegram/send-reminders", tgCtrl.sendRemindersNow);
router.post("/telegram/send-to-students", tgCtrl.sendToStudents);

// ══ REFERRAL ════════════════════════════════════════════════
router.get("/referral", refCtrl.getMyReferral);

// ══ PAYMENT REQUESTS (plan so'rash) ✅ QO'SHILDI ═══════════
router.post("/payment-requests", prCtrl.createRequest);
router.get("/payment-requests", prCtrl.getMyRequests);

// ══ BRANCHES (filiallar) ════════════════════════════════════
router.post("/branches", branchCtrl.createBranch);
router.get("/branches", branchCtrl.getBranches);
router.put("/branches/:branchId", branchCtrl.updateBranch);
router.delete("/branches/:branchId", branchCtrl.deleteBranch);
router.put("/branches/assign/:classId", branchCtrl.assignClass);

// ══ SCHEDULE (jadval) ✅ QO'SHILDI ══════════════════════════
router.post("/schedule", schedCtrl.createSchedule);
router.get("/schedule/weekly", schedCtrl.getWeeklyOverview);
router.get("/schedule/class/:classId", schedCtrl.getClassSchedule);
router.put("/schedule/:scheduleId", schedCtrl.updateSchedule);
router.delete("/schedule/:scheduleId", schedCtrl.deleteSchedule);

// ══ ATTENDANCE (davomat) ✅ QO'SHILDI ═══════════════════════
router.post("/attendance", attCtrl.saveAttendance);
router.get("/attendance/class/:classId", attCtrl.getDayAttendance);
router.get("/attendance/class/:classId/monthly", attCtrl.getMonthlyStats);
router.get("/attendance/student/:studentId/history", attCtrl.getStudentHistory);

// ══ GRADES (baholar) ════════════════════════════════════════
router.post("/grades", gradeCtrl.saveGrades);
router.get("/grades/class/:classId", gradeCtrl.getDayGrades);
router.get("/grades/class/:classId/subjects", gradeCtrl.getSubjects);
router.get("/grades/class/:classId/monthly", gradeCtrl.getMonthlyAverage);
router.get("/grades/student/:studentId", gradeCtrl.getStudentGrades);
router.delete("/grades/:gradeId", gradeCtrl.deleteGrade);

module.exports = router;
