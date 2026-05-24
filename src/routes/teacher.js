// src/routes/teacher.js
const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/teacherController')
const tgCtrl  = require('../controllers/telegramController')
const auth    = require('../middleware/auth')
const roles   = require('../middleware/roles')
const {
  exportPreviousYear,
  cleanupPreviousYear
} = require('../controllers/freezeController')

router.use(auth, roles('teacher'))

// Dashboard
router.get('/dashboard',                         ctrl.getDashboard)
router.get('/subscription',                      ctrl.getSubscriptionInfo)

// ✅ Freeze holati (teacher uchun, 403 yo'q)
router.get('/freeze-status', async (req, res) => {
  try {
    const FreezeSettings = require('../models/FreezeSettings')
    const Teacher        = require('../models/Teacher')
    const [freeze, teacher] = await Promise.all([
      FreezeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }),
      Teacher.findById(req.user.id).select('freezeStartedAt freezeRemainingMs planExpiresAt plan'),
    ])
    let daysLeft = 0
    if (teacher?.freezeStartedAt && teacher?.freezeRemainingMs > 0) {
      daysLeft = Math.ceil(teacher.freezeRemainingMs / (1000 * 60 * 60 * 24))
    } else if (teacher?.planExpiresAt) {
      const diff = new Date(teacher.planExpiresAt) - new Date()
      daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }
    res.json({
      success: true,
      freeze: freeze ? {
        _id: freeze._id, isActive: freeze.isActive,
        reason: freeze.reason, startedAt: freeze.startedAt,
      } : null,
      isActive:      !!freeze,
      teacherFrozen: !!(teacher?.freezeStartedAt),
      daysLeft,
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Classes
router.post('/classes',                          ctrl.createClass)
router.get('/classes',                           ctrl.getMyClasses)
router.put('/classes/:classId/amount',           ctrl.updateClassDefaultAmount)
router.put('/classes/:classId/initial-balance',  ctrl.updateInitialBalance)
router.delete('/classes/:classId',               ctrl.deleteClass)

// Students
router.post('/classes/:classId/students',        ctrl.addStudent)
router.get('/classes/:classId/students',         ctrl.getClassStudents)
router.delete('/students/:studentId',            ctrl.deleteStudent)

// Payments — aniq routelar avval!
router.post('/payments/create-monthly',          ctrl.createMonthlyPayments)
router.get('/payments/class/:classId',           ctrl.getClassPayments)
router.get('/payments',                          ctrl.getMonthlyPayments)
router.put('/payments/:paymentId/status',        ctrl.updatePaymentStatus)

// Reminder, SMS, Export
router.get('/reminder',                          ctrl.getMonthlyReminder)
router.post('/sms-reminder/send',                ctrl.sendSmsReminders)
router.get('/export/:classId',                   ctrl.exportPayments)

// Expenses
router.post('/expenses',                         ctrl.addExpense)
router.get('/expenses',                          ctrl.getExpenses)
router.delete('/expenses/:expenseId',            ctrl.deleteExpense)

// Telegram
router.get('/telegram/bot-link',                 tgCtrl.getBotLink)
router.get('/telegram/parents',                  tgCtrl.getParents)
router.get('/telegram/parents/class/:classId',   tgCtrl.getParentsByClass)
router.post('/telegram/send-reminders',          tgCtrl.sendRemindersNow)
router.post('/telegram/send-to-students',        tgCtrl.sendToStudents)

// ✅ Oldingi yil export va tozalash
router.get('/export-previous-year',              exportPreviousYear)
router.post('/cleanup-previous-year',            cleanupPreviousYear)

module.exports = router