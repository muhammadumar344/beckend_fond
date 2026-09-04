// src/services/billing.js
// ════════════════════════════════════════════════════════════
// OYLIK TO'LOV VARAQASI.
//
// ⚠️ VARAQA QO'LDA YARATILADI va aynan shu — tizimdagi eng
//    qimmat "jim" xato: administrator bitta guruhni unutsa,
//    o'sha oy o'sha guruhdan pul umuman so'ralmaydi. Na xato,
//    na belgi. Oy oxirida faqat "nega tushum kam?" qoladi.
//
//    Shuning uchun ikkita narsa qilindi:
//      1. `GET /teacher/health` — unutilgan guruhni ko'rsatadi
//      2. shu servis — HAMMA guruhga bir bosishda yaratish
//
// ⚠️ ARXIVDAGI O'QUVCHIGA VARAQA YARATILMAYDI. Ilgari
//    `Student.find({ class })` deb olinardi va arxiv paydo
//    bo'lgach bu bug bo'lardi: ketgan bolaga har oy yangi qarz
//    yozilib boraverardi.
//
// ⚠️ TAKROR YARATILMAYDI. Mavjud varaqalar bitta so'rov bilan
//    olinadi va faqat yetishmaganlari qo'shiladi — ya'ni
//    tugmani ikki marta bosish xavfsiz.
// ════════════════════════════════════════════════════════════

const Student = require("../models/Student");
const MonthlyPayment = require("../models/MonthlyPayment");

/**
 * ⚠️ SOF FUNKSIYA. Kimga varaqa yetishmayapti?
 *
 * @param {Array} students  [{ _id }]
 * @param {Array} existing  [{ student }]
 * @returns {Array} varaqasi yo'q o'quvchilar
 */
function pickMissing(students = [], existing = []) {
  const have = new Set(existing.map((p) => String(p.student)));
  return students.filter((s) => !have.has(String(s._id)));
}

/**
 * Bitta guruh uchun yetishmayotgan varaqalarni yaratadi.
 *
 * @returns {Promise<{created:number, alreadyExisted:number, total:number}>}
 */
async function ensureBillsForClass({ cls, teacherId, month, year }) {
  // ⚠️ Faqat FAOL o'quvchilar — arxivdagilarga qarz yozilmasin.
  const students = await Student.find({
    class: cls._id,
    isActive: { $ne: false },
  }).select("_id");

  if (!students.length) {
    return { created: 0, alreadyExisted: 0, total: 0 };
  }

  // ⚠️ BITTA so'rov: ilgari har bir o'quvchi uchun alohida
  //    `findOne` yuborilardi (30 kishilik guruhda 30 ta so'rov,
  //    hamma guruh uchun esa yuzlab).
  const existing = await MonthlyPayment.find({
    class: cls._id,
    month,
    year,
  }).select("student");

  const missing = pickMissing(students, existing);
  if (missing.length) {
    await MonthlyPayment.insertMany(
      missing.map((s) => ({
        student: s._id,
        class: cls._id,
        teacher: teacherId,
        amount: cls.defaultAmount,
        month,
        year,
        status: "not_paid",
      })),
    );
  }

  return {
    created: missing.length,
    alreadyExisted: students.length - missing.length,
    total: students.length,
  };
}

/** Bir nechta guruh uchun — "hammasiga yaratish" tugmasi shu yerdan */
async function ensureBillsForClasses({ classes, teacherId, month, year }) {
  const groups = [];
  let created = 0;

  for (const cls of classes) {
    const r = await ensureBillsForClass({ cls, teacherId, month, year });
    created += r.created;
    // ⚠️ O'quvchisi yo'q guruh hisobotga tushmaydi — u muammo
    //    emas, shunchaki bo'sh guruh.
    if (r.total > 0) {
      groups.push({ id: String(cls._id), name: cls.name, ...r });
    }
  }

  return {
    created,
    groups,
    // Nechta guruhga haqiqatan yangi varaqa qo'shildi
    touched: groups.filter((g) => g.created > 0).length,
  };
}

module.exports = { pickMissing, ensureBillsForClass, ensureBillsForClasses };
