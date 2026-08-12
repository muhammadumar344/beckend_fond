// test/planHelper.test.js
// Tarif limitlari — pul va cheklovlar bilan bog'liq, shuning uchun
// birinchi navbatda shu mantiq sinovdan o'tadi.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PLAN_LIMITS,
  hasFeature,
  canOpenNewClass,
  canAddStudent,
} = require("../src/utils/planHelper");

/** Teacher hujjatining soddalashtirilgan modeli */
const teacher = (plan, active = true) => ({
  plan,
  isPlanActive: () => active,
});

test("hasFeature — premium barcha funksiyalarga ega", () => {
  const t = teacher("premium");
  assert.equal(hasFeature(t, "export"), true);
  assert.equal(hasFeature(t, "sms_reminder"), true);
  assert.equal(hasFeature(t, "multi_lang"), true);
  assert.equal(hasFeature(t, "telegram"), true);
});

test("hasFeature — pro'da export va SMS yo'q", () => {
  const t = teacher("pro");
  assert.equal(hasFeature(t, "telegram"), true);
  assert.equal(hasFeature(t, "monthly_reminder"), true);
  assert.equal(hasFeature(t, "export"), false);
  assert.equal(hasFeature(t, "sms_reminder"), false);
});

test("hasFeature — obuna tugagan bo'lsa free deb hisoblanadi", () => {
  const expired = teacher("premium", false);
  assert.equal(hasFeature(expired, "export"), false);
  assert.equal(hasFeature(expired, "telegram"), false);
});

test("hasFeature — noma'lum funksiya false qaytaradi", () => {
  assert.equal(hasFeature(teacher("premium"), "yoq_funksiya"), false);
});

test("canOpenNewClass — limitga yetganda to'xtatadi", () => {
  assert.equal(canOpenNewClass(teacher("free"), 0), true);
  assert.equal(canOpenNewClass(teacher("free"), 1), false);

  assert.equal(canOpenNewClass(teacher("pro"), 2), true);
  assert.equal(canOpenNewClass(teacher("pro"), 3), false);

  assert.equal(canOpenNewClass(teacher("premium"), 9), true);
  assert.equal(canOpenNewClass(teacher("premium"), 10), false);
});

test("canOpenNewClass — obuna tugaganda free limiti qo'llanadi", () => {
  const expired = teacher("premium", false);
  assert.equal(canOpenNewClass(expired, 0), true);
  assert.equal(canOpenNewClass(expired, 1), false);
});

test("canAddStudent — sinf tarifi bo'yicha cheklaydi", () => {
  assert.equal(canAddStudent("free", 29), true);
  assert.equal(canAddStudent("free", 30), false);

  assert.equal(canAddStudent("pro", 59), true);
  assert.equal(canAddStudent("pro", 60), false);

  assert.equal(canAddStudent("premium", 998), true);
  assert.equal(canAddStudent("premium", 999), false);
});

test("canAddStudent — noma'lum tarif free deb hisoblanadi", () => {
  assert.equal(canAddStudent("nomalum", 29), true);
  assert.equal(canAddStudent("nomalum", 30), false);
  assert.equal(canAddStudent(undefined, 30), false);
});

test("PLAN_LIMITS o'zgarmagan — narx/limitlar tasodifan buzilmasin", () => {
  assert.deepEqual(PLAN_LIMITS.free, { classes: 1, students: 30 });
  assert.deepEqual(PLAN_LIMITS.pro, { classes: 3, students: 60 });
  assert.deepEqual(PLAN_LIMITS.premium, { classes: 10, students: 999 });
});
