// test/billingAlert.test.js
// Oy boshidagi "varaqa yaratilmagan" xabari.
//
// Eng muhim uch qoida:
//   1. HAMMASI JOYIDA — XABAR YO'Q (kassa xabaridagi `problems`
//      bilan bir xil mantiq: xabar kelsa — ish bor).
//   2. SUMMA XABARDA. "3 ta guruh" ni o'qigan odam ertaga
//      qilaman deydi; "7 500 000 so'm so'ralmayapti" ni o'qigan
//      odam hozir qiladi.
//   3. Uzilmas probel (U+00A0) YO'Q — Telegram'dan nusxa
//      olingan son qidiruvda topilishi kerak.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  buildAlert,
  crmLink,
  MAX_ROWS,
} = require("../src/services/billingAlert");

// ⚠️ IZOHLAR OLIB TASHLANADI. Busiz test SOXTA YASHIL bo'lardi:
//    `// startBillingAlertCron();` ham naqshga tushardi, ya'ni
//    ulanish o'chirilgan holda ham test o'tib ketardi. Aynan
//    shunday bo'lgan — buzib sinaganda topildi.
const code = (rel) =>
  fs
    .readFileSync(path.join(__dirname, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const grp = (over = {}) => ({
  name: "9-A",
  studentCount: 12,
  amount: 300000,
  ...over,
});

// ── Yuboriladimi ────────────────────────────────────────────

test("varaqasiz guruh yo'q — xabar yo'q", () => {
  const r = buildAlert({ centerName: "Lumo", month: 9, groups: [] });
  assert.equal(r.hasGaps, false);
  assert.equal(r.count, 0);
});

test("varaqasiz guruh bor — xabar bor", () => {
  const r = buildAlert({ centerName: "Lumo", month: 9, groups: [grp()] });
  assert.equal(r.hasGaps, true);
  assert.equal(r.count, 1);
});

// ── Matn ────────────────────────────────────────────────────

test("guruh nomi va o'quvchi soni xabarda", () => {
  const { text } = buildAlert({
    centerName: "Najot",
    month: 9,
    groups: [grp({ name: "10-B", studentCount: 7 })],
  });
  assert.match(text, /10-B/);
  assert.match(text, /7 o'quvchi/);
  assert.match(text, /Najot/);
});

test("oy nomi o'zbekcha, raqam emas", () => {
  const { text } = buildAlert({ centerName: "L", month: 9, groups: [grp()] });
  assert.match(text, /sentabr/);
  // ⚠️ Ilgari bu yerda `Intl` ishlatilsa "M09" chiqardi —
  //    o'zbek lug'ati yo'q brauzer/Node'da aynan shunday bo'ladi.
  assert.doesNotMatch(text, /M09|September/);
});

test("har bir oy uchun nom bor (12 tasi ham)", () => {
  for (let m = 1; m <= 12; m++) {
    const { text } = buildAlert({ centerName: "L", month: m, groups: [grp()] });
    // "N ta guruhga <oy> oyi uchun" — oy nomi bo'sh qolmasin
    assert.match(text, /uchun varaqa yaratilmagan/);
    assert.doesNotMatch(text, /\s{2}oyi/, `oy ${m} nomsiz qoldi`);
  }
});

// ── Summa ───────────────────────────────────────────────────

test("taxminiy summa = o'quvchi × narx, hamma guruh bo'yicha", () => {
  const { text } = buildAlert({
    centerName: "L",
    month: 9,
    groups: [
      grp({ studentCount: 12, amount: 300000 }), // 3 600 000
      grp({ name: "10-B", studentCount: 8, amount: 250000 }), // 2 000 000
    ],
  });
  assert.match(text, /5 600 000/);
});

test("narxi belgilanmagan guruh summani buzmaydi", () => {
  const { text } = buildAlert({
    centerName: "L",
    month: 9,
    groups: [grp({ amount: 0 }), grp({ name: "10-B", studentCount: 4, amount: 100000 })],
  });
  assert.match(text, /400 000/);
  assert.doesNotMatch(text, /NaN/);
});

test("summa nolga teng bo'lsa qator umuman yozilmaydi", () => {
  // Narx hech qayerda belgilanmagan markaz — soxta "0 so'm
  // so'ralmayapti" qatori faqat chalg'itardi.
  const { text } = buildAlert({
    centerName: "L",
    month: 9,
    groups: [grp({ amount: 0 })],
  });
  assert.doesNotMatch(text, /so'ralmayapti/);
});

test("uzilmas probel (U+00A0) yo'q", () => {
  // ⚠️ `Intl` uni o'zi qo'yadi. Telegram'da ko'rinishi oddiy
  //    probel, lekin nusxa olingan son qidiruvda topilmaydi.
  const { text } = buildAlert({ centerName: "L", month: 9, groups: [grp()] });
  assert.ok(!text.includes(" "), "uzilmas probel qolib ketdi");
});

// ── Uzunlik ─────────────────────────────────────────────────

test("ro'yxat MAX_ROWS bilan cheklanadi va qolgani sanaladi", () => {
  const many = Array.from({ length: MAX_ROWS + 3 }, (_, i) =>
    grp({ name: `G-${i}` }),
  );
  const { text, count } = buildAlert({ centerName: "L", month: 9, groups: many });
  assert.equal(count, MAX_ROWS + 3);
  assert.match(text, new RegExp(`va yana 3 ta`));
  assert.ok(!text.includes(`G-${MAX_ROWS + 1}`), "chegaradan oshgan guruh chiqib ketdi");
});

test("summa CHEGARADAN OSHGANLARNI ham qo'shadi", () => {
  // ⚠️ Ro'yxat qisqaradi, PUL esa qisqarmaydi. Faqat
  //    ko'rsatilgan 8 tasini qo'shsak, xabar yo'qotishni
  //    kamaytirib ko'rsatardi — ya'ni yolg'on gapirardi.
  const many = Array.from({ length: 10 }, (_, i) =>
    grp({ name: `G-${i}`, studentCount: 1, amount: 100000 }),
  );
  const { text } = buildAlert({ centerName: "L", month: 9, groups: many });
  // 10 × 100 000 = 1 000 000; faqat ko'rsatilgan 8 tasi qo'shilsa 800 000
  assert.match(text, /1 000 000/);
  assert.doesNotMatch(text, /800 000/);
});

// ── Havola ──────────────────────────────────────────────────

test("havola rejimga qarab boshqa sahifaga boradi", () => {
  // ⚠️ Bitta manzil yozsak, yarim foydalanuvchi bosib
  //    "sahifa topilmadi" olardi.
  assert.match(crmLink(true), /\/lc\/payments$/);
  assert.match(crmLink(false), /\/teacher\/payments$/);
});

test("havola berilmasa xabar baribir to'liq", () => {
  const { text } = buildAlert({ centerName: "L", month: 9, groups: [grp()] });
  assert.match(text, /Hammasiga yaratish/);
  assert.doesNotMatch(text, /undefined/);
});

// ── Ulanish (yozilgan-u ulanmagan bo'lib qolmasin) ──────────

test("cron server.js da ishga tushiriladi", () => {
  // ⚠️ Bu loyihada `startReminderCron` yozilgan-u hech qayerdan
  //    chaqirilmagan holda oylab turgan — sotilayotgan xususiyat
  //    umuman ishlamagan. Shu sababli ulanishning O'ZI test.
  assert.match(code("../src/server.js"), /startBillingAlertCron\(\)/);
});

test("rejim sozlash route'ga ulangan", () => {
  const src = code("../src/routes/teacher.js");
  assert.match(src, /telegram\/director\/billing-mode/);
  assert.match(src, /setBillingAlertMode/);
});

test("cron filtri `$ne: \"off\"` — mavjud hisoblar ham qamraladi", () => {
  // ⚠️ Mongoose standart qiymatni faqat `save()` da yozadi.
  //    `"billingAlert.mode": "monthly"` deb qidirsak, xususiyat
  //    faqat YANGI hisoblarda ishlardi va buni hech kim
  //    sezmasdi — xabar kelmasligi xatoga o'xshamaydi.
  assert.match(
    code("../src/cron/billingAlertCron.js"),
    /"billingAlert\.mode":\s*\{\s*\$ne:\s*"off"\s*\}/,
  );
});
