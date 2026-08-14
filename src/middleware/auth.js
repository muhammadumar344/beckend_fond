// src/middleware/auth.js
// ════════════════════════════════════════════════════════════
// Token tekshiruvi + SEANS HALI HAQIQIYMI degan savol.
//
// ⚠️ Ilgari bu yerda faqat `jwt.verify` bor edi. Ya'ni token bir
//    marta berilgach, 30 kun davomida hech narsa uni to'xtata
//    olmasdi:
//
//      · admin direktorni bloklaydi  → u ishlayveradi
//      · direktor hisobni o'chiradi  → tokeni ishlayveradi
//      · parol o'g'irlangan, egasi   → o'g'ri hamon ichkarida
//        parolni almashtiradi
//
//    Uchalasi ham jiddiy: parolni almashtirish hujumchini
//    chiqarib yuborishi SHART.
//
// ⚠️ TEZLIK: har so'rovda bazaga borish qimmat. Shuning uchun
//    natija 30 soniya keshlanadi. Eng yomon holatda bloklangan
//    foydalanuvchi yana 30 soniya ishlaydi — 30 kunga nisbatan
//    beqiyos yaxshi, va odatiy so'rovga qo'shimcha yuk tushmaydi.
// ════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const Staff = require('../models/Staff');

const CACHE_TTL_MS = 30 * 1000;
const SWEEP_MS = 5 * 60 * 1000;

/** userId → { at, state } */
const cache = new Map();
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_MS) return;
  lastSweep = now;
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
}

/**
 * Hisob holatini oladi (keshdan yoki bazadan).
 * @returns {Promise<null|{ok:boolean, reason?:string, changedAt:number}>}
 *          null — bu rol uchun tekshirish shart emas
 */
async function loadState(role, id) {
  const now = Date.now();
  sweep(now);

  const hit = cache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.state;

  let state;

  if (role === 'teacher') {
    const t = await Teacher.findById(id)
      .select('isActive deletionScheduledFor passwordChangedAt')
      .lean();
    if (!t) state = { ok: false, reason: 'Hisob topilmadi' };
    else if (t.deletionScheduledFor)
      state = { ok: false, reason: "Hisob o'chirish navbatida" };
    else if (!t.isActive) state = { ok: false, reason: 'Akkaunt bloklangan' };
    else state = { ok: true, changedAt: +new Date(t.passwordChangedAt || 0) };
  } else if (role === 'staff') {
    const s = await Staff.findById(id)
      .select('isActive passwordChangedAt')
      .lean();
    if (!s) state = { ok: false, reason: 'Hisob topilmadi' };
    else if (!s.isActive)
      state = { ok: false, reason: 'Xodim hisobi faol emas' };
    else state = { ok: true, changedAt: +new Date(s.passwordChangedAt || 0) };
  } else {
    // Admin — bloklash/o'chirish tushunchasi yo'q, bazaga bormaymiz
    state = null;
  }

  cache.set(id, { at: now, state });
  return state;
}

/** Parol almashganda yoki hisob bloklanganda darhol kuchga kirsin */
function invalidateSession(userId) {
  cache.delete(String(userId));
}

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token mavjud emas' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Token noto'g'ri yoki muddati o'tgan" });
  }

  try {
    const state = await loadState(decoded.role, String(decoded.id));

    if (state) {
      if (!state.ok) {
        return res.status(401).json({ message: state.reason });
      }
      // Parol token berilgandan KEYIN almashgan bo'lsa — token o'lik.
      // `iat` soniyada, `changedAt` millisekundda.
      if (state.changedAt && decoded.iat * 1000 < state.changedAt) {
        return res.status(401).json({
          message: "Parol o'zgargan — qaytadan tizimga kiring",
        });
      }
    }
  } catch (err) {
    // Baza javob bermasa butun API yiqilmasin: token imzosi
    // baribir to'g'ri edi, so'rovni o'tkazamiz va logga yozamiz.
    console.error('[auth] seans tekshiruvi xato berdi:', err.message);
  }

  // decoded ichida: { id, role: 'teacher' | 'staff' | 'admin' }
  req.user = decoded;
  next();
};

module.exports.invalidateSession = invalidateSession;
