// src/services/centerHealth.js
// ════════════════════════════════════════════════════════════
// MARKAZ SALOMATLIGI — jimgina yo'qotilayotgan narsalar.
//
// Tizimdagi eng qimmat xatolar xato bermaydi. Ular shunchaki
// SODIR BO'LMAYDI:
//
//   • To'lov varaqasi QO'LDA yaratiladi (`createMonthlyPayments`,
//     har guruh uchun alohida). Administrator bitta guruhni
//     unutsa — o'sha oy o'sha guruhdan pul umuman so'ralmaydi.
//     Hech qanday xato yo'q, hech kim bilmaydi, oy oxirida esa
//     "nega tushum kam?" degan savol qoladi.
//
//   • Telefoni yo'q o'quvchiga na eslatma, na Telegram xabari
//     boradi. U tizimda bor, lekin biz unga yeta olmaymiz.
//
//   • Jadvalsiz guruhda davomat ham, bo'sh vaqt hisobi ham
//     ishlamaydi — lekin guruh ro'yxatda "bor" bo'lib turadi.
//
//   • Ustozsiz guruh: dars kimdir tomonidan o'tiladi, lekin
//     tizim kim ekanini bilmaydi — maosh ham, yuklama ham
//     noto'g'ri chiqadi.
//
// ⚠️ RO'YXAT EMAS, SANOQ + BIR NECHTA MISOL. Direktorga
//    "nima unutilgan" kerak, to'liq ro'yxat esa o'sha
//    sahifalarda allaqachon bor.
//
// ⚠️ `buildHealth` SOF FUNKSIYA — `test/centerHealth.test.js`
//    uni qulflaydi.
// ════════════════════════════════════════════════════════════

const Class = require("../models/Class");
const Student = require("../models/Student");
const MonthlyPayment = require("../models/MonthlyPayment");
const Schedule = require("../models/Schedule");

// Xabarda shuncha misol ko'rsatiladi
const SAMPLE = 5;

/**
 * ⚠️ SOF FUNKSIYA.
 *
 * @param {object} d
 * @param {Array} d.groups        [{ id, name, hasBilling, hasSchedule, hasTeacher, studentCount }]
 * @param {Array} d.noPhone       [{ id, name, groupName }]
 * @param {boolean} d.isLC        LC rejimidami (jadval/ustoz faqat LC uchun)
 * @returns {object}
 */
function buildHealth(d) {
  const groups = d.groups || [];
  const noPhone = d.noPhone || [];
  const isLC = Boolean(d.isLC);

  // ⚠️ BO'SH GURUH HISOBGA OLINMAYDI. O'quvchisi yo'q guruhga
  //    to'lov varaqasi yaratilmagani — muammo emas, tabiiy hol.
  const withStudents = groups.filter((g) => g.studentCount > 0);

  // ⚠️ Hamma tekshiruv FAQAT o'quvchisi bor guruhlarda. Yangi
  //    ochilgan bo'sh guruhda na jadval, na ustoz bo'lishi
  //    tabiiy — u hali tayyorlanyapti. Uni ogohlantirishga
  //    qo'shsak, ro'yxat birinchi kundanoq shovqinga aylanardi.
  const noBilling = withStudents.filter((g) => !g.hasBilling);
  const noSchedule = isLC ? withStudents.filter((g) => !g.hasSchedule) : [];
  const noTeacher = isLC ? withStudents.filter((g) => !g.hasTeacher) : [];

  const item = (list, extra = {}) => ({
    count: list.length,
    sample: list.slice(0, SAMPLE).map((x) => x.name),
    ...extra,
  });

  const issues = {
    // Eng qimmati birinchi: bu — to'g'ridan-to'g'ri yo'qotilgan pul
    noBilling: item(noBilling),
    noPhone: item(noPhone),
    noSchedule: item(noSchedule),
    noTeacher: item(noTeacher),
  };

  const total =
    issues.noBilling.count +
    issues.noPhone.count +
    issues.noSchedule.count +
    issues.noTeacher.count;

  return { total, issues, checkedGroups: groups.length };
}

/** Bazadan yig'adi */
async function collect({ directorId, branchId = null, month, year, isLC }) {
  const groupQuery = { teacher: directorId, archivedAt: null };
  if (branchId) groupQuery.branch = branchId;

  const groups = await Class.find(groupQuery)
    .select("name assignedTeacher")
    .lean();
  const ids = groups.map((g) => g._id);

  if (!ids.length) {
    return { groups: [], noPhone: [], isLC };
  }

  const [payRows, students, schedules] = await Promise.all([
    // Shu oy uchun varaqa yaratilgan guruhlar
    MonthlyPayment.aggregate([
      { $match: { class: { $in: ids }, month, year } },
      { $group: { _id: "$class", n: { $sum: 1 } } },
    ]),
    Student.find({ class: { $in: ids }, isActive: { $ne: false } })
      .select("name class parentPhone")
      .lean(),
    isLC
      ? Schedule.find({ class: { $in: ids } }).distinct("class")
      : Promise.resolve([]),
  ]);

  const billed = new Set(payRows.map((r) => String(r._id)));
  const scheduled = new Set(schedules.map((id) => String(id)));

  const countByGroup = new Map();
  for (const s of students) {
    const k = String(s.class);
    countByGroup.set(k, (countByGroup.get(k) || 0) + 1);
  }
  const nameByGroup = new Map(groups.map((g) => [String(g._id), g.name]));

  return {
    isLC,
    groups: groups.map((g) => {
      const id = String(g._id);
      return {
        id,
        name: g.name,
        hasBilling: billed.has(id),
        hasSchedule: scheduled.has(id),
        hasTeacher: Boolean(g.assignedTeacher),
        studentCount: countByGroup.get(id) || 0,
      };
    }),
    // ⚠️ Raqamning o'zi bo'sh bo'lgani muhim, uzunligi emas:
    //    "90" deb yozilgan raqam ham yaroqsiz, lekin uni bu yerda
    //    tekshirsak soxta ogohlantirish ko'p bo'lardi.
    noPhone: students
      .filter((s) => !String(s.parentPhone || "").trim())
      .map((s) => ({
        id: String(s._id),
        name: s.name,
        groupName: nameByGroup.get(String(s.class)) || "",
      })),
  };
}

module.exports = { buildHealth, collect, SAMPLE };
