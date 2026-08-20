// src/services/cashReport.js
// ════════════════════════════════════════════════════════════
// KUNLIK KASSA XABARI — direktorga Telegram orqali.
//
// Kassa zanjiri to'liq: yig'ildi → sanaldi → xarajat chiqdi →
// topshirildi → qabul qilindi. Lekin direktor buni KO'RISH
// uchun saytga kirishi kerak, va u har kuni kirmaydi. Uch
// kundan keyin kirsa, uch kunlik yopilmagan smena chiqadi va
// endi hech kim eslay olmaydi.
//
// ⚠️ HAR KUNI "HAMMASI JOYIDA" YOZMAYMIZ. Bir xil ko'rinadigan
//    xabarni odam bir haftada o'qishni to'xtatadi va rostdan
//    muhim kunini ham ko'rmaydi. Bu — `services/notify.js`
//    dagi "farzandingiz darsga keldi" xabari bilan aynan bir
//    xil xato, u yerda bir marta o'rganilgan.
//
//    Shuning uchun standart rejim `problems`: xabar FAQAT
//    e'tibor talab qilganda ketadi. `daily` — xohlagan
//    direktor uchun alohida tanlov.
//
// ⚠️ QUYIDAGI `buildReport` SOF FUNKSIYA — bazaga tegmaydi.
//    `test/cashReport.test.js` uni to'liq sinaydi: xabar matni
//    pul haqida va u jimgina o'zgarib ketmasligi kerak.
// ════════════════════════════════════════════════════════════

const CashShift = require("../models/CashShift");
const CashHandover = require("../models/CashHandover");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const { dayRange, toObjectId } = require("./cashShift");
const { todayInTashkent, addDays } = require("../utils/supportWindow");

// ⚠️ `Intl` UZILMAS PROBEL (U+00A0) qo'yadi, oddiy probel emas.
//    Telegram'da u ko'rinishda bir xil, lekin nusxa olinganda va
//    qidirilganda boshqacha belgi bo'lib chiqadi. Oddiy probelga
//    almashtiramiz — xabar matni tekshirsa bo'ladigan bo'lib
//    qolsin.
const money = (n) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n || 0)).replace(/ /g, " ");

/**
 * ⚠️ SOF FUNKSIYA. Yig'ilgan ma'lumotdan xabar matnini yasaydi.
 *
 * @param {object} d
 * @param {string} d.date            "YYYY-MM-DD"
 * @param {string} d.centerName
 * @param {object} d.totals          { cashIn, expenses, card, transfer, total, count }
 * @param {Array}  d.closed          [{ name, countedCash, difference }]
 * @param {Array}  d.openDays        [{ name, date, cash }]  — yopilmagan
 * @param {Array}  d.pendingHandovers[{ fromName, toName, amount, days }]
 * @param {Array}  d.disputed        [{ fromName, toName, amount, confirmedAmount }]
 * @returns {{ hasProblems: boolean, text: string }}
 */
function buildReport(d) {
  const closed = d.closed || [];
  const openDays = d.openDays || [];
  const pending = d.pendingHandovers || [];
  const disputed = d.disputed || [];
  const t = d.totals || {};

  const withDiff = closed.filter((c) => c.difference !== 0);

  const hasProblems =
    openDays.length > 0 || withDiff.length > 0 || pending.length > 0 || disputed.length > 0;

  const lines = [];
  lines.push(`*${d.centerName || "Markaz"}* — ${d.date}`);
  lines.push("");

  // ── Kun yakuni ──
  // Har doim bor: muammo bo'lmasa ham `daily` rejimida shu
  // qism yuboriladi va u o'z-o'zicha ma'noli.
  lines.push(`Tushum: *${money(t.total)}* so'm (${t.count || 0} ta to'lov)`);
  if (t.cashIn) lines.push(`  naqd ${money(t.cashIn)}`);
  if (t.card) lines.push(`  karta ${money(t.card)}`);
  if (t.transfer) lines.push(`  o'tkazma ${money(t.transfer)}`);
  if (t.expenses) lines.push(`Naqd chiqim: *${money(t.expenses)}* so'm`);

  // ── Yopilmagan kunlar ──
  // ⚠️ ENG MUHIM QISM. Yopilgan smenalar ro'yxati o'z-o'zicha
  //    aldamchi: pulni olib, kunini umuman yopmagan odam u
  //    yerda KO'RINMAYDI.
  if (openDays.length) {
    lines.push("");
    lines.push(`⚠️ *Yopilmagan kun: ${openDays.length}*`);
    for (const o of openDays.slice(0, 10)) {
      lines.push(`  · ${o.name || "?"} — ${o.date}, ${money(o.cash)} so'm`);
    }
  }

  // ── Farq chiqqan smenalar ──
  if (withDiff.length) {
    lines.push("");
    lines.push("⚠️ *Kassada farq*");
    for (const c of withDiff.slice(0, 10)) {
      const sign = c.difference < 0 ? "kamomad" : "ortiqcha";
      lines.push(`  · ${c.name || "?"} — ${sign} ${money(Math.abs(c.difference))} so'm`);
    }
  }

  // ── Tasdiqlanmagan topshiriqlar ──
  // Pul yo'lda qolib ketgan: kimdir topshirgan, qabul qiluvchi
  // hali sanamagan.
  if (pending.length) {
    lines.push("");
    lines.push("⚠️ *Tasdiqlanmagan topshiriq*");
    for (const h of pending.slice(0, 10)) {
      const age = h.days > 0 ? ` (${h.days} kun)` : "";
      lines.push(
        `  · ${h.fromName || "?"} → ${h.toName || "?"}: ${money(h.amount)} so'm${age}`,
      );
    }
  }

  // ── Farq bilan qabul qilinganlar ──
  if (disputed.length) {
    lines.push("");
    lines.push("🔴 *Topshirishda farq*");
    for (const h of disputed.slice(0, 10)) {
      const diff = (h.confirmedAmount || 0) - (h.amount || 0);
      lines.push(
        `  · ${h.fromName || "?"} → ${h.toName || "?"}: ` +
          `${money(h.amount)} → ${money(h.confirmedAmount)} ` +
          `(${diff < 0 ? "−" : "+"}${money(Math.abs(diff))})`,
      );
    }
  }

  if (!hasProblems) {
    lines.push("");
    lines.push("Hammasi yopilgan, farq yo'q.");
  }

  return { hasProblems, text: lines.join("\n") };
}

/**
 * Bir kunlik ma'lumotni bazadan yig'adi.
 *
 * ⚠️ `openDays` — SO'NGGI 14 KUN ichida. Faqat bugungisini
 *    olsak, kecha yopilmagan kun bugungi xabarda ko'rinmasdi
 *    va abadiy unutilardi (`cashController.openDays` bilan
 *    bir xil sabab).
 */
async function collect(director, date) {
  const day = date || todayInTashkent();
  const { from, to } = dayRange(day);
  const dirId = toObjectId(director._id);

  const [payRows, expRow, closed, handovers, oldPayRows, oldShifts] =
    await Promise.all([
      MonthlyPayment.aggregate([
        {
          $match: {
            teacher: dirId,
            status: "paid",
            paidDate: { $gte: from, $lt: to },
          },
        },
        {
          $group: {
            _id: { $ifNull: ["$paymentMethod", "cash"] },
            sum: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            teacher: dirId,
            paidFrom: "cash",
            spentDate: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: null, sum: { $sum: "$amount" } } },
      ]),
      CashShift.find({ director: director._id, date: day })
        .select("staff.name countedCash difference")
        .lean(),
      CashHandover.find({
        director: director._id,
        status: { $in: ["pending", "disputed"] },
      })
        .select("from.name to.name amount confirmedAmount status createdAt")
        .sort({ createdAt: 1 })
        .limit(50)
        .lean(),
      // Yopilmagan kunlarni topish uchun: kim qaysi kunda pul olgan
      MonthlyPayment.aggregate([
        {
          $match: {
            teacher: dirId,
            status: "paid",
            paidDate: { $gte: dayRange(addDays(day, -13)).from, $lt: to },
            "receivedBy.id": { $ne: null },
          },
        },
        {
          $group: {
            _id: {
              staffId: "$receivedBy.id",
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $add: ["$paidDate", 5 * 60 * 60 * 1000] },
                },
              },
            },
            name: { $last: "$receivedBy.name" },
            cash: {
              $sum: {
                $cond: [
                  { $eq: [{ $ifNull: ["$paymentMethod", "cash"] }, "cash"] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),
      CashShift.find({
        director: director._id,
        date: { $gte: addDays(day, -13), $lte: day },
      })
        .select("staff.id date")
        .lean(),
    ]);

  const totals = { cashIn: 0, card: 0, transfer: 0, total: 0, count: 0 };
  for (const r of payRows) {
    if (r._id === "cash") totals.cashIn = r.sum;
    else if (totals[r._id] !== undefined) totals[r._id] = r.sum;
    else continue;
    totals.total += r.sum;
    totals.count += r.count;
  }
  totals.expenses = expRow[0]?.sum || 0;

  const closedKeys = new Set(
    oldShifts.map((s) => `${String(s.staff.id)}|${s.date}`),
  );
  const openDays = oldPayRows
    .filter((r) => !closedKeys.has(`${String(r._id.staffId)}|${r._id.date}`))
    .map((r) => ({ name: r.name || "", date: r._id.date, cash: r.cash }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const nowMs = Date.now();
  const pendingHandovers = handovers
    .filter((h) => h.status === "pending")
    .map((h) => ({
      fromName: h.from?.name || "",
      toName: h.to?.name || "",
      amount: h.amount,
      days: Math.floor((nowMs - new Date(h.createdAt).getTime()) / 86400000),
    }));

  const disputed = handovers
    .filter((h) => h.status === "disputed")
    .map((h) => ({
      fromName: h.from?.name || "",
      toName: h.to?.name || "",
      amount: h.amount,
      confirmedAmount: h.confirmedAmount,
    }));

  return {
    date: day,
    centerName: director.name || "Markaz",
    totals,
    closed: closed.map((c) => ({
      name: c.staff?.name || "",
      countedCash: c.countedCash,
      difference: c.difference,
    })),
    openDays,
    pendingHandovers,
    disputed,
  };
}

module.exports = { buildReport, collect, money };
