// test/planHelper.test.js
// Tarif limitlari — pul va cheklovlar bilan bog'liq, shuning uchun
// birinchi navbatda shu mantiq sinovdan o'tadi.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCHOOL,
  LC,
  limitsFor,
  priceFor,
  featuresFor,
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

// ── Rejim bo'yicha ajratilgan tariflar ────────────────────────
// Fond va LC — boshqa mijozlar, boshqa narx. Bitta jadval
// ikkalasiga to'g'ri kelmaydi.

test("Fond limitlari o'zgarmagan — tasodifan buzilmasin", () => {
  assert.equal(limitsFor("free", SCHOOL).classes, 1);
  assert.equal(limitsFor("free", SCHOOL).students, 30);
  assert.equal(limitsFor("pro", SCHOOL).classes, 3);
  assert.equal(limitsFor("pro", SCHOOL).students, 60);
  assert.equal(limitsFor("premium", SCHOOL).classes, 10);
  assert.equal(limitsFor("premium", SCHOOL).students, 999);
});

test("LC limitlari Fond'dan kattaroq", () => {
  // LC — biznes, hajmi kattaroq bo'lishi kerak
  assert.ok(limitsFor("pro", LC).students > limitsFor("pro", SCHOOL).students);
  assert.ok(limitsFor("pro", LC).classes > limitsFor("pro", SCHOOL).classes);
  // Fond'da xodim tushunchasi yo'q
  assert.equal(limitsFor("premium", SCHOOL).staff, 0);
  assert.ok(limitsFor("pro", LC).staff > 0);
});

test("LC narxi Fond'dan qimmatroq", () => {
  for (const p of ["pro", "premium"]) {
    assert.ok(
      priceFor(p, LC).monthly > priceFor(p, SCHOOL).monthly,
      `${p}: LC narxi Fond'dan past`,
    );
  }
  assert.equal(priceFor("free", LC).monthly, 0);
  assert.equal(priceFor("free", SCHOOL).monthly, 0);
});

test("⚠️ TILLAR HAR BIR TARIFDA BEPUL", () => {
  // Til — kirish to'sig'i emas. Ruszabon direktor mahsulotni
  // sinab ko'ra olmasa, umuman sotib olmaydi.
  for (const mode of [SCHOOL, LC]) {
    for (const plan of ["free", "pro", "premium"]) {
      assert.equal(
        featuresFor(plan, mode).multi_lang,
        true,
        `${mode}/${plan}: multi_lang bepul bo'lishi kerak`,
      );
    }
  }
});

test("hasFeature rejimni Teacher hujjatidan oladi", () => {
  const lcPro = { plan: "pro", institutionType: LC, isPlanActive: () => true };
  const fondPro = { plan: "pro", institutionType: SCHOOL, isPlanActive: () => true };

  // Export LC'da Pro'dan boshlanadi, Fond'da faqat Premium
  assert.equal(hasFeature(lcPro, "export"), true);
  assert.equal(hasFeature(fondPro, "export"), false);
});

test("white_label faqat LC Premium'da", () => {
  assert.equal(featuresFor("premium", LC).white_label, true);
  assert.equal(featuresFor("pro", LC).white_label, false);
  // Fond'da bu tushuncha umuman yo'q
  assert.equal(featuresFor("premium", SCHOOL).white_label, undefined);
});

test("noma'lum rejim Fond deb hisoblanadi", () => {
  assert.deepEqual(limitsFor("free", "nomalum"), limitsFor("free", SCHOOL));
  assert.deepEqual(limitsFor("free", undefined), limitsFor("free", SCHOOL));
});

test("noma'lum tarif free deb hisoblanadi", () => {
  assert.deepEqual(limitsFor("nomalum", LC), limitsFor("free", LC));
  assert.deepEqual(limitsFor(undefined, SCHOOL), limitsFor("free", SCHOOL));
});

test("canOpenNewClass rejimga qarab ishlaydi", () => {
  const lc = { plan: "free", institutionType: LC, isPlanActive: () => true };
  const fond = { plan: "free", institutionType: SCHOOL, isPlanActive: () => true };

  // LC free'da 2 guruh, Fond free'da 1 sinf
  assert.equal(canOpenNewClass(lc, 1), true);
  assert.equal(canOpenNewClass(lc, 2), false);
  assert.equal(canOpenNewClass(fond, 0), true);
  assert.equal(canOpenNewClass(fond, 1), false);
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
