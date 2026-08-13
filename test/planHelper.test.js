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
  effectivePlan,
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

// ── effectivePlan ─────────────────────────────────────────────
// Ikkita to'lovchi mijozga tegadigan xato shu yerda qulflanadi:
//   1. LC guruhlari `plan` ni yozmasdi → Premium ham 30 tada qolardi
//   2. Tarifni ko'targan foydalanuvchi eski sinflarida eski limitda
//      qolib ketardi — to'lagan puli ish bermasdi

test("effectivePlan — hozirgi tarif yuqori bo'lsa u tanlanadi", () => {
  // LC guruhi: plan yozilmagan (free), direktor premium
  assert.equal(effectivePlan("free", teacher("premium")), "premium");
  assert.equal(effectivePlan(undefined, teacher("premium")), "premium");
  assert.equal(effectivePlan("free", teacher("pro")), "pro");
});

test("effectivePlan — eski yuqori tarif saqlanadi (grandfathering)", () => {
  // Premiumda ochilgan sinf, keyin free'ga tushgan → katta limit qoladi
  assert.equal(effectivePlan("premium", teacher("free")), "premium");
  assert.equal(effectivePlan("pro", teacher("free")), "pro");
});

test("effectivePlan — obuna tugagan bo'lsa hozirgi tarif free", () => {
  assert.equal(effectivePlan("free", teacher("premium", false)), "free");
  // lekin sinfdagi eski tarif baribir saqlanadi
  assert.equal(effectivePlan("pro", teacher("premium", false)), "pro");
});

test("effectivePlan — teacher berilmasa sinf tarifi ishlatiladi", () => {
  assert.equal(effectivePlan("pro", undefined), "pro");
  assert.equal(effectivePlan("nomalum", undefined), "free");
});

test("canAddStudent — teacher berilsa hozirgi tarif hisobga olinadi", () => {
  const premium = teacher("premium");

  // ⚠️ ASOSIY HOLAT: LC guruhi "free" deb yozilgan, direktor premium.
  // Ilgari 30-o'quvchida to'xtardi — endi to'xtamaydi.
  assert.equal(canAddStudent("free", 30, premium), true);
  assert.equal(canAddStudent("free", 998, premium), true);
  assert.equal(canAddStudent("free", 999, premium), false);

  // Tarifni ko'targan Fond foydalanuvchisi ham eski sinfida yutadi
  assert.equal(canAddStudent("free", 30, teacher("pro")), true);
  assert.equal(canAddStudent("free", 60, teacher("pro")), false);
});

test("canAddStudent — teacher berilmasa eski xatti-harakat saqlanadi", () => {
  assert.equal(canAddStudent("free", 29), true);
  assert.equal(canAddStudent("free", 30), false);
});

test("canAddStudent — obunasi tugagan premium free limitida qoladi", () => {
  const expired = teacher("premium", false);
  assert.equal(canAddStudent("free", 29, expired), true);
  assert.equal(canAddStudent("free", 30, expired), false);
});
