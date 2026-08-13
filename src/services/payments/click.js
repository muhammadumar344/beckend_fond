// src/services/payments/click.js
// ════════════════════════════════════════════════════════════
// Click Merchant API (Prepare / Complete).
//
// ⚠️ MERCHANT KALITI YO'Q — bu kod hali JONLI SINALMAGAN.
//    Mantiq hujjatga qarab yozilgan va testlar bilan qoplangan,
//    lekin Click sinov muhitida tekshirilishi SHART.
//
// Click Payme'dan farqli — JSON-RPC emas, oddiy form-POST:
//
//   action=0 → Prepare   (tekshirish, tranzaksiya ochish)
//   action=1 → Complete  (yakunlash)
//
// Har bir so'rov MD5 imzo bilan keladi. Imzo mos kelmasa —
// so'rov soxta, rad etamiz.
//
// Summa SO'MDA keladi (Payme'dan farqli — u tiyinda yuboradi).
// ════════════════════════════════════════════════════════════
const crypto = require("crypto");
const { click: cfg } = require("../../config/payments");
const Transaction = require("../../models/Transaction");
const Teacher = require("../../models/Teacher");
const { PLAN_PRICES } = require("../../utils/planHelper");

// Click xato kodlari — hujjatda belgilangan
const ERR = {
  OK: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  ERROR_IN_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
};

const ACTION = { PREPARE: 0, COMPLETE: 1 };

/**
 * Imzoni tekshiradi.
 *
 * Prepare uchun:
 *   md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id
 *       + amount + action + sign_time)
 *
 * Complete uchun ortasiga `merchant_prepare_id` ham qo'shiladi.
 *
 * ⚠️ Solishtirish `timingSafeEqual` bilan.
 */
function checkSign(p) {
  if (!cfg.enabled) return false;

  const parts = [
    p.click_trans_id,
    p.service_id,
    cfg.secretKey,
    p.merchant_trans_id,
  ];
  if (String(p.action) === String(ACTION.COMPLETE)) {
    parts.push(p.merchant_prepare_id);
  }
  parts.push(p.amount, p.action, p.sign_time);

  const expected = crypto
    .createHash("md5")
    .update(parts.join(""))
    .digest("hex");

  const got = String(p.sign_string || "").toLowerCase();
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const reply = (p, error, note, extra = {}) => ({
  click_trans_id: p.click_trans_id,
  merchant_trans_id: p.merchant_trans_id,
  error,
  error_note: note,
  ...extra,
});

/**
 * `merchant_trans_id` — biz yaratgan buyurtma kodi.
 * Format: `<teacherId>_<plan>_<months>`
 */
function parseOrder(merchantTransId) {
  const [teacherId, plan, months] = String(merchantTransId || "").split("_");
  return { teacherId, plan, months: Number(months || 1) };
}

async function validateOrder(p) {
  const { teacherId, plan, months } = parseOrder(p.merchant_trans_id);

  if (!teacherId || !/^[0-9a-fA-F]{24}$/.test(teacherId)) {
    return { error: ERR.USER_NOT_FOUND, note: "Hisob topilmadi" };
  }
  if (!["pro", "premium"].includes(plan)) {
    return { error: ERR.USER_NOT_FOUND, note: "Tarif noto'g'ri" };
  }

  const teacher = await Teacher.findById(teacherId).select("_id isActive");
  if (!teacher || !teacher.isActive) {
    return { error: ERR.USER_NOT_FOUND, note: "Hisob topilmadi" };
  }

  const expected = (PLAN_PRICES[plan]?.monthly || 0) * months;
  if (Number(p.amount) !== expected) {
    return { error: ERR.INCORRECT_AMOUNT, note: "Summa noto'g'ri" };
  }

  return { teacher, plan, months, amount: expected };
}

// ── Prepare (action=0) ────────────────────────────────────────
async function prepare(p) {
  const v = await validateOrder(p);
  if (v.error) return reply(p, v.error, v.note);

  const existing = await Transaction.findOne({
    provider: "click",
    providerTransactionId: String(p.click_trans_id),
  });

  // Takroriy so'rov — borini qaytaramiz, yangi yaratmaymiz
  if (existing) {
    if (existing.state === "paid") {
      return reply(p, ERR.ALREADY_PAID, "Allaqachon to'langan");
    }
    if (existing.state !== "pending") {
      return reply(p, ERR.TRANSACTION_CANCELLED, "Bekor qilingan");
    }
    return reply(p, ERR.OK, "Success", {
      merchant_prepare_id: String(existing._id),
    });
  }

  const tx = await Transaction.create({
    provider: "click",
    providerTransactionId: String(p.click_trans_id),
    teacher: v.teacher._id,
    purpose: "subscription",
    plan: v.plan,
    months: v.months,
    amount: v.amount,
    state: "pending",
    createTime: Date.now(),
    rawPayload: p,
  });

  return reply(p, ERR.OK, "Success", {
    merchant_prepare_id: String(tx._id),
  });
}

// ── Complete (action=1) ───────────────────────────────────────
async function complete(p, onPaid) {
  const tx = await Transaction.findOne({
    provider: "click",
    providerTransactionId: String(p.click_trans_id),
  });
  if (!tx) return reply(p, ERR.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi");

  // `merchant_prepare_id` biz Prepare'da bergan ID bo'lishi shart
  if (String(p.merchant_prepare_id) !== String(tx._id)) {
    return reply(p, ERR.TRANSACTION_NOT_FOUND, "Tranzaksiya mos kelmadi");
  }

  // Idempotentlik: qayta so'rovda bir xil javob
  if (tx.state === "paid") {
    return reply(p, ERR.OK, "Success", {
      merchant_confirm_id: String(tx._id),
    });
  }
  if (tx.state !== "pending") {
    return reply(p, ERR.TRANSACTION_CANCELLED, "Bekor qilingan");
  }

  // Click xatolik bilan yopilgan bo'lsa (error < 0) — bekor qilamiz
  if (Number(p.error) < 0) {
    tx.state = "cancelled";
    tx.cancelTime = Date.now();
    tx.cancelReason = Number(p.error);
    await tx.save();
    return reply(p, ERR.TRANSACTION_CANCELLED, "Bekor qilindi");
  }

  if (Number(p.amount) !== tx.amount) {
    return reply(p, ERR.INCORRECT_AMOUNT, "Summa noto'g'ri");
  }

  tx.state = "paid";
  tx.performTime = Date.now();
  await tx.save();

  if (typeof onPaid === "function") await onPaid(tx);

  return reply(p, ERR.OK, "Success", { merchant_confirm_id: String(tx._id) });
}

/**
 * Kirish nuqtasi — routes/payments.js shuni chaqiradi.
 */
async function handle(params, hooks = {}) {
  const p = params || {};

  if (!checkSign(p)) {
    return reply(p, ERR.SIGN_CHECK_FAILED, "Imzo noto'g'ri");
  }

  try {
    const action = Number(p.action);
    if (action === ACTION.PREPARE) return await prepare(p);
    if (action === ACTION.COMPLETE) return await complete(p, hooks.onPaid);
    return reply(p, ERR.ACTION_NOT_FOUND, "Action topilmadi");
  } catch (e) {
    console.error("click handle error:", e);
    return reply(p, ERR.FAILED_TO_UPDATE, "Ichki xato");
  }
}

/** To'lov sahifasiga havola */
function buildCheckoutUrl({ teacherId, plan, months, amountSum, returnUrl }) {
  const merchantTransId = `${teacherId}_${plan}_${months}`;
  const q = new URLSearchParams({
    service_id: cfg.serviceId,
    merchant_id: cfg.merchantId,
    amount: String(amountSum),
    transaction_param: merchantTransId,
  });
  if (returnUrl) q.set("return_url", returnUrl);
  return `${cfg.checkoutUrl}?${q.toString()}`;
}

module.exports = { handle, buildCheckoutUrl, checkSign, ERR, ACTION };
