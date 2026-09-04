// test/phone.test.js
// Telefon raqamini solishtirish va QIDIRUV naqshi.
//
// ⚠️ Bu yerdagi asosiy qoida bitta: bazada raqam qanday
//    yozilgan bo'lsa ham topilsin. O'zbekistonda bir xil raqam
//    kamida to'rt xil ko'rinishda yoziladi:
//      +998 90 123 45 67   901234567   90 123-45-67   +998901234567
//    To'g'ridan-to'g'ri solishtirish deyarli hech qachon mos
//    kelmaydi.
const test = require("node:test");
const assert = require("node:assert/strict");

const { phoneKey, samePhone, phoneSearchRegex } = require("../src/utils/phone");

// Bazada uchraydigan haqiqiy yozuvlar
const STORED = [
  "+998 90 123 45 67",
  "901234567",
  "90 123-45-67",
  "+998901234567",
  "(90) 123 45 67",
];

// ── phoneKey ────────────────────────────────────────────────

test("turli yozuvlar bitta kalitga tushadi", () => {
  for (const p of STORED) assert.equal(phoneKey(p), "901234567", p);
});

test("juda qisqa raqam kalit bermaydi", () => {
  assert.equal(phoneKey("123"), "");
  assert.equal(phoneKey(""), "");
  assert.equal(phoneKey(null), "");
});

test("samePhone turli yozuvlarni tenglashtiradi", () => {
  assert.ok(samePhone("+998 90 123 45 67", "901234567"));
  assert.ok(!samePhone("901234567", "901234568"));
  // ⚠️ Bo'sh raqam hech kimga teng emas — aks holda telefoni
  //    yo'q ikki o'quvchi "bitta odam" bo'lib qolardi.
  assert.ok(!samePhone("", ""));
});

// ── phoneSearchRegex ────────────────────────────────────────

test("to'liq raqam bilan qidirilganda hamma yozuv topiladi", () => {
  const rx = phoneSearchRegex("901234567");
  for (const p of STORED) assert.ok(rx.test(p), p);
});

test("mamlakat kodi bilan yozilsa ham topiladi", () => {
  // ⚠️ 998 bazada bo'lmasligi mumkin — oxirgi 9 ta raqam olinadi
  const rx = phoneSearchRegex("+998901234567");
  for (const p of STORED) assert.ok(rx.test(p), p);
});

test("yozayotganda ham topiladi (qisman raqam)", () => {
  const rx = phoneSearchRegex("9012");
  for (const p of STORED) assert.ok(rx.test(p), p);
});

test("probel va tire bilan yozilgan so'rov ham ishlaydi", () => {
  const rx = phoneSearchRegex("90 123-45");
  for (const p of STORED) assert.ok(rx.test(p), p);
});

test("boshqa raqam topilmaydi", () => {
  const rx = phoneSearchRegex("935556677");
  for (const p of STORED) assert.ok(!rx.test(p), p);
});

test("ism yozilsa naqsh yo'q — qidiruv ism bo'yicha ketadi", () => {
  assert.equal(phoneSearchRegex("Ali"), null);
  assert.equal(phoneSearchRegex(""), null);
  // Ikkitadan kam raqam ham telefon emas
  assert.equal(phoneSearchRegex("9-A"), null);
});

// ── Ulanish: controller uni haqiqatan ishlatadimi ────────────

test("qidiruv controlleri phoneSearchRegex ni ishlatadi", () => {
  // ⚠️ Bu loyihada "yozilgan-u ulanmagan" kod yetti marta
  //    takrorlangan. Sof funksiyaning o'zi to'g'ri bo'lsa ham,
  //    controller uni chaqirmasa qidiruv baribir buzuq qoladi.
  const fs = require("fs");
  const path = require("path");
  const src = fs
    .readFileSync(
      path.join(__dirname, "../src/controllers/studentCardController.js"),
      "utf8",
    )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.match(src, /phoneSearchRegex/);
  assert.match(src, /parentPhone:\s*phoneRx/);
});
