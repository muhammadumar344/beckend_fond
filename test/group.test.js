// test/group.test.js
// `Group` modeli `classes` kolleksiyasiga bog'langan va `director`/
// `monthlyPrice` — alias'lar. Alias so'rovda ishlamasa, `find()`
// XATO BERMAYDI — shunchaki bo'sh massiv qaytaradi. Aynan shunday
// jim xatolar bu loyihada bir necha marta bo'lgan, shuning uchun
// xatti-harakat testda qulflanadi.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Group = require("../src/models/Group");
const Class = require("../src/models/Class");

const oid = () => new mongoose.Types.ObjectId();

// ── Kolleksiya ────────────────────────────────────────────────
test("Group va Class bitta kolleksiyani ishlatadi", () => {
  assert.equal(Group.collection.name, "classes");
  assert.equal(Class.collection.name, "classes");
});

// ── Hujjat darajasidagi alias ─────────────────────────────────
test("director alias'i teacher maydoniga yoziladi", () => {
  const id = oid();
  const g = new Group({ director: id, monthlyPrice: 150000, name: "A1" });

  assert.equal(String(g.teacher), String(id));
  assert.equal(String(g.director), String(id));
  assert.equal(g.defaultAmount, 150000);
  assert.equal(g.monthlyPrice, 150000);

  // Bazaga aynan haqiqiy nomlar bilan yoziladi
  const raw = g.toObject();
  assert.ok("teacher" in raw, "teacher yozilishi kerak");
  assert.ok("defaultAmount" in raw, "defaultAmount yozilishi kerak");
  assert.ok(!("director" in raw), "director bazaga yozilmasligi kerak");
  assert.ok(!("monthlyPrice" in raw), "monthlyPrice bazaga yozilmasligi kerak");
});

test("haqiqiy nom bilan yozish ham ishlaydi", () => {
  const id = oid();
  const g = new Group({ teacher: id, defaultAmount: 200000, name: "B1" });
  assert.equal(String(g.director), String(id));
  assert.equal(g.monthlyPrice, 200000);
});

// ── So'rov filtridagi alias (pre-hook) ────────────────────────
// Ulanish yo'q. Buferlash o'chirilmasa Mongoose so'rovni navbatga qo'yadi,
// hook umuman ishlamaydi va test 10 soniya kutib yiqiladi.
mongoose.set("bufferCommands", false);

/**
 * So'rovni bajarishga urinadi (ulanish yo'q — xato kutilgan) va
 * hook tomonidan O'ZGARTIRILGAN filtrni qaytaradi. Hook `setQuery()`
 * chaqirgani uchun filtr exec'dan keyin tarjima qilingan bo'ladi.
 */
async function filterAfterExec(query) {
  try {
    await query.exec();
  } catch {
    /* "before initial connection" — kutilgan */
  }
  return JSON.stringify(query.getFilter());
}

test("pre-hook so'rov filtridagi alias'ni tarjima qiladi", async () => {
  const id = oid();

  const find = await filterAfterExec(Group.find({ director: id }));
  assert.ok(find.includes("teacher"), `tarjima bo'lmagan: ${find}`);
  assert.ok(!find.includes("director"), `alias qolib ketgan: ${find}`);

  const mixed = await filterAfterExec(
    Group.findOne({ director: id, monthlyPrice: { $gt: 0 } }),
  );
  assert.ok(mixed.includes("defaultAmount"), `monthlyPrice tarjima bo'lmagan: ${mixed}`);
  assert.ok(!mixed.includes("monthlyPrice"), `alias qolib ketgan: ${mixed}`);

  const counted = await filterAfterExec(Group.countDocuments({ director: id }));
  assert.ok(counted.includes("teacher"), `countDocuments tarjima bo'lmagan: ${counted}`);

  const nested = await filterAfterExec(
    Group.find({ $or: [{ director: id }, { branch: null }] }),
  );
  assert.ok(nested.includes("teacher"), `$or ichida tarjima bo'lmagan: ${nested}`);
});

test("haqiqiy nom bilan yozilgan filtr o'zgarmaydi", async () => {
  const id = oid();
  const f = await filterAfterExec(Group.find({ teacher: id, defaultAmount: 5 }));
  assert.ok(f.includes("teacher") && f.includes("defaultAmount"));
});

// ── Sxema chegarasi ───────────────────────────────────────────
test("Fond maydonlari Group sxemasida yo'q", () => {
  const paths = Object.keys(Group.schema.paths);
  assert.ok(!paths.includes("initialBalance"));
  assert.ok(!paths.includes("initialBalanceNote"));
  // Class'da esa bor — ajratishning maqsadi shu
  assert.ok(Object.keys(Class.schema.paths).includes("initialBalance"));
});

test("Group sxemasi Class bilan bir xil shakl yozadi (createdAt)", () => {
  // timestamps: true bo'lsa updatedAt qo'shilib, Class orqali yozilgan
  // hujjatlardan farq qilardi
  assert.ok(!Group.schema.paths.updatedAt, "updatedAt bo'lmasligi kerak");
  assert.ok(Group.schema.paths.createdAt, "createdAt bo'lishi kerak");
});

test("plan maydoni bor va Class bilan bir xil qiymatlarni oladi", () => {
  const gEnum = Group.schema.paths.plan.enumValues;
  const cEnum = Class.schema.paths.plan.enumValues;
  assert.deepEqual(gEnum, cEnum);
  assert.equal(Group.schema.paths.plan.defaultValue, "free");
});

test("majburiy maydonlar Class bilan mos", () => {
  for (const f of ["name", "teacher", "defaultAmount"]) {
    assert.equal(
      Group.schema.paths[f].isRequired,
      Class.schema.paths[f].isRequired,
      `${f} majburiyligi farq qilyapti`,
    );
  }
});
