// src/routes/public.js
// ════════════════════════════════════════════════════════════
// AUTENTIFIKATSIYASIZ ROUTE'LAR.
//
// ⚠️ BU YERGA `auth` QO'YILMAYDI va aynan shu sababdan bu fayl
//    alohida: `routes/teacher.js` ichida qolsa, kimdir bir kun
//    router darajasida `auth` qo'shib qo'yardi va ochiq havola
//    jimgina ishlamay qolardi (yoki teskarisi — himoyalangan
//    route ochiq qolardi).
//
// ⚠️ BU YERGA FAQAT ISMSIZ, PULDAN BOSHQA HECH NARSA
//    KO'RSATMAYDIGAN ma'lumot qo'shiladi. Ikkilansangiz —
//    qo'shmang.
// ════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();

const { rateLimit } = require("../middleware/rateLimit");
const ctrl = require("../controllers/publicReportController");

// ⚠️ Token 32 belgi bo'lsa ham cheklov SHART: cheklovsiz ochiq
//    endpoint terib topishga taklif bo'ladi. Chegara saxiy —
//    bitta sinf guruhida 30 ta ota-ona bir vaqtda ochishi
//    normal hol, va ular bitta maktab Wi-Fi'sida bo'lishi
//    mumkin (ya'ni bitta IP).
const reportLimiter = rateLimit({
  name: "publicReport",
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring.",
});

router.get("/report/:token", reportLimiter, ctrl.report);

module.exports = router;
