// test/lang.test.js
// Til middleware'i javobni yuborish payti ushlab qoladi. Agar u
// noto'g'ri ishlasa, xato xabari o'rniga bo'sh yoki "undefined"
// chiqishi mumkin — foydalanuvchi nima bo'lganini bilmay qoladi.
// Shuning uchun asosiy kafolat: tarjima topilmasa MATN O'ZGARMAYDI.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  langMiddleware,
  detectLang,
  translate,
} = require("../src/middleware/lang");
const { MESSAGES } = require("../src/utils/messages");

/** Soxta req — Express'ning req.get() ini taqlid qiladi */
function mkReq({ query = {}, headers = {} } = {}) {
  const lower = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  return { query, get: (h) => lower[h.toLowerCase()] };
}

/** Soxta res — res.json() ga kelgan tanani saqlab qoladi */
/**
 * Soxta res — Express'ga o'xshab `statusCode` va `status()` bor.
 * Bu shart: middleware xato javobini `res.statusCode >= 400`
 * bo'yicha aniqlaydi.
 */
function mkRes() {
  const res = { sent: null, statusCode: 200 };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (body) => {
    res.sent = body;
    return res;
  };
  return res;
}

function run(req) {
  const res = mkRes();
  langMiddleware(req, res, () => {});
  return res;
}

// ── Tilni aniqlash ────────────────────────────────────────────
test("standart til — o'zbekcha", () => {
  assert.equal(detectLang(mkReq()), "uz");
});

test("?lang= eng ustun turadi", () => {
  const req = mkReq({ query: { lang: "en" }, headers: { "X-Lang": "ru" } });
  assert.equal(detectLang(req), "en");
});

test("X-Lang sarlavhasi o'qiladi", () => {
  assert.equal(detectLang(mkReq({ headers: { "X-Lang": "ru" } })), "ru");
});

test("Accept-Language dagi 'ru-RU,ru;q=0.9' → ru", () => {
  const req = mkReq({ headers: { "Accept-Language": "ru-RU,ru;q=0.9" } });
  assert.equal(detectLang(req), "ru");
});

test("qo'llab-quvvatlanmagan til o'zbekchaga tushadi", () => {
  assert.equal(detectLang(mkReq({ query: { lang: "de" } })), "uz");
  assert.equal(detectLang(mkReq({ query: { lang: "" } })), "uz");
  assert.equal(detectLang(mkReq({ query: { lang: "zzz" } })), "uz");
});

// ── Tarjima ───────────────────────────────────────────────────
test("ma'lum xabar tarjima qilinadi", () => {
  assert.equal(translate("Sinf topilmadi", "ru"), "Класс не найден");
  assert.equal(translate("Sinf topilmadi", "en"), "Class not found");
});

test("noma'lum xabar o'zgarishsiz qoladi", () => {
  const s = "Bunday xabar lug'atda yo'q 12345";
  assert.equal(translate(s, "ru"), s);
  assert.equal(translate(s, "en"), s);
});

test("o'zbekcha so'ralganda hech narsa o'zgarmaydi", () => {
  assert.equal(translate("Sinf topilmadi", "uz"), "Sinf topilmadi");
});

// ── Middleware ────────────────────────────────────────────────
test("error maydoni tarjima qilinadi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  res.json({ success: false, error: "Ruxsat yo'q" });
  assert.equal(res.sent.error, "Нет доступа");
});

test("message maydoni tarjima qilinadi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "en" } }));
  res.json({ success: true, message: "Guruh yaratildi" });
  assert.equal(res.sent.message, "Group created");
});

test("boshqa maydonlarga tegilmaydi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  res.json({
    success: true,
    error: "Sinf topilmadi",
    name: "Sinf topilmadi", // xuddi shu matn, lekin ma'lumot maydonida
    students: [{ name: "Ali" }],
  });
  assert.equal(res.sent.error, "Класс не найден");
  assert.equal(res.sent.name, "Sinf topilmadi"); // o'zgarmagan
  assert.equal(res.sent.students[0].name, "Ali");
});

test("shablonli xabar buzilmaydi (o'zbekcha qoladi)", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  res.json({ success: true, message: "5 ta davomat saqlandi" });
  assert.equal(res.sent.message, "5 ta davomat saqlandi");
});

test("massiv javob buzilmaydi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  res.json([{ error: "Sinf topilmadi" }]);
  assert.deepEqual(res.sent, [{ error: "Sinf topilmadi" }]);
});

test("null / matn tana yiqilmaydi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  assert.doesNotThrow(() => res.json(null));
  assert.doesNotThrow(() => res.json("oddiy matn"));
});

test("o'zbekchada ham res.json o'raladi (shakl tenglashtirish uchun)", () => {
  // ⚠️ Ilgari o'zbekchada umuman o'ralmasdi. Endi o'raladi, chunki
  // `error`/`message` tenglashtirish TILDAN QAT'I NAZAR kerak.
  const res = mkRes();
  const before = res.json;
  langMiddleware(mkReq(), res, () => {});
  assert.notEqual(res.json, before);
});

// ── Xato shakli: error ↔ message ──────────────────────────────
// Backend bir xil emas: 81 ta joyda xato `message` da, qolganida
// `error` da. Frontend esa 92 ta joyda faqat `.error` o'qiydi —
// natijada xato sababi ko'rinmasdi.

test("4xx: message → error ga ko'chiriladi", () => {
  const res = run(mkReq());
  res.status(400);
  res.json({ message: "Rol nomi majburiy" });

  assert.equal(res.sent.error, "Rol nomi majburiy");
  assert.equal(res.sent.message, "Rol nomi majburiy");
});

test("4xx: error → message ga ko'chiriladi", () => {
  const res = run(mkReq());
  res.status(404);
  res.json({ success: false, error: "Sinf topilmadi" });

  assert.equal(res.sent.message, "Sinf topilmadi");
  assert.equal(res.sent.error, "Sinf topilmadi");
});

test("5xx da ham ishlaydi", () => {
  const res = run(mkReq());
  res.status(500);
  res.json({ message: "Server xatosi" });
  assert.equal(res.sent.error, "Server xatosi");
});

test("⚠️ 2xx da KO'CHIRILMAYDI — 'Saqlandi' xato bo'lib chiqmasin", () => {
  const res = run(mkReq());
  res.status(200);
  res.json({ success: true, message: "Guruh yaratildi" });

  assert.equal(res.sent.message, "Guruh yaratildi");
  assert.equal(res.sent.error, undefined, "muvaffaqiyatda error paydo bo'lmasin");
});

test("ikkalasi ham bo'lsa o'zgarmaydi", () => {
  const res = run(mkReq());
  res.status(400);
  res.json({ error: "A", message: "B" });

  assert.equal(res.sent.error, "A");
  assert.equal(res.sent.message, "B");
});

test("tenglashtirilgan maydon ham tarjima qilinadi", () => {
  const res = run(mkReq({ headers: { "X-Lang": "ru" } }));
  res.status(404);
  res.json({ message: "Sinf topilmadi" });

  // message → error ko'chadi, keyin IKKALASI ham tarjima bo'ladi
  assert.equal(res.sent.error, "Класс не найден");
  assert.equal(res.sent.message, "Класс не найден");
});

test("req.lang o'rnatiladi", () => {
  const req = mkReq({ headers: { "X-Lang": "en" } });
  langMiddleware(req, mkRes(), () => {});
  assert.equal(req.lang, "en");
});

test("next() har doim chaqiriladi", () => {
  let called = 0;
  langMiddleware(mkReq(), mkRes(), () => called++);
  langMiddleware(mkReq({ headers: { "X-Lang": "ru" } }), mkRes(), () => called++);
  assert.equal(called, 2);
});

// ── Lug'at butunligi ──────────────────────────────────────────
test("har bir kalitda ru va en bor va bo'sh emas", () => {
  for (const [uz, v] of Object.entries(MESSAGES)) {
    assert.ok(v && typeof v === "object", `${uz}: yozuv obyekt emas`);
    assert.ok(v.ru && v.ru.trim(), `${uz}: ru bo'sh`);
    assert.ok(v.en && v.en.trim(), `${uz}: en bo'sh`);
  }
});

test("tarjima o'zbekchaning nusxasi emas", () => {
  for (const [uz, v] of Object.entries(MESSAGES)) {
    assert.notEqual(v.ru, uz, `${uz}: ru tarjima qilinmagan`);
    assert.notEqual(v.en, uz, `${uz}: en tarjima qilinmagan`);
  }
});
