// src/utils/resolveContext.js — YANGI FAYL
// Director (teacher) yoki Staff bo'lishidan qat'i nazar,
// to'g'ri "qaysi muassasaga tegishli" va "qaysi filial bilan
// cheklangan" ekanini aniqlaydi. Barcha LC controllerlari shuni ishlatadi.

const Staff = require('../models/Staff')

/**
 * @returns {{
 *   directorId: string,       // muassasa egasining Teacher._id
 *   branchFilter: string|null,// agar staff filialga bog'langan bo'lsa, shu filial bilan cheklash
 *   isDirector: boolean,
 *   permissions: object|null, // staff bo'lsa — uning ruxsatlari
 * }}
 */
const resolveContext = async (req) => {
  if (req.user.role === 'teacher') {
    // Director — cheklovsiz, hammasini ko'radi
    return {
      directorId: req.user.id,
      branchFilter: null,
      isDirector: true,
      permissions: null,
    }
  }

  if (req.user.role === 'staff') {
    const staff = await Staff.findById(req.user.id).populate('role')
    if (!staff) throw new Error('Staff topilmadi')

    return {
      directorId: staff.director.toString(),
      branchFilter: staff.branch ? staff.branch.toString() : null,
      isDirector: false,
      permissions: staff.role.permissions,
      staffId: staff._id.toString(),
    }
  }

  throw new Error('Noma\'lum rol')
}

/**
 * Ruxsat tekshirish helper — controller ichida chaqiriladi
 * Misol: requirePermission(ctx, 'manageAttendance')
 */
const requirePermission = (ctx, permKey) => {
  if (ctx.isDirector) return true   // director hamma narsaga ruxsatli
  return !!ctx.permissions?.[permKey]
}

module.exports = { resolveContext, requirePermission }