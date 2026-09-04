// test/adminDashboard.test.js
// Platforma egasining bosh sahifasi.
//
// ⚠️ Bu yerda N+1 bor edi va u jimgina o'sib borardi: har bir
//    markaz uchun to'rtta alohida so'rov, ulardan biri esa
//    markazning BARCHA to'lov hujjatlarini xotiraga yuklardi.
//    Yuzta markazda 400+ so'rov — Render'ning bepul tarifida
//    sahifa avval sekinlashadi, keyin umuman ochilmay qoladi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(
  path.join(__dirname, "../src/controllers/adminController.js"),
  "utf8",
);
const DASH = SRC.slice(
  SRC.indexOf("const buildCounts"),
  SRC.indexOf("exports.createTeacher"),
);

test("sanoq halqa ICHIDA emas — aggregate bilan bir marta", () => {
  // Halqa ichidagi `await` — aynan N+1 ning belgisi.
  assert.ok(!/teachers\.map\(async/.test(DASH), "halqa ichida so'rov qolgan");
  assert.ok(DASH.includes("aggregate("));
});

test("to'lovlar bazada yig'iladi, xotiraga tortilmaydi", () => {
  assert.ok(!DASH.includes("MonthlyPayment.find("));
  assert.ok(DASH.includes('$group: { _id: "$teacher", total: { $sum: "$amount" } }'));
});

test("obuna tugash arafasidagilar ro'yxati bor", () => {
  assert.ok(DASH.includes("expiringSoon"));
  assert.ok(DASH.includes("EXPIRING_DAYS"));
});

test("kirmay qo'ygan markazlar ro'yxati bor", () => {
  assert.ok(DASH.includes("idle"));
  assert.ok(DASH.includes("IDLE_DAYS"));
});

test("⚠️ lastLoginAt YO'Q hisob 'kirmagan' deb ko'rsatilmaydi", () => {
  // Maydon yaqinda qo'shildi va eski hisoblarda bo'sh: sxemadagi
  // standart qiymat mavjud hujjatlarga tushmaydi. Ularni "2 yil
  // kirmagan" deb ko'rsatish yolg'on bo'lardi.
  const idleBlock = DASH.slice(DASH.indexOf("const idle ="));
  assert.ok(idleBlock.includes("t.lastLoginAt &&"));
});

test("bloklangan va o'chirilayotgan hisoblar ro'yxatlarga tushmaydi", () => {
  assert.ok(DASH.includes("t.isActive !== false"));
  assert.ok(DASH.includes("!t.deletionScheduledFor"));
});

test("telefon raqami ro'yxatda bor — qo'ng'iroq qilish uchun", () => {
  // Ro'yxatning butun ma'nosi qo'ng'iroq: raqamsiz u shunchaki
  // xafa qiladigan sanoq bo'lib qoladi.
  const block = DASH.slice(DASH.indexOf("const expiringSoon"));
  assert.ok(block.includes("phone: t.phone"));
});

// ── lastLoginAt yozilishi ───────────────────────────────────

const AUTH = fs.readFileSync(
  path.join(__dirname, "../src/controllers/authController.js"),
  "utf8",
);

test("kirishda lastLoginAt yoziladi (ikkala yo'lda ham)", () => {
  const hits = AUTH.split("lastLoginAt").length - 1;
  assert.ok(hits >= 2, `faqat ${hits} joyda yozilyapti`);
});

test("⚠️ lastLoginAt yozuvi kirishni SEKINLASHTIRMAYDI", () => {
  // `await` qo'yilsa har bir kirish bitta yozuvni kutib turardi.
  assert.ok(!AUTH.includes("await Teacher.updateOne({ _id: teacher._id }, { $set: { lastLoginAt"));
  assert.ok(AUTH.includes(".catch(() => {})"));
});
