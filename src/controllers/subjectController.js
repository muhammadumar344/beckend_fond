const Subject = require('../models/Subject')
const Class   = require('../models/Class')
const { resolveContext, requirePermission } = require('../utils/resolveContext')

// GET /api/lc/subjects — Director + barcha Staff ko'radi
// (Administration guruh yaratganda shu ro'yxatdan fan tanlaydi, shuning
// uchun ko'rish uchun alohida ruxsat talab qilinmaydi — faqat login bo'lsa yetarli)
const getSubjects = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    const subjects = await Subject.find({ director: ctx.directorId, isActive: true }).sort({ name: 1 })
    res.json({ success: true, subjects })
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message })
  }
}

// POST /api/lc/subjects — faqat manageSubjects huquqi bor rol (Manager/Director)
const createSubject = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    requirePermission(ctx, 'manageSubjects')

    const { name, description, color } = req.body
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Fan nomi majburiy' })

    const subject = new Subject({
      name: name.trim(),
      description: (description || '').trim(),
      color: color || '#4299e1',
      director: ctx.directorId,
    })
    await subject.save()
    res.status(201).json({ success: true, subject })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Bu nomli fan allaqachon mavjud' })
    }
    res.status(err.status || 500).json({ success: false, error: err.message })
  }
}

// PUT /api/lc/subjects/:id
const updateSubject = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    requirePermission(ctx, 'manageSubjects')

    const subject = await Subject.findOne({ _id: req.params.id, director: ctx.directorId })
    if (!subject) return res.status(404).json({ success: false, error: 'Fan topilmadi' })

    const { name, description, color, isActive } = req.body
    if (name !== undefined)        subject.name = name.trim()
    if (description !== undefined) subject.description = description.trim()
    if (color !== undefined)       subject.color = color
    if (isActive !== undefined)    subject.isActive = isActive

    await subject.save()
    res.json({ success: true, subject })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Bu nomli fan allaqachon mavjud' })
    }
    res.status(err.status || 500).json({ success: false, error: err.message })
  }
}

// DELETE /api/lc/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    requirePermission(ctx, 'manageSubjects')

    const subject = await Subject.findOne({ _id: req.params.id, director: ctx.directorId })
    if (!subject) return res.status(404).json({ success: false, error: 'Fan topilmadi' })

    // Guruh modeliga keyingi bosqichda "subject" maydoni qo'shiladi —
    // shu tekshiruv o'shanda ishga tushadi, hozircha xavfsiz (0 qaytaradi)
    const groupCount = await Class.countDocuments({ subject: subject._id })
    if (groupCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Bu fandan ${groupCount} ta guruhda foydalanilmoqda. Avval guruhlarni o'zgartiring.`,
      })
    }

    await subject.deleteOne()
    res.json({ success: true, message: "Fan o'chirildi" })
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message })
  }
}

module.exports = { getSubjects, createSubject, updateSubject, deleteSubject }