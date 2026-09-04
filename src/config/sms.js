// src/config/sms.js
// ════════════════════════════════════════════════════════════
// SMS PROVAYDERI — hozircha O'CHIQ.
//
// ⚠️ "SMS eslatma" PREMIUM TARIFDA SOTILADI (`planHelper` →
//    `sms_reminder: true`, obuna sahifasida alohida qator).
//    Lekin integratsiya umuman yozilmagan: `smsService` har bir
//    o'quvchi uchun `status: 'failed'` qaytarardi va endpoint
//    buni `success: true` bilan yuborardi.
//
//    Ya'ni Premium sotib olgan direktor tugmani bosib "0
//    yuborildi, 25 muvaffaqiyatsiz" ni ko'rardi va nima
//    noto'g'ri ekanini bilmasdi: raqamlar xatomi, balansmi,
//    tizimmi? Javob — hech qaysi biri: xizmat umuman yo'q edi.
//
// ⚠️ SOXTA MUVAFFAQIYAT — ENG YOMON HOLAT. Payme/Click bilan
//    bir xil qoida: kalit yo'q → **503 va halol xabar**, urinib
//    ko'rilmaydi. Yarim sozlangan holatda ish qilyapmiz deb
//    ko'rsatmaymiz.
//
// YOQISH UCHUN — Render → Environment:
//   SMS_PROVIDER=eskiz          (yoki playmobile)
//   SMS_EMAIL=...               (eskiz: login)
//   SMS_PASSWORD=...
//   SMS_SENDER=4546             (tasdiqlangan jo'natuvchi nomi)
//
// ⚠️ Kalitlarni bu yerga YOZMANG — faqat `process.env`.
// ════════════════════════════════════════════════════════════

const env = process.env;

const provider = (env.SMS_PROVIDER || "").trim().toLowerCase();
const email = (env.SMS_EMAIL || "").trim();
const password = (env.SMS_PASSWORD || "").trim();
const sender = (env.SMS_SENDER || "").trim();

// ⚠️ TO'RTTASI HAM bo'lishi shart. Yarmi to'ldirilgan sozlama
//    provayderga ulanishga urinib, har bir SMS uchun xato
//    qaytarardi — bu "o'chiq" dan ham yomon.
const configured = Boolean(provider && email && password && sender);

module.exports = { configured, provider, email, password, sender };
