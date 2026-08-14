const Staff = require('../models/Staff');
const Teacher = require('../models/Teacher');

/**
 * Teacher (Director) yoki Staff bo'lishidan qat'i nazar
 * { directorId, branchFilter, isDirector, permissions } qaytaradi.
 * Barcha LC controllerlarda shuni ishlating!
 */
async function resolveContext(req) {
  const { id: userId, role } = req.user;

  if (role === 'teacher') {
    return {
      directorId: userId,
      branchFilter: null,       // barcha filiallarni ko'radi
      isDirector: true,
      permissions: null,        // barcha huquqlar mavjud
    };
  }

  if (role === 'staff') {
    const staff = await Staff.findById(userId)
      .populate('role', 'permissions slug name')
      .lean();

    if (!staff) {
      const err = new Error('Xodim topilmadi');
      err.status = 404;
      throw err;
    }
    if (!staff.isActive) {
      const err = new Error('Xodim hisobi faol emas');
      err.status = 403;
      throw err;
    }

    // ⚠️ Direktor markazni o'chirishga qo'ygan bo'lsa xodim ham
    //    kira olmaydi. Login'da tekshirish YETARLI EMAS: allaqachon
    //    berilgan token muddati tugagunicha ishlayverardi, ya'ni
    //    yopilayotgan markazning ma'lumotlari haftalab ochiq qolardi.
    //
    //    Bu qo'shimcha bitta indekslangan _id o'qish — direktor
    //    yo'lida umuman yo'q (u yerda so'rovning o'zi bo'lmaydi).
    const director = await Teacher.findById(staff.director)
      .select('deletionScheduledFor')
      .lean();
    if (director && director.deletionScheduledFor) {
      const err = new Error("Muassasa hisobi o'chirilmoqda");
      err.status = 403;
      throw err;
    }

    return {
      directorId: staff.director,       // Teacher._id
      branchFilter: staff.branch ? String(staff.branch) : null,  // Branch._id (string)
      isDirector: false,
      permissions: staff.role?.permissions || [],
      staffId: userId,
      staffRole: staff.role,
    };
  }

  const err = new Error("Noma'lum foydalanuvchi roli");
  err.status = 401;
  throw err;
}

/**
 * Permission tekshiradi. Director uchun har doim o'tadi.
 * Staff uchun permissions ro'yxatida bo'lishi shart, aks holda 403 throw qiladi.
 */
function requirePermission(ctx, permission) {
  if (ctx.isDirector) return;
  if (!Array.isArray(ctx.permissions) || !ctx.permissions.includes(permission)) {
    const err = new Error(`Ruxsat yo'q: "${permission}" huquqi kerak`);
    err.status = 403;
    throw err;
  }
}

module.exports = { resolveContext, requirePermission };