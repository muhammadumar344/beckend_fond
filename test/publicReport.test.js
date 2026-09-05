// test/publicReport.test.js
// Ota-onalar ko'radigan hisobot.
//
// ⚠️ Bu yerdagi formula noto'g'ri bo'lsa, xato eng ko'rinadigan
//    joyda chiqadi: bir vaqtning o'zida 30 ta ota-onaning
//    telefonida. Shuning uchun sof funksiya va qattiq test.
const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPublicReport } = require("../src/services/publicReport");

const base = {
  cls: { name: "9-A", initialBalance: 0 },
  centerName: "12-maktab",
  month: 9,
  year: 2026,
  payments: [
    { amount: 50000, status: "paid" },
    { amount: 50000, status: "paid" },
    { amount: 50000, status: "not_paid" },
  ],
  expenses: [
    { reason: "Marker", amount: 30000, spentDate: "2026-09-03" },
    { reason: "Suv", amount: 20000, spentDate: "2026-09-05" },
  ],
};

test("yig'ilgan pul faqat to'langanlardan hisoblanadi", () => {
  const r = buildPublicReport(base);
  assert.equal(r.collected, 100000);
  assert.equal(r.spent, 50000);
  assert.equal(r.balance, 50000);
});

test("sanoq ko'rsatiladi, ism KO'RSATILMAYDI", () => {
  const r = buildPublicReport(base);
  assert.equal(r.paidCount, 2);
  assert.equal(r.totalCount, 3);
  // ⚠️ Butun javobda "student" so'zi ham, ism ham bo'lmasligi kerak
  const json = JSON.stringify(r);
  assert.ok(!/student/i.test(json), "javobda o'quvchi ma'lumoti bor");
  assert.ok(!/parent|phone/i.test(json), "javobda ota-ona ma'lumoti bor");
});

test("saytdan oldingi pul qoldiqqa qo'shiladi", () => {
  // ⚠️ Qo'shmasak qoldiq haqiqatdan kam chiqib, ota-ona "pul
  //    kamayib qolibdi" deb o'ylardi.
  const r = buildPublicReport({
    ...base,
    cls: { name: "9-A", initialBalance: 200000 },
  });
  assert.equal(r.carried, 200000);
  assert.equal(r.balance, 200000 + 100000 - 50000);
});

test("qoldiq MANFIY bo'lishi mumkin — nolga qirqilmaydi", () => {
  // O'tgan oydan qolgan qarzga xarajat qilingan holat. Nolga
  // qirqsak son yolg'on bo'lardi.
  const r = buildPublicReport({
    ...base,
    payments: [],
    expenses: [{ reason: "Ijara", amount: 90000, spentDate: "2026-09-01" }],
  });
  assert.equal(r.balance, -90000);
});

test("xarajatlar yangisidan eskisiga tartiblanadi", () => {
  const r = buildPublicReport(base);
  assert.deepEqual(
    r.expenses.map((e) => e.reason),
    ["Suv", "Marker"],
  );
});

test("bo'sh oy — hammasi nol, xato emas", () => {
  const r = buildPublicReport({
    cls: { name: "9-A" },
    payments: [],
    expenses: [],
    month: 9,
    year: 2026,
  });
  assert.equal(r.collected, 0);
  assert.equal(r.spent, 0);
  assert.equal(r.balance, 0);
  assert.deepEqual(r.expenses, []);
});

test("buzuq summa yiqitmaydi", () => {
  // Bazada eski yozuvda `amount` yo'q bo'lishi mumkin
  const r = buildPublicReport({
    ...base,
    payments: [{ status: "paid" }, { amount: "50000", status: "paid" }],
    expenses: [{ reason: "X", amount: null }],
  });
  assert.equal(r.collected, 50000);
  assert.equal(r.spent, 0);
});

test("chek surati javobda bo'ladi", () => {
  const r = buildPublicReport({
    ...base,
    expenses: [
      { reason: "Marker", amount: 1, spentDate: "2026-09-03", receipt: "https://cdn/x.jpg" },
    ],
  });
  assert.equal(r.expenses[0].receipt, "https://cdn/x.jpg");
});

// ── Ulanish: controller haqiqatan himoyalanganmi ─────────────

test("ochiq controller arxivlangan sinfni va bloklangan hisobni yopadi", () => {
  // ⚠️ Bu loyihada "yozilgan-u ulanmagan" xatosi yetti marta
  //    takrorlangan. Sof funksiya to'g'ri bo'lsa ham, controller
  //    tekshiruvni tashlab ketsa havola ochiq qolardi.
  const fs = require("fs");
  const path = require("path");
  const src = fs
    .readFileSync(
      path.join(__dirname, "../src/controllers/publicReportController.js"),
      "utf8",
    )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  assert.match(src, /archivedAt:\s*null/, "arxivlangan sinf tekshirilmaydi");
  assert.match(src, /isActive === false/, "bloklangan hisob tekshirilmaydi");
  assert.match(src, /deletionScheduledFor/, "o'chirilayotgan hisob tekshirilmaydi");
  assert.match(src, /publicToken/, "token bo'yicha qidirilmaydi");
});

test("ochiq route cheklovsiz qolmagan", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs
    .readFileSync(path.join(__dirname, "../src/routes/public.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  assert.match(src, /rateLimit/, "ochiq endpoint cheklanmagan");
  // ⚠️ Bu router'da `auth` BO'LMASLIGI kerak — u yerda token
  //    bilan kiradigan odam yo'q, ota-ona shunchaki havolani ochadi.
  assert.ok(!/require\(["']\.\.\/middleware\/auth/.test(src), "public router'da auth bor");
});
