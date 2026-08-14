// src/services/supportQr.js
// ════════════════════════════════════════════════════════════
// Mashg'ulotga KELGANINI tasdiqlaydigan QR kod.
//
// OQIM:
//   1. O'quvchi keladi
//   2. Ustoz jadvalidan uning kartochkasini bosadi → ekranda QR
//   3. O'quvchi Mini App'dan skanerlaydi → "keldi" bo'ladi
//   4. Skanerlamasa, vaqt tugagach → "kelmadi" + 3 kun bloklash
//
// ⚠️ QR HAR 10 SONIYADA YANGILANADI. Sababi: aks holda QR ning
//    surati yetarli bo'lardi — o'quvchi kelmasdan, do'stidan
//    rasm so'rab, uydan turib "keldim" qilib qo'yardi. 10 soniya
//    ichida rasm yuborib ulgurish amalda imkonsiz.
//
// ⚠️ KOD BAZAGA YOZILMAYDI. U `bookingId + vaqt oynasi` dan
//    HMAC bilan hisoblanadi. Ya'ni saqlash, tozalash va eskirgan
//    yozuvlar muammosi umuman yo'q — kod o'z-o'zidan "o'ladi".
//
// ⚠️ Kalit sifatida JWT_SECRET ishlatiladi. U server.js da
//    majburiy tekshiriladi, ya'ni bu yerda bo'sh bo'lishi mumkin
//    emas.
// ════════════════════════════════════════════════════════════

const crypto = require("crypto");

/** Bitta kod necha soniya yashaydi */
const WINDOW_SEC = 10;

/**
 * Nechta ORQAGA qarab qabul qilamiz.
 * ⚠️ 1 dan kam bo'lsa: o'quvchi skanerlagan payt oyna almashib
 *    ketsa kod rad etilardi va u qayta-qayta urinardi.
 *    1 dan ko'p bo'lsa: eski kod uzoq yashaydi va yuqoridagi
 *    himoya kuchsizlanadi.
 */
const GRACE_WINDOWS = 1;

const windowAt = (ms) => Math.floor(ms / (WINDOW_SEC * 1000));

/** Berilgan oyna uchun kod */
function codeFor(bookingId, win) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`support:${bookingId}:${win}`)
    .digest("base64url")
    .slice(0, 12);
}

/**
 * Hozirgi QR mazmuni.
 * @returns {{payload: string, code: string, expiresIn: number}}
 */
function currentToken(bookingId, now = Date.now()) {
  const win = windowAt(now);
  const code = codeFor(bookingId, win);
  // Oyna tugashiga qancha qolgani — interfeys shunga qarab yangilaydi
  const expiresIn = WINDOW_SEC * 1000 - (now % (WINDOW_SEC * 1000));

  return {
    // Skanerlanadigan matn. Qisqa — QR zichligi past bo'lsin,
    // xira ekranda ham o'qilsin.
    payload: `LUMO1:${bookingId}:${code}`,
    code,
    expiresIn,
  };
}

/**
 * Skanerlangan matnni tekshiradi.
 * @returns {{ok: true, bookingId: string} | {ok: false, reason: string}}
 */
function verifyPayload(raw, now = Date.now()) {
  const parts = String(raw || "").trim().split(":");
  if (parts.length !== 3 || parts[0] !== "LUMO1") {
    return { ok: false, reason: "QR kod tanilmadi" };
  }

  const [, bookingId, code] = parts;
  if (!/^[a-f0-9]{24}$/i.test(bookingId)) {
    return { ok: false, reason: "QR kod tanilmadi" };
  }

  const win = windowAt(now);
  for (let i = 0; i <= GRACE_WINDOWS; i++) {
    const expected = codeFor(bookingId, win - i);
    // ⚠️ Oddiy `===` emas — solishtirish vaqti bo'yicha sizmasin
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, bookingId };
    }
  }

  return { ok: false, reason: "QR kod eskirgan — ustozdan yangisini so'rang" };
}

module.exports = {
  currentToken,
  verifyPayload,
  WINDOW_SEC,
  GRACE_WINDOWS,
};
