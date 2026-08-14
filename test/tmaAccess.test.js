// test/tmaAccess.test.js
// ════════════════════════════════════════════════════════════
// Telefon raqamini solishtirish va Mini App ruxsat qoidalari.
//
// Ikkalasi ham jim buziladigan turdagi mantiq: raqam solishtirish
// noto'g'ri bo'lsa ota-ona "topilmadi" xabarini olaveradi va
// sababini hech kim tushunmaydi; ruxsat qoidasi bo'shashsa esa
// isbotlanmagan hisob bolaning baholarini ko'ra boshlaydi va
// buni hech kim sezmaydi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");

const { phoneKey, samePhone } = require("../src/utils/phone");
const {
  canSee,
  isVerified,
  visibleSections,
} = require("../src/utils/tmaAccess");

// ── Telefon ──────────────────────────────────────────────────

test("bir raqamning turli yozuvlari bir xil kalitga tushadi", () => {
  const forms = [
    "+998901234567",
    "998901234567",
    "901234567",
    "90 123 45 67",
    "+998 90 123-45-67",
    "(90) 123 45 67",
    "8 90 123 45 67",
  ];
  const keys = forms.map(phoneKey);
  assert.deepEqual(
    [...new Set(keys)],
    ["901234567"],
    `Turlicha chiqdi: ${JSON.stringify(keys)}`,
  );
});

test("boshqa raqamlar chalkashmaydi", () => {
  assert.equal(samePhone("+998901234567", "+998901234568"), false);
  assert.equal(samePhone("901234567", "911234567"), false);
});

test("juda qisqa raqam kalit bermaydi — hamma bilan mos kelib qolmasin", () => {
  assert.equal(phoneKey("12345"), "");
  assert.equal(phoneKey(""), "");
  assert.equal(phoneKey(null), "");
  assert.equal(phoneKey(undefined), "");
  // Bo'sh kalit hech kim bilan mos kelmasligi SHART
  assert.equal(samePhone("", ""), false);
  assert.equal(samePhone("123", "456"), false);
});

test("mamlakat kodi bor-yo'qligi ahamiyatsiz", () => {
  assert.equal(samePhone("+998901234567", "901234567"), true);
});

// ── Ruxsatlar ────────────────────────────────────────────────

const link = (via) => ({ verifiedVia: via, isActive: true });

test("isbotlangan bog'lanish hamma bo'limni ko'radi", () => {
  for (const via of ["phone", "code"]) {
    const l = link(via);
    assert.equal(isVerified(l), true, via);
    for (const s of ["grades", "attendance", "payments", "homework"]) {
      assert.equal(canSee(l, s), true, `${via} → ${s}`);
    }
  }
});

test("⚠️ legacy faqat to'lovni ko'radi — baho YOPIQ", () => {
  const l = link("legacy");
  assert.equal(canSee(l, "payments"), true, "eski eslatma ishlashda davom etsin");
  assert.equal(canSee(l, "grades"), false, "isbotsiz baho ochilib ketdi!");
  assert.equal(canSee(l, "attendance"), false);
  assert.equal(canSee(l, "homework"), false);
  assert.equal(isVerified(l), false);
});

test("noma'lum bo'lim YOPIQ — unutilgani ochilib qolmasin", () => {
  assert.equal(canSee(link("phone"), "salaries"), false);
  assert.equal(canSee(link("phone"), "revenue"), false);
  assert.equal(canSee(link("code"), ""), false);
});

test("o'chirilgan bog'lanish hech narsani ko'rmaydi", () => {
  const off = { verifiedVia: "phone", isActive: false };
  assert.equal(canSee(off, "payments"), false);
  assert.equal(canSee(off, "grades"), false);
});

test("bog'lanish yo'q bo'lsa hech narsa ochilmaydi", () => {
  assert.equal(canSee(null, "payments"), false);
  assert.equal(canSee(undefined, "grades"), false);
});

test("visibleSections ruxsat darajasiga mos keladi", () => {
  assert.deepEqual(visibleSections(link("legacy")), ["payments"]);

  const full = visibleSections(link("phone"));
  assert.ok(full.includes("grades"));
  assert.ok(full.includes("payments"));
  assert.ok(full.length > 1);
});
