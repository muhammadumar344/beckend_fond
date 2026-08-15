// src/services/salaryCalc.js
// ════════════════════════════════════════════════════════════
// MAOSHNI HISOBLASH — foiz + qat'iy qism − davomat jarimasi.
//
// ⚠️ NEGA KERAK: hozirgacha maosh qo'lda yoziladigan son edi.
//    Buxgalter har oy har bir ustozning guruhlaridan tushgan
//    pulni sanab, foizini hisoblab, kalkulyatorda ayirib
//    o'tirardi — CRM esa faqat natijani saqlardi. Shu sababli
//    Excel hech qachon tashlanmasdi.
//
// ⚠️ FOIZ TUSHGAN PULDAN olinadi, hisoblangandan emas. Markaz
//    o'zi olmagan puldan ustozga to'lay olmaydi. Yon foydasi:
//    ustozning manfaati ham davomat va o'quvchini saqlab
//    qolishga bog'lanadi.
//
// ⚠️ HECH NARSA AVTOMATIK YOZILMAYDI. Bu fayl faqat TAKLIF
//    qaytaradi; `Salary` yozuvini odam tasdiqlab yaratadi.
//    Maosh — eng nozik raqam; tizim uni jimgina o'zgartirsa,
//    birinchi xatoda unga bo'lgan ishonch butunlay yo'qoladi.
// ════════════════════════════════════════════════════════════

const Staff = require("../models/Staff");
const Class = require("../models/Class");
const MonthlyPayment = require("../models/MonthlyPayment");
const Salary = require("../models/Salary");
const { monthSummary } = require("./staffAttendance");

/** "2026-08" → { month: 8, year: 2026 } */
function parseMonth(m) {
  const [y, mm] = String(m).split("-").map(Number);
  return { month: mm, year: y };
}

const rule = (s) => ({
  percent: s?.salaryRule?.percent || 0,
  fixedAmount: s?.salaryRule?.fixedAmount || 0,
});

/**
 * Har bir xodim uchun hisob-kitob.
 *
 * @param {object} p  { directorId, branchId, month: "YYYY-MM" }
 */
async function computeAll({ directorId, branchId = null, month }) {
  const { month: m, year: y } = parseMonth(month);

  const staffQuery = { director: directorId, isActive: { $ne: false } };
  if (branchId) staffQuery.branch = branchId;

  const groupQuery = { teacher: directorId };
  if (branchId) groupQuery.branch = branchId;

  const [staff, groups, salaries] = await Promise.all([
    Staff.find(staffQuery).select("name role branch salaryRule").populate("role", "name").lean(),
    Class.find(groupQuery).select("name assignedTeacher").lean(),
    Salary.find({ director: directorId, month }).select("staff amount isPaid").lean(),
  ]);

  if (!staff.length) return [];

  // ── Guruhlar ustoz bo'yicha ──
  const groupsOf = new Map();
  for (const g of groups) {
    if (!g.assignedTeacher) continue;
    const k = String(g.assignedTeacher);
    if (!groupsOf.has(k)) groupsOf.set(k, []);
    groupsOf.get(k).push(g);
  }

  // ── Shu oyda TUSHGAN pul, guruh bo'yicha ──
  // ⚠️ Bitta so'rov: guruh boshiga so'rov yuborsak, 40 guruhli
  //    markazda 40 ta so'rov bo'lardi.
  const paid = await MonthlyPayment.find({
    class: { $in: groups.map((g) => g._id) },
    month: m,
    year: y,
    status: "paid",
  })
    .select("class amount")
    .lean();

  const revenueOf = new Map();
  for (const p of paid) {
    const k = String(p.class);
    revenueOf.set(k, (revenueOf.get(k) || 0) + (p.amount || 0));
  }

  // ── Davomat jarimasi ──
  const { byStaff: attendance } = await monthSummary({ directorId, month });

  const salaryOf = new Map(salaries.map((s) => [String(s.staff), s]));

  return staff.map((s) => {
    const k = String(s._id);
    const r = rule(s);
    const mine = groupsOf.get(k) || [];

    const revenue = mine.reduce(
      (sum, g) => sum + (revenueOf.get(String(g._id)) || 0),
      0,
    );
    // ⚠️ Yaxlitlash: tiyin bilan ishlamaymiz, so'm butun son
    const fromPercent = Math.round((revenue * r.percent) / 100);
    const computed = r.fixedAmount + fromPercent;

    const att = attendance.get(k) || { late: 0, absent: 0, penalty: 0 };
    const existing = salaryOf.get(k);

    return {
      staffId: s._id,
      name: s.name,
      roleName: s.role?.name || "",
      rule: r,
      groups: mine.map((g) => ({
        id: g._id,
        name: g.name,
        revenue: revenueOf.get(String(g._id)) || 0,
      })),
      revenue,
      fromPercent,
      computed,
      attendance: {
        late: att.late || 0,
        absent: att.absent || 0,
        penalty: att.penalty || 0,
      },
      // ⚠️ Manfiy maosh bo'lmasin: jarima hisoblangandan katta
      //    bo'lsa nolga to'xtaydi. Ustozdan pul talab qiladigan
      //    tizim yasamaymiz.
      suggested: Math.max(0, computed - (att.penalty || 0)),
      // Allaqachon belgilangan bo'lsa — solishtirish uchun
      current: existing ? existing.amount : null,
      isPaid: Boolean(existing?.isPaid),
      salaryId: existing?._id || null,
    };
  });
}

module.exports = { computeAll, parseMonth };
