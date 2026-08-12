// test/permissions.test.js
// requirePermission butun backend xavfsizligining asosi. Bir marta
// noto'g'ri ishlatilgani uchun Direktor ham davomat saqlay olmagan edi —
// shuning uchun uning xatti-harakati aniq qulflab qo'yiladi.
const test = require("node:test");
const assert = require("node:assert/strict");

const { requirePermission } = require("../src/utils/resolveContext");

test("Direktor uchun har doim o'tadi", () => {
  const ctx = { isDirector: true, permissions: null };
  assert.doesNotThrow(() => requirePermission(ctx, "manageAttendance"));
  assert.doesNotThrow(() => requirePermission(ctx, "yoq_huquq"));
});

test("ruxsat bo'lsa hech narsa qaytarmaydi (undefined)", () => {
  const ctx = { isDirector: false, permissions: ["manageGroups"] };
  // ⚠ MUHIM: `if (!requirePermission(...))` YOZMANG — u har doim true bo'ladi
  assert.equal(requirePermission(ctx, "manageGroups"), undefined);
});

test("ruxsat bo'lmasa 403 bilan xato tashlaydi", () => {
  const ctx = { isDirector: false, permissions: ["manageGroups"] };
  assert.throws(
    () => requirePermission(ctx, "manageSalaries"),
    (err) => err.status === 403 && /manageSalaries/.test(err.message),
  );
});

test("permissions massiv bo'lmasa ham yiqilmaydi", () => {
  for (const bad of [null, undefined, {}, "manageGroups", 42]) {
    const ctx = { isDirector: false, permissions: bad };
    assert.throws(
      () => requirePermission(ctx, "manageGroups"),
      (err) => err.status === 403,
      `permissions = ${JSON.stringify(bad)}`,
    );
  }
});

test("bo'sh massiv — hech qanday ruxsat yo'q", () => {
  const ctx = { isDirector: false, permissions: [] };
  assert.throws(() => requirePermission(ctx, "manageGroups"), { status: 403 });
});
