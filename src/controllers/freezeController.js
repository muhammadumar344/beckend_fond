// src/controllers/freezeController.js
const FreezeSettings = require('../models/FreezeSettings')
const Teacher        = require('../models/Teacher')
const Class          = require('../models/Class')
const Student        = require('../models/Student')
const MonthlyPayment = require('../models/MonthlyPayment')
const Expense        = require('../models/Expense')
const XLSX           = require('xlsx')
// ⚠️ Xabar matni allaqachon yozilgan edi, lekin hech qayerdan
//    chaqirilmasdi: yozilgan paytda direktorga xabar yuboradigan
//    kanalning o'zi yo'q edi (bot faqat ota-onalar uchun ishlardi).
const freezeNotify   = require('../services/freezeNotify')
const { inBackground } = require('../services/notify')
const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, AlignmentType
} = require('docx')

const MONTHS = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'
]

// ── Freeze holati ────────────────────────────────────────────
exports.getFreezeStatus = async (req, res) => {
  try {
    const freeze = await FreezeSettings.findOne().sort({ createdAt: -1 })
    res.json({ success: true, freeze: freeze || null, isActive: freeze?.isActive || false })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Freeze tarixi ────────────────────────────────────────────
exports.getFreezeHistory = async (req, res) => {
  try {
    const history = await FreezeSettings.find().sort({ createdAt: -1 }).limit(10)
    res.json({ success: true, history })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── FREEZE YOQISH ────────────────────────────────────────────
exports.activateFreeze = async (req, res) => {
  try {
    const { reason } = req.body

    await FreezeSettings.updateMany({ isActive: true }, {
      isActive: false, endedAt: new Date()
    })

    const freeze = await FreezeSettings.create({
      isActive:  true,
      startedAt: new Date(),
      reason:    reason || 'Yozgi tatil',
      createdBy: req.user.id,
    })

    const teachers = await Teacher.find({
      isActive: true,
      plan:     { $ne: 'free' },
      planExpiresAt: { $gt: new Date() },
    })

    let frozenCount = 0
    for (const t of teachers) {
      t.freezeStartedAt   = new Date()
      t.freezeRemainingMs = Math.max(0, new Date(t.planExpiresAt) - new Date())
      await t.save()
      frozenCount++
    }

    // ⚠️ FONDA yuboriladi: 200 ta hisob saqlanib, 200 ta
    //    Telegram xabari ketishi mumkin — admin shuncha
    //    "Yuklanmoqda" ni kutib turmasin. Xato ham yutiladi:
    //    Telegram javob bermagani muzlatishni bekor qilmasin.
    inBackground(freezeNotify.notifyFrozen, {
      teachers,
      reason: freeze.reason,
    })

    res.json({
      success: true,
      message: `Freeze yoqildi. ${frozenCount} ta ustoz muzlatildi.`,
      freeze,
      frozenCount,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── FREEZE O'CHIRISH ─────────────────────────────────────────
exports.deactivateFreeze = async (req, res) => {
  try {
    const freeze = await FreezeSettings.findOne({ isActive: true })
    if (!freeze) {
      return res.status(400).json({ success: false, error: 'Aktiv freeze topilmadi' })
    }

    freeze.isActive = false
    freeze.endedAt  = new Date()
    await freeze.save()

    const teachers = await Teacher.find({
      isActive:        true,
      freezeStartedAt: { $ne: null },
      freezeRemainingMs: { $gt: 0 },
    })

    let restoredCount = 0
    for (const t of teachers) {
      t.planExpiresAt     = new Date(Date.now() + t.freezeRemainingMs)
      t.freezeStartedAt   = null
      t.freezeRemainingMs = 0
      await t.save()
      restoredCount++
    }

    // Qolgan kunlar bilan xabar — direktor uchun eng muhim raqam
    inBackground(freezeNotify.notifyRestored, { teachers })

    res.json({
      success: true,
      message: `Freeze o'chirildi. ${restoredCount} ta ustoz tiklandi.`,
      restoredTeachers: restoredCount,
      freezeId: freeze._id,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── OLDINGI YIL EXPORT ───────────────────────────────────────
exports.exportPreviousYear = async (req, res) => {
  try {
    const teacherId = req.user.id
    const { format = 'excel' } = req.query
    const prevYear  = new Date().getFullYear() - 1

    const classes  = await Class.find({ teacher: teacherId })
    const classIds = classes.map(c => c._id)
    const teacher  = await Teacher.findById(teacherId).select('name')

    if (!classes.length) {
      return res.status(404).json({ success: false, error: 'Sinflar topilmadi' })
    }

    // Oyma-oy ma'lumot
    const monthlyData = []
    let grandTotalPaid = 0
    let grandTotalExp  = 0

    for (let m = 1; m <= 12; m++) {
      const payments = await MonthlyPayment.find({
        class: { $in: classIds }, teacher: teacherId, year: prevYear, month: m
      }).populate('student', 'name rollNumber').populate('class', 'name')

      const expenses = await Expense.find({
        teacher: teacherId, year: prevYear, month: m
      }).populate('class', 'name')

      const paidAmt    = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
      const expAmt     = expenses.reduce((s, e) => s + e.amount, 0)
      const paidCnt    = payments.filter(p => p.status === 'paid').length
      const unpaidCnt  = payments.filter(p => p.status === 'not_paid').length

      grandTotalPaid += paidAmt
      grandTotalExp  += expAmt

      monthlyData.push({
        month: m, monthName: MONTHS[m - 1],
        payments, expenses,
        paidAmt, expAmt, paidCnt, unpaidCnt,
        balance: paidAmt - expAmt,
      })
    }

    if (format === 'word') {
      return await exportWord(res, teacher, prevYear, monthlyData, classes, grandTotalPaid, grandTotalExp)
    }
    return exportExcel(res, teacher, prevYear, monthlyData, classes, grandTotalPaid, grandTotalExp)

  } catch (e) {
    console.error('exportPreviousYear error:', e)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message })
    }
  }
}

// ── Excel ────────────────────────────────────────────────────
const exportExcel = (res, teacher, year, monthlyData, classes, grandPaid, grandExp) => {
  const wb = XLSX.utils.book_new()
  const fmt = n => n.toLocaleString('uz-UZ') + " so'm"

  // 1. Yillik xulosa
  const summaryRows = [
    [`${teacher.name} — ${year} yil Yillik Hisobot`],
    [`Chiqarilgan sana: ${new Date().toLocaleDateString('uz-UZ')}`],
    [],
    ['Oy', "To'lagan (ta)", "To'lamagan (ta)", "Yig'ilgan", "Xarajat", "Balans"],
  ]

  for (const m of monthlyData) {
    summaryRows.push([
      m.monthName, m.paidCnt, m.unpaidCnt,
      m.paidAmt, m.expAmt, m.balance
    ])
  }

  summaryRows.push(
    [],
    ['JAMI', '', '',
      grandPaid, grandExp, grandPaid - grandExp
    ]
  )

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }
  ]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Yillik xulosa')

  // 2. Har oy uchun varaq
  for (const m of monthlyData) {
    if (!m.payments.length && !m.expenses.length) continue

    const rows = [
      [`${m.monthName} ${year}`],
      [`To'lagan: ${m.paidCnt} ta | To'lamagan: ${m.unpaidCnt} ta`],
      [`Yig'ilgan: ${fmt(m.paidAmt)} | Xarajat: ${fmt(m.expAmt)} | Balans: ${fmt(m.balance)}`],
      [],
    ]

    if (m.payments.length) {
      rows.push(["TO'LOVLAR:"])
      rows.push(['№', "O'quvchi", 'Sinf', "Summa", 'Holati', "To'lagan sana"])
      m.payments.forEach((p, i) => {
        rows.push([
          i + 1,
          p.student?.name || '—',
          p.class?.name || '—',
          p.amount,
          p.status === 'paid' ? "To'lagan ✓" : "To'lamagan ✗",
          p.paidDate ? new Date(p.paidDate).toLocaleDateString('uz-UZ') : '—'
        ])
      })
      rows.push([])
    }

    if (m.expenses.length) {
      rows.push(['XARAJATLAR:'])
      rows.push(['№', 'Sabab', 'Sinf', "Summa", 'Izoh'])
      m.expenses.forEach((e, i) => {
        rows.push([i + 1, e.reason, e.class?.name || '—', e.amount, e.description || ''])
      })
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 24 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 16 }
    ]
    // Varaq nomi max 31 belgi bo'lishi kerak
    const sheetName = `${m.monthName} ${year}`.substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const buf      = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', compression: true })
  const fileName = encodeURIComponent(`${teacher.name}_${year}_hisobot.xlsx`)

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Length', buf.length)
  res.setHeader('Cache-Control', 'no-cache')
  return res.end(buf)
}

// ── Word ─────────────────────────────────────────────────────
const exportWord = async (res, teacher, year, monthlyData, classes, grandPaid, grandExp) => {
  const fmt = n => n.toLocaleString('uz-UZ') + " so'm"

  const children = []

  // Sarlavha
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `${teacher.name} — ${year} yil Yillik Hisobot`,
        bold: true, size: 32, color: '1A365D'
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Chiqarilgan: ${new Date().toLocaleDateString('uz-UZ')}`,
        size: 18, color: '718096', italics: true
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }),
    // Umumiy xulosa
    new Paragraph({
      children: [new TextRun({ text: 'YILLIK XULOSA', bold: true, size: 24, color: '2B6CB0' })],
      spacing: { after: 150 }
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Jami yig'ilgan: ${fmt(grandPaid)}   |   Jami xarajat: ${fmt(grandExp)}   |   Balans: ${fmt(grandPaid - grandExp)}`,
        size: 20
      })],
      spacing: { after: 400 }
    })
  )

  // Har oy
  for (const m of monthlyData) {
    if (!m.payments.length && !m.expenses.length) continue

    children.push(
      new Paragraph({
        children: [new TextRun({
          text: `${m.monthName} ${year}`,
          bold: true, size: 26, color: '2B6CB0'
        })],
        spacing: { before: 300, after: 100 },
        border: { bottom: { color: 'E2E8F0', size: 6, space: 1, value: 'single' } }
      }),
      new Paragraph({
        children: [new TextRun({
          text: `To'lagan: ${m.paidCnt} ta | To'lamagan: ${m.unpaidCnt} ta | Yig'ilgan: ${fmt(m.paidAmt)} | Xarajat: ${fmt(m.expAmt)} | Balans: ${fmt(m.balance)}`,
          size: 18
        })],
        spacing: { after: 150 }
      })
    )

    if (m.payments.length) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "To'lovlar:", bold: true, size: 20 })],
          spacing: { after: 100 }
        })
      )

      // To'lovlar jadvali
      const headerCells = ['№', "O'quvchi", 'Sinf', "Summa", 'Holati'].map(text =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 18, color: 'FFFFFF' })],
            alignment: AlignmentType.CENTER
          })],
          shading: { fill: '2B6CB0' },
        })
      )

      const dataRows = m.payments.map((p, i) => {
        const isPaid = p.status === 'paid'
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.student?.name || '—', size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.class?.name || '—', size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmt(p.amount), size: 16 })] })] }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({
                  text: isPaid ? "To'lagan ✓" : "To'lamagan ✗",
                  size: 16,
                  color: isPaid ? '276749' : 'C05621',
                  bold: true
                })],
                alignment: AlignmentType.CENTER
              })],
              shading: { fill: isPaid ? 'F0FFF4' : 'FFFAF0' }
            }),
          ]
        })
      })

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows]
        })
      )
      children.push(new Paragraph({ spacing: { after: 150 } }))
    }

    if (m.expenses.length) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Xarajatlar:', bold: true, size: 20 })],
          spacing: { before: 100, after: 100 }
        })
      )
      for (const e of m.expenses) {
        children.push(new Paragraph({
          children: [new TextRun({
            text: `• ${e.reason} (${e.class?.name || '—'}): ${fmt(e.amount)}`,
            size: 18, color: 'C05621'
          })],
          spacing: { after: 50 }
        }))
      }
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `Lumo | schoolfonds.uz`,
        size: 16, color: '718096', italics: true
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 500 }
    })
  )

  const doc = new Document({ sections: [{ children }] })
  const buf = await Packer.toBuffer(doc)
  const fileName = encodeURIComponent(`${teacher.name}_${year}_hisobot.docx`)

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Length', buf.length)
  res.setHeader('Cache-Control', 'no-cache')
  return res.end(buf)
}

// ── ESKI MA'LUMOTLARNI TOZALASH ──────────────────────────────
// O'quvchilar SAQLANADI, faqat to'lovlar va xarajatlar o'chiriladi
// Sinflar raqami +1 bo'ladi (8→9, 9→10 va h.k.)
exports.cleanupPreviousYear = async (req, res) => {
  try {
    const teacherId = req.user.id
    const prevYear  = new Date().getFullYear() - 1

    const classes  = await Class.find({ teacher: teacherId })
    const classIds = classes.map(c => c._id)

    if (!classIds.length) {
      return res.status(404).json({ success: false, error: 'Sinflar topilmadi' })
    }

    // 1. Oldingi yil to'lovlarini o'chirish
    const deletedPayments = await MonthlyPayment.deleteMany({
      class: { $in: classIds },
      teacher: teacherId,
      year: prevYear,
    })

    // 2. Oldingi yil xarajatlarini o'chirish
    const deletedExpenses = await Expense.deleteMany({
      teacher: teacherId,
      year: prevYear,
    })

    // 3. Sinf nomlarini avtomatik ko'tarish
    // Masalan: "8-D" → "9-D", "9-A" → "10-A", "10-B" → "11-B"
    const updatedClasses = []
    for (const cls of classes) {
      const newName = autoIncrementClassName(cls.name)
      if (newName && newName !== cls.name) {
        cls.name = newName
        await cls.save()
        updatedClasses.push({ old: cls.name, new: newName })
      }
    }

    // 4. initialBalance ni 0 ga qaytarish (yangi yil uchun)
    await Class.updateMany(
      { teacher: teacherId },
      { initialBalance: 0, initialBalanceNote: '' }
    )

    res.json({
      success: true,
      message: `Eski ma'lumotlar tozalandi`,
      stats: {
        deletedPayments: deletedPayments.deletedCount,
        deletedExpenses: deletedExpenses.deletedCount,
        updatedClasses:  updatedClasses.length,
        classes:         updatedClasses,
      }
    })
  } catch (e) {
    console.error('cleanupPreviousYear error:', e)
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Sinf nomini avtomatik ko'tarish ─────────────────────────
// "8-D" → "9-D", "9-A sinfi" → "10-A sinfi"
// "8D" → "9D", "8" → "9"
const autoIncrementClassName = (name) => {
  if (!name) return name

  // Pattern: raqam-harf ("8-D", "9-A", "11-B")
  const dashPattern = name.match(/^(\d+)(-[A-Za-z].*)$/)
  if (dashPattern) {
    const num = parseInt(dashPattern[1])
    if (num >= 1 && num <= 11) {
      return `${num + 1}${dashPattern[2]}`
    }
    return name
  }

  // Pattern: raqam harf ("8D", "9A")
  const noGapPattern = name.match(/^(\d+)([A-Za-z].*)$/)
  if (noGapPattern) {
    const num = parseInt(noGapPattern[1])
    if (num >= 1 && num <= 11) {
      return `${num + 1}${noGapPattern[2]}`
    }
    return name
  }

  // Pattern: faqat raqam ("8", "9")
  const numOnly = name.match(/^(\d+)$/)
  if (numOnly) {
    const num = parseInt(numOnly[1])
    if (num >= 1 && num <= 11) {
      return `${num + 1}`
    }
    return name
  }

  // Pattern: "8-sinf", "9-sinfi" kabi
  const sinfPattern = name.match(/^(\d+)(\s*[-]?\s*sinf.*)$/i)
  if (sinfPattern) {
    const num = parseInt(sinfPattern[1])
    if (num >= 1 && num <= 11) {
      return `${num + 1}${sinfPattern[2]}`
    }
    return name
  }

  return name
}