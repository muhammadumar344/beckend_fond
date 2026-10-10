// src/middleware/rateLimit.js
// ════════════════════════════════════════════════════════════
// So'rov cheklagich — parolni terib topishga (brute force) qarshi.
//
// ⚠️ ILGARI UMUMAN YO'Q EDI. Ya'ni bitta skript soatiga yuz minglab
//    parol sinab ko'ra olardi va hech narsa to'xtatmasdi. Pul va
//    o'quvchi ma'lumoti turgan tizimda bu eng katta ochiq eshik edi.
//
// NEGA `express-rate-limit` emas: bizga sanagich va vaqt oynasi
// kerak, xolos. Loyihada bitta Render instansiyasi ishlaydi,
// shuning uchun xotiradagi sanagich yetarli. Bitta paketdan va
// uning bog'liqliklaridan qutuldik.
//
// ⚠️ CHEKLOVI: server qayta ishga tushsa sanagich nolga qaytadi va
//    bir nechta instansiya bo'lsa har biri o'zicha sanaydi. Agar
//    kelajakda instansiya ko'paysa — Redis kerak bo'ladi.
//    Hozirgi holatda bu himoya yo'qligidan ko'ra beqiyos yaxshi.
// ════════════════════════════════════════════════════════════

/** key → { count, resetAt } */
const buckets = new Map();

// Eskirgan yozuvlarni tozalash — aks holda Map cheksiz o'sardi
const SWEEP_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_MS) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs  Vaqt oynasi
 * @param {number} opts.max       Oynadagi eng ko'p so'rov
 * @param {string} opts.name      Sanagich nomi (turli chekloqlar aralashmasin)
 * @param {(req) => string} [opts.keyBy]  Standart: IP manzil
 * @param {string} [opts.message]
 */
function rateLimit(opts) {
  const {
    windowMs,
    max,
    name,
    keyBy = (req) => req.ip || req.socket?.remoteAddress || "unknown",
    message = "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
  } = opts;

  return function limiter(req, res, next) {
    const now = Date.now();
    sweep(now);

    const id = keyBy(req);
    // keyBy null qaytarsa (masalan email yo'q) — cheklamaymiz,
    // validatsiya baribir 400 beradi
    if (!id) return next();

    const key = `${name}:${id}`;
    let b = buckets.get(key);

    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }

    b.count += 1;

    const left = Math.max(0, max - b.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(left));

    if (b.count > max) {
      const sec = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(sec));
      return res.status(429).json({ success: false, error: message });
    }

    return next();
  };
}

/**
 * Muvaffaqiyatli javobda sanagichni tozalash.
 * Parolni to'g'ri kiritgan odam keyingi safar cheklovga
 * urilib qolmasligi uchun.
 */
function clearKey(name, id) {
  buckets.delete(`${name}:${id}`);
}

/**
 * Express'siz cheklash — bot uchun.
 *
 * ⚠️ KERAK BO'LDI, chunki taklif kodini bot orqali ham kiritish
 *    mumkin va u yerda HECH QANDAY cheklov yo'q edi. Mini App
 *    tomonida (`routes/tma.js`) soatiga 10 ta urinish chegarasi
 *    turardi, bot esa cheksiz qabul qilardi — ya'ni himoya
 *    yonidan aylanib o'tish yo'li ochiq edi. Kod bilan bolaning
 *    baholari ochiladi, demak u parolga teng.
 *
 * @returns {{ok: boolean, retryAfterSec: number}}
 */
function hit(name, id, { windowMs, max }) {
  const now = Date.now();
  sweep(now);
  if (!id) return { ok: true, retryAfterSec: 0 };

  const key = `${name}:${id}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;

  return b.count > max
    ? { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
    : { ok: true, retryAfterSec: 0 };
}

// ── Tayyor cheklovlar ───────────────────────────────────────

/** Email/parol tekshiruvi — IP bo'yicha */
const loginLimiter = rateLimit({
  name: "login-ip",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Juda ko'p kirish urinishi. 15 daqiqadan keyin urinib ko'ring.",
});

/**
 * Email bo'yicha alohida — hujumchi IP almashtirib bitta hisobga
 * hujum qilsa, IP cheklovi uni to'xtatmaydi.
 */
const loginByEmailLimiter = rateLimit({
  name: "login-email",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyBy: (req) =>
    typeof req.body?.email === "string"
      ? req.body.email.toLowerCase().trim()
      : null,
  message: "Bu hisobga juda ko'p urinish bo'ldi. 15 daqiqadan keyin urining.",
});

/** Parol tiklash xati — spam va email enumeratsiyasiga qarshi */
const forgotLimiter = rateLimit({
  name: "forgot",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Juda ko'p so'rov. Bir soatdan keyin urinib ko'ring.",
});

/** Ro'yxatdan o'tish — soxta hisob yaratishga qarshi */
const registerLimiter = rateLimit({
  name: "register",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Juda ko'p ro'yxatdan o'tish urinishi. Keyinroq urining.",
});

/** Rasm yuklash — kattaligi bilan serverni bo'g'ishga qarshi */
const uploadLimiter = rateLimit({
  name: "upload",
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Juda ko'p fayl yuborildi. Birozdan keyin urinib ko'ring.",
});

module.exports = {
  rateLimit,
  clearKey,
  hit,
  loginLimiter,
  loginByEmailLimiter,
  forgotLimiter,
  registerLimiter,
  uploadLimiter,
};
