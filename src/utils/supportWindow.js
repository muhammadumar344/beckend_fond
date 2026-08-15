// src/utils/supportWindow.js
// ════════════════════════════════════════════════════════════
// QACHONGA yozilish mumkin — YAGONA manba.
//
//   bugun          → MUMKIN EMAS
//   ertaga … +7 kun → mumkin
//
// ⚠️ NEGA BUGUNGA YOZILMAYDI: o'quvchi mavzuni yozib qoldiradi
//    va support ustozi unga TAYYORLANISHI kerak. Bir soatdan
//    keyin boshlanadigan mashg'ulotga "logarifm tushunmadim"
//    deb yozib qo'ysa, ustoz tayyorlanolmaydi va uchrashuv
//    behuda o'tadi. Bir kun oldindan bilish — butun g'oyaning
//    ma'nosi shunda.
//
// ⚠️ NEGA 7 KUN: undan uzoqqa yozilgan o'quvchining ko'pi
//    esidan chiqaradi yoki rejasi o'zgaradi. Kelmasa esa
//    3 kun bloklanadi — ya'ni uzoq muddat faqat jazoni
//    ko'paytiradi, foyda bermaydi.
//
// ⚠️ CHEKLOV FAQAT INTERFEYSDA BO'LMASIN. Tugmani yashirish
//    himoya emas: so'rovni qo'lda yuborib istalgan sanaga
//    yozib qo'yish mumkin. Shuning uchun `bookSlot` shu
//    yerdagi `isBookable` ni chaqiradi.
//
// ⚠️ Vaqt mintaqasi: Toshkent (UTC+5, yil davomida o'zgarmaydi).
//    Serverning o'z mintaqasiga tayanmaymiz — Render UTC da
//    ishlaydi va kechqurun soat 19:00 dan keyin "ertaga" bir
//    kun surilib ketardi.
// ════════════════════════════════════════════════════════════

const MIN_DAYS_AHEAD = 1; // ertadan
const MAX_DAYS_AHEAD = 7; // shu kunni ham qo'shib

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Toshkent bo'yicha bugungi sana, "YYYY-MM-DD" */
function todayInTashkent(now = Date.now()) {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + n kun */
function addDays(dateStr, n) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Ikki sana orasidagi kunlar farqi (b − a) */
function daysBetween(a, b) {
  const p = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / 86400000);
}

/**
 * Yozilish mumkin bo'lgan sanalar ro'yxati.
 * @returns {string[]}  ["2026-08-16", … ] — 7 ta
 */
function bookableDates(now = Date.now()) {
  const today = todayInTashkent(now);
  const out = [];
  for (let i = MIN_DAYS_AHEAD; i <= MAX_DAYS_AHEAD; i++) {
    out.push(addDays(today, i));
  }
  return out;
}

/**
 * Sana oynaga tushadimi.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
function isBookable(date, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, error: "Sana noto'g'ri" };
  }

  const diff = daysBetween(todayInTashkent(now), date);

  if (diff < MIN_DAYS_AHEAD) {
    // Bugun va o'tgan kunlar bitta xabar bilan rad etiladi:
    // o'quvchiga farqi yo'q, ikkalasida ham javob bir xil.
    return {
      ok: false,
      error: "Bugunga yozilib bo'lmaydi — eng erta ertangi kunga",
    };
  }
  if (diff > MAX_DAYS_AHEAD) {
    return {
      ok: false,
      error: `Eng ko'pi bilan ${MAX_DAYS_AHEAD} kun oldin yozilish mumkin`,
    };
  }
  return { ok: true };
}

/**
 * Toshkent vaqtidagi sana+soatni epoch ga aylantiradi.
 * @param {string} dateStr "YYYY-MM-DD"
 * @param {string} timeStr "HH:MM"
 */
function tashkentEpoch(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - TASHKENT_OFFSET_MS;
}

/**
 * QR qachon ko'rsatiladi.
 *
 * ⚠️ MASHG'ULOT BOSHLANMAGUNCHA QR BERILMAYDI. Ilgari ustoz uni
 *    istalgan paytda ocha olardi — ya'ni o'quvchi ertalab kelib,
 *    kechqurungi mashg'ulotini "keldim" qilib ketishi mumkin edi.
 *    Butun QR g'oyasining ma'nosi shundaki, u AYNAN o'sha 30
 *    daqiqada, aynan o'sha xonada skanerlanadi.
 *
 * ⚠️ Tugagandan keyin ham berilmaydi: vaqt o'tgach yozuv
 *    "kelmadi" bo'ladi (cron/supportCron.js). Ikkalasi bir xil
 *    chegaraga tayanmasa, cron "kelmadi" deb belgilagan yozuv
 *    uchun QR hali ochiq turardi.
 *
 * @returns {{open, expired, opensAt, closesAt, secondsUntilOpen}}
 */
function qrWindow({ date, startTime, endTime }, now = Date.now()) {
  const opensAt = tashkentEpoch(date, startTime);
  const closesAt = tashkentEpoch(date, endTime);
  return {
    open: now >= opensAt && now < closesAt,
    expired: now >= closesAt,
    opensAt,
    closesAt,
    secondsUntilOpen: Math.max(0, Math.ceil((opensAt - now) / 1000)),
  };
}

module.exports = {
  bookableDates,
  isBookable,
  qrWindow,
  tashkentEpoch,
  todayInTashkent,
  addDays,
  daysBetween,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
};
