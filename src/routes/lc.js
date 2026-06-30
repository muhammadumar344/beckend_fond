const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { onlyTeacher, allowTeacherOrStaff } = require("../middleware/roles");

const roleCtrl = require("../controllers/roleController");
const staffCtrl = require("../controllers/staffController");
const salaryCtrl = require("../controllers/salaryController");

router.use(auth);

// ─── ROLES ───────────────────────────────────────────────────────────────────
router.get("/roles/my", allowTeacherOrStaff, roleCtrl.getMyRole); // /my avval!
router.get("/roles", allowTeacherOrStaff, roleCtrl.getRoles);
router.post("/roles", onlyTeacher, roleCtrl.createRole);
router.put("/roles/:id", onlyTeacher, roleCtrl.updateRole);
router.delete("/roles/:id", onlyTeacher, roleCtrl.deleteRole);

// ─── BRANCH MANAGER ────────────────────────────────────────────────────────
// Filialga manager tayinlash/olib tashlash: body { staffId }
router.put("/branches/:id/manager", onlyTeacher, staffCtrl.assignManager);
// Direktor o'zini ham shu filial manageri qilib belgilaydi (toggle)
router.put("/branches/:id/manager/self", onlyTeacher, staffCtrl.becomeManagerToo);

// ─── STAFF ───────────────────────────────────────────────────────────────────
router.get("/staff", allowTeacherOrStaff, staffCtrl.getStaff);
router.get("/staff/:id", allowTeacherOrStaff, staffCtrl.getStaffById);
router.post("/staff", allowTeacherOrStaff, staffCtrl.createStaff);
router.put("/staff/:id", allowTeacherOrStaff, staffCtrl.updateStaff);
router.put("/staff/:id/toggle", allowTeacherOrStaff, staffCtrl.toggleStaff);
router.put(
  "/staff/:id/reset-password",
  onlyTeacher,
  staffCtrl.resetStaffPassword,
);

// ─── SALARIES ────────────────────────────────────────────────────────────────
router.get('/salaries/my',           allowTeacherOrStaff, salaryCtrl.getMySalaryHistory);
router.get('/salaries/summary',      allowTeacherOrStaff, salaryCtrl.getSalarySummary);
router.get('/salaries',              allowTeacherOrStaff, salaryCtrl.getSalaries);
router.post('/salaries',             allowTeacherOrStaff, salaryCtrl.setSalary);
router.put('/salaries/:id/pay',      allowTeacherOrStaff, salaryCtrl.markSalaryPaid);
router.delete('/salaries/:id',       allowTeacherOrStaff, salaryCtrl.deleteSalary);

module.exports = router;