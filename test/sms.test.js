// test/sms.test.js
// ════════════════════════════════════════════════════════════
// "SMS eslatma" PREMIUM TARIFDA SOTILADI, lekin integratsiya
// yozilmagan. Eski `smsService` har bir o'quvchi uchun jimgina
// `status: 'failed'` qaytarardi va endpoint buni `success: true`
// bilan yuborardi — pul to'lagan direktor "0 yuborildi" ni
// ko'rib, sababini bilmasdi.
//
// Bu test SOXTA MUVAFFAQIYAT qaytmasligini qulflaydi.
// Payme/Click va platforma kartasi bilan bir xil qoida.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const read = (rel) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

test("kalitsiz holatda `configured: false`", () => {
  for (const k of ["SMS_PROVIDER", "SMS_EMAIL", "SMS_PASSWORD", "SMS_SENDER"])
    delete process.env[k];
  delete require.cache[require.resolve("../src/config/sms")];

  const sms = require("../src/config/sms");
  assert.equal(sms.configured, false);
});

test("YARIM to'ldirilgan sozlama ham `configured: false`", () => {
  // ⚠️ Yarmi to'ldirilgan sozlama provayderga ulanishga urinib,
  //    har bir SMS uchun xato qaytarardi — "o'chiq" dan ham yomon.
  process.env.SMS_PROVIDER = "eskiz";
  process.env.SMS_EMAIL = "a@b.uz";
  delete process.env.SMS_PASSWORD;
  delete process.env.SMS_SENDER;
  delete require.cache[require.resolve("../src/config/sms")];

  assert.equal(require("../src/config/sms").configured, false);

  delete process.env.SMS_PROVIDER;
  delete process.env.SMS_EMAIL;
  delete require.cache[require.resolve("../src/config/sms")];
});

test("sozlanmagan holatda XATO tashlaydi, `failed` ro'yxati emas", async () => {
  delete require.cache[require.resolve("../src/config/sms")];
  delete require.cache[require.resolve("../src/services/smsService")];
  const svc = require("../src/services/smsService");

  assert.equal(svc.isConfigured(), false);

  await assert.rejects(
    () => svc.sendBulkReminders([{ _id: "1", name: "A", parentPhone: "90" }]),
    (e) => e.status === 503,
    "503 bilan yiqilishi kerak",
  );
  await assert.rejects(() => svc.sendSingle("90", "salom"), (e) => e.status === 503);
});

test("eski 'soxta muvaffaqiyat' naqshi qaytib kelmasin", () => {
  const src = read("src/services/smsService.js");

  // Izohdagi tushuntirish emas, HAQIQIY kod qaralsin
  const code = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

  assert.ok(
    !/status:\s*['"]failed['"]/.test(code),
    "har bir o'quvchi uchun jimgina `failed` qaytarilmasin",
  );
  assert.ok(
    !/return\s*\{\s*success:\s*false/.test(code),
    "sozlanmaganlik XATO bo'lib chiqsin — chaqiruvchi 503 qaytaradi",
  );
});

test("controller SMS ni yuborishdan OLDIN tekshiradi", () => {
  const src = read("src/controllers/teacherController.js");
  const i = src.indexOf("const sendSmsReminders");
  assert.ok(i > 0);
  const body = src.slice(i, i + 3000);

  const guard = body.indexOf("smsService.isConfigured()");
  const send = body.indexOf("smsService.sendBulkReminders");
  assert.ok(guard > 0, "isConfigured tekshiruvi bo'lishi kerak");
  assert.ok(guard < send, "tekshiruv yuborishdan OLDIN turishi kerak");
  assert.ok(/503/.test(body.slice(guard - 400, guard + 400)), "503 qaytarilsin");
});

test("obuna javobida SMS holati bor — sahifa oldindan aytsin", () => {
  const src = read("src/controllers/teacherController.js");
  assert.ok(
    /channels:\s*\{[\s\S]{0,200}sms:\s*\{\s*configured/.test(src),
    "GET /teacher/subscription `channels.sms.configured` qaytarishi kerak",
  );
});
