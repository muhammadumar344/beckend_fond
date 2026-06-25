// src/routes/lc.js — YANGI FAYL
// Learning Center: Role va Staff endpointlari
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const salaryCtrl = require("../controllers/salaryController");
const roleCtrl = require("../controllers/roleController");
const staffCtrl = require("../controllers/staffController");
const branchCtrl = require("../controllers/branchController");
// ── DIRECTOR (teacher role) yoki STAFF kira oladigan route lar ──
// Auth shart, lekin role 'teacher' YOKI 'staff' bo'lishi mumkin
const requireTeacherOrStaff = (req, res, next) => {
  if (req.user.role === "teacher" || req.user.role === "staff") return next();
  return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
};

router.use(auth, requireTeacherOrStaff);

router.post("/salaries", salaryCtrl.setSalary);
router.put("/salaries/:salaryId/paid", salaryCtrl.markAsPaid);
router.get("/salaries/branch/:branchId", salaryCtrl.getBranchSalaries);
router.get("/salaries/my", salaryCtrl.getMySalaryHistory);

router.put("/branches/:branchId/manager", branchCtrl.assignManager);
router.put("/branches/:branchId/become-manager", branchCtrl.becomeManagerToo);
// ── Rollar ────────────────────────────────────────────────────
router.get("/roles", roleCtrl.getMyRoles);
router.post("/roles", roleCtrl.createRole);
router.delete("/roles/:roleId", roleCtrl.deleteRole);

// ── Xodimlar ──────────────────────────────────────────────────
router.post("/staff", staffCtrl.createStaff);
router.get("/staff", staffCtrl.getMyStaff);
router.put("/staff/:staffId/toggle", staffCtrl.toggleStaffStatus);

router.put('/branches/:branchId/manager',          branchCtrl.assignManager)
router.put('/branches/:branchId/become-manager',   branchCtrl.becomeManagerToo)


module.exports = router;

// ════════════════════════════════════════════════════════════
// server.js ga qo'shing:
//   app.use('/api/lc', require('./routes/lc'))
//
// Public route (auth siz, server.js da boshqa public route lar bilan):
//   const staffCtrl = require('./controllers/staffController')
//   app.get('/api/staff/verify/:token', staffCtrl.verifyEmail)
//
