// test/audit.test.js
// O'zgarishlar tarixi — pul bilan bog'liq, shuning uchun mantiq
// sinovdan o'tishi shart.
//
// Bu yerda bazaga ulanmaymiz: `diff()` sof funksiya, model esa
// faqat sxema darajasida tekshiriladi.
const test = require("node:test");
const assert = require("node:assert/strict");

const { diff } = require("../src/services/audit");

// ── diff() ──────────────────────────────────────────────────

test("diff — o'zgarmagan maydon ro'yxatga tushmaydi", () => {
  const before = { status: "paid", amount: 300000 };
  const after = { status: "paid", amount: 300000 };
  assert.deepEqual(diff(before, after, ["status", "amount"]), []);
});

test("diff — summa o'zgarishi 'nimadan nimaga' bilan yoziladi", () => {
  const before = { amount: 300000 };
  const after = { amount: 250000 };
  assert.deepEqual(diff(before, after, ["amount"]), [
    { field: "amount", from: 300000, to: 250000 },
  ]);
});

test("diff — faqat SO'RALGAN maydonlar tekshiriladi", () => {
  // `updatedAt` har saqlashda o'zgaradi. Uni ham qo'shsak,
  // jurnal shovqinga to'lib, haqiqiy o'zgarish ko'rinmay
  // qolardi — shuning uchun ro'yxat ataylab qo'lda beriladi.
  const before = { amount: 100, updatedAt: new Date("2026-01-01") };
  const after = { amount: 100, updatedAt: new Date("2026-08-17") };
  assert.deepEqual(diff(before, after, ["amount"]), []);
});

test("diff — bir xil sananing ikki nusxasi o'zgarish emas", () => {
  // Obyektlar `!==` bilan hech qachon teng emas. Solishtirishdan
  // oldin normalizatsiya qilinmasa, har bir saqlash "sana
  // o'zgardi" deb yozilardi.
  const d1 = new Date("2026-08-17T10:00:00Z");
  const d2 = new Date("2026-08-17T10:00:00Z");
  assert.deepEqual(diff({ paidDate: d1 }, { paidDate: d2 }, ["paidDate"]), []);
});

test("diff — null va undefined bir xil hisoblanadi", () => {
  // To'lov bekor qilinganda `paidDate` null bo'ladi, yangi
  // yozuvda esa umuman yo'q. Ikkalasi ham "sana yo'q" degani.
  assert.deepEqual(diff({ paidDate: null }, {}, ["paidDate"]), []);
  assert.deepEqual(diff({}, { paidDate: undefined }, ["paidDate"]), []);
});

test("diff — null'dan qiymatga o'tish o'zgarish", () => {
  const d = new Date("2026-08-17T10:00:00Z");
  const out = diff({ paidDate: null }, { paidDate: d }, ["paidDate"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].field, "paidDate");
  assert.equal(out[0].from, null);
  assert.equal(out[0].to, d);
});

test("diff — bo'sh 'before' (yangi yozuv) hamma narsani ko'rsatadi", () => {
  const out = diff({}, { amount: 500000, note: "avans" }, ["amount", "note"]);
  assert.equal(out.length, 2);
  assert.equal(out[0].from, null);
  assert.equal(out[0].to, 500000);
});

test("diff — ObjectId'ga o'xshash obyektlar matn bo'yicha solishtiriladi", () => {
  const id = { toString: () => "64f0a1b2c3d4e5f6a7b8c9d0" };
  const same = { toString: () => "64f0a1b2c3d4e5f6a7b8c9d0" };
  const other = { toString: () => "64f0a1b2c3d4e5f6a7b8c9d1" };

  assert.deepEqual(diff({ staff: id }, { staff: same }, ["staff"]), []);
  assert.equal(diff({ staff: id }, { staff: other }, ["staff"]).length, 1);
});

// ── Model ───────────────────────────────────────────────────

test("AuditLog — o'zgartirish va o'chirish bloklangan", async () => {
  // Jurnalni o'zgartira oladigan odam uchun jurnal hech narsani
  // isbotlamaydi. Shuning uchun model darajasida qulflangan.
  const AuditLog = require("../src/models/AuditLog");

  const blocked = [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ];

  for (const op of blocked) {
    const hooks = AuditLog.schema.s.hooks._pres.get(op);
    assert.ok(
      hooks && hooks.length > 0,
      `${op} uchun to'siq qo'yilmagan — jurnal o'zgartirilishi mumkin`,
    );
  }
});

test("AuditLog — director majburiy va indekslangan", () => {
  // Bunsiz bir markazning jurnali boshqasiga ko'rinib ketardi.
  const AuditLog = require("../src/models/AuditLog");
  const path = AuditLog.schema.path("director");
  assert.ok(path, "director maydoni yo'q");
  assert.equal(path.isRequired, true);
});

test("AuditLog — actor.model faqat Teacher yoki Staff", () => {
  const AuditLog = require("../src/models/AuditLog");
  const path = AuditLog.schema.path("actor.model");
  assert.deepEqual(path.enumValues, ["Teacher", "Staff"]);
});
