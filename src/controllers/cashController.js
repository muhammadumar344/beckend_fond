// src/controllers/cashController.js
// ════════════════════════════════════════════════════════════
// Kassa — kunlik smena.
//
// ⚠️ IKKI XIL KO'RINISH, IKKI XIL HUQUQ:
//
//    `managePayments` — O'Z smenasini ko'radi va yopadi.
//       Pul oladigan odamning o'zi. Boshqa birovnikini
//       ko'ra olmaydi.
//
//    `viewCash`       — HAMMANING smenasini ko'radi, lekin
//       birov uchun yopa olmaydi. Direktor va filial
//       rahbari uchun.
//
//    Yopish har doim faqat O'ZI uchun: boshqa odam nomidan
//    "sanadim" deb yozib qo'yish mumkin bo'lsa, imzoning
//    ma'nosi qolmaydi.
// ════════════════════════════════════════════════════════════
const CashShift = require('../models/CashShift');
const MonthlyPayment = require('../models/MonthlyPayment');
const svc = require('../services/cashShift');
const { audit } = require('../services/audit');
const { resolveContext, requirePermission } = require('../utils/resolveContext');
const { todayInTashkent, addDays } = require('../utils/supportWindow');

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// GET /api/lc/cash/my?date=YYYY-MM-DD
// O'z smenam: bugungi yig'indi, to'lovlar ro'yxati, yopilganmi.
const mine = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'managePayments');

    const staffId = ctx.isDirector ? ctx.directorId : ctx.staffId;
    const view = await svc.shiftView(ctx, { date: req.query.date, staffId });

    res.json({ success: true, today: todayInTashkent(), ...view });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// POST /api/lc/cash/close   { date?, countedCash, note? }
const closeShift = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'managePayments');

    const shift = await svc.close(ctx, {
      date: req.body.date,
      countedCash: req.body.countedCash,
      note: req.body.note,
    });

    // ⚠️ Farq bo'lsa jurnalga tushsin. Kamomad — direktor
    //    keyinchalik qidiradigan narsa, va uni smenaning o'zidan
    //    emas, umumiy jurnaldan topishi kerak: u yerda boshqa
    //    hammasi bilan bir qatorda turadi.
    audit(req, ctx, {
      action: shift.difference === 0 ? 'cash.shift_closed' : 'cash.shift_diff',
      entity: 'CashShift',
      entityId: shift._id,
      entityLabel: `${shift.staff.name} — ${shift.date}`,
      changes: [
        { field: 'kutilgan naqd', from: null, to: shift.expected.cash },
        { field: 'sanalgan naqd', from: null, to: shift.countedCash },
        ...(shift.difference !== 0
          ? [{ field: 'farq', from: null, to: shift.difference }]
          : []),
      ],
    });

    res.json({ success: true, shift });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// GET /api/lc/cash/shifts?from=&to=&staffId=&page=&limit=
// Direktor ko'rinishi: yopilgan smenalar ro'yxati.
const shifts = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'viewCash');

    const query = { director: ctx.directorId };
    if (req.query.staffId) query['staff.id'] = req.query.staffId;

    // Sana matn ("YYYY-MM-DD") bo'lgani uchun oddiy matn
    // solishtiruvi to'g'ri ishlaydi — format leksik tartibda
    // xronologik tartib bilan mos tushadi.
    const { from, to } = req.query;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = String(from);
      if (to) query.date.$lte = String(to);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Number(req.query.limit) || PAGE_SIZE);

    const [items, total] = await Promise.all([
      CashShift.find(query)
        .sort({ date: -1, closedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CashShift.countDocuments(query),
    ]);

    res.json({
      success: true,
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// GET /api/lc/cash/open?days=7
// ⚠️ ENG MUHIM KO'RINISH. Yopilgan smenalar ro'yxati o'z-o'zicha
//    hech narsa demaydi: pulni olib, umuman yopmagan odam u
//    yerda KO'RINMAYDI. Shuning uchun alohida so'rov —
//    "to'lov qabul qilgan, lekin kunini yopmagan" kunlar.
const openDays = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'viewCash');

    const days = Math.min(60, Math.max(1, Number(req.query.days) || 14));
    const today = todayInTashkent();
    const from = addDays(today, -(days - 1));

    const fromDate = svc.dayRange(from).from;
    const toDate = svc.dayRange(today).to;

    // Kim qaysi kunda pul qabul qilgan
    const rows = await MonthlyPayment.aggregate([
      {
        $match: {
          teacher: svc.toObjectId(ctx.directorId),
          status: 'paid',
          paidDate: { $gte: fromDate, $lt: toDate },
          'receivedBy.id': { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            staffId: '$receivedBy.id',
            // Toshkent kuniga keltirish: UTC ga +5 soat qo'shib,
            // keyin sanani ajratamiz.
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $add: ['$paidDate', 5 * 60 * 60 * 1000] },
              },
            },
          },
          name: { $last: '$receivedBy.name' },
          cash: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ['$paymentMethod', 'cash'] }, 'cash'] },
                '$amount',
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': -1 } },
      { $limit: 500 },
    ]);

    const closed = await CashShift.find({
      director: ctx.directorId,
      date: { $gte: from, $lte: today },
    })
      .select('staff.id date')
      .lean();

    const closedKeys = new Set(
      closed.map((c) => `${String(c.staff.id)}|${c.date}`)
    );

    const open = rows
      .filter((r) => !closedKeys.has(`${String(r._id.staffId)}|${r._id.date}`))
      .map((r) => ({
        staffId: r._id.staffId,
        date: r._id.date,
        name: r.name || '',
        cash: r.cash,
        count: r.count,
      }));

    res.json({ success: true, today, from, open });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// GET /api/lc/cash/day?date=&staffId=
// Direktor bitta smenani ochib ko'radi: qaysi to'lovlardan yig'ilgan.
const day = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'viewCash');

    const view = await svc.shiftView(ctx, {
      date: req.query.date,
      staffId: req.query.staffId,
    });

    res.json({ success: true, today: todayInTashkent(), ...view });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = { mine, closeShift, shifts, openDays, day };
