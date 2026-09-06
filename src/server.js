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

// ⚠️ Render (va har qanday proksi) orqasida `req.ip` proksining
//    manzilini ko'rsatadi. So'rov cheklagichi shu manzilga qarab
//    sanaydi — ya'ni bu sozlamasiz BITTA foydalanuvchi hammani
//    bloklab qo'yardi. `1` = faqat birinchi proksiga ishonamiz
//    (Render shunday), aks holda mijoz sarlavhani soxtalashtiradi.
app.set('trust proxy', 1);

// Express o'zini "X-Powered-By: Express" deb tanishtiradi —
// hujumchiga bekorga ma'lumot bermaymiz
app.disable('x-powered-by');

const { securityHeaders } = require('./middleware/security');
app.use(securityHeaders);

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
  // ⚠️ BU RO'YXAT TO'LIQ BO'LISHI SHART. Brauzer o'zi bilmagan
  //    sarlavhani yuborishdan OLDIN OPTIONS so'rovi bilan so'raydi;
  //    javobda sarlavha bo'lmasa — butun so'rovni bekor qiladi va
  //    `fetch` "Load failed" deb yiqiladi. Server logida hech
  //    narsa ko'rinmaydi, chunki so'rov serverga umuman yetib
  //    bormaydi.
  //
  //    X-Lang               — javob xabarlari qaysi tilda qaytadi
  //    X-Telegram-Init-Data — Mini App'ning YAGONA autentifikatsiya
  //                           yo'li (middleware/tmaAuth.js). Ro'yxatda
  //                           yo'q edi va shu sababli Telegram
  //                           ichidagi ilova hech qachon ochilmagan.
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Lang',
    'X-Telegram-Init-Data',
  ],
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
  // ⚠️ Bot webhook manzili ichida TOKEN bor
  //    (`/bot-webhook-8551…-AAG…`). Uni shundayligicha yozsak,
  //    token Render loglarida qoladi va logni ko'ra oladigan har
  //    kim botni to'liq egallaydi. Shuning uchun kesib tashlanadi.
  const url = req.originalUrl.startsWith('/bot-webhook-')
    ? '/bot-webhook-***'
    : req.originalUrl;
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${url} Origin=${req.headers.origin || '-'} Auth=${!!req.headers.authorization}`);
  next();
});

// ⚠️ BOT WEBHOOK UCHUN JOY — SHU YERDA BAND QILINADI.
//
//    Sabab: `initBot` bazaga ulangandan KEYIN, ya'ni ASINXRON
//    ishlaydi. U paytda quyidagi 404-tutuvchi (`app.use`) allaqachon
//    ro'yxatga olingan bo'ladi, Express esa middleware'larni
//    QO'SHILISH TARTIBIDA yuradi. Natijada webhook route'i 404 dan
//    KEYIN turib qolardi va Telegram yuborgan har bir yangilanish
//    "Route topilmadi" bo'lib qaytardi — bot jim, log toza,
//    sababi ko'rinmaydi.
//
//    Router'ni oldindan ulab qo'yish bu muammoni yechadi: Router
//    o'z ichidagi route'larni SO'ROV PAYTIDA qaraydi, shuning
//    uchun keyin qo'shilgani ham ishlaydi.
const botWebhook = express.Router();
app.use(botWebhook);

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

  // ⚠️ Mini App (ota-ona/o'quvchi) — ATAYLAB alohida bo'lim.
  //    O'zining middleware'i (`tmaAuth`), o'zining controlleri.
  //    Bu yerga direktor route'larini ulamang: ota-ona hisobi
  //    bilan markaz moliyasiga yo'l ochilib ketadi.
  app.use('/api/tma', require('./routes/tma'));
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

// ⚠️ OCHIQ (login'siz) route'lar — ota-onalar uchun hisobot
//    havolasi. Alohida router: bu yerga hech qachon `auth`
//    qo'yilmaydi va bu ataylab (routes/public.js izohiga qarang).
try {
  app.use('/api/public', require('./routes/public'));
  console.log('✅ /api/public router mounted');
} catch (e) {
  console.warn('⚠️  routes/public topilmadi yoki xato:', e.message || e);
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
      // ⚠️ `initBot` endi async — tokenni Telegram'da tekshirib
      //    ko'radi. `await` bo'lmasa "Bot initialized" yozuvi
      //    tekshiruv natijasidan OLDIN chiqib, yaroqsiz tokenda
      //    ham "hammasi joyida" degan taassurot qoldirardi.
      // ⚠️ `app` EMAS, `botWebhook` uzatiladi — yuqoridagi izohga
      //    qarang. Router'da ham `.post()` bor, bot/bot.js ga
      //    o'zgartirish kerak emas.
      const { initBot } = require('./bot/bot');
      if (typeof initBot === 'function') await initBot(botWebhook);
    } catch (e) {
      console.warn('⚠️  bot init topilmadi yoki xato berdi:', e.message || e);
    }

    // ── CRON ────────────────────────────────────────────────
    // ⚠️ Bazaga ULANGANDAN KEYIN ishga tushiriladi, aks holda
    //    birinchi so'rov ulanishsiz osilib qolardi.
    //
    // ⚠️ `startReminderCron` ilgari YOZILGAN, LEKIN HECH QAYERDA
    //    CHAQIRILMAGAN edi — ya'ni Pro/Premium da sotilayotgan
    //    "oylik Telegram eslatma" xususiyati hech qachon
    //    ishlamagan. Shu yerda ulandi.
    try {
      const { startReminderCron } = require('./cron/reminderCron');
      startReminderCron();
      const { startAccountCleanupCron } = require('./cron/accountCleanupCron');
      startAccountCleanupCron();
      const { startSupportCron } = require('./cron/supportCron');
      startSupportCron();
      const { startCashReportCron } = require('./cron/cashReportCron');
      startCashReportCron();
      const { startChurnDigestCron } = require('./cron/churnDigestCron');
      startChurnDigestCron();
      const { startBillingAlertCron } = require('./cron/billingAlertCron');
      startBillingAlertCron();
    } catch (e) {
      console.error('⚠️  cron ishga tushmadi:', e.message || e);
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
  if (res.headersSent) return next(err);

  // ⚠️ Hajm chegarasidan oshgan tana — bu SERVER xatosi EMAS,
  //    foydalanuvchi xatosi. Ilgari u ham 500 bo'lib chiqardi va
  //    logotip/chek yuklayotgan direktor "Ichki server xatosi"
  //    degan tushunarsiz javob olib, nima qilishni bilmasdi.
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'Fayl juda katta',
    });
  }

  // Buzuq JSON — ham mijoz xatosi
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: "So'rov formati noto'g'ri",
    });
  }

  console.error('Server xatosi:', err && err.message ? err.message : err);
  res.status(500).json({ error: 'Ichki server xatosi' });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} da ishlamoqda`);
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;