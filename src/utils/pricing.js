// src/utils/pricing.js
// ════════════════════════════════════════════════════════════
// O'QUVCHINING SHU GURUH UCHUN NARXI.
//
// ⚠️ CHEGIRMA ILGARI ISHLAMASDI. `Enrollment.priceOverride`
//    maydoni bor edi va izohida "chegirma, aka-uka chegirmasi,
//    shartnoma narxi" deb yozilgan edi — lekin oylik to'lov
//    yaratadigan kod `Enrollment` ni UMUMAN o'qimasdi va
//    hammaga guruhning to'liq narxini yozardi.
//
//    Ya'ni direktor chegirma qo'yadi, tizim to'liq summani
//    hisoblaydi, ota-ona esa "menga chegirma va'da qilingan"
//    deb keladi. Eng yomon turdagi xato: hech qayerda xato
//    ko'rinmaydi, faqat pul noto'g'ri.
//
// ⚠️ NARX IKKI MANBADAN KELADI va bu ataylab:
//      · asosiy guruh    → `Student.priceOverride`
//      · qo'shimcha guruh → `Enrollment.priceOverride`
//    Asosiy guruhga `Enrollment` yozuvi yaratilmaydi (takror
//    bo'lardi — `utils/enrollment.js` izohiga qarang), shuning
//    uchun uning narxi o'quvchining o'zida turadi.
//
// ⚠️ NOL — HAQIQIY NARX, "belgilanmagan" emas. Bepul o'qiydigan
//    o'quvchi bor (xodim farzandi, grant). `?? ` ishlatiladi,
//    `||` emas: `0 || 500000` bizga 500 000 berardi va bepul
//    o'quvchiga hisob kelib qolardi.
// ════════════════════════════════════════════════════════════

/**
 * Bitta o'quvchining shu guruhdagi oylik narxi.
 *
 * ⚠️ SOF FUNKSIYA — bazaga tegmaydi, `test/pricing.test.js`
 *    uni to'liq sinaydi.
 *
 * @param {object} p
 * @param {object} p.student     Student hujjati
 * @param {object} p.group       Class/Group hujjati (`defaultAmount`)
 * @param {object} [p.enrollment] Shu guruhdagi Enrollment (bo'lsa)
 * @returns {{ amount: number, source: 'enrollment'|'student'|'group' }}
 */
function resolvePrice({ student, group, enrollment }) {
  const groupPrice = Number(group?.defaultAmount) || 0;

  // Qo'shimcha guruh narxi eng aniq manba — u aynan shu
  // (o'quvchi + guruh) juftligi uchun qo'yilgan.
  const fromEnrollment = enrollment?.priceOverride;
  if (fromEnrollment !== undefined && fromEnrollment !== null) {
    return { amount: Number(fromEnrollment), source: "enrollment" };
  }

  const fromStudent = student?.priceOverride;
  if (fromStudent !== undefined && fromStudent !== null) {
    return { amount: Number(fromStudent), source: "student" };
  }

  return { amount: groupPrice, source: "group" };
}

/**
 * Guruhdagi hamma o'quvchi uchun narx xaritasi.
 *
 * ⚠️ `Enrollment` yozuvlari BITTA so'rov bilan olinadi va
 *    xotirada juftlashtiriladi. Har bir o'quvchi uchun alohida
 *    so'rov yuborsak, 30 kishilik guruhga 30 ta so'rov ketardi.
 *
 * @param {Array} students
 * @param {object} group
 * @param {Array} enrollments  shu guruhning Enrollment yozuvlari
 * @returns {Map<string, {amount:number, source:string}>}
 */
function priceMap(students, group, enrollments = []) {
  const byStudent = new Map(
    enrollments.map((e) => [String(e.student), e]),
  );
  const out = new Map();
  for (const s of students) {
    out.set(
      String(s._id),
      resolvePrice({ student: s, group, enrollment: byStudent.get(String(s._id)) }),
    );
  }
  return out;
}

module.exports = { resolvePrice, priceMap };
