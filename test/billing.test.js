// test/billing.test.js
// Oylik to'lov varaqasi.
//
// ⚠️ Varaqa QO'LDA yaratiladi va bu — tizimdagi eng qimmat "jim"
//    xato: bitta guruh unutilsa, o'sha oy o'sha guruhdan pul
//    umuman so'ralmaydi. Na xato, na belgi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { pickMissing } = require("../src/services/billing");

test("varaqasi yo'q o'quvchilar ajratiladi", () => {
  const r = pickMissing(
    [{ _id: "a" }, { _id: "b" }, { _id: "c" }],
    [{ student: "b" }],
  );
  assert.deepEqual(r.map((s) => s._id), ["a", "c"]);
});

test("ObjectId va matn aralashsa ham to'g'ri ishlaydi", () => {
  // Mongoose hujjatlarida `_id` ObjectId bo'ladi, `student` esa
  // ba'zan matn — to'g'ridan-to'g'ri solishtirsak takror varaqa
  // yaratilardi.
  const oid = { toString: () => "abc" };
  const r = pickMissing([{ _id: oid }], [{ student: "abc" }]);
  assert.equal(r.length, 0);
});

test("hammasida varaqa bor — hech narsa yaratilmaydi", () => {
  const r = pickMissing([{ _id: "a" }], [{ student: "a" }]);
  assert.equal(r.length, 0);
});

test("bo'sh guruh yiqilmaydi", () => {
  assert.deepEqual(pickMissing([], []), []);
  assert.deepEqual(pickMissing(), []);
});

// ── Qoidalar ────────────────────────────────────────────────

const SVC = fs.readFileSync(
  path.join(__dirname, "../src/services/billing.js"),
  "utf8",
);
const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/teacherController.js"),
  "utf8",
);
const ROUTES = fs.readFileSync(
  path.join(__dirname, "../src/routes/teacher.js"),
  "utf8",
);

test("⚠️ ARXIVDAGI o'quvchiga varaqa yaratilmaydi", () => {
  // Aks holda ketgan bolaga har oy yangi qarz yozilib borardi.
  assert.ok(SVC.includes("isActive: { $ne: false }"));
});

test("mavjud varaqalar BITTA so'rov bilan olinadi", () => {
  // Ilgari har bir o'quvchi uchun alohida `findOne` yuborilardi.
  assert.ok(SVC.includes("MonthlyPayment.find({"));
  assert.ok(!SVC.includes("MonthlyPayment.findOne("));
  assert.ok(SVC.includes("insertMany"));
});

test("controller o'z nusxasini emas, servisni chaqiradi", () => {
  const fn = CTRL.slice(
    CTRL.indexOf("const createMonthlyPayments ="),
    CTRL.indexOf("const getMonthlyPayments ="),
  );
  assert.ok(fn.includes("billing.ensureBillsForClass"));
  assert.ok(fn.includes("billing.ensureBillsForClasses"));
});

test("hammaga yaratish route'ga ulangan", () => {
  assert.ok(ROUTES.includes("create-monthly-all"));
  assert.ok(ROUTES.includes("ctrl.createMonthlyPaymentsAll"));
});

test("arxivdagi guruhga varaqa yaratilmaydi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const createMonthlyPaymentsAll ="));
  assert.ok(fn.includes("archivedAt: null"));
});

test("xodim faqat o'z filialiga yaratadi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const createMonthlyPaymentsAll ="));
  assert.ok(fn.includes("ctx.branchFilter"));
});
