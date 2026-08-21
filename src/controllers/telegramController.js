// src/controllers/telegramController.js
const TelegramParent = require('../models/TelegramParent')
const MonthlyPayment = require('../models/MonthlyPayment')
const Student = require('../models/Student')
const { getBot } = require('../bot/bot')
const { sendMonthlyReminders } = require('../cron/reminderCron')
const { sendPaymentReminder } = require('../services/telegramService')

// Bot havolasi
exports.getBotLink = async (req, res) => {
  try {
    const bot = getBot()
    if (!bot) return res.status(503).json({ success: false, error: 'Bot ishlamayapti' })
    const info = await bot.getMe()
    res.json({ success: true, botUsername: info.username, botLink: `https://t.me/${info.username}` })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Barcha ulangan ota-onalar
exports.getParents = async (req, res) => {
  try {
    const parents = await TelegramParent.find({ teacherId: req.user.id, isActive: true })
      .populate('studentId', 'name rollNumber parentPhone')
      .populate('classId', 'name')
      .sort({ registeredAt: -1 })

    res.json({
      success: true,
      total: parents.length,
      parents: parents.map(p => ({
        id: p._id,
        telegramUsername: p.telegramUsername || null,
        student: p.studentId,
        class: p.classId,
        registeredAt: p.registeredAt,
        lastNotifiedAt: p.lastNotifiedAt,
      })),
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Sinf bo'yicha ota-onalar
exports.getParentsByClass = async (req, res) => {
  try {
    const parents = await TelegramParent.find({
      teacherId: req.user.id,
      classId: req.params.classId,
      isActive: true,
    }).populate('studentId', 'name rollNumber')
    res.json({ success: true, total: parents.length, parents })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Hammaga eslatma yuborish
exports.sendRemindersNow = async (req, res) => {
  try {
    const result = await sendMonthlyReminders()
    res.json({ success: true, message: 'Eslatmalar yuborildi', sent: result?.sent || 0 })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ✅ YANGI: Tanlangan o'quvchilar ota-onalariga yuborish
exports.sendToStudents = async (req, res) => {
  try {
    const { studentIds, month, year } = req.body
    const teacherId = req.user.id

    if (!studentIds?.length) {
      return res.status(400).json({ success: false, error: 'studentIds bo\'sh' })
    }

    let sentCount = 0
    let failedCount = 0

    for (const studentId of studentIds) {
      try {
        // Bu student uchun Telegram parent topish
        const parent = await TelegramParent.findOne({
          studentId,
          teacherId,
          isActive: true,
        }).populate('studentId', 'name').populate('classId', 'name')

        if (!parent) { failedCount++; continue }

        // To'lanmagan oylarni topish
        const query = {
          student: studentId,
          teacher: teacherId,
          status: 'not_paid',
        }
        if (month) query.month = Number(month)
        if (year)  query.year  = Number(year)

        const unpaidPayments = await MonthlyPayment.find(query).sort({ year: 1, month: 1 })

        if (!unpaidPayments.length) { failedCount++; continue }

        const sent = await sendPaymentReminder(
          parent.telegramChatId,
          parent.studentId.name,
          parent.classId.name,
          unpaidPayments.map(p => ({ month: p.month, year: p.year, amount: p.amount }))
        )

        if (sent) {
          parent.lastNotifiedAt = new Date()
          await parent.save()
          sentCount++
        } else {
          failedCount++
        }
      } catch (e) {
        console.error(`Student ${studentId} uchun xato:`, e.message)
        failedCount++
      }
    }

    res.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      message: `${sentCount} ta ota-onaga yuborildi`,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}
// ════════════════════════════════════════════════════════════
// DIREKTORNI TELEGRAM'GA ULASH
//
// ⚠️ Bot ilgari faqat ota-ona uchun edi — direktorga tizimdan
//    xabar yuborishning umuman yo'li yo'q edi. Bu ulanish
//    bitta funksiya uchun emas: kunlik kassa xabari
//    birinchisi, xolos.
//
// ⚠️ FAQAT DIREKTOR (`onlyTeacher`). Xodim markaz nomidan
//    ulanish tokeni ola olmasligi kerak.
// ════════════════════════════════════════════════════════════
const Teacher = require('../models/Teacher')
const dirTg = require('../services/directorTelegram')
const cashReport = require('../services/cashReport')
const churnDigest = require('../services/churnDigest')

// GET /api/teacher/telegram/director — ulanish holati
exports.getDirectorLink = async (req, res) => {
  try {
    const doc = await Teacher.findById(req.user.id)
      .select(
        'telegram.chatId telegram.username telegram.linkedAt cashReport churnDigest',
      )
      .lean()

    res.json({
      success: true,
      linked: Boolean(doc?.telegram?.chatId),
      username: doc?.telegram?.username || '',
      linkedAt: doc?.telegram?.linkedAt || null,
      mode: doc?.cashReport?.mode || 'problems',
      // Haftalik "ketish arafasida" xabari — ayni shu kanal
      churnMode: doc?.churnDigest?.mode || 'weekly',
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// POST /api/teacher/telegram/director — bir martalik havola
exports.createDirectorLink = async (req, res) => {
  try {
    const bot = getBot()
    if (!bot)
      return res.status(503).json({ success: false, error: 'Bot ishlamayapti' })

    const info = await bot.getMe()
    const { token, expiresAt } = await dirTg.createLinkToken(req.user.id)

    // ⚠️ Ochiq token FAQAT shu javobda ketadi va bazada
    //    qaytmaydi (hash bo'lib yotadi).
    res.json({
      success: true,
      link: `https://t.me/${info.username}?start=dir_${token}`,
      expiresAt,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// DELETE /api/teacher/telegram/director — ulanishni uzish
exports.unlinkDirector = async (req, res) => {
  try {
    await dirTg.unlink(req.user.id)
    res.json({ success: true, message: 'Ulanish uzildi' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// PUT /api/teacher/telegram/director/mode   { mode }
//
// ⚠️ `problems` standart va shunday qolishi kerak. Har kuni
//    "hammasi joyida" yozsak, direktor bir haftada xabarni
//    o'qimay qo'yadi va rostdan muhim kunini ham ko'rmaydi.
exports.setCashReportMode = async (req, res) => {
  try {
    const mode = String(req.body.mode || '')
    if (!['off', 'problems', 'daily'].includes(mode)) {
      return res
        .status(400)
        .json({ success: false, error: "Rejim noto'g'ri" })
    }

    await Teacher.updateOne(
      { _id: req.user.id },
      { $set: { 'cashReport.mode': mode } },
    )
    res.json({ success: true, mode })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// PUT /api/teacher/telegram/director/churn-mode   { mode }
//
// ⚠️ Kassa rejimidan ALOHIDA saqlanadi. Ikkalasini bitta
//    sozlamaga yig'sak, kunlik kassa xabarini o'chirgan direktor
//    ketayotgan o'quvchilar haqidagi xabardan ham ayrilardi —
//    va buni bilmasdi ham.
exports.setChurnDigestMode = async (req, res) => {
  try {
    const mode = String(req.body.mode || '')
    if (!['off', 'weekly'].includes(mode)) {
      return res.status(400).json({ success: false, error: "Rejim noto'g'ri" })
    }

    await churnDigest.setMode(req.user.id, mode)
    res.json({ success: true, mode })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// POST /api/teacher/telegram/director/preview   { type }
//
// "Xabar qanday keladi?" — ulanishni tekshirishning yagona
// halol yo'li. Busiz direktor tugmani bosib, ertaga soat 21:00
// gacha kutishi va xabar kelmasa nima buzilganini bilmasligi
// kerak edi: bot bloklanganmi, rejim o'chiqmi, ulanish
// uzilganmi — uchalasi ham JIM.
//
// ⚠️ Bu yerda BUGUNGI HAQIQIY ma'lumot yuboriladi, soxta namuna
//    emas. Namuna xabar ulanishni tekshiradi, lekin "menga bu
//    kerakmi?" degan savolga javob bermaydi.
exports.sendDirectorPreview = async (req, res) => {
  try {
    const type = String(req.body.type || 'cash')
    if (!['cash', 'churn'].includes(type)) {
      return res.status(400).json({ success: false, error: "Xabar turi noto'g'ri" })
    }

    const doc = await Teacher.findById(req.user.id)
      .select('name telegram.chatId')
      .lean()
    if (!doc?.telegram?.chatId) {
      return res
        .status(400)
        .json({ success: false, error: 'Telegram ulanmagan' })
    }

    const bot = getBot()
    if (!bot)
      return res.status(503).json({ success: false, error: 'Bot ishlamayapti' })

    let text
    if (type === 'cash') {
      const data = await cashReport.collect(doc)
      text = cashReport.buildReport(data).text
    } else {
      const data = await churnDigest.collect(doc, churnDigest.crmLink())
      text = churnDigest.buildDigest(data).text
    }

    try {
      await bot.sendMessage(doc.telegram.chatId, text, { parse_mode: 'Markdown' })
    } catch (e) {
      // ⚠️ 403 = botni bloklagan. Ulanishni tozalaymiz —
      //    aks holda interfeys "ulangan" deb turaveradi va
      //    direktor nega xabar kelmayotganini tushunmasdi.
      if (e.response?.body?.error_code === 403) {
        await Teacher.updateOne(
          { _id: req.user.id },
          { $set: { 'telegram.chatId': null, 'telegram.linkedAt': null } },
        )
        return res.status(400).json({
          success: false,
          error: 'Bot bloklangan — Telegram\'da botni oching va qayta ulaning',
        })
      }
      throw e
    }

    res.json({ success: true, message: 'Yuborildi' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}
