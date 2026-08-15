const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { onlyTeacher, allowTeacherOrStaff } = require("../middleware/roles");
const { requireLCMode } = require("../middleware/mode"); // ✅ YANGI

const roleCtrl = require("../controllers/roleController");
const staffCtrl = require("../controllers/staffController");
const salaryCtrl = require("../controllers/salaryController");
const subjectCtrl = require("../controllers/subjectController"); // ✅ YANGI
const groupCtrl = require("../controllers/groupController"); // ✅ YANGI
const leadCtrl = require("../controllers/leadController"); // ✅ YANGI — CRM
const hwCtrl = require("../controllers/homeworkController"); // ✅ YANGI — uy vazifasi

// ✅ TUZATILDI — /api/lc/* butunlay O'quv markazi (LC) rejimiga qulflandi.
// Avval bu yerda hech qanday mode tekshiruvi yo'q edi.
router.use(auth, requireLCMode);

// ─── ROLES ───────────────────────────────────────────────────────────────────
router.get("/roles/my", allowTeacherOrStaff, roleCtrl.getMyRole);
router.get("/roles", allowTeacherOrStaff, roleCtrl.getRoles);
router.post("/roles", onlyTeacher, roleCtrl.createRole);
router.put("/roles/:id", onlyTeacher, roleCtrl.updateRole);
router.delete("/roles/:id", onlyTeacher, roleCtrl.deleteRole);

// ─── STAFF ───────────────────────────────────────────────────────────────────
router.get("/staff", allowTeacherOrStaff, staffCtrl.getStaff);
router.post("/staff", allowTeacherOrStaff, staffCtrl.createStaff);
router.put("/staff/:id", allowTeacherOrStaff, staffCtrl.updateStaff);
router.put("/staff/:id/toggle", allowTeacherOrStaff, staffCtrl.toggleStaff);
router.put(
  "/staff/:id/reset-password",
  onlyTeacher,
  staffCtrl.resetStaffPassword,
);

// ─── SALARIES ────────────────────────────────────────────────────────────────
router.get("/salaries/my", allowTeacherOrStaff, salaryCtrl.getMySalaryHistory);
router.get(
  "/salaries/summary",
  allowTeacherOrStaff,
  salaryCtrl.getSalarySummary,
);
router.get("/salaries", allowTeacherOrStaff, salaryCtrl.getSalaries);
router.post("/salaries", allowTeacherOrStaff, salaryCtrl.setSalary);
router.put("/salaries/:id/pay", allowTeacherOrStaff, salaryCtrl.markSalaryPaid);
router.delete("/salaries/:id", allowTeacherOrStaff, salaryCtrl.deleteSalary);
// ⚠️ Hisob-kitob FAQAT TAKLIF qaytaradi — `Salary` yozuvini
//    odam `POST /salaries` bilan tasdiqlab yaratadi.
router.get("/salaries/computed", allowTeacherOrStaff, salaryCtrl.getComputed);
router.put("/staff/:staffId/salary-rule", allowTeacherOrStaff, salaryCtrl.setSalaryRule);

// ─── SUBJECTS (Fanlar) — ✅ YANGI ────────────────────────────────────────────
// GET — Director + barcha Staff ko'radi (guruh yaratishda dropdown uchun)
router.get("/subjects", allowTeacherOrStaff, subjectCtrl.getSubjects);
// POST/PUT/DELETE — ichkarida requirePermission(ctx, 'manageSubjects') tekshiradi
router.post("/subjects", allowTeacherOrStaff, subjectCtrl.createSubject);
router.put("/subjects/:id", allowTeacherOrStaff, subjectCtrl.updateSubject);
router.delete("/subjects/:id", allowTeacherOrStaff, subjectCtrl.deleteSubject);

// ─── GROUPS (Guruhlar) — ✅ YANGI ────────────────────────────────────────────
// ✅ Fond'ning /teacher/classes'idan ENDI mustaqil — LC o'z API'siga ega.
// Ichkarida (bugungacha) Class kolleksiyasi ishlatiladi, lekin bu shunchaki
// ichki tafsilot — tashqi contract endi to'liq "Group" shaklida.
router.get(
  "/groups/available-teachers",
  allowTeacherOrStaff,
  groupCtrl.getAvailableTeachers,
);
router.post(
  "/groups/check-availability",
  allowTeacherOrStaff,
  groupCtrl.checkAvailability,
);
router.get("/groups", allowTeacherOrStaff, groupCtrl.getGroups);
router.post("/groups", allowTeacherOrStaff, groupCtrl.createGroup);
router.get("/groups/:groupId", allowTeacherOrStaff, groupCtrl.getGroupById);
router.put("/groups/:groupId", allowTeacherOrStaff, groupCtrl.updateGroup);
router.delete("/groups/:groupId", allowTeacherOrStaff, groupCtrl.deleteGroup);

// ─── LEADS (CRM voronkasi) — ✅ YANGI ────────────────────────────────────────
// Ruxsat ichkarida: o'qish uchun viewLeads|manageLeads, yozish uchun manageLeads
router.get("/leads", allowTeacherOrStaff, leadCtrl.getLeads);
router.post("/leads", allowTeacherOrStaff, leadCtrl.createLead);
router.post("/leads/:leadId/convert", allowTeacherOrStaff, leadCtrl.convertLead);
router.put("/leads/:leadId", allowTeacherOrStaff, leadCtrl.updateLead);
router.delete("/leads/:leadId", allowTeacherOrStaff, leadCtrl.deleteLead);

// ─── GURUHGA YOZISH (bitta o'quvchi — bir nechta guruh) ─────────────────────
// Ruxsat ichkarida: manageStudents. Asosiy guruh (Student.class) bu
// yerda o'zgarmaydi — batafsil models/Enrollment.js
const enrollCtrl = require("../controllers/enrollmentController");
router.get(
  "/students/:studentId/groups",
  allowTeacherOrStaff,
  enrollCtrl.getStudentGroups,
);
router.post("/enrollments", allowTeacherOrStaff, enrollCtrl.enroll);
router.put(
  "/enrollments/:studentId/:classId",
  allowTeacherOrStaff,
  enrollCtrl.updateEnrollment,
);
router.delete(
  "/enrollments/:studentId/:classId",
  allowTeacherOrStaff,
  enrollCtrl.unenroll,
);

// ─── FILIALLAR STATISTIKASI — ✅ YANGI ───────────────────────────────────────
// Filiallarni yaratish/tahrirlash /teacher/branches'da qoladi (Direktor).
// Bu yerda faqat LC uchun kengaytirilgan statistika.
const branchCtrl = require("../controllers/branchController");
router.get("/branches/stats", allowTeacherOrStaff, branchCtrl.getBranchStats);

// ─── UY VAZIFALARI — ✅ YANGI ────────────────────────────────────────────────
// Ruxsat ichkarida: o'qish uchun viewHomework|manageHomework, yozish uchun
// manageHomework. /leaderboard :homeworkId dan OLDIN turishi shart.
router.get("/homework/leaderboard", allowTeacherOrStaff, hwCtrl.getLeaderboard);
router.post(
  "/homework/notify-parents",
  allowTeacherOrStaff,
  hwCtrl.notifyParents,
);
router.get("/homework", allowTeacherOrStaff, hwCtrl.getHomeworks);
router.post("/homework", allowTeacherOrStaff, hwCtrl.createHomework);
router.get(
  "/homework/:homeworkId/results",
  allowTeacherOrStaff,
  hwCtrl.getHomeworkResults,
);
router.post(
  "/homework/:homeworkId/results",
  allowTeacherOrStaff,
  hwCtrl.saveHomeworkResults,
);
router.put("/homework/:homeworkId", allowTeacherOrStaff, hwCtrl.updateHomework);
router.delete("/homework/:homeworkId", allowTeacherOrStaff, hwCtrl.deleteHomework);

// ─── DASHBOARD & HISOBOTLAR — ✅ YANGI ───────────────────────────────────────
router.get("/dashboard-stats", allowTeacherOrStaff, groupCtrl.getDashboardStats);
router.get("/reports/summary", allowTeacherOrStaff, groupCtrl.getReportSummary);
router.get("/reports/export", allowTeacherOrStaff, groupCtrl.exportGroupsReport);


// ─── QO'SHIMCHA MASHG'ULOT (support booking) ─────────────────────────────────
// Ustoz qabul vaqtini belgilaydi, o'quvchi Mini App'dan yoziladi.
// O'quvchi tomoni: routes/tma.js
const supportCtrl = require("../controllers/supportController");
const requireSupport = require("../middleware/support");

// ⚠️ Sozlama endpoint'lari `requireSupport` DAN O'TMAYDI — aks
//    holda o'chirilgan xizmatni qayta yoqib bo'lmasdi.
router.get("/support/settings", allowTeacherOrStaff, supportCtrl.getSettings);
// ⚠️ `onlyTeacher` EMAS: filial boshqaruvchisi ham sozlaydi.
//    Aniq tekshiruv controller ichida (`canManageSupport`) —
//    u yerda `manageStaff` ruxsati talab qilinadi.
router.put("/support/settings", allowTeacherOrStaff, supportCtrl.updateSettings);

// Ustozning kuni va tarixi
router.get("/support/today", allowTeacherOrStaff, requireSupport, supportCtrl.getToday);
router.get("/support/stats", allowTeacherOrStaff, requireSupport, supportCtrl.getStats);

// ⚠️ `/support/slots` YO'Q. Support ustozining "qabul vaqti"
//    degan tushuncha olib tashlandi: qabul markazning ish vaqti
//    davomida har doim ochiq, faqat band qilingan 30 daqiqa
//    bandligicha qoladi. Ish vaqti — `/support/settings` ichida.

router.get("/support/free", allowTeacherOrStaff, requireSupport, supportCtrl.getFree);
router.get("/support/bookings", allowTeacherOrStaff, requireSupport, supportCtrl.getBookings);
router.post("/support/bookings", allowTeacherOrStaff, requireSupport, supportCtrl.createBooking);
router.put("/support/bookings/:bookingId", allowTeacherOrStaff, requireSupport, supportCtrl.updateBooking);
router.get("/support/bookings/:bookingId/qr", allowTeacherOrStaff, requireSupport, supportCtrl.getQr);

// ─── XODIM DAVOMATI ─────────────────────────────────────────────────────────
//
// ⚠️ Egasi — filial boshqaruvchisi (`manageStaff`). Sozlamalar
//    esa `enabled` bayrog'idan qat'i nazar ochiq: o'chirilgan
//    xususiyatni qayta yoqish yo'li yopilib qolmasin.
const staffAttCtrl = require("../controllers/staffAttendanceController");

router.get("/staff-attendance/settings", allowTeacherOrStaff, staffAttCtrl.getSettings);
router.put("/staff-attendance/settings", allowTeacherOrStaff, staffAttCtrl.updateSettings);
router.get("/staff-attendance/day", allowTeacherOrStaff, staffAttCtrl.getDay);
router.post("/staff-attendance/mark", allowTeacherOrStaff, staffAttCtrl.mark);
router.get("/staff-attendance/month", allowTeacherOrStaff, staffAttCtrl.getMonth);

// ─── OTA-ONA TO'LOVLARI ─────────────────────────────────────────────────────
//
// ⚠️ PUL BIZDAN O'TMAYDI. Ota-ona markazning kartasiga
//    to'g'ridan-to'g'ri o'tkazadi; bu yerda faqat "to'ladim"
//    so'rovi tasdiqlanadi. Boshqa odamlarning pulini ushlab
//    turish alohida litsenziya talab qiladi.
const claimCtrl = require("../controllers/paymentClaimController");

router.get("/payment-claims", allowTeacherOrStaff, claimCtrl.list);
router.put("/payment-claims/:claimId", allowTeacherOrStaff, claimCtrl.review);
router.get("/payment-details", allowTeacherOrStaff, claimCtrl.getDetails);
router.put("/payment-details", allowTeacherOrStaff, claimCtrl.updateDetails);

// ─── KETISH ARAFASIDAGI O'QUVCHILAR ─────────────────────────────────────────
//
// Markaz o'quvchini yo'qotganini u ketgandan KEYIN biladi —
// navbatdagi to'lov kelmaganda. Belgilar esa oldin ko'rinadi va
// allaqachon bazamizda: bola ketishdan oldin kelmay qo'yadi.
const churnCtrl = require("../controllers/churnController");

router.get("/at-risk", allowTeacherOrStaff, churnCtrl.list);
router.post("/at-risk/:studentId/contacted", allowTeacherOrStaff, churnCtrl.markContacted);

// ─── O'QUVCHI KARTOCHKASI VA QIDIRUV ────────────────────────────────────────
//
// Administrator bitta bola haqida bilish uchun besh sahifani
// aylanib chiqardi. Endi bitta sahifa va istalgan joydan
// qidirish mumkin.
const cardCtrl = require("../controllers/studentCardController");

router.get("/search", allowTeacherOrStaff, cardCtrl.search);
router.get("/student/:studentId/card", allowTeacherOrStaff, cardCtrl.card);

module.exports = router;
