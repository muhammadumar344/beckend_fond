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
const { onlyTeacher, allowTeacherOrStaff } = require("../middleware/roles"); // ✅ TUZATILDI: destructure
const { requireLCMode } = require("../middleware/mode"); // ✅ YANGI
// Rasm yuboriladigan manzillar — katta tana bilan serverni bo'g'ishga qarshi
const { uploadLimiter } = require("../middleware/rateLimit");

const {
  exportPreviousYear,
  cleanupPreviousYear,
} = require("../controllers/freezeController");

// ✅ MUHIM: faqat auth (token bor-yo'qligi) — role cheklovi YO'Q
router.use(auth);

// ══ DASHBOARD — faqat Director ══════════════════════════════
// Brendlash (white-label): o'qishni xodim ham qiladi (sidebar uchun),
// o'zgartirishni faqat direktor — tekshiruv controller ichida.
router.get("/branding", allowTeacherOrStaff, ctrl.getBranding);
router.put("/branding", uploadLimiter, onlyTeacher, ctrl.updateBranding);

// ══ HISOBNI O'CHIRISH — faqat direktorning o'zi ═════════════
// Tiklash `/api/auth/restore-account` da (login talab qilinmaydi).
const accountCtrl = require("../controllers/accountController");
router.get("/account/deletion-status", onlyTeacher, accountCtrl.deletionStatus);
router.post("/account/delete", onlyTeacher, accountCtrl.requestDeletion);

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

// ══ CLASSES ══════════════════════════════════════════════════
// ✅ /classes/list AVVAL yozilishi shart — /classes/:id bilan conflict bo'lmasin
router.get("/classes/list", allowTeacherOrStaff, ctrl.getClassesForStaff);

// ✅ TUZATILDI — Director VA Staff (manageGroups huquqi bilan, ichkarida
// requirePermission tekshiradi). Avval faqat onlyTeacher edi — shu sabab
// "manageGroups" huquqi berilgan Administration/Manager roli guruh ochish
// u yoqda tursin, guruhlar ro'yxatini ko'rishda ham 403 olardi.
router.post("/classes", allowTeacherOrStaff, ctrl.createClass);
router.get("/classes", allowTeacherOrStaff, ctrl.getMyClasses);
router.put(
  "/classes/:classId/amount",
  allowTeacherOrStaff,
  ctrl.updateClassDefaultAmount,
);
// Boshlang'ich balans — faqat Direktor (tizimdan oldingi tarixiy summa)
router.put(
  "/classes/:classId/initial-balance",
  onlyTeacher,
  ctrl.updateInitialBalance,
);
router.delete("/classes/:classId", allowTeacherOrStaff, ctrl.deleteClass);

// ══ STUDENTS — Director VA Staff (manageStudents huquqi bilan) ══
router.post(
  "/classes/:classId/students",
  allowTeacherOrStaff,
  ctrl.addStudent,
);
router.get(
  "/classes/:classId/students",
  allowTeacherOrStaff,
  ctrl.getClassStudents,
);
router.delete("/students/:studentId", allowTeacherOrStaff, ctrl.deleteStudent);

// ══ MINI APP ULANISHI — ota-onani Telegram'ga bog'lash ══════
// Kod bilan bog'lanish o'zi bot'da; bu yerda faqat kod chiqariladi.
const inviteCtrl = require("../controllers/inviteController");
router.post(
  "/students/:studentId/invite",
  allowTeacherOrStaff,
  inviteCtrl.createInvite,
);
router.get(
  "/students/:studentId/links",
  allowTeacherOrStaff,
  inviteCtrl.getStudentLinks,
);
router.delete("/links/:linkId", allowTeacherOrStaff, inviteCtrl.revokeLink);

// ══ PAYMENTS — Director + 'managePayments' huquqli xodim ════
// Ruxsat controller ichida requirePermission(ctx, 'managePayments') bilan
// tekshiriladi; xodim faqat o'z filiali sinflarini ko'radi/o'zgartiradi.
router.post(
  "/payments/create-monthly",
  allowTeacherOrStaff,
  ctrl.createMonthlyPayments,
);
router.get(
  "/payments/class/:classId",
  allowTeacherOrStaff,
  ctrl.getClassPayments,
);
router.get("/payments", allowTeacherOrStaff, ctrl.getMonthlyPayments);
router.put(
  "/payments/:paymentId/status",
  allowTeacherOrStaff,
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
router.post("/payment-requests", uploadLimiter, onlyTeacher, prCtrl.createRequest);
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

// ══ SCHEDULE — ✅ FAQAT O'quv markazi (LC) rejimi ════════════
// ✅ TUZATILDI — bu Fond'da umuman bo'lmasligi kerak edi (Fond = faqat
// fond puli yig'ish). requireLCMode qo'shildi.
router.post(
  "/schedule",
  allowTeacherOrStaff,
  requireLCMode,
  schedCtrl.createSchedule,
);
router.get(
  "/schedule/weekly",
  allowTeacherOrStaff,
  requireLCMode,
  schedCtrl.getWeeklyOverview,
);
router.get(
  "/schedule/class/:classId",
  allowTeacherOrStaff,
  requireLCMode,
  schedCtrl.getClassSchedule,
);
router.put(
  "/schedule/:scheduleId",
  allowTeacherOrStaff,
  requireLCMode,
  schedCtrl.updateSchedule,
);
router.delete(
  "/schedule/:scheduleId",
  allowTeacherOrStaff,
  requireLCMode,
  schedCtrl.deleteSchedule,
);

// ══ ATTENDANCE — ✅ FAQAT O'quv markazi (LC) rejimi ═══════════
router.post(
  "/attendance",
  allowTeacherOrStaff,
  requireLCMode,
  attCtrl.saveAttendance,
);
router.get(
  "/attendance/class/:classId",
  allowTeacherOrStaff,
  requireLCMode,
  attCtrl.getDayAttendance,
);
router.get(
  "/attendance/class/:classId/monthly",
  allowTeacherOrStaff,
  requireLCMode,
  attCtrl.getMonthlyStats,
);
router.get(
  "/attendance/student/:studentId/history",
  allowTeacherOrStaff,
  requireLCMode,
  attCtrl.getStudentHistory,
);

// ══ GRADES — ✅ FAQAT O'quv markazi (LC) rejimi ═══════════════
router.post(
  "/grades",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.saveGrades,
);
router.get(
  "/grades/class/:classId",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.getDayGrades,
);
router.get(
  "/grades/class/:classId/subjects",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.getSubjects,
);
router.get(
  "/grades/class/:classId/monthly",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.getMonthlyAverage,
);
router.get(
  "/grades/student/:studentId",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.getStudentGrades,
);
router.delete(
  "/grades/:gradeId",
  allowTeacherOrStaff,
  requireLCMode,
  gradeCtrl.deleteGrade,
);

module.exports = router;