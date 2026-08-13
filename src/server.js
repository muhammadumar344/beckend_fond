require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// ✅ YANGI — MUHIM XAVFSIZLIK TEKSHIRUVI: JWT_SECRET sozlanmagan bo'lsa,
// server umuman ishga tushmaydi. Avval bu holatda kod jimgina ma'lum,
// oldindan yozilgan zaxira qiymatga o'tib ketardi — bu esa har qanday
// hisob uchun soxta token yasash imkonini berardi. Tez va aniq xato
// berish, keyinroq "email yoki parol xato" kabi tushunarsiz xatolarga
// duch kelishdan yaxshiroq.
if (!process.env.JWT_SECRET) {
  console.error('❌ XATO: JWT_SECRET muhit o\'zgaruvchisi sozlanmagan!');
  console.error('   Server xavfsizlik sababli ishga tushirilmaydi.');
  console.error('   Render/.env faylida JWT_SECRET qiymatini belgilang.');
  process.exit(1);
}

const app = express();

// ✅ TUZATILDI: agar FRONTEND_URL muhitda sozlanmagan/xato bo'lsa ham,
// production domen qattiq yozilgan — sayt CORS sababli butunlay
// to'xtab qolmaydi.
//
// Yangi domenga o'tganda uni shu ro'yxatga qo'shing va eskisini
// KAMIDA bir necha oy qoldiring — 301 redirect davrida foydalanuvchilar
// ikkala manzilga ham kirib turadi.
const allowedOrigins = [
  process.env.FRONTEND_URL,        // Render muhitidagi qiymat
  'https://schoolfonds.uz',        // ✅ Asosiy domen — env buzilsa ham ishlaydi
  'https://www.schoolfonds.uz',    // ✅ www varianti
  'https://schoolfonds.netlify.app', // ✅ Netlify manzili — har doim ishlaydi
  'http://localhost:3000',         // local dev
  'http://localhost:5173',         // Vite default port
].filter(Boolean);

// ✅ Netlify preview deploylar uchun ham ruxsat (masalan: deploy-preview-12--schoolfonds.netlify.app)
const isNetlifyPreview = (origin) => /^https:\/\/[a-z0-9-]+--schoolfonds\.netlify\.app$/.test(origin);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isNetlifyPreview(origin)) {
      callback(null, true);
    } else {
      console.warn('❌ CORS tomonidan bloklandi:', origin);
      callback(null, false); // ✅ TUZATILDI: Error tashlash o'rniga shunchaki rad etamiz
    }
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  // X-Lang — javob xabarlari qaysi tilda qaytishini belgilaydi.
  // CORS ro'yxatida bo'lmasa brauzer sarlavhani umuman yubormaydi.
  allowedHeaders: ['Content-Type','Authorization','Accept','X-Lang'],
  credentials: true,
}));

app.options('*', cors());

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Til: javobdagi error/message maydonlarini foydalanuvchi tiliga
// o'giradi. Barcha route'lardan OLDIN turishi shart. O'zbekcha
// so'rovlarda umuman ishlamaydi (qo'shimcha yuk yo'q).
const { langMiddleware } = require('./middleware/lang');
app.use(langMiddleware);

app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Origin=${req.headers.origin || '-'} Auth=${!!req.headers.authorization}`);
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', app: 'Lumo API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
 const staffCtrl = require('./controllers/staffController')
  app.get('/api/staff/verify/:token', staffCtrl.verifyEmail)

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
  app.use('/api/lc', require('./routes/lc'));
  console.log('✅ /api/lc router mounted');
} catch (e) {
  console.warn('⚠️  routes/lc topilmadi yoki xato:', e.message || e);
}

// To'lov tizimlari. Kalitlar sozlanmagan bo'lsa route'lar 503
// qaytaradi — batafsil src/config/payments.js
try {
  app.use('/api/payments', require('./routes/payments'));
  const { enabledProviders } = require('./config/payments');
  const list = enabledProviders().map((p) => p.label);
  console.log(
    list.length
      ? `✅ /api/payments mounted — yoqilgan: ${list.join(', ')}`
      : 'ℹ️ /api/payments mounted — hech qaysi provayder sozlanmagan (o\'chiq)',
  );
} catch (e) {
  console.warn('⚠️  routes/payments topilmadi yoki xato:', e.message || e);
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