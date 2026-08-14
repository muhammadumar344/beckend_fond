// src/services/telegramAuth.js
// ════════════════════════════════════════════════════════════
// Telegram Mini App `initData` imzosini tekshirish.
//
// BU YER — BUTUN MINI APP'NING QULFI. Agar imzo noto'g'ri
// tekshirilsa, istalgan odam o'zini istalgan foydalanuvchi deb
// tanishtirib, boshqa oilaning bolasining baholarini ko'radi.
// Shuning uchun bu yerda hech qanday "tezroq bo'lsin" yo'q.
//
// QOIDA (Telegram hujjatidan):
//   1. `hash` ni ajratib olamiz, qolgan maydonlarni
//      `key=value` qilib ALIFBO tartibida `\n` bilan ulaymiz
//   2. secret = HMAC_SHA256(kalit: "WebAppData", matn: BOT_TOKEN)
//   3. kutilgan = HMAC_SHA256(kalit: secret, matn: 1-banddagi matn)
//   4. kutilgan === hash bo'lsa — ma'lumot haqiqiy
//
// ⚠️ 2-bandda kalit va matn O'RNI ALMASHIB KETMASIN. Bu eng
//    ko'p uchraydigan xato: kod ishlayotgandek tuyuladi, lekin
//    tekshiruv hech narsani tekshirmaydi.
//
// ⚠️ `auth_date` ham tekshiriladi. Bo'lmasa bir marta o'g'irlangan
//    initData abadiy ishlayverardi (replay hujumi).
// ════════════════════════════════════════════════════════════

const crypto = require("crypto");

// initData qancha vaqt yaroqli. Telegram ilovasi ochiq turganda
// uni yangilamaydi, shuning uchun juda qisqa qilib bo'lmaydi.
const MAX_AGE_SEC = 24 * 60 * 60;

/**
 * @param {string} initData  `window.Telegram.WebApp.initData`
 * @param {string} botToken
 * @param {object} [opts]  { maxAgeSec }
 * @returns {{ok: true, user: object, authDate: Date} | {ok: false, reason: string}}
 */
function verifyInitData(initData, botToken, opts = {}) {
  if (!botToken) return { ok: false, reason: "Bot tokeni sozlanmagan" };
  if (!initData || typeof initData !== "string") {
    return { ok: false, reason: "initData yo'q" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "Imzo yo'q" };

  // 1) hash'dan tashqari hamma narsa, alifbo tartibida
  const pairs = [];
  for (const [k, v] of params) {
    if (k === "hash") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // 2) va 3)
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  // ⚠️ Oddiy `===` emas: solishtirish vaqti bo'yicha sizib chiqishi
  //    mumkin. Uzunliklar teng bo'lmasa timingSafeEqual otadi.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Imzo mos kelmadi" };
  }

  // 4) Eskirganmi
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) return { ok: false, reason: "auth_date yo'q" };
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  const maxAge = opts.maxAgeSec || MAX_AGE_SEC;
  if (ageSec > maxAge) {
    return { ok: false, reason: "Ma'lumot eskirgan, ilovani qayta oching" };
  }
  // Kelajakdagi sana — soat farqiga biroz yon beramiz
  if (ageSec < -300) {
    return { ok: false, reason: "auth_date noto'g'ri" };
  }

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return { ok: false, reason: "user maydonini o'qib bo'lmadi" };
  }
  if (!user || !user.id) return { ok: false, reason: "Foydalanuvchi yo'q" };

  return {
    ok: true,
    user: {
      id: String(user.id),
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      username: user.username || "",
      languageCode: user.language_code || "",
    },
    authDate: new Date(authDate * 1000),
  };
}

module.exports = { verifyInitData, MAX_AGE_SEC };
