// src/controllers/scheduleController.js
const Schedule = require('../models/Schedule')
const Class    = require('../models/Class')

const DAYS = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba']

// ── Jadval yaratish ──────────────────────────────────────────
exports.createSchedule = async (req, res) => {
  try {
    const teacherId = req.user.id
    const { classId, dayOfWeek, startTime, endTime, subject, room } = req.body

    if (!classId || dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'classId, dayOfWeek, startTime, endTime majburiy' })
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ success: false, error: 'dayOfWeek 0-6 orasida bo\'lishi kerak' })
    }

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) return res.status(404).json({ success: false, error: 'Sinf topilmadi' })

    // Bir xil kun + vaqt mavjudmi?
    const existing = await Schedule.findOne({ class: classId, dayOfWeek, isActive: true })
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `${DAYS[dayOfWeek]} kuni jadval allaqachon mavjud (${existing.startTime}-${existing.endTime})`,
      })
    }

    const schedule = await Schedule.create({
      class: classId, teacher: teacherId,
      dayOfWeek, startTime, endTime,
      subject: (subject || '').trim(),
      room:    (room || '').trim(),
    })

    res.status(201).json({ success: true, message: 'Jadval qo\'shildi', schedule })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Sinf jadvali ─────────────────────────────────────────────
exports.getClassSchedule = async (req, res) => {
  try {
    const { classId } = req.params
    const teacherId   = req.user.id

    const cls = await Class.findOne({ _id: classId, teacher: teacherId })
    if (!cls) return res.status(404).json({ success: false, error: 'Sinf topilmadi' })

    const schedules = await Schedule.find({ class: classId, isActive: true })
      .sort({ dayOfWeek: 1, startTime: 1 })

    // Haftaning har kuni uchun guruhlash
    const weekly = Array.from({ length: 7 }, (_, i) => ({
      day:       i,
      dayName:   DAYS[i],
      schedules: schedules.filter(s => s.dayOfWeek === i),
    }))

    res.json({ success: true, classId, className: cls.name, weekly, total: schedules.length })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Barcha sinflar jadvali (haftalik ko'rinish) ──────────────
exports.getWeeklyOverview = async (req, res) => {
  try {
    const teacherId = req.user.id
    const Class     = require('../models/Class')

    const classes   = await Class.find({ teacher: teacherId }).select('name')
    const classIds  = classes.map(c => c._id)

    const schedules = await Schedule.find({ class: { $in: classIds }, isActive: true })
      .populate('class', 'name')
      .sort({ dayOfWeek: 1, startTime: 1 })

    const weekly = Array.from({ length: 7 }, (_, i) => ({
      day:       i,
      dayName:   DAYS[i],
      schedules: schedules
        .filter(s => s.dayOfWeek === i)
        .map(s => ({
          _id:       s._id,
          class:     s.class,
          startTime: s.startTime,
          endTime:   s.endTime,
          subject:   s.subject,
          room:      s.room,
        })),
    }))

    res.json({ success: true, weekly })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Jadval yangilash ─────────────────────────────────────────
exports.updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params
    const teacherId      = req.user.id
    const { startTime, endTime, subject, room } = req.body

    const schedule = await Schedule.findOne({ _id: scheduleId, teacher: teacherId })
    if (!schedule) return res.status(404).json({ success: false, error: 'Jadval topilmadi' })

    if (startTime) schedule.startTime = startTime
    if (endTime)   schedule.endTime   = endTime
    if (subject !== undefined) schedule.subject = subject.trim()
    if (room !== undefined)    schedule.room    = room.trim()
    await schedule.save()

    res.json({ success: true, message: 'Jadval yangilandi', schedule })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Jadval o'chirish ─────────────────────────────────────────
exports.deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params
    const teacherId      = req.user.id

    const schedule = await Schedule.findOne({ _id: scheduleId, teacher: teacherId })
    if (!schedule) return res.status(404).json({ success: false, error: 'Jadval topilmadi' })

    schedule.isActive = false
    await schedule.save()

    res.json({ success: true, message: 'Jadval o\'chirildi' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}