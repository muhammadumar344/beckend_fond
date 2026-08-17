// src/services/audit.js
// ════════════════════════════════════════════════════════════
// Audit jurnaliga yozish.
//
//   const { audit, diff } = require('../services/audit')
//
//   const before = payment.toObject()
//   payment.status = 'paid'
//   await payment.save()
//
//   audit(req, ctx, {
//     action: 'payment.marked_paid',
//     entity: 'MonthlyPayment',
//     entityId: payment._id,
//     entityLabel: `${student.name} — ${month}/${year}`,
//     changes: diff(before, payment, ['status', 'amount', 'paidDate']),
//   })
//
// ⚠️ `audit()` NI `await` QILMANG. U ataylab va'da qaytarmaydi:
//    jurnalga yozish to'lovni saqlashdan muhimroq emas. Mongo
//    sekinlashsa yoki xato bersa, foydalanuvchi buni sezmasligi
//    kerak.
//
// ⚠️ SHUNING UCHUN BU YERDA HECH QACHON `throw` YO'Q. Xato
//    faqat konsolga chiqadi. Agar jurnal ishlamay qolsa,
//    to'lovlar baribir yozilaveradi.
// ════════════════════════════════════════════════════════════
const AuditLog = require("../models/AuditLog");
const Teacher = require("../models/Teacher");

// Direktor ismini har safar bazadan olmaslik uchun kichik kesh.
// Jurnalga yozish kamdan-kam bo'ladi, lekin bir direktor bir
// seansda o'nlab to'lov belgilashi mumkin — o'sha o'nta so'rov
// bitta o'qishga aylanadi.
const nameCache = new Map();
const NAME_TTL_MS = 10 * 60 * 1000;

async function directorName(directorId) {
  const key = String(directorId);
  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;

  const t = await Teacher.findById(directorId).select("name").lean();
  const name = t?.name || "";
  nameCache.set(key, { name, at: Date.now() });
  return name;
}

/**
 * Ikki holat orasidagi farqni chiqaradi.
 *
 * ⚠️ Faqat ATAYLAB berilgan maydonlar tekshiriladi. Butun
 *    hujjatni solishtirsak, `updatedAt` kabi texnik maydonlar
 *    ham "o'zgarish" bo'lib chiqib, jurnalni shovqinga
 *    to'ldirardi va haqiqiy o'zgarish ko'rinmay qolardi.
 *
 * @param {object} before  o'zgarishdan oldingi holat (lean/toObject)
 * @param {object} after   keyingi holat
 * @param {string[]} fields  kuzatiladigan maydonlar
 * @returns {{field: string, from: any, to: any}[]}
 */
function diff(before, after, fields) {
  const out = [];
  for (const f of fields) {
    const a = normalise(before?.[f]);
    const b = normalise(after?.[f]);
    if (a !== b) out.push({ field: f, from: before?.[f] ?? null, to: after?.[f] ?? null });
  }
  return out;
}

// Sana va ObjectId'ni solishtirish uchun matnga keltiramiz.
// Bunsiz bir xil sananing ikki nusxasi "har xil" bo'lib
// chiqardi (obyektlar `!==` bilan hech qachon teng emas).
function normalise(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && typeof v.toString === "function") return v.toString();
  return v;
}

/**
 * Jurnalga bitta yozuv qo'shadi. Kutib turmaydi, xato bermaydi.
 *
 * @param {object} req  Express so'rovi (IP va foydalanuvchi uchun)
 * @param {object} ctx  resolveContext() natijasi
 * @param {object} data { action, entity, entityId, entityLabel, changes }
 */
function audit(req, ctx, data) {
  // ⚠️ Bo'sh o'zgarish yozilmasin. Foydalanuvchi "Saqlash"ni
  //    bosgani bilan hech narsani o'zgartirmagan bo'lishi
  //    mumkin — bunday yozuvlar jurnalni bosib ketardi.
  if (Array.isArray(data.changes) && data.changes.length === 0) return;

  write(req, ctx, data).catch((err) => {
    console.error("audit yozilmadi:", err.message || err);
  });
}

async function write(req, ctx, data) {
  const isDirector = ctx.isDirector;

  const actor = {
    id: isDirector ? ctx.directorId : ctx.staffId,
    model: isDirector ? "Teacher" : "Staff",
    name: isDirector ? await directorName(ctx.directorId) : ctx.staffName || "",
    roleName: isDirector ? "Direktor" : ctx.staffRole?.name || "Xodim",
  };

  await AuditLog.create({
    director: ctx.directorId,
    actor,
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    entityLabel: data.entityLabel || "",
    changes: data.changes || [],
    ip: clientIp(req),
  });
}

// Render/Nginx ortida turganda haqiqiy IP `x-forwarded-for` da
// bo'ladi; `req.ip` esa proksining o'zini ko'rsatadi.
function clientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip || "";
}

module.exports = { audit, diff };
