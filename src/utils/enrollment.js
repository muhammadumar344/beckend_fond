// src/utils/enrollment.js
// ════════════════════════════════════════════════════════════
// Guruh ro'yxatini yig'adigan yagona joy.
//
// O'quvchi guruhga IKKI xil yo'l bilan tegishli bo'lishi mumkin:
//   1. `Student.class` — asosiy guruh (eski, hamma joyda ishlatiladi)
//   2. `Enrollment`    — qo'shimcha guruhlar (reja 1.3)
//
// Shu sabab `Student.find({ class })` endi TO'LIQ javob emas.
// Guruh ro'yxati kerak bo'lsa — har doim shu yerdagi funksiyalar.
//
// ⚠️ Ikkalasi birlashtirilganda takror bo'lmasligi kafolatlanadi:
//    asosiy guruh uchun Enrollment yozuvi yaratilmaydi (models/
//    Enrollment.js), lekin eski ma'lumotda tasodifan bo'lib qolsa
//    ham `_id` bo'yicha noyoblashtiriladi.
// ════════════════════════════════════════════════════════════
const Student = require("../models/Student");
const Enrollment = require("../models/Enrollment");

/** ObjectId | string → string */
const key = (v) => String(v);

/**
 * Guruhdagi barcha o'quvchilar (asosiy + qo'shimcha).
 * rollNumber bo'yicha tartiblangan — eski kod ham shunday qilardi.
 *
 * @param {string} classId
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive=false]  o'chirilgan o'quvchilar ham
 * @returns {Promise<Array>} Student hujjatlari
 */
async function getGroupStudents(classId, opts = {}) {
  const studentFilter = opts.includeInactive ? {} : { isActive: { $ne: false } };

  const [primary, extra] = await Promise.all([
    Student.find({ class: classId, ...studentFilter }),
    Enrollment.find({ class: classId, status: "active" }).select("student"),
  ]);

  const seen = new Set(primary.map((s) => key(s._id)));
  const extraIds = extra
    .map((e) => e.student)
    .filter((id) => id && !seen.has(key(id)));

  let extraDocs = [];
  if (extraIds.length) {
    extraDocs = await Student.find({ _id: { $in: extraIds }, ...studentFilter });
  }

  return [...primary, ...extraDocs].sort(
    (a, b) => (a.rollNumber || 0) - (b.rollNumber || 0),
  );
}

/**
 * Guruhdagi o'quvchilar soni. `Student.countDocuments({ class })`
 * o'rniga shuni ishlating.
 */
async function countGroupStudents(classId) {
  const [primary, extra] = await Promise.all([
    Student.countDocuments({ class: classId, isActive: { $ne: false } }),
    Enrollment.countDocuments({ class: classId, status: "active" }),
  ]);
  return primary + extra;
}

/**
 * Bir nechta guruhdagi NOYOB o'quvchilar soni.
 *
 * ⚠️ `countGroupStudents` ni yig'ish NOTO'G'RI bo'lardi: ikkita
 *    guruhda o'qiydigan bola ikki marta sanalardi. Filial/markaz
 *    umumiy statistikasi uchun aynan shu funksiya kerak.
 */
async function countUniqueStudents(classIds) {
  if (!classIds?.length) return 0;

  const [primaryIds, enrolled] = await Promise.all([
    Student.find({ class: { $in: classIds }, isActive: { $ne: false } }).select(
      "_id",
    ),
    Enrollment.find({ class: { $in: classIds }, status: "active" }).select(
      "student",
    ),
  ]);

  const set = new Set(primaryIds.map((s) => key(s._id)));
  for (const e of enrolled) if (e.student) set.add(key(e.student));
  return set.size;
}

/**
 * O'quvchi qatnashadigan guruh ID'lari (asosiy + qo'shimcha).
 * @returns {Promise<string[]>}
 */
async function getStudentGroupIds(studentId) {
  const [student, enrollments] = await Promise.all([
    Student.findById(studentId).select("class"),
    Enrollment.find({ student: studentId, status: "active" }).select("class"),
  ]);

  const ids = new Set();
  if (student?.class) ids.add(key(student.class));
  for (const e of enrollments) if (e.class) ids.add(key(e.class));
  return [...ids];
}

/**
 * Ko'p guruh uchun bir marta so'rab, `classId → studentIds` xaritasini
 * qaytaradi. Ro'yxat sahifalarida har bir guruh uchun alohida so'rov
 * yubormaslik uchun (N+1 muammosi).
 *
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function buildGroupStudentMap(classIds) {
  const map = new Map(classIds.map((id) => [key(id), new Set()]));
  if (!classIds?.length) return map;

  const [students, enrollments] = await Promise.all([
    Student.find({ class: { $in: classIds }, isActive: { $ne: false } }).select(
      "class",
    ),
    Enrollment.find({ class: { $in: classIds }, status: "active" }).select(
      "student class",
    ),
  ]);

  for (const s of students) {
    map.get(key(s.class))?.add(key(s._id));
  }
  for (const e of enrollments) {
    map.get(key(e.class))?.add(key(e.student));
  }
  return map;
}

module.exports = {
  getGroupStudents,
  countGroupStudents,
  countUniqueStudents,
  getStudentGroupIds,
  buildGroupStudentMap,
};
