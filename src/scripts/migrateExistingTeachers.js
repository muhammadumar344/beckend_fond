// src/scripts/migrateExistingTeachers.js
// ════════════════════════════════════════════════════════════
// BIR MARTALIK SCRIPT — onboarding qo'shilishidan oldin
// ro'yxatdan o'tgan teacher larni "tugallangan" deb belgilaydi
// ════════════════════════════════════════════════════════════
//
// ISHLATISH:
//   node src/scripts/migrateExistingTeachers.js           → ko'rsatadi
//   node src/scripts/migrateExistingTeachers.js --apply   → yozadi
//
// ⚠️ ILGARI BU SKRIPT TEKSHIRUVSIZ YOZARDI va bu jonli bazada
//    ZARAR keltirardi:
//
//    · Filtr `onboardingCompleted: { $ne: true }` — ya'ni
//      onboarding'ni HALI TUGATMAGAN har bir hisob, shu
//      jumladan BUGUN ro'yxatdan o'tganlar ham.
//    · `institutionType: 'school'` MAJBURAN yozilardi. Rejim
//      esa ro'yxatdan o'tishda tanlanadi va keyin
//      o'zgartirilmaydi (ataylab shunday). Ya'ni o'quv markazi
//      sifatida ro'yxatdan o'tgan, lekin onboarding'ni
//      tugatmagan direktor jimgina "Maktab fondi" ga aylanardi
//      va butun LC menyusini yo'qotardi.
//    · `institutionName` va `city` BO'SHATILARDI.
//
//    Endi: `--apply` bo'lmasa faqat ko'rsatadi, va rejimi
//    allaqachon tanlangan hisoblarga UMUMAN tegmaydi.
//
// Bu bir martalik skript — onboarding qo'shilishidan oldin
// ro'yxatdan o'tganlar uchun. Ishi tugagan bo'lsa o'chirsa
// bo'ladi.
require('dotenv').config()
const mongoose = require('mongoose')
const Teacher = require('../models/Teacher')

const APPLY = process.argv.includes('--apply')

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fond-school')
    console.log('✅ MongoDB ulandi')

    // ⚠️ FAQAT REJIMI HALI TANLANMAGAN HISOBLAR. `institutionType`
    //    yozilgan bo'lsa — bu odam tanlovini qilgan, unga
    //    tegmaymiz. Busiz LC direktori jimgina Fond'ga
    //    aylanardi.
    const filter = {
      onboardingCompleted: { $ne: true },
      $or: [
        { institutionType: { $exists: false } },
        { institutionType: null },
        { institutionType: '' },
      ],
    }

    const targets = await Teacher.find(filter).select('email institutionType').lean()

    console.log(`\n  Mos keladigan hisob: ${targets.length}`)
    for (const t of targets.slice(0, 10)) console.log(`     • ${t.email}`)
    if (targets.length > 10) console.log(`     … va yana ${targets.length - 10} ta`)

    if (!APPLY) {
      console.log('\n  Quruq yurish — hech narsa yozilmadi.')
      console.log('  Haqiqatan yozish uchun: --apply\n')
      await mongoose.disconnect()
      process.exit(0)
    }

    const result = await Teacher.updateMany(filter, {
      $set: {
        onboardingCompleted: true,
        institutionType: 'school',   // eski rejim — har doim "school" edi
        studentCountRange: '1-50',   // standart qiymat
      },
      // ⚠️ `institutionName` va `city` BO'SHATILMAYDI. Ilgari
      //    ular `''` bilan yozilardi — to'ldirib qo'ygan odam
      //    ma'lumotini yo'qotardi.
    })

    console.log(`\n✅ ${result.modifiedCount} ta teacher yangilandi (onboarding skip qilindi)`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error('❌ Xato:', e.message)
    process.exit(1)
  }
}

run()