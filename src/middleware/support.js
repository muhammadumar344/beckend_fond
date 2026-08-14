// src/middleware/support.js
// ════════════════════════════════════════════════════════════
// Qo'shimcha mashg'ulot xizmati shu markazda bor-yo'qligi.
//
// ⚠️ Interfeysda menyuni yashirish YETARLI EMAS. So'rovni qo'lda
//    yuborish mumkin, shuning uchun tekshiruv server tomonida
//    ham bo'lishi shart.
//
// ⚠️ Yoqish/o'chirish endpoint'ining O'ZI bu tekshiruvdan
//    o'tmaydi — aks holda o'chirilgan xizmatni qayta yoqib
//    bo'lmasdi.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const { resolveContext } = require("../utils/resolveContext");

module.exports = async function requireSupport(req, res, next) {
  try {
    const ctx = await resolveContext(req);
    const director = await Teacher.findById(ctx.directorId)
      .select("supportEnabled")
      .lean();

    if (!director?.supportEnabled) {
      return res.status(403).json({
        success: false,
        error: "Bu markazda qo'shimcha mashg'ulot xizmati yo'q",
        supportDisabled: true,
      });
    }

    next();
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
};
