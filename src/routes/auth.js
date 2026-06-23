const express = require("express");
const authController = require("../controllers/authController");
const staffCtrl = require("../controllers/staffController");
const router = express.Router();

router.get("/setup/check", authController.checkSetup);
router.post("/setup", authController.createAdmin);
router.post("/staff/login", staffCtrl.staffLogin);

router.post("/admin/login", authController.adminLogin);
router.post("/teacher/login", authController.teacherLogin);

module.exports = router;
