// src/controllers/paymentClaimController.js
// ════════════════════════════════════════════════════════════
// "To'ladim" so'rovlari — xodim tomoni.
//
// Ota-ona ilovadan yuboradi, xodim shu yerda tasdiqlaydi yoki
// rad etadi. Tasdiqlangach `MonthlyPayment` yopiladi va
// ota-onaga Telegram'ga xabar boradi.
//
// ⚠️ `managePayments` ruxsati talab qilinadi — bu PUL ustidagi
//    amal. Ustoz yoki qabulxona xodimi qarzni yopa olmasligi
//    kerak.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const svc = require("../services/paymentClaim");
const { notifyPaymentClaim, inBackground } = require("../services/notify");

// ── GET /api/lc/payment-claims?status=pending ───────────────
exports.list = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const claims = await svc.list({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
      status: req.query.status || "pending",
    });

    res.json({
      success: true,
      claims,
      pending: await svc.pendingCount(ctx.directorId, ctx.branchFilter || null),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── PUT /api/lc/payment-claims/:claimId ─────────────────────
// Body: { decision: 'confirmed' | 'rejected', reviewNote }
exports.review = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { decision, reviewNote } = req.body || {};
    if (!["confirmed", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ success: false, error: "Qaror: 'confirmed' yoki 'rejected'" });
    }

    const r = await svc.review({
      directorId: ctx.directorId,
      claimId: req.params.claimId,
      decision,
      reviewNote,
      by: ctx.staffId || ctx.directorId,
    });

    if (!r.ok) {
      return res.status(r.status || 400).json({ success: false, error: r.error });
    }

    // ⚠️ Fon rejimida: xabar ketmagani tasdiqlashga to'sqinlik
    //    qilmasin. Ota-ona xabarni ko'rmasa ham qarz yopilgan.
    inBackground(notifyPaymentClaim, {
      directorId: ctx.directorId,
      claimId: r.claim._id,
      decision,
    });

    res.json({ success: true, claim: r.claim });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/payment-details ─────────────────────────────
// Markazning karta rekvizitlari — ota-ona shuni ko'radi.
exports.getDetails = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const t = await Teacher.findById(ctx.directorId).select("paymentDetails").lean();

    res.json({
      success: true,
      details: {
        cardNumber: t?.paymentDetails?.cardNumber || "",
        cardHolder: t?.paymentDetails?.cardHolder || "",
        instructions: t?.paymentDetails?.instructions || "",
      },
      // ⚠️ Rekvizit — moliyaviy sozlama, uni har kim
      //    o'zgartira olmasligi kerak
      canEdit: Boolean(ctx.isDirector || ctx.permissions?.includes("managePayments")),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── PUT /api/lc/payment-details ─────────────────────────────
exports.updateDetails = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "managePayments");

    const { cardNumber = "", cardHolder = "", instructions = "" } = req.body || {};

    // ⚠️ Raqamdan boshqa hamma narsa olib tashlanadi. Direktor
    //    "8600 1234 5678 9012" deb yozadi, ota-ona esa nusxa
    //    olib bank ilovasiga qo'yadi — probel bilan ba'zi
    //    ilovalar qabul qilmaydi.
    const digits = String(cardNumber).replace(/\D/g, "");
    if (digits && (digits.length < 16 || digits.length > 19)) {
      return res.status(400).json({
        success: false,
        error: "Karta raqami 16 xonali bo'lishi kerak",
      });
    }

    await Teacher.updateOne(
      { _id: ctx.directorId },
      {
        $set: {
          "paymentDetails.cardNumber": digits,
          "paymentDetails.cardHolder": String(cardHolder).slice(0, 100).trim(),
          "paymentDetails.instructions": String(instructions).slice(0, 300).trim(),
        },
      },
    );

    res.json({ success: true, message: "Saqlandi" });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
