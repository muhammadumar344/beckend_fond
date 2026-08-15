// src/routes/tma.js
// ════════════════════════════════════════════════════════════
// Telegram Mini App — ota-ona va o'quvchi uchun.
//
// ⚠️ BU ROUTER BUTUNLAY ALOHIDA. Bu yerga hech qachon
//    `middleware/auth.js` (direktor tokeni) ulanmasin va
//    `tmaAuth` boshqa router'larda ishlatilmasin. Aralashtirsak
//    ota-ona hisobi bilan markaz moliyasiga yo'l ochilishi mumkin.
// ════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();

const tmaAuth = require("../middleware/tmaAuth");
const ctrl = require("../controllers/tmaController");
const { rateLimit } = require("../middleware/rateLimit");

// Kod terib topishga qarshi — imzo to'g'ri bo'lsa ham,
// bitta Telegram hisobi soatiga 10 marta urinishi mumkin
const redeemLimiter = rateLimit({
  name: "tma-redeem",
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyBy: (req) => req.tma?.user?.id || req.ip,
  message: "Juda ko'p urinish. Bir soatdan keyin urinib ko'ring.",
});

router.use(tmaAuth);

router.get("/me", ctrl.getMe);
router.post("/redeem", redeemLimiter, ctrl.redeemCode);

router.get("/student/:studentId/grades", ctrl.getGrades);
router.get("/student/:studentId/attendance", ctrl.getAttendance);
router.get("/student/:studentId/payments", ctrl.getPayments);

// ⚠️ Cheklov SHART: bu tugma xodimga ish yaratadi. Cheklovsiz
//    bitta odam yuzlab "to'ladim" yuborib, tasdiqlash ro'yxatini
//    ko'mib tashlashi mumkin edi.
const payLimiter = rateLimit({
  name: "tma-pay",
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyBy: (req) => req.tma?.user?.id || req.ip,
  message: "Juda ko'p urinish. Bir soatdan keyin urinib ko'ring.",
});
router.post("/student/:studentId/pay", payLimiter, ctrl.claimPayment);
router.get("/student/:studentId/homework", ctrl.getHomework);

// ── Qo'shimcha mashg'ulot ───────────────────────────────────
const bookLimiter = rateLimit({
  name: "tma-book",
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyBy: (req) => req.tma?.user?.id || req.ip,
  message: "Juda ko'p urinish. Birozdan keyin urinib ko'ring.",
});

router.get("/student/:studentId/teachers", ctrl.getSupportTeachers);
router.get("/student/:studentId/free", ctrl.getFreeSlots);
router.get("/student/:studentId/bookings", ctrl.getBookings);
router.post("/student/:studentId/bookings", bookLimiter, ctrl.createBooking);
// ⚠️ Bekor qilish endpoint'i ATAYLAB yo'q — controller izohiga qarang
router.post("/scan", bookLimiter, ctrl.scanQr);

module.exports = router;
