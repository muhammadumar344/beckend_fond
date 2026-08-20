// src/services/cashShift.js
// ════════════════════════════════════════════════════════════
// Kunlik kassa hisobi. Modeldagi izohni ham o'qing —
// "smena ochish" nega yo'qligi o'sha yerda.
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');
const MonthlyPayment = require('../models/MonthlyPayment');
const CashShift = require('../models/CashShift');
const Expense = require('../models/Expense');
const { tashkentEpoch, todayInTashkent } = require('../utils/supportWindow');

// ⚠️ `aggregate()` Mongoose sxemasidan O'TMAYDI. Matn ID hech
//    qachon ObjectId bilan teng bo'lmaydi va `$match` xato
//    bermay, JIMGINA bo'sh qaytaradi — ya'ni kassa "bugun
//    to'lov yo'q" deb ko'rsatardi va sabab topilmasdi.
const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(String(v))
    ? new mongoose.Types.ObjectId(String(v))
    : v;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Toshkent bo'yicha kunning boshi va oxiri.
 * @param {string} date "YYYY-MM-DD"
 */
function dayRange(date) {
  if (!DATE_RE.test(String(date))) {
    const err = new Error("Sana noto'g'ri — YYYY-MM-DD kutilgan");
    err.status = 400;
    throw err;
  }
  const from = new Date(tashkentEpoch(date, '00:00'));
  const to = new Date(tashkentEpoch(date, '00:00') + 86400000);
  return { from, to };
}

/**
 * ⚠️ SOF FUNKSIYA — bazaga tegmaydi, `test/cash.test.js` shuni
 *    tekshiradi. Formulani shu yerda qulflab qo'yamiz: kassaning
 *    butun ma'nosi bitta ayirishga bog'liq va u jimgina
 *    o'zgarib ketmasligi kerak.
 *
 * @param {Array} paymentRows  aggregate natijasi [{ _id: usul, sum, count }]
 * @param {{sum:number,count:number}} [cashOut]  naqd xarajatlar
 * @returns {{cashIn,expenses,expenseCount,cash,card,transfer,total,count}}
 */
function foldTotals(paymentRows = [], cashOut = { sum: 0, count: 0 }) {
  const by = { cash: 0, card: 0, transfer: 0 };
  let total = 0;
  let count = 0;

  for (const r of paymentRows) {
    if (by[r._id] === undefined) continue; // kutilmagan usul — e'tiborsiz
    by[r._id] = r.sum;
    total += r.sum;
    count += r.count;
  }

  const expenses = Number(cashOut?.sum) || 0;

  return {
    // Naqd TUSHUM — xarajatsiz. Ikkalasi alohida ko'rinishi
    // shart: "50 000 kam" bilan "50 000 chiqim qilingan"
    // butunlay boshqa gap, direktor ularni ajrata olishi kerak.
    cashIn: by.cash,
    expenses,
    expenseCount: Number(cashOut?.count) || 0,

    // ⚠️ `cash` — QUTIDA QOLISHI KERAK BO'LGAN pul, ya'ni
    //    sanaladigan son. `difference` shundan hisoblanadi.
    //    Manfiy bo'lishi mumkin: administrator kechagi puldan
    //    xarajat qilgan bo'lsa, bugungi tushumdan ko'proq
    //    chiqim bo'lishi normal.
    cash: by.cash - expenses,

    card: by.card,
    transfer: by.transfer,
    // To'lovlar yig'indisi — xarajat bunga TEGMAYDI. Bu
    // "bugun qancha tushdi" degan savolning javobi.
    total,
    count,
  };
}

/**
 * Shu kun, shu odam qabul qilgan to'lovlar va naqd xarajatlari.
 *
 * @param {object} ctx      resolveContext() natijasi
 * @param {object} opts     { date, staffId }  staffId yo'q bo'lsa — hamma
 */
async function totals(ctx, { date, staffId } = {}) {
  const { from, to } = dayRange(date || todayInTashkent());

  const match = {
    teacher: toObjectId(ctx.directorId),
    status: 'paid',
    paidDate: { $gte: from, $lt: to },
  };
  if (staffId) match['receivedBy.id'] = toObjectId(staffId);

  // ⚠️ Faqat `paidFrom: 'cash'`. Bo'sh maydon (eski yozuv)
  //    kassaga TEGMAYDI — models/Expense.js dagi izohga qarang.
  const expMatch = {
    teacher: toObjectId(ctx.directorId),
    paidFrom: 'cash',
    spentDate: { $gte: from, $lt: to },
  };
  if (staffId) expMatch['paidBy.id'] = toObjectId(staffId);

  const [rows, expRows] = await Promise.all([
    MonthlyPayment.aggregate([
      { $match: match },
      {
        $group: {
          // Eski to'lovlarda `paymentMethod` umuman yo'q — ular
          // naqd deb hisoblanadi (maydon qo'shilgunicha hammasi
          // shunday edi).
          _id: { $ifNull: ['$paymentMethod', 'cash'] },
          sum: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: expMatch },
      { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  return foldTotals(rows, expRows[0] || { sum: 0, count: 0 });
}

/**
 * Smena kartochkasi: yig'indi + o'sha kungi to'lovlar ro'yxati +
 * yopilgan bo'lsa yopilish ma'lumoti.
 */
async function shiftView(ctx, { date, staffId }) {
  const day = date || todayInTashkent();
  const { from, to } = dayRange(day);

  const listMatch = {
    teacher: ctx.directorId,
    status: 'paid',
    paidDate: { $gte: from, $lt: to },
  };
  if (staffId) listMatch['receivedBy.id'] = staffId;

  // ⚠️ XARAJATLAR RO'YXATI HAM QAYTADI. Faqat "chiqim 200 000"
  //    deb yozsak, smenani yopayotgan odam nimani nazarda
  //    tutilganini bilmaydi va sanagan puli bilan solishtira
  //    olmaydi. "Marker va qog'oz — 200 000" esa tekshirsa
  //    bo'ladigan gap.
  const expListMatch = {
    teacher: ctx.directorId,
    paidFrom: 'cash',
    spentDate: { $gte: from, $lt: to },
  };
  if (staffId) expListMatch['paidBy.id'] = staffId;

  const [expected, payments, expenses, closed] = await Promise.all([
    totals(ctx, { date: day, staffId }),
    MonthlyPayment.find(listMatch)
      .select('amount month year paymentMethod paidDate receivedBy student')
      .populate('student', 'name')
      .sort({ paidDate: -1 })
      .limit(200)
      .lean(),
    Expense.find(expListMatch)
      .select('amount reason description spentDate paidBy class')
      .populate('class', 'name')
      .sort({ spentDate: -1 })
      .limit(200)
      .lean(),
    staffId
      ? CashShift.findOne({
          director: ctx.directorId,
          'staff.id': staffId,
          date: day,
        }).lean()
      : null,
  ]);

  return { date: day, expected, payments, expenses, closed: closed || null };
}

/**
 * Smenani yopadi. Ikkinchi marta yopib bo'lmaydi.
 *
 * ⚠️ `expected` NUSXA qilib saqlanadi, keyin qayta hisoblanmaydi.
 *    Sabab: `markPayment` `paidDate` ni o'tgan songa qo'ya oladi.
 *    Ya'ni yopilgan kunning "kutilgan" summasi ertaga o'zgarishi
 *    mumkin — va o'sha odam sanagan haqiqiy pul bilan farqi
 *    o'z-o'zidan "tuzalib" ketardi. Yopilgan paytda nima
 *    ko'rsatilgan bo'lsa, o'sha qoladi.
 */
async function close(ctx, { date, countedCash, note }) {
  const day = date || todayInTashkent();

  if (day > todayInTashkent()) {
    const err = new Error("Kelajakdagi kunni yopib bo'lmaydi");
    err.status = 400;
    throw err;
  }

  const counted = Number(countedCash);
  if (!Number.isFinite(counted) || counted < 0) {
    const err = new Error("Sanalgan naqd pul noto'g'ri");
    err.status = 400;
    throw err;
  }

  const staffId = ctx.isDirector ? ctx.directorId : ctx.staffId;
  const expected = await totals(ctx, { date: day, staffId });

  try {
    return await CashShift.create({
      director: ctx.directorId,
      staff: {
        id: staffId,
        model: ctx.isDirector ? 'Teacher' : 'Staff',
        name: ctx.isDirector ? 'Direktor' : ctx.staffName || '',
        roleName: ctx.isDirector ? 'Direktor' : ctx.staffRole?.name || 'Xodim',
      },
      branch: ctx.branchFilter || undefined,
      date: day,
      expected,
      countedCash: counted,
      difference: counted - expected.cash,
      note: note || '',
    });
  } catch (e) {
    // Unikal indeks — ikki marta bosilgan tugma yoki qo'lda
    // yuborilgan takroriy so'rov
    if (e.code === 11000) {
      const err = new Error('Bu kun allaqachon yopilgan');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

module.exports = { dayRange, totals, foldTotals, shiftView, close, toObjectId };
