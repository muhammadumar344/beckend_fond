// src/scripts/fixRolePermissions.js
// Bir martalik skript: eski (obyekt) formatdagi permissions'ni
// array'ga o'tkazadi.
//
// ISHLATISH:
//   node src/scripts/fixRolePermissions.js           → ko'rsatadi
//   node src/scripts/fixRolePermissions.js --apply   → yozadi
//
// ⚠️ ILGARI TEKSHIRUVSIZ YOZARDI va bitta jim xatosi bor edi:
//    `permissions` maydoni umuman bo'lmagan rol (`undefined`
//    yoki `null`) ham "eski format" deb hisoblanardi va unga
//    BO'SH massiv yozilardi — ya'ni rolning barcha huquqlari
//    o'chib ketardi va o'sha roldagi xodim ertasi kuni hech
//    qayerga kira olmasdi.
//
//    Endi faqat HAQIQIY obyekt o'giriladi.
require('dotenv').config()
const mongoose = require('mongoose')
const Role = require('../models/Role')

const APPLY = process.argv.includes('--apply')

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB ulandi. Rollar tekshirilmoqda...')

  const roles = await Role.find({}).lean() // .lean() — xom (raw) ma'lumotni olish uchun
  let fixed = 0
  let alreadyOk = 0
  let skipped = 0

  for (const raw of roles) {
    const perms = raw.permissions

    if (Array.isArray(perms)) {
      alreadyOk++
      continue
    }

    // ⚠️ Obyekt BO'LMASA tegmaymiz. `null`/`undefined` — o'girish
    //    kerak bo'lgan eski format emas, shunchaki bo'sh maydon.
    if (!perms || typeof perms !== 'object') {
      skipped++
      continue
    }

    // Obyekt formatidan array'ga o'girish: { manageStaff: true, manageGroups: false }
    // -> ['manageStaff']
    const newPerms = []
    for (const [key, value] of Object.entries(perms)) {
      if (value === true) newPerms.push(key)
    }

    if (APPLY) {
      await Role.updateOne({ _id: raw._id }, { $set: { permissions: newPerms } })
    }
    fixed++
    console.log(
      `${APPLY ? 'Tuzatildi' : 'Tuzatiladi'}: "${raw.name}" (${raw._id}) -> [${newPerms.join(', ')}]`,
    )
  }

  console.log('---')
  console.log(`Jami rollar: ${roles.length}`)
  console.log(`Allaqachon to'g'ri edi: ${alreadyOk}`)
  console.log(`Tegilmadi (obyekt emas): ${skipped}`)
  console.log(`${APPLY ? 'Tuzatildi' : 'Tuzatiladi'}: ${fixed}`)
  if (!APPLY) console.log('\nQuruq yurish — hech narsa yozilmadi. Yozish uchun: --apply')

  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((e) => {
  console.error('Xatolik:', e)
  process.exit(1)
})