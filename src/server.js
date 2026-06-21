require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,        // production frontend (Netlify)
  'http://localhost:3000',         // local dev
  'http://localhost:5173',         // Vite default port
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
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

app.options('*', cors());

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Origin=${req.headers.origin || '-'} Auth=${!!req.headers.authorization}`);
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', app: 'Fond School API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

try {
  const refCtrl = require('./controllers/referralController');
  if (refCtrl && typeof refCtrl.checkCode === 'function') {
    app.get('/api/ref/:code', refCtrl.checkCode);
  }
} catch (e) {
  console.log('ℹ️ referralController yoq — /api/ref/* ruteni otkazib yuborildi');
}

try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ /api/auth router mounted');
} catch (e) {
  console.warn('⚠️  routes/auth topilmadi yoki xato:', e.message || e);
}

try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ /api/admin router mounted');
} catch (e) {
  console.warn('⚠️  routes/admin topilmadi yoki xato:', e.message || e);
}

try {
  app.use('/api/teacher', require('./routes/teacher'));
  console.log('✅ /api/teacher router mounted');
} catch (e) {
  console.error('❌ routes/teacher topilmadi yoki xato:', e.message || e);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fond-school';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB ulandi');

    // initBot (agar mavjud bo'lsa)
    try {
      const { initBot } = require('./bot/bot');
      if (typeof initBot === 'function') initBot(app);
      console.log('✅ Bot initialized');
    } catch (e) {
      console.warn('⚠️  bot init topilmadi yoki xato berdi:', e.message || e);
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
  })
  .catch((err) => {
    console.error('❌ MongoDB ulanish xatosi:', err.message || err);
    process.exit(1);
  });

app.use((req, res) => {
  res.status(404).json({ error: `Route topilmadi: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('Server xatosi:', err && err.message ? err.message : err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Ichki server xatosi' });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} da ishlamoqda`);
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
