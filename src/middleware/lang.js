// src/middleware/lang.js
// ════════════════════════════════════════════════════════════
// Javobdagi xabarlarni foydalanuvchi tiliga o'giradi.
//
// NEGA MIDDLEWARE, HAR BIR CONTROLLER EMAS?
// Kodda 338 ta joyda o'zbekcha matn yozilgan. Ularning har birini
// `t("kalit")` ga almashtirish — ishlab turgan saytda 338 ta
// tahrir, ya'ni 338 ta xato ehtimoli. Buning o'rniga javob
// yuborilayotgan payt bitta joyda ushlab qolamiz: controller'lar
// avvalgidek o'zbekcha yozaveradi, foydalanuvchi esa o'z tilida
// oladi.
//
// Tarjima topilmasa matn o'zgarmaydi — javob hech qachon
// bo'sh yoki "undefined" bo'lib chiqmaydi.
// ════════════════════════════════════════════════════════════

const { MESSAGES } = require("../utils/messages");

const SUPPORTED = ["uz", "ru", "en"];
const DEFAULT_LANG = "uz";

// Tarjima qilinadigan maydonlar. Boshqa hamma narsa (ma'lumot,
// ismlar, ID'lar) daxlsiz qoladi.
const FIELDS = ["error", "message"];

/**
 * So'rovdan tilni aniqlaydi.
 * Tartib: ?lang= → X-Lang sarlavhasi → Accept-Language → uz
 */
function detectLang(req) {
  const raw =
    req.query?.lang ||
    req.get?.("X-Lang") ||
    req.get?.("Accept-Language") ||
    "";

  // "ru-RU,ru;q=0.9" → "ru"
  const code = String(raw).trim().slice(0, 2).toLowerCase();
  return SUPPORTED.includes(code) ? code : DEFAULT_LANG;
}

/**
 * Bitta matnni tarjima qiladi. Topilmasa — o'zini qaytaradi.
 */
function translate(text, lang) {
  if (lang === DEFAULT_LANG) return text;
  if (typeof text !== "string") return text;

  const entry = MESSAGES[text];
  if (!entry) return text; // lug'atda yo'q → o'zbekcha qoladi
  return entry[lang] || text;
}

/**
 * Express middleware: res.json ni o'rab oladi.
 */
function langMiddleware(req, res, next) {
  const lang = detectLang(req);
  req.lang = lang;

  // O'zbekcha bo'lsa hech narsa qilmaymiz — ortiqcha ish yo'q
  if (lang === DEFAULT_LANG) return next();

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      for (const field of FIELDS) {
        if (typeof body[field] === "string") {
          body[field] = translate(body[field], lang);
        }
      }
    }
    return originalJson(body);
  };

  next();
}

module.exports = { langMiddleware, detectLang, translate, SUPPORTED, DEFAULT_LANG };
