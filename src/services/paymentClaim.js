// src/services/paymentClaim.js
// ════════════════════════════════════════════════════════════
// "To'ladim" da'vosining mantig'i — Mini App va CRM uchun bir xil.
//
// ⚠️ TASDIQLASH SHART. Pul haqiqatan kelganini faqat markaz
//    biladi — bank hisobini biz ko'rmaymiz. Tugma bosilishi
//    bilan qarz o'chsa, istalgan odam bir bosishda "to'ladim"
//    qilib qo'yardi va CRM'dagi raqamlar yolg'onga aylanardi.
//
// ⚠️ Tasdiqlangandan KEYIN `MonthlyPayment` yangilanadi. Ikkita
//    joyda ikki xil holat bo'lib qolmasligi uchun yagona yo'l
//    shu yerdan o'tadi — controller to'g'ridan-to'g'ri
//    `MonthlyPayment` ga tegmaydi.
// ════════════════════════════════════════════════════════════

const PaymentClaim = require("../models/PaymentClaim");
const MonthlyPayment = require("../models/MonthlyPayment");
const Student = require("../models/Student");
const Class = require("../models/Class");

/**
 * Ota-ona "to'ladim" deydi.
 *
 * @returns {Promise<{ok: true, claim} | {ok: false, status, error}>}
 */
async function create({
  directorId,
  studentId,
  month,
  year,
  amount,
  note = "",
  telegramId = "",
}) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) {
    return { ok: false, status: 400, error: "Oy yoki yil noto'g'ri" };
  }

  const student = await Student.findById(studentId).select("class name").lean();
  if (!student) {
    return { ok: false, status: 404, error: "O'quvchi topilmadi" };
  }

  // ⚠️ To'lov varaqasi BO'LISHI SHART. Bo'lmasa qaysi summa
  //    kutilayotgani noma'lum va ota-ona istalgan raqamni
  //    yozib yuborardi.
  const bill = await MonthlyPayment.findOne({
    student: studentId,
    month: m,
    year: y,
  });
  if (!bill) {
    return {
      ok: false,
      status: 404,
      error: "Bu oy uchun to'lov varaqasi yaratilmagan. Markazga murojaat qiling.",
    };
  }
  if (bill.status === "paid") {
    return { ok: false, status: 400, error: "Bu oy allaqachon to'langan" };
  }

  const group = await Class.findById(student.class).select("branch").lean();

  try {
    const claim = await PaymentClaim.create({
      director: directorId,
      branch: group?.branch || null,
      student: studentId,
      month: m,
      year: y,
      // ⚠️ Summani ota-onadan OLMAYMIZ — varaqadagi summa olinadi.
      //    Aks holda u "1000 so'm to'ladim" deb yuborib, xodim
      //    e'tibor bermay tasdiqlab yuborishi mumkin edi.
      amount: bill.amount || 0,
      note: String(note || "").slice(0, 300),
      claimedByTelegramId: String(telegramId || ""),
      via: "transfer",
    });
    return { ok: true, claim };
  } catch (err) {
    // Noyob indeks: shu oyga allaqachon kutilayotgan da'vo bor
    if (err.code === 11000) {
      return {
        ok: false,
        status: 409,
        error: "Bu oy uchun to'lovingiz allaqachon tekshirilmoqda",
      };
    }
    throw err;
  }
}

/**
 * Xodim ko'rib chiqadi.
 *
 * @param {'confirmed'|'rejected'} decision
 */
async function review({ directorId, claimId, decision, reviewNote = "", by = null }) {
  const claim = await PaymentClaim.findOne({
    _id: claimId,
    director: directorId, // ⚠️ boshqa markazning da'vosiga tegmasin
  });
  if (!claim) return { ok: false, status: 404, error: "So'rov topilmadi" };
  if (claim.status !== "pending") {
    return { ok: false, status: 400, error: "Bu so'rov allaqachon ko'rib chiqilgan" };
  }

  claim.status = decision;
  claim.reviewedBy = by;
  claim.reviewedAt = new Date();
  claim.reviewNote = String(reviewNote || "").slice(0, 300);
  await claim.save();

  if (decision === "confirmed") {
    // ⚠️ `updateOne` ATAYLAB — bu yerda hujjatni o'qib, o'zgartirib,
    //    saqlash orasida boshqa xodim ham tasdiqlashi mumkin.
    //    Bitta atomik yozuv shu poygani yopadi.
    await MonthlyPayment.updateOne(
      { student: claim.student, month: claim.month, year: claim.year },
      { $set: { status: "paid", paidDate: new Date() } },
    );
  }

  return { ok: true, claim };
}

/** Xodim ekrani uchun ro'yxat */
async function list({ directorId, branchId = null, status = "pending", limit = 100 }) {
  const query = { director: directorId };
  if (branchId) query.branch = branchId;
  if (status && status !== "all") query.status = status;

  const claims = await PaymentClaim.find(query)
    .populate("student", "name parentPhone")
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 300))
    .lean();

  return claims.map((c) => ({
    id: c._id,
    studentName: c.student?.name || "—",
    parentPhone: c.student?.parentPhone || "",
    month: c.month,
    year: c.year,
    amount: c.amount,
    status: c.status,
    note: c.note,
    reviewNote: c.reviewNote,
    createdAt: c.createdAt,
  }));
}

/** Tasdiqlanmagan so'rovlar soni — menyudagi belgi uchun */
const pendingCount = (directorId, branchId = null) =>
  PaymentClaim.countDocuments({
    director: directorId,
    status: "pending",
    ...(branchId ? { branch: branchId } : {}),
  });

module.exports = { create, review, list, pendingCount };
