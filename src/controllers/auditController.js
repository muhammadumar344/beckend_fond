// src/controllers/auditController.js
// ════════════════════════════════════════════════════════════
// Audit jurnalini o'qish.
//
// ⚠️ FAQAT O'QISH. Bu yerda hech qachon yozish, tahrirlash yoki
//    o'chirish endpoint'i bo'lmasin — jurnalni o'zgartira
//    oladigan odam uchun u hech narsani isbotlamaydi.
//
// ⚠️ KIM KO'RA OLADI: standart holatda faqat DIREKTOR.
//    Administrator o'z izini o'zi ko'rib, keyin nima
//    qilganini bilib turishi bu jurnalning maqsadiga zid.
//    Xodimga ochish kerak bo'lsa — `viewAudit` huquqi orqali,
//    direktor ataylab beradi.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const { resolveContext, requirePermission } = require("../utils/resolveContext");

// ⚠️ `aggregate()` Mongoose sxemasidan O'TMAYDI: `$match` ga
//    berilgan matn ID hech qachon ObjectId bilan solishtirilmaydi
//    va so'rov JIMGINA bo'sh natija qaytaradi. Direktor "jurnal
//    bo'sh" deb o'ylardi. `find()` da bunday muammo yo'q — u
//    o'zi cast qiladi.
const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(String(v))
    ? new mongoose.Types.ObjectId(String(v))
    : v;

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// GET /api/lc/audit
//   ?actorId=...      — bitta xodimning ishi
//   &entity=MonthlyPayment
//   &entityId=...     — bitta yozuvning butun tarixi
//   &action=payment.marked_paid
//   &from=2026-08-01&to=2026-08-31
//   &page=1&limit=50
const list = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewAudit");

    // ⚠️ `director` HAR DOIM so'rovda bo'lsin. Bu yagona narsa
    //    bir markazning jurnalini boshqasidan ajratib turadi.
    const query = { director: ctx.directorId };

    const { actorId, entity, entityId, action, from, to } = req.query;
    if (actorId) query["actor.id"] = actorId;
    if (entity) query.entity = entity;
    if (entityId) query.entityId = entityId;
    if (action) query.action = action;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      // `to` kunning OXIRIGACHA. Bunsiz "31-avgustgacha" deganda
      // 31-avgust kuni qilingan ishlar ro'yxatga tushmasdi.
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Number(req.query.limit) || PAGE_SIZE);

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
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

// GET /api/lc/audit/actors
// Filtr ro'yxati uchun: shu markazda jurnalda izi bor odamlar.
// Butun xodimlar ro'yxatini bermaymiz — hech qachon hech narsa
// qilmagan odamni filtrda ko'rsatish faqat chalg'itadi.
const actors = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "viewAudit");

    const rows = await AuditLog.aggregate([
      { $match: { director: toObjectId(ctx.directorId) } },
      {
        $group: {
          _id: "$actor.id",
          name: { $last: "$actor.name" },
          roleName: { $last: "$actor.roleName" },
          count: { $sum: 1 },
          lastAt: { $max: "$createdAt" },
        },
      },
      { $sort: { lastAt: -1 } },
      { $limit: 100 },
    ]);

    res.json({ success: true, actors: rows });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = { list, actors };
