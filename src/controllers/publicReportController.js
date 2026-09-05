// src/controllers/publicReportController.js
// ════════════════════════════════════════════════════════════
// OCHIQ HISOBOT — TOKEN BILAN, LOGIN'SIZ.
//
// ⚠️ BU YAGONA AUTENTIFIKATSIYASIZ MA'LUMOT ENDPOINT'I.
//    Shuning uchun uchta qoida qat'iy:
//
//    1. Token bo'yicha TOPILADI, id bo'yicha emas. Sinf id si
//       manzillarda ko'rinadi va uni topish oson; token esa
//       tasodifiy 32 belgi.
//    2. Javobda ISM YO'Q — na o'quvchi, na ota-ona, na xodim.
//       Faqat pul va sanoq (`services/publicReport.js` izohiga
//       qarang).
//    3. Arxivlangan sinf ochilmaydi: o'quv yili tugagach havola
//       o'zi so'nadi va eski yozishmadagi havola abadiy ochiq
//       qolmaydi.
//
// ⚠️ So'rov cheklangan (`routes/public.js`): token 32 belgi
//    bo'lsa ham, cheklovsiz endpoint terib topishga taklif
//    bo'lardi.
// ════════════════════════════════════════════════════════════

const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const { buildPublicReport } = require("../services/publicReport");

// ── GET /api/public/report/:token?month=&year= ──────────────
exports.report = async (req, res) => {
  try {
    const token = String(req.params.token || "");
    // Uzunligi mos kelmasa bazaga umuman bormaymiz
    if (token.length < 16 || token.length > 64) {
      return res.status(404).json({ success: false, error: "Havola topilmadi" });
    }

    const cls = await Class.findOne({ publicToken: token, archivedAt: null })
      .select("name teacher initialBalance")
      .lean();
    if (!cls) {
      return res.status(404).json({ success: false, error: "Havola topilmadi" });
    }

    // ⚠️ Direktorning holati ham tekshiriladi: hisob bloklangan
    //    yoki o'chirilayotgan bo'lsa havola ham yopiladi. Aks
    //    holda o'chirilgan hisobning ma'lumoti ochiq qolardi.
    const director = await Teacher.findById(cls.teacher)
      .select("institutionName isActive deletionScheduledFor")
      .lean();
    if (!director || director.isActive === false || director.deletionScheduledFor) {
      return res.status(404).json({ success: false, error: "Havola topilmadi" });
    }

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    const [payments, expenses] = await Promise.all([
      MonthlyPayment.find({ class: cls._id, month, year })
        .select("amount status")
        .lean(),
      Expense.find({ class: cls._id, month, year })
        .select("reason amount spentDate createdAt receipt")
        .lean(),
    ]);

    const report = buildPublicReport({
      cls,
      centerName: director.institutionName || "",
      payments,
      expenses,
      month,
      year,
    });

    // ⚠️ Kesh sarlavhasi: bir xil havolani 30 ta ota-ona bir
    //    daqiqada ochadi (guruhga tashlangan zahoti). Render'ning
    //    bepul tarifi bunga arzimaydi — 60 soniya yetarli.
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ success: true, report });
  } catch (err) {
    console.error("[public report]", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};
