// src/utils/studentPurge.js
// ════════════════════════════════════════════════════════════
// O'QUVCHI O'CHIRILGANDA UNGA TEGISHLI HAMMA NARSA HAM.
//
// ⚠️ ILGARI FAQAT TO'LOVLARI O'CHIRILARDI. Qolgan hammasi —
//    davomat, baholar, uy vazifasi natijalari, qo'shimcha
//    guruhlarga yozilishi, Telegram bog'lanishi, qo'shimcha
//    mashg'ulot yozuvlari — bazada EGASIZ qolib ketardi.
//
//    Bu jim, lekin zararli:
//      · davomat foizi eski yozuvlarni sanashda davom etardi —
//        ya'ni guruh statistikasi abadiy noto'g'ri chiqardi
//      · ota-onaning Mini App'dagi bog'lanishi ochiq qolardi
//      · tasdiqlanmagan to'lov so'rovi ro'yxatda "o'quvchisiz"
//        qator bo'lib turardi
//
// ⚠️ ENDI O'CHIRISH KAMDAN-KAM KERAK: ketgan o'quvchi
//    ARXIVLANADI (`isActive: false`) va hamma tarixi joyida
//    qoladi. O'chirish faqat adashib qo'shilgan yozuv uchun —
//    va aynan o'shanda iz qolmasligi kerak.
//
// ⚠️ RO'YXAT MODELLAR PAPKASI BILAN BIR XIL BO'LISHI SHART.
//    `test/studentPurge.test.js` `student` maydoni bor har bir
//    modelni skanerlaydi va bu yerda yo'qini xato deb beradi —
//    `accountPurge` bilan bir xil qoida.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

// [model nomi, o'quvchini ko'rsatuvchi maydon]
const OWNED = [
  ["MonthlyPayment", "student"],
  ["Attendance", "student"],
  ["Grade", "student"],
  ["HomeworkResult", "student"],
  ["Enrollment", "student"],
  ["StudentLink", "student"],
  ["PaymentClaim", "student"],
  ["SupportBooking", "student"],
  ["InviteCode", "student"],
];

// ⚠️ `TelegramParent` da maydon boshqacha nomlanadi — eski bot
//    ro'yxati va u `studentId` deb yozadi.
const OTHER = [["TelegramParent", "studentId"]];

/**
 * @param {string|ObjectId} studentId
 * @returns {Promise<object>} qaysi to'plamdan nechta o'chirildi
 */
async function purgeStudent(studentId) {
  const removed = {};

  for (const [name, field] of [...OWNED, ...OTHER]) {
    const Model = mongoose.models[name];
    // Model yuklanmagan bo'lsa (masalan test muhitida) —
    // jimgina o'tkazib yuboramiz, o'chirish to'xtamasin.
    if (!Model) continue;
    const r = await Model.deleteMany({ [field]: studentId });
    if (r?.deletedCount) removed[name] = r.deletedCount;
  }

  return removed;
}

module.exports = { purgeStudent, OWNED, OTHER };
