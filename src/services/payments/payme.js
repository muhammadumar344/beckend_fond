// src/services/payments/payme.js
// ════════════════════════════════════════════════════════════
// Payme Merchant API (JSON-RPC 2.0).
//
// ⚠️ MERCHANT KALITI YO'Q — bu kod hali JONLI SINALMAGAN.
//    Mantiq hujjatga qarab yozilgan va testlar bilan qoplangan,
//    lekin Payme sandbox'ida tekshirilishi SHART (docs/PAYMENTS.md).
//
// Payme serveri bizga POST yuboradi, biz javob qaytaramiz:
//
//   CheckPerformTransaction  → to'lash mumkinmi?
//   CreateTransaction        → tranzaksiya ochish (pul bloklanadi)
//   PerformTransaction       → yakunlash (pul yechiladi)
//   CancelTransaction        → bekor qilish / qaytarish
//   CheckTransaction         → holatni so'rash
//
// Autentifikatsiya: Basic auth, `Paycom:KEY`.
// Summa TIYINDA keladi (1 so'm = 100 tiyin).
// ════════════════════════════════════════════════════════════
const crypto = require("crypto");
const { payme: cfg } = require("../../config/payments");
const Transaction = require("../../models/Transaction");
const Teacher = require("../../models/Teacher");
const { priceFor } = require("../../utils/planHelper");

// Payme xato kodlari — hujjatda belgilangan, o'zgartirmang
const ERR = {
  TRANSPORT: -32300,
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32400,
  INSUFFICIENT_PRIVILEGE: -32504,
  // Merchant tomonidagi kodlar
  INVALID_AMOUNT: -31001,
  ORDER_NOT_FOUND: -31050,
  CANT_PERFORM: -31008,
  TX_NOT_FOUND: -31003,
  ALREADY_DONE: -31007,
};

// Payme tranzaksiya holatlari
const PAYME_STATE = {
  CREATED: 1,
  COMPLETED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_COMPLETE: -2,
};

// Tranzaksiya ochiq turishi mumkin bo'lgan maksimal vaqt (12 soat)
const TIMEOUT_MS = 12 * 60 * 60 * 1000;

const err = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message: { uz: message, ru: message, en: message }, data },
});
const ok = (id, result) => ({ jsonrpc: "2.0", id: id ?? null, result });

/**
 * Basic auth sarlavhasini tekshiradi.
 * Kutilgan: `Basic base64("Paycom:" + KEY)`
 *
 * ⚠️ Solishtirish `timingSafeEqual` bilan — oddiy `===` kalitni
 *    belgima-belgi topish imkonini beradigan vaqt farqi qoldiradi.
 */
function checkAuth(authHeader) {
  if (!cfg.enabled) return false;
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  let decoded;
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  const login = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  if (login !== "Paycom") return false;

  const valid = [cfg.key, cfg.testKey].filter(Boolean);
  return valid.some((k) => {
    const a = Buffer.from(pass);
    const b = Buffer.from(k);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/**
 * `account` dan buyurtmani topadi va summani tekshiradi.
 * Bizda buyurtma = direktorning obuna to'lovi.
 */
async function resolveOrder(params) {
  const account = params?.account || {};
  const teacherId = account.teacher_id || account.order_id;
  const plan = account.plan;
  const months = Number(account.months || 1);

  if (!teacherId || !/^[0-9a-fA-F]{24}$/.test(String(teacherId))) {
    return { error: { code: ERR.ORDER_NOT_FOUND, message: "Hisob topilmadi" } };
  }
  if (!["pro", "premium"].includes(plan)) {
    return { error: { code: ERR.ORDER_NOT_FOUND, message: "Tarif noto'g'ri" } };
  }

  const teacher = await Teacher.findById(teacherId).select(
    "_id isActive institutionType plan planExpiresAt",
  );
  if (!teacher || !teacher.isActive) {
    return { error: { code: ERR.ORDER_NOT_FOUND, message: "Hisob topilmadi" } };
  }

  // Kutilgan summa — tiyinda
  // ⚠️ Narx REJIMGA bog'liq — LC va Fond narxlari boshqa
  const expectedSum = (priceFor(plan, teacher)?.monthly || 0) * months;
  const expectedTiyin = expectedSum * cfg.amountMultiplier;
  if (Number(params.amount) !== expectedTiyin) {
    return {
      error: { code: ERR.INVALID_AMOUNT, message: "Summa noto'g'ri" },
    };
  }

  return { teacher, plan, months, amountSum: expectedSum };
}

// ── Metodlar ──────────────────────────────────────────────────

async function checkPerformTransaction(id, params) {
  const r = await resolveOrder(params);
  if (r.error) return err(id, r.error.code, r.error.message);
  return ok(id, { allow: true });
}

async function createTransaction(id, params) {
  const existing = await Transaction.findOne({
    provider: "payme",
    providerTransactionId: params.id,
  });

  // Takroriy so'rov — YANGI yozuv yaratmaymiz, borini qaytaramiz
  if (existing) {
    if (existing.state !== "pending") {
      return err(id, ERR.CANT_PERFORM, "Tranzaksiya yakunlangan");
    }
    if (Date.now() - existing.createTime > TIMEOUT_MS) {
      existing.state = "cancelled";
      existing.cancelTime = Date.now();
      existing.cancelReason = 4; // timeout
      await existing.save();
      return err(id, ERR.CANT_PERFORM, "Tranzaksiya muddati tugadi");
    }
    return ok(id, {
      create_time: existing.createTime,
      transaction: String(existing._id),
      state: PAYME_STATE.CREATED,
    });
  }

  const r = await resolveOrder(params);
  if (r.error) return err(id, r.error.code, r.error.message);

  // Shu hisobda allaqachon ochiq tranzaksiya bo'lsa — ikkinchisiga yo'l yo'q
  const openOne = await Transaction.findOne({
    teacher: r.teacher._id,
    state: "pending",
    provider: "payme",
  });
  if (openOne) {
    return err(id, ERR.CANT_PERFORM, "Boshqa tranzaksiya ochiq");
  }

  const tx = await Transaction.create({
    provider: "payme",
    providerTransactionId: params.id,
    teacher: r.teacher._id,
    purpose: "subscription",
    plan: r.plan,
    months: r.months,
    amount: r.amountSum,
    state: "pending",
    createTime: Number(params.time) || Date.now(),
    rawPayload: params,
  });

  return ok(id, {
    create_time: tx.createTime,
    transaction: String(tx._id),
    state: PAYME_STATE.CREATED,
  });
}

async function performTransaction(id, params, onPaid) {
  const tx = await Transaction.findOne({
    provider: "payme",
    providerTransactionId: params.id,
  });
  if (!tx) return err(id, ERR.TX_NOT_FOUND, "Tranzaksiya topilmadi");

  // Allaqachon to'langan — bir xil javob qaytaramiz (idempotentlik)
  if (tx.state === "paid") {
    return ok(id, {
      transaction: String(tx._id),
      perform_time: tx.performTime,
      state: PAYME_STATE.COMPLETED,
    });
  }
  if (tx.state !== "pending") {
    return err(id, ERR.CANT_PERFORM, "Tranzaksiya bekor qilingan");
  }
  if (Date.now() - tx.createTime > TIMEOUT_MS) {
    tx.state = "cancelled";
    tx.cancelTime = Date.now();
    tx.cancelReason = 4;
    await tx.save();
    return err(id, ERR.CANT_PERFORM, "Tranzaksiya muddati tugadi");
  }

  tx.state = "paid";
  tx.performTime = Date.now();
  await tx.save();

  // Obunani faollashtirish — chaqiruvchi beradi
  if (typeof onPaid === "function") await onPaid(tx);

  return ok(id, {
    transaction: String(tx._id),
    perform_time: tx.performTime,
    state: PAYME_STATE.COMPLETED,
  });
}

async function cancelTransaction(id, params, onRefund) {
  const tx = await Transaction.findOne({
    provider: "payme",
    providerTransactionId: params.id,
  });
  if (!tx) return err(id, ERR.TX_NOT_FOUND, "Tranzaksiya topilmadi");

  const already = tx.state === "cancelled" || tx.state === "refunded";
  if (!already) {
    const wasPaid = tx.state === "paid";
    tx.state = wasPaid ? "refunded" : "cancelled";
    tx.cancelTime = Date.now();
    tx.cancelReason = Number(params.reason) || null;
    await tx.save();

    // To'langandan keyin bekor qilinsa — obunani qaytarib olish kerak
    if (wasPaid && typeof onRefund === "function") await onRefund(tx);
  }

  return ok(id, {
    transaction: String(tx._id),
    cancel_time: tx.cancelTime,
    state:
      tx.state === "refunded"
        ? PAYME_STATE.CANCELLED_AFTER_COMPLETE
        : PAYME_STATE.CANCELLED,
  });
}

async function checkTransaction(id, params) {
  const tx = await Transaction.findOne({
    provider: "payme",
    providerTransactionId: params.id,
  });
  if (!tx) return err(id, ERR.TX_NOT_FOUND, "Tranzaksiya topilmadi");

  let state = PAYME_STATE.CREATED;
  if (tx.state === "paid") state = PAYME_STATE.COMPLETED;
  else if (tx.state === "cancelled") state = PAYME_STATE.CANCELLED;
  else if (tx.state === "refunded") state = PAYME_STATE.CANCELLED_AFTER_COMPLETE;

  return ok(id, {
    create_time: tx.createTime,
    perform_time: tx.performTime,
    cancel_time: tx.cancelTime,
    transaction: String(tx._id),
    state,
    reason: tx.cancelReason,
  });
}

/**
 * Kirish nuqtasi — routes/payments.js shuni chaqiradi.
 * @param {object} body     JSON-RPC tanasi
 * @param {string} auth     Authorization sarlavhasi
 * @param {object} hooks    { onPaid, onRefund }
 */
async function handle(body, auth, hooks = {}) {
  if (!checkAuth(auth)) {
    return err(body?.id, ERR.INSUFFICIENT_PRIVILEGE, "Ruxsat yo'q");
  }

  const { id, method, params } = body || {};
  if (!method) return err(id, ERR.INVALID_REQUEST, "Metod ko'rsatilmagan");

  try {
    switch (method) {
      case "CheckPerformTransaction":
        return await checkPerformTransaction(id, params);
      case "CreateTransaction":
        return await createTransaction(id, params);
      case "PerformTransaction":
        return await performTransaction(id, params, hooks.onPaid);
      case "CancelTransaction":
        return await cancelTransaction(id, params, hooks.onRefund);
      case "CheckTransaction":
        return await checkTransaction(id, params);
      default:
        return err(id, ERR.METHOD_NOT_FOUND, "Metod topilmadi");
    }
  } catch (e) {
    console.error("payme handle error:", e);
    return err(id, ERR.INTERNAL, "Ichki xato");
  }
}

/** To'lov sahifasiga havola (foydalanuvchi shu yerga yuboriladi) */
function buildCheckoutUrl({ teacherId, plan, months, amountSum, returnUrl }) {
  const params = [
    `m=${cfg.merchantId}`,
    `ac.teacher_id=${teacherId}`,
    `ac.plan=${plan}`,
    `ac.months=${months}`,
    `a=${amountSum * cfg.amountMultiplier}`,
  ];
  if (returnUrl) params.push(`c=${returnUrl}`);
  const encoded = Buffer.from(params.join(";")).toString("base64");
  return `${cfg.checkoutUrl}/${encoded}`;
}

module.exports = { handle, buildCheckoutUrl, checkAuth, ERR, PAYME_STATE };
