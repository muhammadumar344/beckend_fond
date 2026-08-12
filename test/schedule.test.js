// test/schedule.test.js
// Dars vaqtlari kesishuvi. Eng nozik joyi — ketma-ket darslar
// (18:00–19:00 va 19:00–20:00) ziddiyat DEB HISOBLANMASLIGI kerak,
// aks holda ustozni ketma-ket ikki guruhga qo'yib bo'lmaydi.
const test = require("node:test");
const assert = require("node:assert/strict");

const { timesOverlap } = require("../src/utils/teacherAvailability");

test("to'liq kesishadi", () => {
  assert.equal(timesOverlap("18:00", "19:30", "18:00", "19:30"), true);
});

test("qisman kesishadi — boshi ustma-ust", () => {
  assert.equal(timesOverlap("18:00", "19:30", "19:00", "20:00"), true);
});

test("qisman kesishadi — oxiri ustma-ust", () => {
  assert.equal(timesOverlap("19:00", "20:00", "18:00", "19:30"), true);
});

test("biri ikkinchisining ichida", () => {
  assert.equal(timesOverlap("18:00", "20:00", "18:30", "19:00"), true);
  assert.equal(timesOverlap("18:30", "19:00", "18:00", "20:00"), true);
});

test("ketma-ket darslar kesishmaydi — chegara aniq", () => {
  // 18:00–19:00 tugagach 19:00–20:00 boshlanadi: bu ziddiyat EMAS
  assert.equal(timesOverlap("18:00", "19:00", "19:00", "20:00"), false);
  assert.equal(timesOverlap("19:00", "20:00", "18:00", "19:00"), false);
});

test("umuman uzoq vaqtlar kesishmaydi", () => {
  assert.equal(timesOverlap("09:00", "10:30", "18:00", "19:30"), false);
  assert.equal(timesOverlap("18:00", "19:30", "09:00", "10:30"), false);
});

test("bir daqiqalik kesishuv ham aniqlanadi", () => {
  assert.equal(timesOverlap("18:00", "19:01", "19:00", "20:00"), true);
});

test("zero-padded format — 09:00 va 9:00 farqi", () => {
  // Solishtirish matn bo'yicha ketadi, shuning uchun format doim
  // "HH:MM" bo'lishi shart. Frontend <input type=time> shuni beradi.
  assert.equal(timesOverlap("09:00", "10:00", "09:30", "11:00"), true);
  assert.equal(timesOverlap("08:00", "09:00", "09:00", "10:00"), false);
});
