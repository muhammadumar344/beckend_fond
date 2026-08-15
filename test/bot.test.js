// test/bot.test.js
// ════════════════════════════════════════════════════════════
// Bot matnlari, klaviaturalari va Mini App manzili.
//
// ⚠️ Bu yerda bazaga tegadigan oqim (raqam solishtirish, kod
//    tekshirish) sinalmaydi — u uchun jonli MongoDB kerak.
//    Sinaladigani: TIL TANLASH, MATN TO'LIQLIGI va MANZIL
//    YASASH. Aynan shu uchtasi jimgina buziladi va faqat
//    foydalanuvchi shikoyat qilganda bilinadi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");

const { t, langOf, PACKS } = require("../src/bot/texts");
const {
  phoneKeyboard,
  mainKeyboard,
  confirmResetKeyboard,
} = require("../src/bot/keyboards");
const { appUrl } = require("../src/bot/handlers");

// ── Til tanlash ─────────────────────────────────────────────
test("ruscha telefonli foydalanuvchi ruscha javob oladi", () => {
  assert.strictEqual(langOf({ language_code: "ru" }), "ru");
  assert.strictEqual(langOf({ language_code: "ru-RU" }), "ru");
  assert.strictEqual(langOf({ language_code: "RU" }), "ru");
});

test("qolgan hamma til — o'zbekcha", () => {
  assert.strictEqual(langOf({ language_code: "uz" }), "uz");
  assert.strictEqual(langOf({ language_code: "en" }), "uz");
  assert.strictEqual(langOf({}), "uz");
  assert.strictEqual(langOf(undefined), "uz");
});

// ── Matnlar ─────────────────────────────────────────────────
test("⚠️ uz va ru kalitlari bir xil — tarjimasi unutilmasin", () => {
  const uz = Object.keys(PACKS.uz).sort();
  const ru = Object.keys(PACKS.ru).sort();
  assert.deepStrictEqual(
    ru,
    uz,
    "ru paketida yetishmayotgan yoki ortiqcha kalit bor",
  );
});

test("hech bir matn bo'sh emas", () => {
  for (const [lang, pack] of Object.entries(PACKS)) {
    for (const [key, val] of Object.entries(pack)) {
      const text = typeof val === "function" ? val("test") : val;
      assert.ok(
        typeof text === "string" && text.trim().length > 0,
        `${lang}.${key} bo'sh`,
      );
    }
  }
});

test("noma'lum tilda o'zbekchaga qaytadi", () => {
  assert.strictEqual(t("de", "btnHelp"), PACKS.uz.btnHelp);
});

test("o'zgaruvchili matn qiymatni joyiga qo'yadi", () => {
  assert.ok(t("uz", "phoneNotFound", "+998901234567").includes("+998901234567"));
  assert.ok(t("ru", "codeTooMany", 42).includes("42"));
});

// ── Klaviaturalar ───────────────────────────────────────────
test("raqam tugmasi Telegram'dan kontakt so'raydi", () => {
  const kb = phoneKeyboard("uz");
  assert.strictEqual(kb.keyboard[0][0].request_contact, true);
});

test("⚠️ raqam klaviaturasi bir bosishdan keyin yo'qolmaydi", () => {
  // Ilgari `one_time_keyboard: true` edi: raqami ro'yxatda
  // topilmagan ota-ona qayta urina olmasdi va nima qilishni
  // bilmay qolardi.
  assert.notStrictEqual(phoneKeyboard("uz").one_time_keyboard, true);
});

test("manzil bo'lsa 'Ochish' tugmasi web_app bo'ladi", () => {
  const kb = mainKeyboard("uz", "https://x.uz/tma.html");
  const open = kb.inline_keyboard[0][0];
  assert.strictEqual(open.web_app.url, "https://x.uz/tma.html");
});

test("⚠️ manzil sozlanmagan bo'lsa buzuq tugma ko'rsatilmaydi", () => {
  const kb = mainKeyboard("uz", "");
  const flat = kb.inline_keyboard.flat();
  assert.ok(!flat.some((b) => b.web_app), "web_app tugmasi chiqib qolgan");
  // Lekin qolgan tugmalar joyida — ekran bo'sh qolmaydi
  assert.ok(flat.some((b) => b.callback_data === "relink"));
});

test("menyuda har doim qayta bog'lanish yo'li bor", () => {
  const flat = mainKeyboard("ru", "https://x.uz/tma.html").inline_keyboard.flat();
  assert.ok(flat.some((b) => b.callback_data === "relink"));
  assert.ok(flat.some((b) => b.callback_data === "help"));
});

test("tasdiq klaviaturasida ha va yo'q bor", () => {
  const flat = confirmResetKeyboard("uz").inline_keyboard.flat();
  assert.deepStrictEqual(
    flat.map((b) => b.callback_data).sort(),
    ["relink_no", "relink_yes"],
  );
});

// ── Mini App manzili ────────────────────────────────────────
test("TMA_URL asosiy shakli — /tma.html qo'shiladi", () => {
  process.env.TMA_URL = "https://schoolfonds.uz";
  assert.strictEqual(appUrl(), "https://schoolfonds.uz/tma.html");
});

test("⚠️ to'liq manzil yozilsa ikki marta qo'shilmaydi", () => {
  process.env.TMA_URL = "https://schoolfonds.uz/tma.html";
  assert.strictEqual(appUrl(), "https://schoolfonds.uz/tma.html");
});

test("oxiridagi qiyshiq chiziq ahamiyatsiz", () => {
  process.env.TMA_URL = "https://schoolfonds.uz/";
  assert.strictEqual(appUrl(), "https://schoolfonds.uz/tma.html");
});

test("⚠️ http rad etiladi — Telegram uni ochmaydi", () => {
  process.env.TMA_URL = "http://schoolfonds.uz";
  assert.strictEqual(appUrl(), "");
});

test("TMA_URL bo'sh bo'lsa FRONTEND_URL dan birinchisi olinadi", () => {
  process.env.TMA_URL = "";
  process.env.FRONTEND_URL = "https://a.netlify.app, http://localhost:3000";
  assert.strictEqual(appUrl(), "https://a.netlify.app/tma.html");
});

test("ikkalasi ham bo'sh bo'lsa manzil yo'q", () => {
  process.env.TMA_URL = "";
  process.env.FRONTEND_URL = "";
  assert.strictEqual(appUrl(), "");
});
