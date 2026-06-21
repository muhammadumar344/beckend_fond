require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ── CORS konfiguratsiyasi ───────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,        // production frontend (Netlify)
  'http://localhost:3000',         // local dev
  'http://localhost:5173',         // Vite default port
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // origin bo'lmagan so'rovlar (Postman, server-to-server) ham ruxsat etilsin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('❌ CORS tomonidan bloklandi:', origin);
      callback(new Error('CORS tomonidan bloklandi: ' + origin));
    }
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  credentials: true,
}));

// ensure preflight is answered quickly (redundant but safe)
app.options('*', cors());

// ── Body parsers ────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Diagnostic request logger ───────────────────────────────
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Origin=${req.headers.origin || '-'} Auth=${!!req.headers.authorization}`);
  next();
});

// ── Health endpoints ────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', app: 'Fond School API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Optional public route: referral code checker if controller exists
try {
  const refCtrl = require('./controllers/referralController');
  if (refCtrl && typeof refCtrl.checkCode === 'function') {
    app.get('/api/ref/:code', refCtrl.checkCode);
  }
} catch (e) {
  console.log('ℹ️ referralController yo‘q — /api/ref/* ruteni o‘tkazib yuborildi');
}

// ── MongoDB va routelarni mount qilish ───────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fond-school';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB ulandi');

    // initBot (agar mavjud bo'lsa)
    try {
      const { initBot } = require('./bot/bot');
      if (typeof initBot === 'function') initBot(app);
    } catch (e) {
      console.log('ℹ️ bot init topilmadi yoki xato berdi:', e.message || e);
    }

    // Probe middleware for /api/teacher mount (logs before teacher router)
    app.use('/api/teacher', (req, res, next) => {
      console.log(`[PROBE] /api/teacher -> ${req.method} ${req.originalUrl} Headers=${JSON.stringify({
        origin: req.headers.origin,
        authorization: !!req.headers.authorization
      })}`);
      next();
    });

    // Mount routers safely (agar fayl yo'q bo'lsa — log chiqaradi, app ishlashi davom etadi)
    try {
      app.use('/api/auth', require('./routes/auth'));
    } catch (e) {
      console.log('ℹ️ routes/auth topilmadi — /api/auth mount qilinmadi');
    }

    try {
      app.use('/api/admin', require('./routes/admin'));
    } catch (e) {
      console.log('ℹ️ routes/admin topilmadi — /api/admin mount qilinmadi');
    }

    try {
      app.use('/api/teacher', require('./routes/teacher'));
    } catch (e) {
      console.error('❌ routes/teacher topilmadi yoki xato:', e.message || e);
      // Still continue — 404 handler will handle requests
    }

    // (DEV) print registered routes once (helpful log)
    if (process.env.NODE_ENV !== 'production') {
      setTimeout(() => {
        try {
          const out = [];
          app._router.stack.forEach(mw => {
            if (mw.route && mw.route.path) {
              out.push(`${Object.keys(mw.route.methods).join(',').toUpperCase()} ${mw.route.path}`);
            } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
              mw.handle.stack.forEach(r => {
                if (r.route && r.route.path) {
                  out.push(`${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
                }
              });
            }
          });
          console.log('=== Registered routes ===\n' + out.join('\n'));
        } catch (err) {
          console.warn('Could not list routes:', err.message || err);
        }
      }, 1000);
    }

    // 404 handler (catch-all)
    app.use((req, res) => {
      res.status(404).json({ error: `Route topilmadi: ${req.method} ${req.originalUrl}` });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Server xatosi:', err && err.message ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ichki server xatosi' });
      }
    });

    // Server start
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server http://localhost:${PORT} da ishlamoqda`);
      console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB ulanish xatosi:', err.message || err);
    process.exit(1);
  });

module.exports = app;