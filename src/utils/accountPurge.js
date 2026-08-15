// src/utils/accountPurge.js
// ════════════════════════════════════════════════════════════
// Direktor hisobini va unga TEGISHLI HAMMA MA'LUMOTNI o'chirish.
//
// ⚠️ Bu yerni to'ldirmasdan qoldirish — eng jimgina xato turi.
//    Ro'yxatdan bitta model tushib qolsa, o'sha to'plamda egasiz
//    hujjatlar qoladi: hech kim ko'rmaydi, lekin bazada yotadi va
//    hisob-kitoblarda paydo bo'lib turadi. Shuning uchun quyidagi
//    ro'yxat modellar papkasi bilan bir xil bo'lishi SHART.
//    Yangi model qo'shsangiz — shu yerga ham qo'shing.
//    `npm test` dagi "accountPurge" testi buni tekshiradi.
//
// ⚠️ TRANZAKSIYA YO'Q. MongoDB Atlas bepul rejasida replica set
//    bor, lekin loyihaning qolgan qismi ham tranzaksiyasiz
//    ishlaydi. O'rniga tartib muhim: eng oxirida Teacher
//    o'chiriladi. Yarim yo'lda uzilsa direktor hisobi qoladi va
//    amal qayta chaqirilsa davom etadi.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const cloudinary = require("../services/cloudinary");

// [model nomi, egasini ko'rsatuvchi maydon]
//
// ⚠️ `Group` bu yerda YO'Q — u `Class` bilan BITTA to'plamda
//    (`classes`) yashaydi, faqat boshqacha nomlangan qarashi.
//    Ikkalasini yozsak bir xil hujjatlarni ikki marta o'chirishga
//    urinardik. models/Group.js oxiridagi izohga qarang.
const OWNED = [
  ["Attendance", "teacher"],
  ["Branch", "teacher"],
  ["Class", "teacher"],
  ["Enrollment", "director"],
  ["Expense", "teacher"],
  ["Grade", "teacher"],
  ["Homework", "director"],
  ["HomeworkResult", "director"],
  ["InviteCode", "director"],
  ["Lead", "director"],
  ["MonthlyPayment", "teacher"],
  ["PaymentClaim", "director"],
  ["PaymentRequest", "teacher"],
  ["Role", "director"],
  ["Salary", "director"],
  ["Schedule", "teacher"],
  ["Staff", "director"],
  ["StaffAttendance", "director"],
  ["StudentLink", "director"],
  ["Subject", "director"],
  ["SupportBooking", "director"],
  // ⚠️ `SupportSlot` olib tashlandi — model umuman yo'q endi.
  //    Support ustozining qabul vaqti degan tushuncha yo'qoldi:
  //    qabul markazning ish vaqti davomida har doim ochiq
  //    (utils/supportSlots.js dagi izoh).
  ["TelegramParent", "teacherId"],
  ["Transaction", "teacher"],
];

/**
 * Direktorga tegishli hamma narsani o'chiradi.
 *
 * @param {string|ObjectId} directorId
 * @returns {Promise<Object>} model → o'chirilgan hujjatlar soni
 */
async function purgeDirector(directorId) {
  const Teacher = mongoose.model("Teacher");
  const Student = mongoose.model("Student");
  const Class = mongoose.model("Class");

  const counts = {};

  // 1) Logotip CDN da bo'lsa — avval o'sha (baza yozuvi yo'qolgach
  //    publicId ni boshqa topolmaymiz)
  const teacher = await Teacher.findById(directorId).select(
    "logoPublicId email name",
  );
  if (!teacher) return null; // allaqachon o'chirilgan
  if (teacher.logoPublicId) {
    await cloudinary.destroyImage(teacher.logoPublicId);
  }

  // 2) To'lov cheklari ham CDN da bo'lishi mumkin. Hujjatlar
  //    o'chib ketgach publicId larni boshqa topib bo'lmaydi, shuning
  //    uchun o'chirishdan OLDIN yig'ib olamiz.
  const PaymentRequest = mongoose.model("PaymentRequest");
  const receiptIds = await PaymentRequest.find({
    teacher: directorId,
    screenshotPublicId: { $nin: ["", null] },
  }).distinct("screenshotPublicId");
  for (const id of receiptIds) {
    await cloudinary.destroyImage(id);
  }
  counts.cdnReceipts = receiptIds.length;

  // 3) O'quvchilar — ularda direktor maydoni YO'Q, faqat `class`.
  //    Shuning uchun avval sinf id larini yig'amiz.
  const classIds = await Class.find({ teacher: directorId }).distinct("_id");
  if (classIds.length) {
    const r = await Student.deleteMany({ class: { $in: classIds } });
    counts.Student = r.deletedCount || 0;
  } else {
    counts.Student = 0;
  }

  // 4) Egasi bo'yicha to'g'ridan-to'g'ri o'chadiganlar
  for (const [name, field] of OWNED) {
    const Model = mongoose.model(name);
    const r = await Model.deleteMany({ [field]: directorId });
    counts[name] = r.deletedCount || 0;
  }

  // 5) Referal bog'lanishi — bu direktor kimnidir taklif qilgan
  //    bo'lsa, o'sha hisoblarda osilgan havola qolmasin
  const ref = await Teacher.updateMany(
    { referredBy: directorId },
    { $set: { referredBy: null } },
  );
  counts.referralsCleared = ref.modifiedCount || 0;

  // 6) Eng oxirida — direktorning o'zi
  await Teacher.deleteOne({ _id: directorId });
  counts.Teacher = 1;

  return counts;
}

module.exports = { purgeDirector, OWNED };
