// test/centerHealth.test.js
// "Jim muammolar" paneli.
//
// Tizimdagi eng qimmat xatolar xato bermaydi — ular shunchaki
// sodir bo'lmaydi. To'lov varaqasi QO'LDA yaratiladi va bitta
// guruh unutilsa, o'sha oy o'sha guruhdan pul umuman
// so'ralmaydi: na xabar, na belgi. Oy oxirida faqat "nega
// tushum kam?" degan savol qoladi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildHealth, SAMPLE } = require("../src/services/centerHealth");

const group = (over = {}) => ({
  id: "1",
  name: "Ingliz A2",
  hasBilling: true,
  hasSchedule: true,
  hasTeacher: true,
  studentCount: 10,
  ...over,
});

test("hammasi joyida — muammo yo'q", () => {
  const r = buildHealth({ isLC: true, groups: [group()], noPhone: [] });
  assert.equal(r.total, 0);
});

test("to'lov varaqasi yaratilmagan guruh — eng qimmat muammo", () => {
  const r = buildHealth({
    isLC: true,
    groups: [group({ hasBilling: false })],
    noPhone: [],
  });
  assert.equal(r.issues.noBilling.count, 1);
  assert.deepEqual(r.issues.noBilling.sample, ["Ingliz A2"]);
});

test("⚠️ BO'SH guruh hech qaysi ro'yxatga tushmaydi", () => {
  // Yangi ochilgan, o'quvchisi yo'q guruhda na jadval, na ustoz
  // bo'lishi tabiiy — u hali tayyorlanyapti. Uni qo'shsak,
  // ro'yxat birinchi kundanoq shovqinga aylanardi.
  const r = buildHealth({
    isLC: true,
    groups: [
      group({
        studentCount: 0,
        hasBilling: false,
        hasSchedule: false,
        hasTeacher: false,
      }),
    ],
    noPhone: [],
  });
  assert.equal(r.total, 0);
});

test("telefonsiz o'quvchi — unga eslatma ham, xabar ham bormaydi", () => {
  const r = buildHealth({
    isLC: true,
    groups: [group()],
    noPhone: [{ id: "s1", name: "Ali", groupName: "Ingliz A2" }],
  });
  assert.equal(r.issues.noPhone.count, 1);
});

test("jadval va ustoz FAQAT LC uchun tekshiriladi", () => {
  // Fond — bitta sinf rahbari: unda na jadval, na tayinlangan
  // ustoz tushunchasi bor.
  const groups = [group({ hasSchedule: false, hasTeacher: false })];
  const lc = buildHealth({ isLC: true, groups, noPhone: [] });
  const fond = buildHealth({ isLC: false, groups, noPhone: [] });

  assert.equal(lc.issues.noSchedule.count, 1);
  assert.equal(lc.issues.noTeacher.count, 1);
  assert.equal(fond.issues.noSchedule.count, 0);
  assert.equal(fond.issues.noTeacher.count, 0);
});

test("ro'yxat emas, sanoq + bir nechta misol", () => {
  // To'liq ro'yxat o'sha sahifalarda bor; bu yerda direktorga
  // "nima unutilgan" kerak.
  const many = Array.from({ length: SAMPLE + 4 }, (_, i) =>
    group({ id: String(i), name: `Guruh ${i}`, hasBilling: false }),
  );
  const r = buildHealth({ isLC: true, groups: many, noPhone: [] });
  assert.equal(r.issues.noBilling.count, SAMPLE + 4);
  assert.equal(r.issues.noBilling.sample.length, SAMPLE);
});

test("bo'sh markaz yiqilmaydi", () => {
  const r = buildHealth({});
  assert.equal(r.total, 0);
  assert.equal(r.checkedGroups, 0);
});

// ── Ulanish ─────────────────────────────────────────────────

const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/teacherController.js"),
  "utf8",
);
const ROUTES = fs.readFileSync(
  path.join(__dirname, "../src/routes/teacher.js"),
  "utf8",
);

test("route'ga ulangan", () => {
  assert.ok(ROUTES.includes('"/health"'));
  assert.ok(ROUTES.includes("ctrl.getCenterHealth"));
});

test("moliyaviy ma'lumot — ruxsat tekshiriladi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const getCenterHealth"));
  assert.ok(fn.includes('requireAnyPermission(ctx, ["viewPayments", "managePayments"])'));
});

test("arxivdagi guruhlar tekshirilmaydi", () => {
  const svc = fs.readFileSync(
    path.join(__dirname, "../src/services/centerHealth.js"),
    "utf8",
  );
  assert.ok(svc.includes("archivedAt: null"));
});
