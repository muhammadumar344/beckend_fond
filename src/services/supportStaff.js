// src/services/supportStaff.js
// ════════════════════════════════════════════════════════════
// KIM support ustozi — YAGONA javob.
//
// ⚠️ ILGARI NOTO'G'RI EDI. O'quvchiga o'z guruhlarining
//    ustozlari ko'rsatilardi, ya'ni dars o'tayotgan ustozdan
//    ustiga-ustak qo'shimcha mashg'ulot ham kutilardi.
//    Haqiqatda o'quv markazlari buning uchun ALOHIDA odam
//    oladi va uning roli "Support Teacher" qilib qo'yiladi.
//    Endi ro'yxat aynan shu roldan olinadi.
//
// ⚠️ Bayroq ROLDA (`Role.isSupport`), xodimda emas: markaz
//    rolni bir marta belgilaydi, keyin unga qancha xodim
//    qo'shsa ham qo'shimcha sozlash kerak bo'lmaydi.
//
// ⚠️ `slug === 'support_teacher'` ham qabul qilinadi. Sabab:
//    bu rol yangi bayroq paydo bo'lishidan OLDIN yaratilgan
//    markazlarda `isSupport` maydoni yo'q. Ularni migratsiya
//    qilishni kutib turmaymiz — ikkala shart ham ishlaydi.
// ════════════════════════════════════════════════════════════

const Role = require("../models/Role");
const Staff = require("../models/Staff");
const SupportSlot = require("../models/SupportSlot");

const LEGACY_SLUG = "support_teacher";

/** Markazdagi support rollari (id ro'yxati) */
async function supportRoleIds(directorId) {
  const roles = await Role.find({
    director: directorId,
    isActive: { $ne: false },
    $or: [{ isSupport: true }, { slug: LEGACY_SLUG }],
  })
    .select("_id")
    .lean();
  return roles.map((r) => r._id);
}

/**
 * Support ustozlari.
 *
 * @param {object} p
 * @param {string} p.directorId
 * @param {string} [p.branchId]   Berilsa — faqat shu filial (va
 *                                filialsiz, markaz bo'ylab ishlaydiganlar)
 * @param {boolean} [p.withSlotsOnly]  Faqat qabul vaqti bor bo'lganlar
 * @returns {Promise<Array<{id, name, phone, branch}>>}
 */
async function listSupportStaff({
  directorId,
  branchId = null,
  withSlotsOnly = false,
}) {
  const roleIds = await supportRoleIds(directorId);
  if (!roleIds.length) return [];

  const query = {
    director: directorId,
    role: { $in: roleIds },
    isActive: { $ne: false },
  };

  // ⚠️ Filiali YO'Q xodim ham chiqadi. Ko'p markazda support
  //    ustozi bitta bo'ladi va u hamma filialga xizmat qiladi —
  //    qat'iy filtr uni hech kimga ko'rsatmay qo'yardi.
  if (branchId) {
    query.$or = [{ branch: branchId }, { branch: null }];
  }

  let staff = await Staff.find(query).select("name phone branch").lean();

  if (withSlotsOnly && staff.length) {
    // ⚠️ Qabul vaqti belgilanmagan ustoz KO'RSATILMAYDI. Aks
    //    holda o'quvchi uni tanlab, "bo'sh vaqt yo'q" degan
    //    bo'sh ekranga tushardi va nima qilishni bilmasdi.
    const withSlots = await SupportSlot.find({
      director: directorId,
      teacher: { $in: staff.map((s) => s._id) },
      isActive: true,
    }).distinct("teacher");

    const ok = new Set(withSlots.map(String));
    staff = staff.filter((s) => ok.has(String(s._id)));
  }

  return staff.map((s) => ({
    id: s._id,
    name: s.name,
    phone: s.phone || "",
    branch: s.branch || null,
  }));
}

/**
 * Shu xodim support ustozimi.
 *
 * ⚠️ YOZISHDAN OLDIN TEKSHIRILADI. Ro'yxatni interfeysda
 *    cheklash yetarli emas: so'rovga istalgan xodim id sini
 *    qo'yib yuborish mumkin va o'quvchi buxgalterga
 *    "qo'shimcha dars"ga yozilib olardi.
 */
async function isSupportStaff(directorId, staffId) {
  const roleIds = await supportRoleIds(directorId);
  if (!roleIds.length) return false;

  const n = await Staff.countDocuments({
    _id: staffId,
    director: directorId,
    role: { $in: roleIds },
    isActive: { $ne: false },
  });
  return n > 0;
}

module.exports = { listSupportStaff, isSupportStaff, supportRoleIds, LEGACY_SLUG };
