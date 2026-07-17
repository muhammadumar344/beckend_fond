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

// ─── DASHBOARD & HISOBOTLAR — ✅ YANGI ───────────────────────────────────────
router.get("/dashboard-stats", allowTeacherOrStaff, groupCtrl.getDashboardStats);
router.get("/reports/export", allowTeacherOrStaff, groupCtrl.exportGroupsReport);

module.exports = router;
