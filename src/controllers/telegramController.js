// src/controllers/telegramController.js
const MonthlyPayment = require('../models/MonthlyPayment')
const Student = require('../models/Student')
const Class = require('../models/Class')
const { getBot } = require('../bot/bot')
const { sendMonthlyReminders } = require('../cron/reminderCron')
const { sendPaymentReminder } = require('../services/telegramService')
// ⚠️ IKKALA manba shu yerdan olinadi — utils/notifyTargets.js.
//    Bu fayl ilgari faqat eski `TelegramParent` ni o'qirdi va
//    natijada Mini App orqali (raqamini tasdiqlab) bog'langan
//    ota-onalar CRM'da UMUMAN ko'rinmasdi. Direktor "80 tadan
//    3 tasi ulangan" degan sonni ko'rib, botni ishlamayapti deb
//    o'ylardi; "tanlanganlarga yuborish" esa o'sha odamlarni
//    jimgina `failed` deb sanardi.
const { collectTargets, groupByStudent, markNotified } = require('../utils/notifyTargets')

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
//
// ⚠️ O'quvchi va sinf nomlari BIR MARTA olinadi — ilgari har bir
//    yozuv uchun ikkita `populate` ishlardi.
exports.getParents = async (req, res) => {
  try {
    const targets = await collectTargets({ directorId: req.user.id })

    const students = await Student.find({
      _id: { $in: [...new Set(targets.map((t) => t.studentId))] },
    })
      .select('name rollNumber parentPhone class')
      .lean()
    const studentById = new Map(students.map((s) => [String(s._id), s]))

    const classes = await Class.find({
      _id: { $in: students.map((s) => s.class).filter(Boolean) },
    })
      .select('name')
      .lean()
    const classById = new Map(classes.map((c) => [String(c._id), c]))

    const parents = targets
      .filter((t) => studentById.has(t.studentId))
      .map((t) => {
        const st = studentById.get(t.studentId)
        const cls = st.class ? classById.get(String(st.class)) : null
        return {
          id: t.linkId,
          telegramUsername: t.username || null,
          student: {
            _id: st._id,
            name: st.name,
            rollNumber: st.rollNumber,
            parentPhone: st.parentPhone,
          },
          class: cls ? { _id: cls._id, name: cls.name } : null,
          registeredAt: t.linkedAt,
          lastNotifiedAt: t.lastNotifiedAt,
          // Direktor "bu kim?" deb so'ramasin: raqamini tasdiqlaganmi,
          // kod bilan kirganmi yoki eski isbotsiz yozuvmi
          verifiedVia: t.verifiedVia,
          kind: t.kind,
        }
      })
      .sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0))

    res.json({ success: true, total: parents.length, parents })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Sinf bo'yicha ota-onalar
exports.getParentsByClass = async (req, res) => {
  try {
    // ⚠️ Sinf bo'yicha filtr O'QUVCHI orqali: `StudentLink` da
    //    sinf yozilmaydi (o'quvchi guruhini almashtirsa yozuv
    //    eskirib qolardi).
    const students = await Student.find({ class: req.params.classId })
      .select('name rollNumber')
      .lean()
    const studentById = new Map(students.map((s) => [String(s._id), s]))

    const targets = await collectTargets({
      directorId: req.user.id,
      studentIds: students.map((s) => String(s._id)),
    })

    const parents = targets.map((t) => ({
      id: t.linkId,
      telegramUsername: t.username || null,
      studentId: studentById.get(t.studentId) || null,
      registeredAt: t.linkedAt,
      lastNotifiedAt: t.lastNotifiedAt,
      verifiedVia: t.verifiedVia,
    }))

    res.json({ success: true, total: parents.length, parents })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Hammaga eslatma yuborish
// Hammaga eslatma — cron bilan BITTA funksiya
//
// ⚠️ `sendMonthlyReminders` ilgari hech narsa qaytarmasdi va
//    bu yerdagi `result?.sent || 0` doim NOL berardi. Xabarlar
//    haqiqatan ketardi, direktor esa "0 ta yuborildi" ni
//    ko'rib, ishlamayapti deb o'ylardi.
exports.sendRemindersNow = async (req, res) => {
  try {
    const result = await sendMonthlyReminders()
    res.json({
      success: true,
      message: 'Eslatmalar yuborildi',
      sent: result?.sent || 0,
      // Qarzi yo'q yoki ulanmagan — "0 yuborildi" ni tushuntiradi
      skipped: result?.skipped || 0,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// Tanlangan o'quvchilar ota-onalariga yuborish
//
// ⚠️ ILGARI HALQA ICHIDA SO'ROV YUBORILARDI: har bir o'quvchi
//    uchun bitta `findOne` + ikkita `populate` + bitta
//    `MonthlyPayment.find`. 50 ta o'quvchida 200 dan ortiq
//    so'rov va bir necha soniya kutish.
//
// ⚠️ VA ENG MUHIMI: ro'yxat faqat eski `TelegramParent` dan
//    olinardi. Mini App orqali bog'langan ota-ona `failed`
//    bo'lib sanalardi — direktor "yuborilmadi" ni ko'rib,
//    sababini hech qachon bilmasdi.
exports.sendToStudents = async (req, res) => {
  try {
    const { studentIds, month, year } = req.body
    const teacherId = req.user.id

    if (!studentIds?.length) {
      return res.status(400).json({ success: false, error: 'studentIds bo\'sh' })
    }

    const ids = studentIds.map(String)

    const targets = await collectTargets({ directorId: teacherId, studentIds: ids })
    const byStudent = groupByStudent(targets)

    const students = await Student.find({ _id: { $in: ids } })
      .select('name class')
      .lean()
    const studentById = new Map(students.map((s) => [String(s._id), s]))

    const classes = await Class.find({
      _id: { $in: students.map((s) => s.class).filter(Boolean) },
    })
      .select('name')
      .lean()
    const classNameById = new Map(classes.map((c) => [String(c._id), c.name]))

    // To'lanmagan oylar ham BITTA so'rovda
    const query = { student: { $in: ids }, teacher: teacherId, status: 'not_paid' }
    if (month) query.month = Number(month)
    if (year) query.year = Number(year)

    const unpaidAll = await MonthlyPayment.find(query)
      .sort({ year: 1, month: 1 })
      .select('student month year amount')
      .lean()

    const unpaidByStudent = new Map()
    for (const p of unpaidAll) {
      const k = String(p.student)
      if (!unpaidByStudent.has(k)) unpaidByStudent.set(k, [])
      unpaidByStudent.get(k).push(p)
    }

    let sentCount = 0
    let failedCount = 0
    // ⚠️ "Nega yuborilmadi" AJRATILADI. "5 ta yuborilmadi" degan
    //    son bilan direktor hech narsa qila olmaydi: ulanmagan
    //    ota-onaga havola yuborish kerak, qarzi yo'q bolaga esa
    //    umuman hech narsa kerak emas.
    let notLinked = 0
    let noDebt = 0

    for (const id of ids) {
      const student = studentById.get(id)
      if (!student) { failedCount++; continue }

      const unpaid = unpaidByStudent.get(id)
      if (!unpaid?.length) { noDebt++; continue }

      const receivers = byStudent.get(id)
      if (!receivers?.length) { notLinked++; continue }

      // ⚠️ HAMMA qabul qiluvchiga — otasi ham, onasi ham ulangan
      //    bo'lsa ikkalasi ham oladi. Eski kod bittasini tanlardi.
      for (const t of receivers) {
        try {
          const sent = await sendPaymentReminder(
            t.chatId,
            student.name,
            classNameById.get(String(student.class)) || '',
            unpaid.map((p) => ({ month: p.month, year: p.year, amount: p.amount })),
          )
          if (sent) {
            await markNotified(t)
            sentCount++
          } else {
            failedCount++
          }
        } catch (e) {
          console.error(`Student ${id} uchun xato:`, e.message)
          failedCount++
        }
      }
    }

    res.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      notLinked,
      noDebt,
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
const billingAlert = require('../services/billingAlert')

// GET /api/teacher/telegram/director — ulanish holati
exports.getDirectorLink = async (req, res) => {
  try {
    const doc = await Teacher.findById(req.user.id)
      .select(
        'telegram.chatId telegram.username telegram.linkedAt cashReport churnDigest billingAlert',
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
      // ⚠️ `|| 'monthly'` SHART: mavjud hisoblarda `billingAlert`
      //    maydoni bazada umuman yo'q (sxemadagi standart qiymat
      //    faqat `save()` da yoziladi), ya'ni bo'shini o'qib
      //    interfeys "o'chiq" deb ko'rsatib qo'yardi.
      billingMode: doc?.billingAlert?.mode || 'monthly',
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

// PUT /api/teacher/telegram/director/billing-mode   { mode }
//
// ⚠️ Uchinchi ALOHIDA sozlama. Uchalasi bitta kalitga yig'ilsa,
//    kunlik shovqindan qochib kassa xabarini o'chirgan direktor
//    oyiga bir marta keladigan "pul so'ralmayapti" xabaridan ham
//    ayrilardi.
exports.setBillingAlertMode = async (req, res) => {
  try {
    const mode = String(req.body.mode || '')
    if (!['off', 'monthly'].includes(mode)) {
      return res.status(400).json({ success: false, error: "Rejim noto'g'ri" })
    }

    await billingAlert.setMode(req.user.id, mode)
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
    if (!['cash', 'churn', 'billing'].includes(type)) {
      return res.status(400).json({ success: false, error: "Xabar turi noto'g'ri" })
    }

    // ⚠️ `institutionType` ham kerak: varaqa xabaridagi havola
    //    rejimga qarab boshqa sahifaga boradi (/lc yoki /teacher).
    const doc = await Teacher.findById(req.user.id)
      .select('name telegram.chatId institutionType')
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
    } else if (type === 'churn') {
      const data = await churnDigest.collect(doc, churnDigest.crmLink())
      text = churnDigest.buildDigest(data).text
    } else {
      const isLC = doc.institutionType === 'learning_center'
      const data = await billingAlert.collect(doc, {
        link: billingAlert.crmLink(isLC),
      })
      text = billingAlert.buildAlert(data).text
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
