// backend/src/controllers/teacherController.js
const Class = require('../models/Class')
const Student = require('../models/Student')
const MonthlyPayment = require('../models/MonthlyPayment')
const Expense = require('../models/Expense')
const Teacher = require('../models/Teacher')
const XLSX = require('xlsx')
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = require('docx')
const { PLAN_LIMITS, hasFeature, canOpenNewClass, canAddStudent } = require('../utils/planHelper')
const smsService = require('../services/smsService')

// ============================================================
//  CLASSES
// ============================================================

exports.createClass = async (req, res) => {
  try {
    const { name, defaultAmount } = req.body
    const teacherId = req.user.id

    if (!name || !defaultAmount) {
      return res.status(400).json({ success: false, error: 'Sinf nomi va default summa majburiy' })
    }
    if (defaultAmount <= 0) {
      return res.status(400).json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" })
    }

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }

    const currentClassCount = await Class.countDocuments({ teacher: teacherId })
    if (!canOpenNewClass(teacher, currentClassCount)) {
      const activePlan = teacher.isPlanActive() ? teacher.plan : 'free'
      const limit = PLAN_LIMITS[activePlan]
      return res.status(403).json({
        success: false,
        error: teacher.isPlanActive()
          ? `${activePlan.toUpperCase()} rejimda maksimal ${limit.classes} ta sinf ochishingiz mumkin`
          : 'Obunangiz tugagan. Yangi sinf ochish uchun Pro yoki Premium sotib oling',
        requiresUpgrade: !teacher.isPlanActive(),
      })
    }

    const activePlan = teacher.isPlanActive() ? teacher.plan : 'free'
    const newClass = new Class({
      name: name.trim(),
      teacher: teacherId,
      defaultAmount: Number(defaultAmount),
      plan: activePlan,
    })
    await newClass.save()

    res.status(201).json({ success: true, message: 'Sinf muvaffaqiyatli yaratildi', class: newClass })
  } catch (err) {
    console.error('createClass error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getMyClasses = async (req, res) => {
  try {
    const teacherId = req.user.id
    const classes = await Class.find({ teacher: teacherId }).sort({ createdAt: -1 })

    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments({ class: cls._id })
        const payments = await MonthlyPayment.find({ class: cls._id })
        const paidCount = payments.filter((p) => p.status === 'paid').length
        return { ...cls.toObject(), studentCount, paidCount, unpaidCount: payments.length - paidCount }
      })
    )

    res.json({ success: true, classes: classesWithStats })
  } catch (err) {
    console.error('getMyClasses error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.updateClassDefaultAmount = async (req, res) => {
  try {
    const { classId } = req.params
    const { defaultAmount } = req.body
    const teacherId = req.user.id

    if (!defaultAmount || defaultAmount <= 0) {
      return res.status(400).json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" })
    }

    cls.defaultAmount = Number(defaultAmount)
    await cls.save()

    res.json({ success: true, message: 'Default summa yangilandi', class: cls })
  } catch (err) {
    console.error('updateClassDefaultAmount error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params
    const teacherId = req.user.id

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" })
    }

    await Student.deleteMany({ class: classId })
    await MonthlyPayment.deleteMany({ class: classId })
    await Expense.deleteMany({ class: classId })
    await Class.findByIdAndDelete(classId)

    res.json({ success: true, message: "Sinf va barcha bog'liq ma'lumotlar o'chirildi" })
  } catch (err) {
    console.error('deleteClass error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  STUDENTS
// ============================================================

exports.addStudent = async (req, res) => {
  try {
    const { classId } = req.params
    const { name, parentPhone } = req.body
    const teacherId = req.user.id

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "O'quvchi ismi majburiy" })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" })
    }

    const studentCount = await Student.countDocuments({ class: classId })
    if (!canAddStudent(cls.plan, studentCount)) {
      const limit = PLAN_LIMITS[cls.plan] || PLAN_LIMITS.free
      return res.status(403).json({
        success: false,
        error: `Bu sinfga maksimal ${limit.students} ta o'quvchi qo'shish mumkin`,
        requiresUpgrade: true,
      })
    }

    const student = new Student({
      name: name.trim(),
      class: classId,
      parentPhone: (parentPhone || '').trim(),
      rollNumber: studentCount + 1,
    })
    await student.save()

    res.status(201).json({ success: true, message: "O'quvchi qo'shildi", student })
  } catch (err) {
    console.error('addStudent error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params
    const teacherId = req.user.id

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" })
    }

    const students = await Student.find({ class: classId }).sort({ rollNumber: 1 })
    res.json({ success: true, students })
  } catch (err) {
    console.error('getClassStudents error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params
    const teacherId = req.user.id

    const student = await Student.findById(studentId)
    if (!student) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi" })
    }

    const cls = await Class.findOne({ _id: student.class, teacher: teacherId })
    if (!cls) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" })
    }

    await MonthlyPayment.deleteMany({ student: studentId })
    await Student.findByIdAndDelete(studentId)

    res.json({ success: true, message: "O'quvchi o'chirildi" })
  } catch (err) {
    console.error('deleteStudent error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  PAYMENTS
// ============================================================

exports.createMonthlyPayments = async (req, res) => {
  try {
    const { classId, month, year } = req.body
    const teacherId = req.user.id

    if (!classId || !month || !year) {
      return res.status(400).json({ success: false, error: 'classId, month, year majburiy' })
    }
    if (month < 1 || month > 12 || year < 2020) {
      return res.status(400).json({ success: false, error: "Oy va yil noto'g'ri" })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: "Sinf topilmadi yoki ruxsat yo'q" })
    }

    const students = await Student.find({ class: classId })
    if (students.length === 0) {
      return res.status(400).json({ success: false, error: "Bu sinfda o'quvchi yo'q" })
    }

    let createdCount = 0
    let alreadyExisted = 0

    for (const student of students) {
      try {
        const existing = await MonthlyPayment.findOne({
          student: student._id,
          class: classId,
          month: Number(month),
          year: Number(year),
        })
        if (!existing) {
          await MonthlyPayment.create({
            student: student._id,
            class: classId,
            teacher: teacherId,
            amount: cls.defaultAmount,
            month: Number(month),
            year: Number(year),
            status: 'not_paid',
          })
          createdCount++
        } else {
          alreadyExisted++
        }
      } catch (e) {
        console.error(`Error creating payment for student ${student._id}:`, e)
      }
    }

    res.json({
      success: true,
      message: `${createdCount} ta to'lov yaratildi`,
      summary: { created: createdCount, alreadyExisted, total: students.length, expectedTotal: students.length * cls.defaultAmount },
    })
  } catch (err) {
    console.error('createMonthlyPayments error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getMonthlyPayments = async (req, res) => {
  try {
    const teacherId = req.user.id
    const { month, year } = req.query

    const classes = await Class.find({ teacher: teacherId })
    const classIds = classes.map((c) => c._id)

    const query = { class: { $in: classIds } }
    if (month) query.month = Number(month)
    if (year) query.year = Number(year)

    const payments = await MonthlyPayment.find(query)
      .populate('student', 'name parentPhone rollNumber')
      .populate('class', 'name defaultAmount')
      .sort({ class: 1, createdAt: -1 })

    const classStats = {}
    for (const cls of classes) {
      const studentCount = await Student.countDocuments({ class: cls._id })
      classStats[cls._id.toString()] = {
        className: cls.name,
        defaultAmount: cls.defaultAmount,
        studentCount,
        expectedTotal: studentCount * cls.defaultAmount,
      }
    }

    const paidPayments = payments.filter((p) => p.status === 'paid')
    const collectedTotal = paidPayments.reduce((sum, p) => sum + p.amount, 0)
    const expectedTotal = Object.values(classStats).reduce((sum, c) => sum + c.expectedTotal, 0)

    res.json({
      success: true,
      payments,
      classStats,
      summary: {
        paidCount: paidPayments.length,
        unpaidCount: payments.length - paidPayments.length,
        collectedTotal,
        expectedTotal,
        remaining: expectedTotal - collectedTotal,
      },
    })
  } catch (err) {
    console.error('getMonthlyPayments error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getClassPayments = async (req, res) => {
  try {
    const { classId } = req.params
    const { month, year } = req.query
    const teacherId = req.user.id

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Sinf topilmadi' })
    }

    const students = await Student.find({ class: classId })
    const query = { class: classId }
    if (month) query.month = Number(month)
    if (year) query.year = Number(year)

    const payments = await MonthlyPayment.find(query)
      .populate('student', 'name parentPhone rollNumber')
      .sort({ 'student.rollNumber': 1 })

    const paidPayments = payments.filter((p) => p.status === 'paid')
    const collectedTotal = paidPayments.reduce((sum, p) => sum + p.amount, 0)
    const expectedTotal = students.length * cls.defaultAmount

    res.json({
      success: true,
      class: { id: cls._id, name: cls.name, defaultAmount: cls.defaultAmount, studentCount: students.length },
      payments,
      summary: {
        studentCount: students.length,
        paidCount: paidPayments.length,
        unpaidCount: students.length - paidPayments.length,
        expectedTotal,
        collectedTotal,
        remaining: expectedTotal - collectedTotal,
      },
    })
  } catch (err) {
    console.error('getClassPayments error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params
    const { status } = req.body
    const teacherId = req.user.id

    if (!['paid', 'not_paid'].includes(status)) {
      return res.status(400).json({ success: false, error: "Status 'paid' yoki 'not_paid' bo'lishi kerak" })
    }

    const payment = await MonthlyPayment.findById(paymentId).populate('class')
    if (!payment) {
      return res.status(404).json({ success: false, error: "To'lov topilmadi" })
    }

    if (payment.class.teacher.toString() !== teacherId) {
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" })
    }

    payment.status = status
    payment.paidDate = status === 'paid' ? new Date() : null
    await payment.save()
    await payment.populate('student', 'name parentPhone rollNumber')

    res.json({ success: true, message: 'Status yangilandi', payment })
  } catch (err) {
    console.error('updatePaymentStatus error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  MONTHLY REMINDER (Pro/Premium)
// ============================================================

exports.getMonthlyReminder = async (req, res) => {
  try {
    const teacherId = req.user.id
    const { month, year } = req.query

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }

    if (!hasFeature(teacher, 'monthly_reminder')) {
      return res.status(403).json({ success: false, error: 'Bu funksiya Pro va Premium tarifda', requiresUpgrade: true })
    }

    const now = new Date()
    const m = Number(month) || now.getMonth() + 1
    const y = Number(year) || now.getFullYear()

    const classes = await Class.find({ teacher: teacherId })
    const classIds = classes.map((c) => c._id)

    const unpaidPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      month: m,
      year: y,
      status: 'not_paid',
    })
      .populate('student', 'name parentPhone rollNumber')
      .populate('class', 'name defaultAmount')

    const grouped = {}
    for (const p of unpaidPayments) {
      const cid = p.class._id.toString()
      if (!grouped[cid]) {
        grouped[cid] = { classId: cid, className: p.class.name, defaultAmount: p.class.defaultAmount, unpaidStudents: [], totalUnpaid: 0 }
      }
      grouped[cid].unpaidStudents.push({
        rollNumber: p.student.rollNumber,
        name: p.student.name,
        parentPhone: p.student.parentPhone,
        amount: p.amount,
      })
      grouped[cid].totalUnpaid += p.amount
    }

    let extraData = {}
    if (hasFeature(teacher, 'export')) {
      const allPaid = await MonthlyPayment.find({ class: { $in: classIds }, status: 'paid' })
      const allExpenses = await Expense.find({ teacher: teacherId })
      const totalIncome = allPaid.reduce((s, p) => s + p.amount, 0)
      const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0)
      extraData.overallBalance = { totalIncome, totalExpenses, balance: totalIncome - totalExpenses }
    }

    res.json({
      success: true,
      month: m,
      year: y,
      totalUnpaidStudents: unpaidPayments.length,
      classes: Object.values(grouped),
      ...extraData,
    })
  } catch (err) {
    console.error('getMonthlyReminder error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  SMS REMINDER (Premium)
// ============================================================

exports.sendSmsReminders = async (req, res) => {
  try {
    const { classId, month, year } = req.body
    const teacherId = req.user.id

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }

    if (!hasFeature(teacher, 'sms_reminder')) {
      return res.status(403).json({ success: false, error: 'SMS reminder funksiyasi faqat Premium uchun', requiresUpgrade: true })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Sinf topilmadi' })
    }

    const payments = await MonthlyPayment.find({
      class: classId,
      month: Number(month),
      year: Number(year),
      status: 'not_paid',
    }).populate('student', 'name parentPhone rollNumber')

    if (payments.length === 0) {
      return res.json({ success: true, message: "SMS yuborilmaydigan o'quvchi yo'q", summary: { total: 0, sent: 0, failed: 0 } })
    }

    const studentsToNotify = payments.map((p) => ({
      _id: p.student._id,
      name: p.student.name,
      parentPhone: p.student.parentPhone,
      amount: p.amount,
    }))

    const results = await smsService.sendBulkReminders(studentsToNotify, cls.name, month, year)
    const successCount = results.filter((r) => r.status === 'sent').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    res.json({
      success: true,
      message: 'SMS reminder yuborildi',
      summary: { total: results.length, sent: successCount, failed: failedCount },
      details: results,
    })
  } catch (err) {
    console.error('sendSmsReminders error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  EXPORT (Premium)
//  ✅ TO'G'IRLANDI: arraybuffer, to'g'ri headers, korrekt Excel/Word
// ============================================================

exports.exportPayments = async (req, res) => {
  try {
    const { classId } = req.params
    const { month, year, format = 'json' } = req.query
    const teacherId = req.user.id

    // Teacher va feature tekshirish
    const teacher = await Teacher.findById(teacherId)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }
    if (!hasFeature(teacher, 'export')) {
      return res.status(403).json({ success: false, error: 'Export funksiyasi faqat Premium uchun', requiresUpgrade: true })
    }

    // Class tekshirish
    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Sinf topilmadi' })
    }

    // Students
    const students = await Student.find({ class: classId }).sort({ rollNumber: 1 })
    if (students.length === 0) {
      return res.status(400).json({ success: false, error: "Bu sinfda o'quvchi yo'q" })
    }

    // Payments
    const query = { class: classId }
    if (month) query.month = Number(month)
    if (year) query.year = Number(year)

    const payments = await MonthlyPayment.find(query).populate('student', 'name parentPhone rollNumber')

    // Oy nomi
    const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']
    const monthName = month ? (monthNames[Number(month) - 1] || '') : ''

    // Export data
    const exportData = students.map((student) => {
      const payment = payments.find((p) => p.student._id.toString() === student._id.toString())
      return {
        '№': student.rollNumber,
        "O'quvchi ismi": student.name,
        'Ota-ona telefoni': student.parentPhone || '—',
        "Summa (so'm)": payment ? payment.amount : cls.defaultAmount,
        Holati: payment?.status === 'paid' ? "To'lagan" : "To'lamagan",
        "To'lagan sanasi": payment?.paidDate
          ? new Date(payment.paidDate).toLocaleDateString('uz-UZ')
          : '—',
      }
    })

    const paidCount = exportData.filter((r) => r['Holati'] === "To'lagan").length
    const collected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
    const expectedTotal = students.length * cls.defaultAmount

    const meta = {
      paidCount,
      expectedTotal,
      collectedTotal: collected,
      remaining: expectedTotal - collected,
      month: Number(month) || 0,
      year: Number(year) || new Date().getFullYear(),
      monthName,
    }

    if (format === 'excel') return exportToExcel(res, cls, exportData, meta)
    if (format === 'word')  return exportToWord(res, cls, exportData, meta)

    // JSON format
    return res.json({
      success: true,
      data: exportData,
      meta: { className: cls.name, ...meta, studentCount: students.length, unpaidCount: students.length - paidCount },
    })
  } catch (err) {
    console.error('exportPayments error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  ✅ EXCEL EXPORT — TO'G'IRLANDI
// ============================================================

const exportToExcel = (res, cls, data, meta) => {
  try {
    const wb = XLSX.utils.book_new()

    // ── 1. To'lovlar jadvali ──────────────────────────────────
    // Header qatori
    const headerRow = [
      '№',
      "O'quvchi ismi",
      'Ota-ona telefoni',
      "Summa (so'm)",
      'Holati',
      "To'lagan sanasi",
    ]

    // Data qatorlari
    const dataRows = data.map((d) => [
      d['№'],
      d["O'quvchi ismi"],
      d['Ota-ona telefoni'],
      d["Summa (so'm)"],
      d['Holati'],
      d["To'lagan sanasi"],
    ])

    const wsData = [headerRow, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Ustun kengliklari
    ws['!cols'] = [
      { wch: 5 },   // №
      { wch: 25 },  // Ism
      { wch: 18 },  // Telefon
      { wch: 15 },  // Summa
      { wch: 14 },  // Holati
      { wch: 18 },  // Sana
    ]

    XLSX.utils.book_append_sheet(wb, ws, "To'lovlar")

    // ── 2. Hisobot jadvali ───────────────────────────────────
    const summaryRows = [
      [`${cls.name} - ${meta.monthName} ${meta.year}`],
      [],
      ['Ko\'rsatkich', 'Qiymat'],
      ["Jami o'quvchilar", data.length],
      ["To'lagan", meta.paidCount],
      ["To'lamagan", data.length - meta.paidCount],
      [],
      ["Kutilayotgan summa (so'm)", meta.expectedTotal],
      ["Yig'ilgan summa (so'm)", meta.collectedTotal],
      ["Qolgan summa (so'm)", meta.remaining],
    ]

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Hisobot')

    // ✅ Buffer — 'buffer' type ishlatiladi (Node.js Buffer)
    const buf = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'buffer',        // ← 'buffer' ishlatamiz, 'binary' emas
      compression: true,     // ← fayl hajmini kamaytiradi
    })

    const fileName = encodeURIComponent(`${cls.name}_${meta.month}_${meta.year}.xlsx`)

    // ✅ To'g'ri Content-Type va headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Length', buf.length)
    res.setHeader('Cache-Control', 'no-cache')

    return res.end(buf)  // ← res.send() o'rniga res.end() — binary uchun xavfsizroq
  } catch (err) {
    console.error('exportToExcel error:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Excel export xatosi: ' + err.message })
    }
  }
}

// ============================================================
//  ✅ WORD EXPORT — TO'G'IRLANDI
// ============================================================

const exportToWord = async (res, cls, data, meta) => {
  try {
    const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

    // Jadval header
    const tableHeaderCells = [
      '№',
      "O'quvchi ismi",
      'Ota-ona telefoni',
      "Summa (so'm)",
      'Holati',
      "To'lagan sanasi",
    ].map((text) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: '2B6CB0' },
      })
    )

    // Jadval data qatorlari
    const tableDataRows = data.map((row, idx) => {
      const isPaid = row['Holati'] === "To'lagan"
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row['№'] || idx + 1), size: 18 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row["O'quvchi ismi"] || '', size: 18 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row['Ota-ona telefoni'] || '—', size: 18 })] })] }),
          new TableCell({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: String(row["Summa (so'm)"] || 0), size: 18 })],
          })] }),
          new TableCell({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: row['Holati'] || '', size: 18, color: isPaid ? '276749' : 'C05621', bold: true })],
            })],
            shading: isPaid ? { fill: 'F0FFF4' } : { fill: 'FFFAF0' },
          }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row["To'lagan sanasi"] || '—', size: 18 })] })] }),
        ],
      })
    })

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Sarlavha
          new Paragraph({
            children: [new TextRun({ text: `${cls.name} — To'lovlar Hisoboti`, bold: true, size: 32, color: '1A365D' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Meta ma'lumot
          new Paragraph({
            children: [new TextRun({ text: `${meta.monthName} ${meta.year}`, size: 24, color: '4A5568' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Statistika
          new Paragraph({ children: [new TextRun({ text: '📊 Umumiy statistika', bold: true, size: 24 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: `Jami o'quvchilar: ${data.length}`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `To'lagan: ${meta.paidCount}`, size: 20, color: '276749' })] }),
          new Paragraph({ children: [new TextRun({ text: `To'lamagan: ${data.length - meta.paidCount}`, size: 20, color: 'C05621' })] }),
          new Paragraph({ children: [new TextRun({ text: `Kutilayotgan: ${meta.expectedTotal.toLocaleString('uz-UZ')} so'm`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `Yig'ilgan: ${meta.collectedTotal.toLocaleString('uz-UZ')} so'm`, size: 20, bold: true, color: '276749' })] }),
          new Paragraph({ children: [new TextRun({ text: `Qolgan: ${meta.remaining.toLocaleString('uz-UZ')} so'm`, size: 20, bold: true, color: 'C05621' })], spacing: { after: 400 } }),

          // Jadval sarlavhasi
          new Paragraph({ children: [new TextRun({ text: "📋 O'quvchilar ro'yxati", bold: true, size: 24 })], spacing: { after: 200 } }),

          // Jadval
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: tableHeaderCells, tableHeader: true }),
              ...tableDataRows,
            ],
          }),

          // Footer
          new Paragraph({
            children: [new TextRun({ text: `Chiqarilgan sana: ${new Date().toLocaleDateString('uz-UZ')}`, size: 16, color: '718096', italics: true })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
          }),
        ],
      }],
    })

    // ✅ Buffer yaratish
    const buf = await Packer.toBuffer(doc)

    const fileName = encodeURIComponent(`${cls.name}_${meta.month}_${meta.year}.docx`)

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Length', buf.length)
    res.setHeader('Cache-Control', 'no-cache')

    return res.end(buf)
  } catch (err) {
    console.error('exportToWord error:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Word export xatosi: ' + err.message })
    }
  }
}

// ============================================================
//  EXPENSES
// ============================================================

exports.addExpense = async (req, res) => {
  try {
    const { classId, reason, amount, month, year, description } = req.body
    const teacherId = req.user.id

    if (!classId || !reason || !amount || !month || !year) {
      return res.status(400).json({ success: false, error: "Barcha majburiy maydonlarni to'ldiring" })
    }
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: "Summa 0 dan katta bo'lishi kerak" })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Sinf topilmadi' })
    }

    const expense = new Expense({
      class: classId,
      teacher: teacherId,
      reason: reason.trim(),
      amount: Number(amount),
      month: Number(month),
      year: Number(year),
      description: (description || '').trim(),
    })
    await expense.save()

    res.status(201).json({ success: true, message: "Xarajat qo'shildi", expense })
  } catch (err) {
    console.error('addExpense error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getExpenses = async (req, res) => {
  try {
    const teacherId = req.user.id
    const { month, year } = req.query

    const query = { teacher: teacherId }
    if (month) query.month = Number(month)
    if (year) query.year = Number(year)

    const expenses = await Expense.find(query).populate('class', 'name').sort({ createdAt: -1 })
    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    res.json({ success: true, expenses, total })
  } catch (err) {
    console.error('getExpenses error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params
    const teacherId = req.user.id

    const expense = await Expense.findOne({ _id: expenseId, teacher: teacherId })
    if (!expense) {
      return res.status(404).json({ success: false, error: "Xarajat topilmadi yoki ruxsat yo'q" })
    }

    await Expense.findByIdAndDelete(expenseId)
    res.json({ success: true, message: "Xarajat o'chirildi" })
  } catch (err) {
    console.error('deleteExpense error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  DASHBOARD
// ============================================================

exports.getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }

    const classes = await Class.find({ teacher: teacherId })
    const classIds = classes.map((c) => c._id)

    const allStudents = await Student.find({ class: { $in: classIds } })
    const totalStudents = allStudents.length

    const monthlyPayments = await MonthlyPayment.find({
      class: { $in: classIds },
      month: currentMonth,
      year: currentYear,
    })

    const paidPayments = monthlyPayments.filter((p) => p.status === 'paid')
    const collectedThisMonth = paidPayments.reduce((sum, p) => sum + p.amount, 0)

    let expectedThisMonth = 0
    for (const cls of classes) {
      const classStudents = allStudents.filter((s) => s.class.toString() === cls._id.toString())
      expectedThisMonth += classStudents.length * cls.defaultAmount
    }

    const monthlyExpenses = await Expense.find({ teacher: teacherId, month: currentMonth, year: currentYear })
    const expensesTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)

    const classDetails = await Promise.all(
      classes.map(async (cls) => {
        const classStudents = allStudents.filter((s) => s.class.toString() === cls._id.toString())
        const classPayments = monthlyPayments.filter((p) => p.class.toString() === cls._id.toString())
        const classPaid = classPayments.filter((p) => p.status === 'paid')
        const classExpensesTotal = monthlyExpenses
          .filter((e) => e.class?.toString() === cls._id.toString())
          .reduce((sum, e) => sum + e.amount, 0)

        return {
          id: cls._id,
          name: cls.name,
          defaultAmount: cls.defaultAmount,
          studentCount: classStudents.length,
          paidCount: classPaid.length,
          unpaidCount: classStudents.length - classPaid.length,
          collectedThisMonth: classPaid.reduce((sum, p) => sum + p.amount, 0),
          expectedThisMonth: classStudents.length * cls.defaultAmount,
          expensesThisMonth: classExpensesTotal,
        }
      })
    )

    res.json({
      success: true,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        plan: teacher.plan,
        planActive: teacher.isPlanActive(),
        daysLeft: teacher.daysLeft(),
        planExpiresAt: teacher.planExpiresAt,
        features: {
          monthly_reminder: hasFeature(teacher, 'monthly_reminder'),
          export: hasFeature(teacher, 'export'),
          multi_lang: hasFeature(teacher, 'multi_lang'),
          sms_reminder: hasFeature(teacher, 'sms_reminder'),
        },
      },
      registeredDate: teacher.registeredDate || teacher.createdAt,
      currentMonth,
      currentYear,
      summary: {
        totalClasses: classes.length,
        totalStudents,
        paidCount: paidPayments.length,
        unpaidCount: monthlyPayments.length - paidPayments.length,
        collectedThisMonth,
        expectedThisMonth,
        remainingThisMonth: expectedThisMonth - collectedThisMonth,
        expensesTotal,
        balance: collectedThisMonth - expensesTotal,
      },
      classDetails,
    })
  } catch (err) {
    console.error('getDashboard error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// ============================================================
//  SUBSCRIPTION
// ============================================================

exports.getSubscriptionInfo = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher topilmadi' })
    }

    res.json({
      success: true,
      currentPlan: teacher.plan,
      planActive: teacher.isPlanActive(),
      daysLeft: teacher.daysLeft(),
      planExpiresAt: teacher.planExpiresAt,
      highestPlanEver: teacher.highestPlanEver,
      features: {
        monthly_reminder: hasFeature(teacher, 'monthly_reminder'),
        export: hasFeature(teacher, 'export'),
        multi_lang: hasFeature(teacher, 'multi_lang'),
        sms_reminder: hasFeature(teacher, 'sms_reminder'),
      },
    })
  } catch (err) {
    console.error('getSubscriptionInfo error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

module.exports = exports