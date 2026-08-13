// test/payments.test.js
// ════════════════════════════════════════════════════════════
// ⚠️ MUHIM: bu testlar to'lov tizimlari BILAN ishlashini
//    isbotlamaydi. Merchant hisobi yo'q, sandbox'da sinalmagan.
//
// Bu yerda tekshiriladigan narsa — pulga tegadigan va bizga
// bog'liq bo'lgan qismlar:
//   • kalit yo'q bo'lsa hech narsa ochiq qolmasligi
//   • soxta imzo/parol o'tib ketmasligi
//   • summa tekshiruvi
//
// Jonli sinov ro'yxati: docs/PAYMENTS.md
// ════════════════════════════════════════════════════════════
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// ⚠️ Modullar env'ni YUKLANGANDA o'qiydi, shuning uchun
// o'zgaruvchilar require'dan OLDIN qo'yilishi shart.
process.env.PAYME_MERCHANT_ID = "test_merchant";
process.env.PAYME_KEY = "test_payme_key";
process.env.CLICK_MERCHANT_ID = "test_click_merchant";
process.env.CLICK_SERVICE_ID = "12345";
process.env.CLICK_SECRET_KEY = "test_click_secret";

const payme = require("../src/services/payments/payme");
const click = require("../src/services/payments/click");
const cfg = require("../src/config/payments");

// ── Konfiguratsiya ────────────────────────────────────────────
test("kalit berilganda provayder yoqiladi", () => {
  assert.equal(cfg.payme.enabled, true);
  assert.equal(cfg.click.enabled, true);
  assert.equal(cfg.anyEnabled(), true);
  assert.deepEqual(
    cfg.enabledProviders().map((p) => p.name).sort(),
    ["click", "payme"],
  );
});

test("Payme tiyinda, Click so'mda ishlaydi", () => {
  // Aralashtirilsa 100 barobar farq bilan pul yechilardi
  assert.equal(cfg.payme.amountMultiplier, 100);
  assert.equal(cfg.click.amountMultiplier, 1);
});

// ── Payme autentifikatsiyasi ──────────────────────────────────
const basic = (login, pass) =>
  "Basic " + Buffer.from(`${login}:${pass}`).toString("base64");

test("Payme: to'g'ri parol o'tadi", () => {
  assert.equal(payme.checkAuth(basic("Paycom", "test_payme_key")), true);
});

test("Payme: noto'g'ri parol o'tmaydi", () => {
  assert.equal(payme.checkAuth(basic("Paycom", "boshqa")), false);
});

test("Payme: noto'g'ri login o'tmaydi", () => {
  assert.equal(payme.checkAuth(basic("Admin", "test_payme_key")), false);
});

test("Payme: buzuq sarlavha yiqilmaydi", () => {
  for (const h of [undefined, "", "Bearer x", "Basic", "Basic !!!", "Basic " + Buffer.from("yoq").toString("base64")]) {
    assert.equal(payme.checkAuth(h), false, `qabul qilindi: ${h}`);
  }
});

test("Payme: uzunligi boshqa parol yiqilmaydi (timingSafeEqual)", () => {
  // timingSafeEqual uzunlik farq qilsa TashlaYDI — oldindan tekshirilishi shart
  assert.doesNotThrow(() => payme.checkAuth(basic("Paycom", "qisqa")));
  assert.equal(payme.checkAuth(basic("Paycom", "juda-juda-uzun-parol-xxx")), false);
});

test("Payme: ruxsatsiz so'rov metodga umuman yetib bormaydi", async () => {
  const res = await payme.handle(
    { id: 1, method: "CreateTransaction", params: { id: "x" } },
    basic("Paycom", "notogri"),
  );
  assert.equal(res.error.code, payme.ERR.INSUFFICIENT_PRIVILEGE);
});

test("Payme: noma'lum metod rad etiladi", async () => {
  const res = await payme.handle(
    { id: 7, method: "DropDatabase", params: {} },
    basic("Paycom", "test_payme_key"),
  );
  assert.equal(res.error.code, payme.ERR.METHOD_NOT_FOUND);
  assert.equal(res.id, 7);
});

test("Payme: JSON-RPC javob shakli to'g'ri", async () => {
  const res = await payme.handle({ id: 42 }, basic("Paycom", "test_payme_key"));
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 42);
  assert.ok(res.error.message.uz, "xabar tarjimalari bo'lishi kerak");
});

// ── Click imzosi ──────────────────────────────────────────────
const clickSign = (p, secret = "test_click_secret") => {
  const parts = [p.click_trans_id, p.service_id, secret, p.merchant_trans_id];
  if (String(p.action) === "1") parts.push(p.merchant_prepare_id);
  parts.push(p.amount, p.action, p.sign_time);
  return crypto.createHash("md5").update(parts.join("")).digest("hex");
};

const prepareParams = (over = {}) => {
  const p = {
    click_trans_id: "111",
    service_id: "12345",
    merchant_trans_id: "507f1f77bcf86cd799439011_pro_1",
    amount: "29000",
    action: "0",
    sign_time: "2026-01-01 10:00:00",
    ...over,
  };
  p.sign_string = clickSign(p);
  return p;
};

test("Click: to'g'ri imzo o'tadi", () => {
  assert.equal(click.checkSign(prepareParams()), true);
});

test("Click: buzilgan imzo o'tmaydi", () => {
  const p = prepareParams();
  p.sign_string = "0".repeat(32);
  assert.equal(click.checkSign(p), false);
});

test("Click: summa o'zgarsa imzo buziladi", () => {
  const p = prepareParams();
  p.amount = "1"; // to'lovchi summani o'zgartirmoqchi
  assert.equal(click.checkSign(p), false);
});

test("Click: boshqa maxfiy kalit bilan imzo o'tmaydi", () => {
  const p = prepareParams();
  p.sign_string = clickSign(p, "o'g'irlangan-kalit");
  assert.equal(click.checkSign(p), false);
});

test("Click: complete imzosi prepare_id ni ham qamraydi", () => {
  const p = {
    click_trans_id: "111",
    service_id: "12345",
    merchant_trans_id: "507f1f77bcf86cd799439011_pro_1",
    merchant_prepare_id: "abc123",
    amount: "29000",
    action: "1",
    sign_time: "2026-01-01 10:00:00",
  };
  p.sign_string = clickSign(p);
  assert.equal(click.checkSign(p), true);

  // prepare_id almashtirilsa imzo mos kelmasligi kerak
  p.merchant_prepare_id = "boshqa";
  assert.equal(click.checkSign(p), false);
});

test("Click: imzosiz so'rov action'ga yetib bormaydi", async () => {
  const res = await click.handle({ click_trans_id: "1", action: "0" });
  assert.equal(res.error, click.ERR.SIGN_CHECK_FAILED);
});

test("Click: noma'lum action rad etiladi", async () => {
  const p = prepareParams({ action: "9" });
  const res = await click.handle(p);
  assert.equal(res.error, click.ERR.ACTION_NOT_FOUND);
});

test("Click: javobda click_trans_id qaytariladi", async () => {
  const res = await click.handle({ click_trans_id: "555", action: "0" });
  assert.equal(res.click_trans_id, "555");
});

// ── To'lov havolasi ───────────────────────────────────────────
test("Payme havolasi merchant va summani o'z ichiga oladi", () => {
  const url = payme.buildCheckoutUrl({
    teacherId: "507f1f77bcf86cd799439011",
    plan: "pro",
    months: 2,
    amountSum: 58000,
  });
  assert.ok(url.startsWith("https://checkout.paycom.uz/"));

  const decoded = Buffer.from(url.split("/").pop(), "base64").toString();
  assert.ok(decoded.includes("m=test_merchant"));
  assert.ok(decoded.includes("ac.teacher_id=507f1f77bcf86cd799439011"));
  // ⚠️ Tiyinda: 58000 so'm = 5800000 tiyin
  assert.ok(decoded.includes("a=5800000"), `tiyin noto'g'ri: ${decoded}`);
});

test("Click havolasi so'mda yuboriladi", () => {
  const url = click.buildCheckoutUrl({
    teacherId: "507f1f77bcf86cd799439011",
    plan: "premium",
    months: 1,
    amountSum: 59000,
  });
  assert.ok(url.includes("amount=59000"), "Click so'mda ishlaydi");
  assert.ok(url.includes("service_id=12345"));
  assert.ok(
    url.includes("transaction_param=507f1f77bcf86cd799439011_premium_1"),
  );
});

// ── Kalitsiz holat (eng muhim kafolat) ────────────────────────
test("kalit yo'q bo'lsa hamma narsa o'chiq", () => {
  // Yangi jarayon — env'siz yuklanadi
  const { execFileSync } = require("child_process");
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `const c=require('./src/config/payments');
       const p=require('./src/services/payments/payme');
       const k=require('./src/services/payments/click');
       console.log(JSON.stringify({
         payme: c.payme.enabled, click: c.click.enabled, any: c.anyEnabled(),
         list: c.enabledProviders().length,
         paymeAuth: p.checkAuth('Basic ' + Buffer.from('Paycom:').toString('base64')),
         clickSign: k.checkSign({ sign_string: 'x' }),
       }));`,
    ],
    {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH }, // to'lov kalitlarisiz
      encoding: "utf8",
    },
  );

  const r = JSON.parse(out.trim().split("\n").pop());
  assert.equal(r.payme, false, "Payme yoqilib qolgan");
  assert.equal(r.click, false, "Click yoqilib qolgan");
  assert.equal(r.any, false);
  assert.equal(r.list, 0);
  // Eng xavflisi: bo'sh kalit bilan autentifikatsiya o'tib ketishi
  assert.equal(r.paymeAuth, false, "bo'sh parol bilan kirib bo'lyapti!");
  assert.equal(r.clickSign, false, "imzosiz so'rov o'tib ketyapti!");
});
