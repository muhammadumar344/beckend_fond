// test/telegramAuth.test.js
// ════════════════════════════════════════════════════════════
// Mini App qulfi. Bu test yiqilsa — begona odam boshqa oilaning
// bolasining baholarini ko'ra oladi degani. Shu sababli bu yerda
// "shunchaki ishlayapti" yetarli emas: soxta imzo, o'zgartirilgan
// maydon va eskirgan ma'lumot ALOHIDA sinaladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { verifyInitData } = require("../src/services/telegramAuth");

const BOT_TOKEN = "123456:TEST-TOKEN-abcdefghijklmnop";

/** Haqiqiy Telegram kabi to'g'ri imzolangan initData yasaydi */
function makeInitData(fields, token = BOT_TOKEN) {
  const params = new URLSearchParams(fields);
  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  const hash = crypto
    .createHmac("sha256", secret)
    .update(pairs.join("\n"))
    .digest("hex");

  params.append("hash", hash);
  return params.toString();
}

const now = () => Math.floor(Date.now() / 1000);

const validUser = () =>
  JSON.stringify({
    id: 555000111,
    first_name: "Aziza",
    last_name: "Karimova",
    username: "aziza",
    language_code: "uz",
  });

test("to'g'ri imzo qabul qilinadi", () => {
  const data = makeInitData({ user: validUser(), auth_date: String(now()) });
  const r = verifyInitData(data, BOT_TOKEN);

  assert.equal(r.ok, true, r.reason);
  assert.equal(r.user.id, "555000111");
  assert.equal(r.user.firstName, "Aziza");
  assert.equal(r.user.username, "aziza");
});

test("BOSHQA bot tokeni bilan imzolangan ma'lumot rad etiladi", () => {
  // Hujumchining o'z boti bor — lekin bizning tokenimiz yo'q
  const data = makeInitData(
    { user: validUser(), auth_date: String(now()) },
    "999999:BOSHQA-TOKEN",
  );
  const r = verifyInitData(data, BOT_TOKEN);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Imzo/);
});

test("maydon o'zgartirilsa imzo buziladi", () => {
  const data = makeInitData({ user: validUser(), auth_date: String(now()) });

  // Foydalanuvchi id sini boshqasiga almashtirishga urinamiz
  const tampered = data.replace("555000111", "555000999");
  assert.notEqual(tampered, data, "test o'zi ishlashi kerak");

  const r = verifyInitData(tampered, BOT_TOKEN);
  assert.equal(r.ok, false, "o'zgartirilgan ma'lumot o'tib ketdi!");
});

test("imzo umuman bo'lmasa rad etiladi", () => {
  const r = verifyInitData(
    `user=${encodeURIComponent(validUser())}&auth_date=${now()}`,
    BOT_TOKEN,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /Imzo yo'q/);
});

test("soxta hash rad etiladi", () => {
  const data =
    makeInitData({ user: validUser(), auth_date: String(now()) }).replace(
      /hash=[a-f0-9]+$/,
      "hash=" + "0".repeat(64),
    );
  const r = verifyInitData(data, BOT_TOKEN);
  assert.equal(r.ok, false);
});

test("eskirgan ma'lumot rad etiladi — takroriy hujumga qarshi", () => {
  const old = now() - 48 * 60 * 60; // 2 kun oldin
  const data = makeInitData({ user: validUser(), auth_date: String(old) });
  const r = verifyInitData(data, BOT_TOKEN);
  assert.equal(r.ok, false);
  assert.match(r.reason, /eskirgan/i);
});

test("muddat sozlanadi — qisqaroq oyna berish mumkin", () => {
  const data = makeInitData({
    user: validUser(),
    auth_date: String(now() - 120),
  });
  assert.equal(verifyInitData(data, BOT_TOKEN).ok, true);
  assert.equal(verifyInitData(data, BOT_TOKEN, { maxAgeSec: 60 }).ok, false);
});

test("kelajakdagi sana rad etiladi", () => {
  const data = makeInitData({
    user: validUser(),
    auth_date: String(now() + 3600),
  });
  const r = verifyInitData(data, BOT_TOKEN);
  assert.equal(r.ok, false);
});

test("bo'sh yoki noto'g'ri kirish yiqitmaydi", () => {
  for (const bad of ["", null, undefined, 42, {}]) {
    const r = verifyInitData(bad, BOT_TOKEN);
    assert.equal(r.ok, false, `${bad} uchun`);
  }
});

test("token sozlanmagan bo'lsa hech narsa o'tmaydi", () => {
  const data = makeInitData({ user: validUser(), auth_date: String(now()) });
  const r = verifyInitData(data, "");
  assert.equal(r.ok, false);
  assert.match(r.reason, /token/i);
});

test("user maydoni buzuq bo'lsa rad etiladi", () => {
  const data = makeInitData({ user: "{buzuq", auth_date: String(now()) });
  const r = verifyInitData(data, BOT_TOKEN);
  assert.equal(r.ok, false);
});
