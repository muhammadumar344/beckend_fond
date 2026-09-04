// src/cron/reminderCron.js
const cron = require('node-cron')
const TelegramParent = require('../models/TelegramParent')
const StudentLink = require('../models/StudentLink')
const Student = require('../models/Student')
const Class = require('../models/Class')
const MonthlyPayment = require('../models/MonthlyPayment')
const { collectTargets } = require('../utils/notifyTargets')
const { sendPaymentReminder } = require('../services/telegramService')

const MONTH_NAMES = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr',
]

const getPreviousMonth = () => {
  const now = new Date()
  let month = now.getMonth() // 0-indexed = oldingi oy
  let year = now.getFullYear()
  if (month === 0) { month = 12; year -= 1 }
  return { month, year }
}

const sendMonthlyReminders = async () => {
  console.log('📬 Oylik Telegram eslatma boshlandi...')
  try {
    // ⚠️ Ro'yxat IKKALA manbadan olinadi — utils/notifyTargets.js
    //    izohiga qarang. Ilgari bu yer faqat `TelegramParent` ni
    //    o'qirdi, ya'ni yangi bog'langan ota-onalar eslatmani
    //    jimgina olmay qolardi.
    const targets = await collectTargets()

    if (!targets.length) {
      console.log('📭 Ulangan ota-ona yo\'q')
      return { sent: 0, skipped: 0, notLinked: 0 }
    }

    // ⚠️ O'quvchi va sinf nomlari BIR MARTA olinadi. Ilgari har bir
    //    ota-ona uchun `populate` ishlagan — 500 ta ota-onada 1000 ta
    //    ortiqcha so'rov.
    const studentIds = [...new Set(targets.map((t) => t.studentId))]
    const students = await Student.find({ _id: { $in: studentIds } })
      .select('name class')
      .lean()
    const classes = await Class.find({
      _id: { $in: students.map((s) => s.class).filter(Boolean) },
    })
      .select('name')
      .lean()

    const studentById = new Map(students.map((s) => [String(s._id), s]))
    const classById = new Map(classes.map((c) => [String(c._id), c.name]))

    // To'lanmagan to'lovlar ham bir so'rovda
    const unpaidAll = await MonthlyPayment.find({
      student: { $in: studentIds },
      status: 'not_paid',
    })
      .sort({ year: 1, month: 1 })
      .select('student month year amount')
      .lean()

    const unpaidByStudent = new Map()
    for (const p of unpaidAll) {
      const k = String(p.student)
      if (!unpaidByStudent.has(k)) unpaidByStudent.set(k, [])
      const list = unpaidByStudent.get(k)
      if (list.length < 3) list.push(p) // eng eski 3 tasi
    }

    let sentCount = 0
    let skippedCount = 0

    for (const t of targets) {
      try {
        const student = studentById.get(t.studentId)
        if (!student) continue

        const unpaid = unpaidByStudent.get(t.studentId)
        if (!unpaid?.length) { skippedCount++; continue }

        const sent = await sendPaymentReminder(
          t.chatId,
          student.name,
          classById.get(String(student.class)) || '',
          unpaid.map((p) => ({ month: p.month, year: p.year, amount: p.amount }))
        )

        if (sent) {
          const Model = t.source === 'link' ? StudentLink : TelegramParent
          await Model.updateOne(
            { _id: t.linkId },
            { $set: { lastNotifiedAt: new Date() } },
          )
          sentCount++
        }
      } catch (err) {
        console.error(`${t.chatId} uchun xato:`, err.message)
      }
    }

    console.log(`✅ Telegram: ${sentCount} yuborildi, ${skippedCount} o'tkazildi`)

    // ⚠️ NATIJA QAYTARILISHI SHART. Bu funksiya cron'dan ham,
    //    CRM'dagi "Hammaga yuborish" tugmasidan ham chaqiriladi
    //    (`telegramController.sendRemindersNow`). U yerda
    //    `result?.sent || 0` yozilgan — funksiya hech narsa
    //    qaytarmagani uchun direktor xabarlar HAQIQATAN ketgan
    //    holda ham "0 ta yuborildi" ni ko'rardi.
    return { sent: sentCount, skipped: skippedCount }
  } catch (err) {
    console.error('sendMonthlyReminders xatosi:', err)
    return { sent: 0, skipped: 0, error: err.message }
  }
}

const startReminderCron = () => {
  // Har oy 1-sana soat 09:00 (Toshkent vaqti)
  cron.schedule('0 9 1 * *', sendMonthlyReminders, { timezone: 'Asia/Tashkent' })
  console.log('⏰ Oylik eslatma cron ishga tushdi (1-sana, 09:00 Toshkent)')
}

module.exports = { startReminderCron, sendMonthlyReminders }