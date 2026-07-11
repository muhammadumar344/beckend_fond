// scripts/fixRolePermissions.js
// Bir martalik skript: eski (obyekt) formatdagi permissions'ni array'ga o'tkazadi
// Ishlatish: node scripts/fixRolePermissions.js
require('dotenv').config()
const mongoose = require('mongoose')
const Role = require('../models/Role')

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB ulandi. Rollar tekshirilmoqda...')

  const roles = await Role.find({}).lean() // .lean() — xom (raw) ma'lumotni olish uchun
  let fixed = 0
  let alreadyOk = 0

  for (const raw of roles) {
    const perms = raw.permissions

    if (Array.isArray(perms)) {
      alreadyOk++
      continue
    }

    // Obyekt formatidan array'ga o'girish: { manageStaff: true, manageGroups: false }
    // -> ['manageStaff']
    const newPerms = []
    if (perms && typeof perms === 'object') {
      for (const [key, value] of Object.entries(perms)) {
        if (value === true) newPerms.push(key)
      }
    }

    await Role.updateOne({ _id: raw._id }, { $set: { permissions: newPerms } })
    fixed++
    console.log(`Tuzatildi: "${raw.name}" (${raw._id}) -> [${newPerms.join(', ')}]`)
  }

  console.log('---')
  console.log(`Jami rollar: ${roles.length}`)
  console.log(`Allaqachon to'g'ri edi: ${alreadyOk}`)
  console.log(`Tuzatildi: ${fixed}`)

  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((e) => {
  console.error('Xatolik:', e)
  process.exit(1)
})