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
// Markaz salomatligi — jimgina yo'qotilayotgan narsalar
// (to'lov varaqasi yaratilmagan guruh, telefonsiz o'quvchi…).
// ⚠️ Xodim ham ko'radi: ruxsat controller ichida tekshiriladi.
router.get("/health", allowTeacherOrStaff, ctrl.getCenterHealth);
router.put("/onboarding", onlyTeacher, ctrl.completeOnboarding);

// ══ REJIM — xato tanlaganlar uchun chiqish yo'li ═════════════
// Faqat hisob bo'sh bo'lsa ishlaydi (controller izohiga qarang)
router.get("/mode", onlyTeacher, ctrl.getModeStatus);
router.put("/mode", onlyTeacher, ctrl.switchMode);

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
// ⚠️ TEZKOR QIDIRUV IKKALA REJIMDA HAM ISHLAYDI.
//    Ilgari u faqat `/api/lc/search` da edi va butun `/api/lc/*`
//    `requireLCMode` bilan qulflangan — ya'ni Fond direktori
//    Ctrl+K ni bosib, har safar bo'sh ro'yxat ko'rardi. Xato
//    ham chiqmasdi: qidiruv jimgina 403 olardi.
//    Controller rejimga bog'liq emas — o'quvchi va sinfni
//    `ctx.directorId` bo'yicha qidiradi.
const cardCtrlShared = require("../controllers/studentCardController");
router.get("/search", allowTeacherOrStaff, cardCtrlShared.search);

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
// ⚠️ Nomni o'zgartirish 2026-08-21 gacha UMUMAN YO'Q edi:
//    `updateClass` yozilgan, lekin route'ga ulanmagan. Ya'ni
//    sinf nomida xato bo'lsa (yoki yangi o'quv yili boshlansa)
//    uni o'chirib qayta yaratishdan boshqa yo'l yo'q edi — u esa
//    o'quvchilarni ham, to'lov tarixini ham olib ketardi.
router.put("/classes/:classId", allowTeacherOrStaff, ctrl.updateClass);
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
// ⚠️ TAHRIRLASH 2026-08-21 gacha UMUMAN YO'Q edi: funksiya
//    yozilgan, lekin route'ga ulanmagan (va ustiga buzuq edi).
//    Ya'ni telefonda xato bo'lsa, o'quvchini o'chirib qayta
//    yaratishdan boshqa yo'l yo'q edi — u esa butun to'lov
//    tarixini o'chiradi.
// Excel/CSV import — avval ko'rsatadi (`apply: false`), keyin yozadi.
// ⚠️ `uploadLimiter`: fayl tanasi katta bo'ladi, serverni bo'g'ib
//    qo'ymasin (chek rasmlari bilan bir xil himoya).
router.post(
  "/classes/:classId/students/import",
  uploadLimiter,
  allowTeacherOrStaff,
  ctrl.importStudents,
);
router.put("/students/:studentId", allowTeacherOrStaff, ctrl.updateStudent);
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
// ⚠️ HAMMA guruhga bir bosishda — unutilgan guruh qolmasin.
//    Ikki marta bosish xavfsiz: mavjud varaqalar qayta
//    yaratilmaydi.
router.post(
  "/payments/create-monthly-all",
  allowTeacherOrStaff,
  ctrl.createMonthlyPaymentsAll,
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
// ⚠️ SUMMANI TAHRIRLASH. Ilgari varaqa guruhning `defaultAmount`
//    idan kelar va keyin HECH QACHON o'zgarmasdi — ya'ni
//    chegirma, qisman to'lov va aka-uka uchun boshqa narx
//    kiritilmasdi, noto'g'ri yozilgan summani ham tuzatib
//    bo'lmasdi. Yagona yo'l varaqani o'chirib qayta yaratish edi
//    va u bilan birga to'lov tarixi ham yo'qolardi.
//
//    Ya'ni bu ochilish xavf QO'SHMAYDI: bir xil huquqli odam
//    allaqachon o'chirib qayta yarata olardi. Endi esa
//    o'zgarish jurnalga tushadi (`payment.amount_changed`) —
//    kim, qachon, nimadan nimaga.
//
// ⚠️ Ruxsat controller ichida: `managePayments`. Filial
//    cheklovi ham o'sha yerda tekshiriladi.
router.put("/payments/:paymentId", allowTeacherOrStaff, ctrl.markPayment);

// ══ REMINDER / SMS / EXPORT — faqat Director ════════════════
router.get("/reminder", onlyTeacher, ctrl.getMonthlyReminder);
router.post("/sms-reminder/send", onlyTeacher, ctrl.sendSmsReminders);
router.get("/export/:classId", onlyTeacher, ctrl.exportPayments);

// ══ EXPENSES — Director va `manageExpenses` huquqli xodim ════
//
// ⚠️ Ilgari uchalasi ham `onlyTeacher` edi. Ikkita sabab bilan
//    ochildi:
//    1) Interfeys direktorga `manageExpenses` huquqini berish
//       imkonini berardi, lekin u huquq hech qayerda
//       tekshirilmasdi — buxgalter huquqni oladi va hech qanday
//       sahifa ko'rmasdi.
//    2) Muhimrog'i: kassadan pulni ADMINISTRATOR oladi. U
//       xarajatni yoza olmasa, kechqurun smenada kamomad
//       chiqadi va halol odam o'g'ri bo'lib ko'rinadi.
//
//    Ruxsat controller ichida `requirePermission(ctx,
//    "manageExpenses")` bilan tekshiriladi — `allowTeacherOrStaff`
//    o'zi hech narsani cheklamaydi.
router.post("/expenses", allowTeacherOrStaff, ctrl.addExpense);
router.get("/expenses", allowTeacherOrStaff, ctrl.getExpenses);
router.delete("/expenses/:expenseId", allowTeacherOrStaff, ctrl.deleteExpense);

// ══ TELEGRAM — faqat Director ════════════════════════════════
router.get("/telegram/bot-link", onlyTeacher, tgCtrl.getBotLink);

// ── Direktorning O'Z Telegram ulanishi ───────────────────────
// ⚠️ Ota-onalar oqimidan BUTUNLAY ALOHIDA. Bu — markazga
//    tizimdan xabar yuborish kanali; kunlik kassa xabari
//    birinchi ishlatuvchisi, xolos.
// ⚠️ `onlyTeacher`: xodim markaz nomidan ulanish tokeni ola
//    olmasligi kerak.
router.get("/telegram/director", onlyTeacher, tgCtrl.getDirectorLink);
router.post("/telegram/director", onlyTeacher, tgCtrl.createDirectorLink);
router.delete("/telegram/director", onlyTeacher, tgCtrl.unlinkDirector);
router.put("/telegram/director/mode", onlyTeacher, tgCtrl.setCashReportMode);
router.put(
  "/telegram/director/churn-mode",
  onlyTeacher,
  tgCtrl.setChurnDigestMode,
);
router.put(
  "/telegram/director/billing-mode",
  onlyTeacher,
  tgCtrl.setBillingAlertMode,
);
// "Xabar qanday keladi?" — bugungi haqiqiy ma'lumot bilan
router.post(
  "/telegram/director/preview",
  onlyTeacher,
  tgCtrl.sendDirectorPreview,
);
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

// ─── "TO'LADIM" — OTA-ONA YUBORADI, XODIM TASDIQLAYDI ───────────────────────
//
// ⚠️ `/api/lc/*` DA EMAS, SHU YERDA — va bu ataylab. U yerda butun
//    router `requireLCMode` bilan qulflangan, Fond direktori esa
//    403 olardi. Fondda bu oqim LC'dagidan ham keragiroq: sinf
//    rahbari 30 ta to'lovni qo'lda belgilaydi.
//
// ⚠️ PUL BIZDAN O'TMAYDI. Ota-ona to'g'ridan-to'g'ri kartaga
//    o'tkazadi; bu yerda faqat "to'ladim" so'rovi tasdiqlanadi.
//    Boshqa odamlarning pulini ushlab turish alohida litsenziya
//    talab qiladi.
const claimCtrl = require("../controllers/paymentClaimController");

router.get("/payment-claims", allowTeacherOrStaff, claimCtrl.list);
router.put("/payment-claims/:claimId", allowTeacherOrStaff, claimCtrl.review);
router.get("/payment-details", allowTeacherOrStaff, claimCtrl.getDetails);
router.put("/payment-details", allowTeacherOrStaff, claimCtrl.updateDetails);

module.exports = router;