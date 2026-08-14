// test/supportQr.test.js
// ════════════════════════════════════════════════════════════
// QR kod — "keldi" belgisining yagona isboti.
//
// Buzilsa ikki tomonlama yomon: bo'shashsa o'quvchi uydan
// turib "keldim" qilib qo'yadi; qattiq bo'lsa haqiqatan
// kelgan bola skanerlay olmay, 3 kunga bloklanadi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-secret-for-qr";

const {
  currentToken,
  verifyPayload,
  WINDOW_SEC,
} = require("../src/services/supportQr");

const ID = "507f1f77bcf86cd799439011";
const WIN_MS = WINDOW_SEC * 1000;

test("hozirgi kod qabul qilinadi", () => {
  const now = Date.now();
  const { payload } = currentToken(ID, now);
  const r = verifyPayload(payload, now);

  assert.equal(r.ok, true, r.reason);
  assert.equal(r.bookingId, ID);
});

test("⚠️ kod har 10 soniyada o'zgaradi", () => {
  const t0 = 1_700_000_000_000;
  const a = currentToken(ID, t0).code;
  const b = currentToken(ID, t0 + WIN_MS).code;
  const c = currentToken(ID, t0 + 2 * WIN_MS).code;

  assert.notEqual(a, b, "keyingi oynada kod o'sha bo'lib qoldi");
  assert.notEqual(b, c);
});

test("oyna ichida kod o'zgarmaydi", () => {
  // Oyna boshidan 1 va 9 soniya — bir xil kod bo'lishi kerak
  const start = Math.floor(Date.now() / WIN_MS) * WIN_MS;
  assert.equal(
    currentToken(ID, start + 1000).code,
    currentToken(ID, start + 9000).code,
  );
});

test("bitta oyna orqaga qabul qilinadi — skanerlash paytida almashsa", () => {
  const t0 = 1_700_000_000_000;
  const { payload } = currentToken(ID, t0);
  // Foydalanuvchi skanerlaguncha oyna almashdi
  const r = verifyPayload(payload, t0 + WIN_MS);
  assert.equal(r.ok, true, "haqiqiy o'quvchi rad etildi");
});

test("⚠️ ikki oyna orqaga QABUL QILINMAYDI — surat yuborishga qarshi", () => {
  const t0 = 1_700_000_000_000;
  const { payload } = currentToken(ID, t0);
  const r = verifyPayload(payload, t0 + 2 * WIN_MS + 1000);
  assert.equal(r.ok, false, "eski kod o'tib ketdi — QR surati yetarli bo'lardi");
  assert.match(r.reason, /eskirgan/i);
});

test("boshqa yozuvning kodi ishlamaydi", () => {
  const now = Date.now();
  const other = "507f1f77bcf86cd799439022";
  const { code } = currentToken(other, now);

  // Hujumchi kodni o'z bookingId siga yopishtirmoqchi
  const r = verifyPayload(`LUMO1:${ID}:${code}`, now);
  assert.equal(r.ok, false);
});

test("o'zgartirilgan kod rad etiladi", () => {
  const now = Date.now();
  const { payload } = currentToken(ID, now);
  const broken = payload.slice(0, -1) + (payload.slice(-1) === "A" ? "B" : "A");
  assert.equal(verifyPayload(broken, now).ok, false);
});

test("begona QR kodlar rad etiladi", () => {
  for (const bad of [
    "",
    null,
    undefined,
    "https://example.com",
    "LUMO1:xxx:yyy",
    "LUMO1:507f1f77bcf86cd799439011", // kod yo'q
    "BOSHQA:507f1f77bcf86cd799439011:abc",
    "LUMO1::",
  ]) {
    const r = verifyPayload(bad);
    assert.equal(r.ok, false, `${bad} o'tib ketdi`);
    assert.ok(r.reason, "sabab bo'lishi kerak");
  }
});

test("payload qisqa — QR zich bo'lib ketmasin", () => {
  const { payload } = currentToken(ID);
  assert.ok(
    payload.length < 50,
    `payload ${payload.length} belgi — QR o'qilmay qolishi mumkin`,
  );
});

test("expiresIn oyna oxirigacha qolgan vaqtni beradi", () => {
  const start = Math.floor(Date.now() / WIN_MS) * WIN_MS;
  assert.equal(currentToken(ID, start).expiresIn, WIN_MS);
  assert.equal(currentToken(ID, start + 3000).expiresIn, WIN_MS - 3000);
  assert.ok(currentToken(ID, start + 9999).expiresIn > 0);
});
