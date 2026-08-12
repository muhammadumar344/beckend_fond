const mongoose = require('mongoose');
const Salary = require('../models/Salary');
const Staff  = require('../models/Staff');
const { resolveContext, requirePermission } = require('../utils/resolveContext');

// aggregate() Mongoose sxemasidan o'tmaydi — string ID'ni o'zi ObjectId'ga
// o'girmaydi. Shuning uchun $match'ga berishdan oldin qo'lda cast qilamiz.
const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(String(v))
    ? new mongoose.Types.ObjectId(String(v))
    : v;

// ─── SET / UPDATE OYLIK MAOSH ─────────────────────────────────────────────────
// POST /api/lc/salaries
// Body: { staffId, month: "2025-01", amount, note }

const setSalary = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageSalaries');

    const { staffId, month, amount, note } = req.body;
    if (!staffId || !month || amount === undefined) {
      return res.status(400).json({ message: "staffId, month va amount majburiy" });
    }

    // Month format: YYYY-MM
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: "Month formati: YYYY-MM (masalan: 2025-01)" });
    }

    // Xodim directorga tegishli va filial mos kelishini tekshirish
    const staffQuery = { _id: staffId, director: ctx.directorId };
    if (ctx.branchFilter) staffQuery.branch = ctx.branchFilter;
    const staff = await Staff.findOne(staffQuery);
    if (!staff) return res.status(404).json({ message: "Xodim topilmadi" });

    // Upsert — agar bu oy uchun yozuv bo'lsa yangilaydi, bo'lmasa yaratadi
    const salary = await Salary.findOneAndUpdate(
      { staff: staffId, month, director: ctx.directorId },
      {
        $set: {
          amount:   Number(amount),
          note:     note || '',
          branch:   staff.branch,
          director: ctx.directorId,
          // To'langan bo'lsa to'lov ma'lumotlarini o'zgartirilmaydi
        },
        $setOnInsert: {
          isPaid:   false,
          paidDate: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('staff', 'name email position');

    res.status(201).json(salary);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── TO'LANDI DEYB BELGILASH ──────────────────────────────────────────────────
// PUT /api/lc/salaries/:id/pay
// Body: { paidDate (optional), note (optional) }

const markSalaryPaid = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageSalaries');

    const query = { _id: req.params.id, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const salary = await Salary.findOne(query);
    if (!salary) return res.status(404).json({ message: "Maosh yozuvi topilmadi" });

    const { isPaid, paidDate, note } = req.body;

    // Agar isPaid body'da kelsa shu qiymat, aks holda toggle
    if (typeof isPaid === 'boolean') {
      salary.isPaid  = isPaid;
      salary.paidDate = isPaid ? (paidDate ? new Date(paidDate) : new Date()) : null;
    } else {
      // Toggle
      salary.isPaid  = !salary.isPaid;
      salary.paidDate = salary.isPaid ? new Date() : null;
    }

    if (note !== undefined) salary.note = note;
    await salary.save();

    await salary.populate('staff', 'name email position');
    res.json(salary);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── RO'YXAT (Director / Branch Manager) ─────────────────────────────────────
// GET /api/lc/salaries?month=2025-01&branchId=...&staffId=...&isPaid=true

const getSalaries = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageSalaries');

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    // Filter'lar
    if (req.query.month)    query.month  = req.query.month;
    if (req.query.branchId && ctx.isDirector) query.branch = req.query.branchId;
    if (req.query.staffId)  query.staff  = req.query.staffId;
    if (req.query.isPaid !== undefined) {
      query.isPaid = req.query.isPaid === 'true';
    }

    const salaries = await Salary.find(query)
      .populate('staff',  'name email position')
      .populate('branch', 'name')
      .sort({ month: -1, createdAt: -1 });

    // Umumiy statistika
    const total    = salaries.reduce((sum, s) => sum + s.amount, 0);
    const paid     = salaries.filter(s => s.isPaid).reduce((sum, s) => sum + s.amount, 0);
    const unpaid   = total - paid;

    res.json({
      salaries,
      stats: {
        total,
        paid,
        unpaid,
        count:       salaries.length,
        paidCount:   salaries.filter(s => s.isPaid).length,
        unpaidCount: salaries.filter(s => !s.isPaid).length,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── STAFF O'Z MAOSH TARIXI ───────────────────────────────────────────────────
// GET /api/lc/salaries/my?year=2025

const getMySalaryHistory = async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: "Faqat xodimlar uchun" });
    }

    const query = { staff: req.user.id };

    // Yil bo'yicha filter
    if (req.query.year) {
      const year = req.query.year;
      query.month = { $regex: `^${year}-` };
    }

    const salaries = await Salary.find(query)
      .sort({ month: -1 })
      .select('month amount isPaid paidDate note createdAt');

    const total  = salaries.reduce((sum, s) => sum + s.amount, 0);
    const paid   = salaries.filter(s => s.isPaid).reduce((sum, s) => sum + s.amount, 0);

    res.json({
      salaries,
      stats: {
        total,
        paid,
        unpaid: total - paid,
        count:  salaries.length,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── O'CHIRISH ────────────────────────────────────────────────────────────────
// DELETE /api/lc/salaries/:id — faqat to'lanmagan maoshni o'chirsa bo'ladi

const deleteSalary = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageSalaries');

    const query = { _id: req.params.id, director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    const salary = await Salary.findOne(query);
    if (!salary) return res.status(404).json({ message: "Maosh yozuvi topilmadi" });

    if (salary.isPaid) {
      return res.status(400).json({
        message: "To'langan maoshni o'chirish mumkin emas",
      });
    }

    await salary.deleteOne();
    res.json({ message: "Maosh yozuvi o'chirildi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── OYLIK XULOSA (branch bo'yicha) ──────────────────────────────────────────
// GET /api/lc/salaries/summary?month=2025-01

const getSalarySummary = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, 'manageSalaries');

    const month = req.query.month;
    if (!month) return res.status(400).json({ message: "month parametri majburiy" });

    const matchQuery = { director: toObjectId(ctx.directorId), month };
    if (ctx.branchFilter) matchQuery.branch = toObjectId(ctx.branchFilter);

    const summary = await Salary.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:         '$branch',
          totalAmount: { $sum: '$amount' },
          paidAmount:  { $sum: { $cond: ['$isPaid', '$amount', 0] } },
          count:       { $sum: 1 },
          paidCount:   { $sum: { $cond: ['$isPaid', 1, 0] } },
        },
      },
      {
        $lookup: {
          from:         'branches',
          localField:   '_id',
          foreignField: '_id',
          as:           'branch',
        },
      },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          branchName:   { $ifNull: ['$branch.name', "Filialsiz"] },
          totalAmount:  1,
          paidAmount:   1,
          unpaidAmount: { $subtract: ['$totalAmount', '$paidAmount'] },
          count:        1,
          paidCount:    1,
          unpaidCount:  { $subtract: ['$count', '$paidCount'] },
        },
      },
    ]);

    res.json(summary);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  setSalary,
  markSalaryPaid,
  getSalaries,
  getMySalaryHistory,
  deleteSalary,
  getSalarySummary,
};