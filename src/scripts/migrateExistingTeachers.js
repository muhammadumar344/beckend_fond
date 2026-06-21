// src/scripts/migrateExistingTeachers.js
// ════════════════════════════════════════════════════════════
// BIR MARTALIK SCRIPT — onboarding qo'shilishidan oldin
// ro'yxatdan o'tgan teacher larni "tugallangan" deb belgilaydi
// ════════════════════════════════════════════════════════════
//
// ISHLATISH:
//   1. Bu faylni backend/src/scripts/ papkasiga joylashtiring
//   2. Terminal orqali (Render Shell yoki local):
//      node src/scripts/migrateExistingTeachers.js
//   3. Natijani konsolda ko'rasiz
//   4. Ishlatib bo'lgach, bu faylni o'chirib tashlash mumkin
//
require('dotenv').config()
const mongoose = require('mongoose')
const Teacher = require('../models/Teacher')

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fond-school')
    console.log('✅ MongoDB ulandi')

    // onboardingCompleted hali false bo'lgan BARCHA mavjud teacher larni
    // "school" rejimida avtomatik tugallangan deb belgilaymiz
    const result = await Teacher.updateMany(
      {
        onboardingCompleted: { $ne: true },   // hali tugallanmagan
      },
      {
        $set: {
          onboardingCompleted: true,
          institutionType: 'school',           // eski rejim — har doim "school" edi
          institutionName: '',                  // bo'sh qoladi, kerak bo'lsa keyin to'ldiradi
          city: '',
          studentCountRange: '1-50',            // default qiymat
        },
      }
    )

    console.log(`✅ ${result.modifiedCount} ta teacher yangilandi (onboarding skip qilindi)`)
    console.log('ℹ️  Bulardan keyin ro\'yxatdan o\'tgan YANGI teacher lar oddiy onboarding ko\'radi.')

    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error('❌ Xato:', e.message)
    process.exit(1)
  }
}

run()