// test/markPayment.test.js
// ════════════════════════════════════════════════════════════
// TO'LOV SUMMASINI TAHRIRLASH — ochilgan eshik yopiq qolsin.
//
// ⚠️ NEGA BU TEST BOR: `markPayment` uzoq vaqt route'ga
//    ulanmay turgan edi va shu sababli undagi ikkita teshik
//    ko'rinmasdi:
//
//      1. FILIAL CHEKLOVI YO'Q edi — bitta filialga
//         biriktirilgan administrator boshqa filialning to'lov
//         summasini o'zgartira olardi;
//      2. SUMMA TEKSHIRILMASDI — manfiy son ham, matn ham
//         bazaga tushardi va hisobotlar jimgina buzilardi.
//
//    Endi funksiya ulangan, ya'ni ikkala teshik ham HAQIQIY
//    bo'lardi. Test kodning o'zini qaraydi: himoya olib
//    tashlansa yiqiladi.
//
// ⚠️ Bazaga ulanmaydi — bu loyihadagi hamma test kabi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const controller = read("src/controllers/teacherController.js");
const routes = read("src/routes/teacher.js");

/**
 * `markPayment` funksiyasining tanasi, IZOHLARSIZ.
 *
 * ⚠️ Izohlar olib tashlanadi: bu faylda izohlar kodni tushuntiradi
 *    va ular ichida `payment.amount = amount` kabi MISOL bo'ladi.
 *    Izohsiz qidirmasak, test o'z izohimizni "kod" deb o'qib
 *    soxta xato beradi — aynan shunday bo'ldi ham.
 */
const bodyOf = (src, name) => {
  const start = src.indexOf(`const ${name} = async (req, res) => {`);
  assert.notEqual(start, -1, `${name} topilmadi`);
  const next = src.indexOf("\nconst ", start + 10);
  return src
    .slice(start, next === -1 ? src.length : next)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
};

const markPayment = bodyOf(controller, "markPayment");

test("markPayment route'ga ulangan", () => {
  assert.match(
    routes,
    /router\.put\(\s*"\/payments\/:paymentId"\s*,\s*allowTeacherOrStaff\s*,\s*ctrl\.markPayment\s*\)/,
    "summani tuzatishning boshqa yo'li yo'q — ulanmasa xususiyat yo'qoladi",
  );
});

test("markPayment — `managePayments` huquqini talab qiladi", () => {
  assert.match(
    markPayment,
    /requirePermission\(ctx,\s*"managePayments"\)/,
    "pul maydoni har kimga ochiq bo'lmasin",
  );
});

test("markPayment — FILIAL cheklovini tekshiradi", () => {
  // ⚠️ Shunchaki `ctx.branchFilter` so'zini qidirish YETMAYDI:
  //    u tanada ikki marta uchraydi (shart va solishtirish), ya'ni
  //    shartni `false &&` ga almashtirsangiz ham test o'tib
  //    ketardi. Sinab ko'rildi — aynan shunday bo'ldi.
  //    Shuning uchun butun himoya shakli tekshiriladi.
  assert.match(
    markPayment,
    /if\s*\(\s*ctx\.branchFilter\s*&&[\s\S]{0,160}?String\(payment\.class\.branch\)\s*!==\s*ctx\.branchFilter[\s\S]{0,160}?status\(403\)/,
    "filialga biriktirilgan xodim boshqa filial to'loviga tegmasin",
  );
});

test("markPayment — manfiy summani rad etadi", () => {
  // Tekshiruv `payment.amount` ga YOZISHDAN OLDIN turishi shart
  const guard = markPayment.indexOf("n < 0");
  const write = markPayment.indexOf("payment.amount = ");
  assert.notEqual(guard, -1, "summa tekshiruvi yo'q");
  assert.ok(
    guard < write,
    "tekshiruv yozishdan OLDIN bo'lishi kerak, aks holda buzuq qiymat bazaga tushadi",
  );
});

test("markPayment — summani songa o'giradi", () => {
  assert.match(
    markPayment,
    /payment\.amount = Number\(amount\)/,
    'matn ("50000 ") bazaga tushmasin',
  );
});

test("markPayment — noma'lum statusni rad etadi", () => {
  assert.match(
    markPayment,
    /\["paid",\s*"not_paid"\]\.includes\(status\)/,
    "sxemadan tashqari status yozilmasin",
  );
});

test("markPayment — summa o'zgarishi JURNALGA tushadi", () => {
  // Bu ochilishning yagona himoyasi: kim, qachon, nimadan nimaga
  assert.match(markPayment, /payment\.amount_changed/);
  assert.match(markPayment, /audit\(req, ctx, \{/);
  assert.match(markPayment, /changes/);
});

test("markPayment endi `checkDead` ALLOW ro'yxatida emas", () => {
  const dead = read("src/scripts/checkDead.js");
  const allow = dead.slice(dead.indexOf("const ALLOW"), dead.indexOf("]);"));
  assert.ok(
    !allow.includes('"markPayment"'),
    "ulangandan keyin ro'yxatda qolsa, keyingi o'lik kod yashirinib qoladi",
  );
});
