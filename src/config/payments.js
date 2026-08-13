// src/config/payments.js
// ════════════════════════════════════════════════════════════
// To'lov tizimlari sozlamasi.
//
// ⚠️ HOZIRCHA IKKALASI HAM O'CHIQ. Merchant shartnomasi yo'q,
//    shuning uchun kalitlar ham yo'q. Kod yozilgan va tayyor —
//    kalit qo'yilishi bilan ishlay boshlaydi.
//
// YOQISH UCHUN (merchant olgandan keyin):
//   Render → Environment ga quyidagilarni qo'shing va qayta
//   deploy qiling. Boshqa hech narsa o'zgartirish shart emas.
//
//   Payme:
//     PAYME_MERCHANT_ID=...      (kabinetdan)
//     PAYME_KEY=...              (kassa kaliti)
//     PAYME_TEST_KEY=...         (ixtiyoriy — sinov uchun)
//
//   Click:
//     CLICK_MERCHANT_ID=...
//     CLICK_SERVICE_ID=...
//     CLICK_SECRET_KEY=...
//     CLICK_MERCHANT_USER_ID=...
//
// Kalit yetishmasa provayder `enabled: false` bo'ladi va uning
// endpoint'lari 503 qaytaradi — yarim sozlangan holatda pul
// qabul qilishga urinmaydi.
// ════════════════════════════════════════════════════════════

const env = process.env;

/** Barcha qiymatlar bo'lsagina true */
const allSet = (...keys) => keys.every((k) => Boolean(env[k] && env[k].trim()));

const payme = {
  name: "payme",
  label: "Payme",
  enabled: allSet("PAYME_MERCHANT_ID", "PAYME_KEY"),
  merchantId: env.PAYME_MERCHANT_ID || "",
  key: env.PAYME_KEY || "",
  testKey: env.PAYME_TEST_KEY || "",
  // Payme summani TIYINDA yuboradi (1 so'm = 100 tiyin)
  amountMultiplier: 100,
  checkoutUrl: "https://checkout.paycom.uz",
};

const click = {
  name: "click",
  label: "Click",
  enabled: allSet("CLICK_MERCHANT_ID", "CLICK_SERVICE_ID", "CLICK_SECRET_KEY"),
  merchantId: env.CLICK_MERCHANT_ID || "",
  serviceId: env.CLICK_SERVICE_ID || "",
  secretKey: env.CLICK_SECRET_KEY || "",
  merchantUserId: env.CLICK_MERCHANT_USER_ID || "",
  // Click so'mda ishlaydi
  amountMultiplier: 1,
  checkoutUrl: "https://my.click.uz/services/pay",
};

const PROVIDERS = { payme, click };

/** Yoqilgan provayderlar ro'yxati (frontend shuni ko'rsatadi) */
function enabledProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => p.enabled)
    .map((p) => ({ name: p.name, label: p.label }));
}

/** Umuman biror to'lov tizimi yoqilganmi */
function anyEnabled() {
  return Object.values(PROVIDERS).some((p) => p.enabled);
}

module.exports = { PROVIDERS, payme, click, enabledProviders, anyEnabled };
