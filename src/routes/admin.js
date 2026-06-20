// src/routes/admin.js — TUZATILGAN (duplicate const va route olib tashlandi)
const express    = require('express')
const adminCtrl  = require('../controllers/adminController')
const freezeCtrl = require('../controllers/freezeController')
const prCtrl     = require('../controllers/paymentRequestController')
const refCtrl    = require('../controllers/referralController')
const auth       = require('../middleware/auth')
const roles      = require('../middleware/roles')

const router = express.Router()
router.use(auth, roles('admin'))

// ══ DASHBOARD / TEACHERS ════════════════════════════════════
router.get('/dashboard',                        adminCtrl.getDashboard)
router.post('/teachers',                        adminCtrl.createTeacher)
router.put('/teachers/:teacherId/password',     adminCtrl.updateTeacherPassword)
router.put('/teachers/:teacherId/plan',         adminCtrl.updateTeacherPlan)
router.put('/teachers/:teacherId/deactivate',   adminCtrl.deactivateTeacher)
router.put('/teachers/:teacherId/activate',     adminCtrl.activateTeacher)
router.get('/plans',                            adminCtrl.getPlanPrices)

// ══ FREEZE ═══════════════════════════════════════════════════
router.get('/freeze',             freezeCtrl.getFreezeStatus)
router.post('/freeze/activate',   freezeCtrl.activateFreeze)
router.post('/freeze/deactivate', freezeCtrl.deactivateFreeze)
router.get('/freeze/history',     freezeCtrl.getFreezeHistory)

// ══ REFERRAL ═════════════════════════════════════════════════
router.get('/referral/stats', refCtrl.getReferralStats)

// ══ PAYMENT REQUESTS ═════════════════════════════════════════
router.get('/payment-requests',                  prCtrl.getAllRequests)
router.get('/payment-requests/stats',            prCtrl.getStats)
router.get('/payment-requests/:id/screenshot',   prCtrl.getScreenshot)
router.post('/payment-requests/:id/approve',     prCtrl.approveRequest)
router.post('/payment-requests/:id/reject',      prCtrl.rejectRequest)

module.exports = router