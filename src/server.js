// src/server.js
require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

const app = express()

// ── Middleware ─────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,        // production frontend (Netlify)
  'http://localhost:3000',         // local dev
  'http://localhost:5173',         // Vite default port (kerak bo'lsa)
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    // origin bo'lmagan so'rovlar (Postman, server-to-server) ham ruxsat etiladi
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn('❌ CORS tomonidan bloklandi:', origin)
      callback(new Error('CORS tomonidan bloklandi: ' + origin))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '5mb' }))   // ✅ screenshot uchun limit oshirildi
app.use(express.urlencoded({ extended: true }))

// ── Health check ───────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', app: 'Fond School API' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// ── PUBLIC routes (auth siz) ───────────────────────────────────
// ✅ Referral kod tekshirish — auth middleware DAN OLDIN
const refCtrl = require('./controllers/referralController')
app.get('/api/ref/:code', refCtrl.checkCode)

// ── MongoDB ulanish ────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fond-school')
  .then(async () => {
    console.log('✅ MongoDB ulandi')

    // ✅ 1-qadam: Botni ishga tushirish
    const { initBot } = require('./bot/bot')
    initBot(app)

    // ✅ 2-qadam: Routelarni ulash
    app.use('/api/auth',    require('./routes/auth'))
    app.use('/api/admin',   require('./routes/admin'))
    app.use('/api/teacher', require('./routes/teacher'))

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: `Route topilmadi: ${req.method} ${req.originalUrl}` })
    })

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Server xatosi:', err.message)
      res.status(500).json({ error: 'Ichki server xatosi' })
    })

    // ✅ 3-qadam: Cron job
    const { startReminderCron } = require('./cron/reminderCron')
    startReminderCron()

    // ✅ 4-qadam: Serverni ishga tushirish
    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => {
      console.log(`🚀 Server http://localhost:${PORT} da ishlamoqda`)
      console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
    })
  })
  .catch((err) => {
    console.error('❌ MongoDB ulanish xatosi:', err.message)
    process.exit(1)
  })

module.exports = app;