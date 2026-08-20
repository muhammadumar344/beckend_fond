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


// ── "Faqat ko'rish" darajasi ────────────────────────────────
//
// ⚠️ O'QISH — "yoki", YOZISH — aniq `manage*`. Ilgari
//    interfeys `viewGrades` kabi huquqlarni taklif qilardi, lekin
//    ular hech qayerda tekshirilmasdi: direktor huquq beradi va
//    hech narsa o'zgarmaydi.

const { requireAnyPermission } = require('../src/utils/resolveContext');

const staffCtx = (perms) => ({ isDirector: false, permissions: perms });

test("requireAnyPermission — bittasi bo'lsa o'tadi", () => {
  assert.doesNotThrow(() =>
    requireAnyPermission(staffCtx(['viewGrades']), ['viewGrades', 'manageGrades']),
  );
  assert.doesNotThrow(() =>
    requireAnyPermission(staffCtx(['manageGrades']), ['viewGrades', 'manageGrades']),
  );
});

test('requireAnyPermission — hech biri bo\'lmasa 403', () => {
  try {
    requireAnyPermission(staffCtx(['manageAttendance']), ['viewGrades', 'manageGrades']);
    assert.fail('throw qilmadi');
  } catch (e) {
    assert.equal(e.status, 403);
  }
});

test('requireAnyPermission — direktorga har doim o\'tadi', () => {
  assert.doesNotThrow(() =>
    requireAnyPermission({ isDirector: true }, ['viewGrades']),
  );
});

test('requireAnyPermission — buzuq permissions yiqitmaydi', () => {
  // localStorage'dagi eski kesh yoki buzuq format
  for (const bad of [null, undefined, 'viewGrades', 42]) {
    assert.throws(() =>
      requireAnyPermission({ isDirector: false, permissions: bad }, ['viewGrades']),
    );
  }
});

// ── Enum va haqiqiy tekshiruvlar mos keladimi ───────────────

test("enum'dagi har bir huquq backendda ISHLATILADI", () => {
  // ⚠️ Eng muhim test. Ilgari sakkizta huquq enum'da ham,
  //    interfeysda ham bor edi, lekin hech qayerda
  //    tekshirilmasdi — direktor bergan huquq hech narsa
  //    ochmasdi. Bu jimgina yolg'on va uni faqat shunday
  //    tekshiruv ushlaydi.
  const fs = require('node:fs');
  const path = require('node:path');

  const SRC = path.join(__dirname, '../src');
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.js') && e.name !== 'Role.js') files.push(full);
    }
  })(SRC);

  const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const Role = require('../src/models/Role');

  const unused = Role.PERMISSION_TYPES.filter(
    (p) => !all.includes(`"${p}"`) && !all.includes(`'${p}'`),
  );

  assert.deepEqual(
    unused,
    [],
    `enum'da bor, lekin hech qayerda tekshirilmaydi: ${unused.join(', ')}`,
  );
});

test('eskirgan huquq JIMGINA tashlanadi, xato bermaydi', async () => {
  // Bazadagi eski rollarda `sendSMS` kabi qiymatlar yotibdi.
  // Enum xato tashlasa, direktor eski rolni tahrirlashga urinib
  // "validation failed" olardi va o'zi hech narsa qila olmasdi.
  const Role = require('../src/models/Role');
  const r = new Role({
    director: new (require('mongoose').Types.ObjectId)(),
    name: 'Eski rol',
    slug: 'eski_rol',
    permissions: ['manageGrades', 'sendSMS', 'viewSchedule', 'manageLeads'],
  });
  // ⚠️ `validateSync()` EMAS — u middleware'ni ishga tushirmaydi,
  //    ya'ni tozalash hook'i o'tkazib yuborilardi va test
  //    haqiqiy yo'lni tekshirmasdi. `save()` esa aynan shu
  //    `pre('validate')` zanjiridan o'tadi.
  await r.validate();
  assert.deepEqual(r.permissions.slice(), ['manageGrades', 'manageLeads']);
});
