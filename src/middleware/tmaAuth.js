// src/middleware/tmaAuth.js
// ════════════════════════════════════════════════════════════
// Mini App so'rovlarini tekshiradi.
//
// ⚠️ BU MIDDLEWARE DIREKTOR TOKENINI QABUL QILMAYDI va aksincha.
//    Ikkalasi butunlay alohida. Sabab: ota-ona tokeni bilan
//    `/api/teacher/*` ga kirish yo'li ochilib qolsa, butun markaz
//    ma'lumoti ochiladi. Shuning uchun `/api/tma/*` o'zining
//    middleware'i, o'zining controlleri bilan yashaydi.
//
// NEGA O'ZIMIZNING JWT YO'Q: Telegram har so'rovda imzolangan
// `initData` beradi va uni yangilab turadi. O'z tokenimizni
// qo'shsak — yana bitta muddat, yana bitta yangilash oqimi, yana
// bitta o'g'irlanishi mumkin bo'lgan narsa. Imzoni har safar
// tekshirish ~0.1 ms turadi.
// ════════════════════════════════════════════════════════════

const { verifyInitData } = require("../services/telegramAuth");
const StudentLink = require("../models/StudentLink");
const { BOT_TOKEN } = require("../bot/bot");

const HEADER = "x-telegram-init-data";

module.exports = async function tmaAuth(req, res, next) {
  try {
    const initData = req.headers[HEADER];

    const v = verifyInitData(initData, BOT_TOKEN);
    if (!v.ok) {
      return res.status(401).json({ success: false, error: v.reason });
    }

    // Bu Telegram hisobiga bog'langan o'quvchilar
    const links = await StudentLink.find({
      telegramUserId: v.user.id,
      isActive: true,
    })
      .populate("student", "name class")
      .lean();

    req.tma = {
      user: v.user,
      links,
      /** Berilgan o'quvchiga bog'lanish (yo'q bo'lsa undefined) */
      linkFor(studentId) {
        return links.find(
          (l) => l.student && String(l.student._id) === String(studentId),
        );
      },
    };

    next();
  } catch (err) {
    console.error("[tmaAuth]", err);
    res.status(500).json({ success: false, error: "Server xatosi" });
  }
};
