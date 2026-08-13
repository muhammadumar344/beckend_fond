// src/routes/payments.js
// ════════════════════════════════════════════════════════════
// Payme / Click webhook'lari va to'lov havolasi.
//
// ⚠️ HOZIRCHA O'CHIQ. `config/payments.js` da kalitlar yo'q,
//    shuning uchun har bir endpoint 503 qaytaradi. Merchant
//    olingach muhit o'zgaruvchilarini qo'ying — kod o'zgarmaydi.
//
// Bu route'lar `auth` middleware ORTIDA EMAS: Payme/Click
// serverlari bizga JWT bilan kelmaydi. Ularning haqiqiyligi
// imzo/parol orqali tekshiriladi (payme.checkAuth, click.checkSign).
// ════════════════════════════════════════════════════════════
const express = require("express");
const router = express.Router();

const { PROVIDERS, enabledProviders } = require("../config/payments");
const payme = require("../services/payments/payme");
const click = require("../services/payments/click");
const Teacher = require("../models/Teacher");
const { PLAN_PRICES } = require("../utils/planHelper");
const { onlyTeacher } = require("../middleware/roles");

/**
 * To'lov muvaffaqiyatli — obunani faollashtiradi.
 *
 * ⚠️ Ikkala provayder ham bir xil funksiyani chaqiradi, shuning
 *    uchun obuna mantig'i BITTA joyda. Payme'da bir xil, Click'da
 *    boshqacha bo'lib qolish xavfi yo'q.
 */
async function activateSubscription(tx) {
  const teacher = await Teacher.findById(tx.teacher);
  if (!teacher) return;

  const now = new Date();
  // Obuna hali tugamagan bo'lsa — ustiga qo'shamiz, nolga tushirmaymiz
  const base =
    teacher.planExpiresAt && teacher.planExpiresAt > now
      ? new Date(teacher.planExpiresAt)
      : now;
  base.setMonth(base.getMonth() + (tx.months || 1));

  teacher.plan = tx.plan;
  teacher.planExpiresAt = base;
  await teacher.save();

  console.log(
    `✅ Obuna faollashdi: ${teacher.email} → ${tx.plan}, ${tx.months} oy (${tx.provider})`,
  );
}

/** To'lov qaytarildi — obunani bekor qilamiz */
async function revokeSubscription(tx) {
  const teacher = await Teacher.findById(tx.teacher);
  if (!teacher) return;

  teacher.plan = "free";
  teacher.planExpiresAt = null;
  await teacher.save();

  console.warn(
    `⚠️ To'lov qaytarildi, obuna bekor qilindi: ${teacher.email} (${tx.provider})`,
  );
}

const hooks = { onPaid: activateSubscription, onRefund: revokeSubscription };

/** Provayder o'chiq bo'lsa so'rovni to'xtatadi */
const requireProvider = (name) => (req, res, next) => {
  if (!PROVIDERS[name]?.enabled) {
    return res.status(503).json({
      error: `${PROVIDERS[name]?.label || name} hali sozlanmagan`,
      configured: false,
    });
  }
  next();
};

// ── Holat: frontend qaysi tugmalarni ko'rsatishini biladi ────
router.get("/providers", (req, res) => {
  const list = enabledProviders();
  res.json({
    success: true,
    providers: list,
    // Bittasi ham yo'q bo'lsa frontend qo'lda to'lov oqimini ko'rsatadi
    manualOnly: list.length === 0,
  });
});

// ── Payme webhook (JSON-RPC) ─────────────────────────────────
router.post("/payme", requireProvider("payme"), async (req, res) => {
  const result = await payme.handle(
    req.body,
    req.headers.authorization,
    hooks,
  );
  // Payme HAR DOIM 200 kutadi — xato tananing ichida bo'ladi
  res.json(result);
});

// ── Click webhook (form-POST) ────────────────────────────────
router.post("/click", requireProvider("click"), async (req, res) => {
  const result = await click.handle(req.body, hooks);
  res.json(result);
});

// ── To'lov havolasini olish (foydalanuvchi bosadi) ───────────
router.post("/checkout", onlyTeacher, async (req, res) => {
  try {
    const { provider, plan, months = 1 } = req.body;

    if (!PROVIDERS[provider]?.enabled) {
      return res.status(503).json({
        success: false,
        error: "Bu to'lov usuli hali sozlanmagan",
        configured: false,
      });
    }
    if (!["pro", "premium"].includes(plan)) {
      return res
        .status(400)
        .json({ success: false, error: "Plan: 'pro' yoki 'premium'" });
    }

    const m = Math.max(1, Math.min(12, Number(months) || 1));
    const amountSum = (PLAN_PRICES[plan]?.monthly || 0) * m;

    const build =
      provider === "payme" ? payme.buildCheckoutUrl : click.buildCheckoutUrl;
    const url = build({
      teacherId: req.user.id,
      plan,
      months: m,
      amountSum,
      returnUrl: process.env.FRONTEND_URL || "",
    });

    res.json({ success: true, url, amount: amountSum, months: m });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.activateSubscription = activateSubscription;
