// test/supportSlots.test.js
// ════════════════════════════════════════════════════════════
// Vaqt hisoblash — bo'sh vaqtlar mantig'ining poydevori.
//
// Eng xavfli joyi: HAFTA KUNI ikki xil sanaladi (loyihada
// 0 = Dushanba, JS da 0 = Yakshanba). Aralashtirilsa bo'sh
// vaqtlar bir kun surilib ketardi — o'quvchi seshanbaga
// yozilaman deb dushanbaga yozilardi va buni faqat ustoz
// kelmagan o'quvchini kutib turganda bilinardi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

const {
  projectDayOfWeek,
  toMin,
  toTime,
} = require("../src/utils/supportSlots");

test("⚠️ hafta kuni loyiha hisobida — 0 = Dushanba", () => {
  // 2026-08-17 dushanba (tekshirilgan sana)
  assert.equal(projectDayOfWeek("2026-08-17"), 0, "dushanba");
  assert.equal(projectDayOfWeek("2026-08-18"), 1, "seshanba");
  assert.equal(projectDayOfWeek("2026-08-19"), 2, "chorshanba");
  assert.equal(projectDayOfWeek("2026-08-20"), 3, "payshanba");
  assert.equal(projectDayOfWeek("2026-08-21"), 4, "juma");
  assert.equal(projectDayOfWeek("2026-08-22"), 5, "shanba");
  assert.equal(projectDayOfWeek("2026-08-23"), 6, "yakshanba");
});

test("yakshanba JS da 0, bizda 6 — chalkashmaydi", () => {
  const d = "2026-08-23";
  const js = new Date(Date.UTC(2026, 7, 23)).getUTCDay();
  assert.equal(js, 0, "JS da yakshanba 0 bo'lishi kerak");
  assert.equal(projectDayOfWeek(d), 6, "bizda yakshanba 6");
});

test("oy va yil chegarasi to'g'ri sanaladi", () => {
  // 2026-12-31 payshanba, 2027-01-01 juma
  assert.equal(projectDayOfWeek("2026-12-31"), 3);
  assert.equal(projectDayOfWeek("2027-01-01"), 4);
});

test("vaqt ↔ daqiqa aylantirish", () => {
  assert.equal(toMin("00:00"), 0);
  assert.equal(toMin("09:30"), 570);
  assert.equal(toMin("15:00"), 900);
  assert.equal(toMin("23:59"), 1439);

  assert.equal(toTime(0), "00:00");
  assert.equal(toTime(570), "09:30");
  assert.equal(toTime(900), "15:00");
  assert.equal(toTime(1439), "23:59");
});

test("aylantirish qaytib kelganda o'zgarmaydi", () => {
  for (const t of ["07:05", "12:00", "18:45", "21:15"]) {
    assert.equal(toTime(toMin(t)), t, t);
  }
});

test("nol bilan to'ldirish saqlanadi — string solishtirish shunga tayanadi", () => {
  // `timesOverlap` qatorlarni to'g'ridan-to'g'ri solishtiradi,
  // ya'ni "9:00" emas, "09:00" bo'lishi SHART
  assert.equal(toTime(toMin("09:00")), "09:00");
  assert.ok("09:00" < "10:00", "zero-padding bo'lmasa bu buzilardi");
});

// ── Bo'lish mantig'i (funksiyaning o'zi bazaga bog'liq, shuning
//    uchun bo'laklarga bo'lish qoidasi alohida tekshiriladi) ──
test("qabul oynasi teng bo'laklarga bo'linadi, oxiri oshib ketmaydi", () => {
  const from = toMin("15:00");
  const to = toMin("17:00");
  const step = 30;

  const slots = [];
  for (let s = from; s + step <= to; s += step) {
    slots.push([toTime(s), toTime(s + step)]);
  }

  assert.equal(slots.length, 4);
  assert.deepEqual(slots[0], ["15:00", "15:30"]);
  assert.deepEqual(slots[3], ["16:30", "17:00"]);
});

test("oyna bo'lakka to'liq bo'linmasa qoldiq TASHLANADI", () => {
  // 15:00–16:20, 30 daqiqadan → 15:00 va 15:30. 16:00–16:30
  // oynadan chiqib ketadi, ya'ni taklif qilinmaydi.
  const from = toMin("15:00");
  const to = toMin("16:20");
  const step = 30;

  const slots = [];
  for (let s = from; s + step <= to; s += step) {
    slots.push(toTime(s));
  }

  assert.deepEqual(slots, ["15:00", "15:30"]);
});
