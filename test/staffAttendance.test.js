// test/staffAttendance.test.js
// ════════════════════════════════════════════════════════════
// Xodim davomatining SOF mantig'i — bazasiz sinaladi.
//
// ⚠️ Bu yerda pul bor: kechikish → jarima → maosh. Chegaradagi
//    xato "5 daqiqa kechikkan odam jarima to'ladi" degani, va
//    bunday xatoni xodim BIRINCHI oyda sezadi. Shuning uchun
//    chegara alohida sinaladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");

const {
  judge,
  normalizeSettings,
  monthOf,
  FALLBACK,
} = require("../src/services/staffAttendance");
const Teacher = require("../src/models/Teacher");

// ── Kechikish chegarasi ─────────────────────────────────────
test("o'z vaqtida kelgan — kechikish yo'q", () => {
  const r = judge("09:00", "09:00", 5);
  assert.strictEqual(r.status, "present");
  assert.strictEqual(r.lateMinutes, 0);
});

test("erta kelgan ham 'keldi'", () => {
  assert.strictEqual(judge("09:00", "08:45", 5).status, "present");
});

test("⚠️ grace ICHIDA kelgan kechikkan HISOBLANMAYDI", () => {
  // Aynan chegarada — 5 daqiqa kechikish, grace ham 5
  const r = judge("09:00", "09:05", 5);
  assert.strictEqual(r.status, "present");
  assert.strictEqual(r.lateMinutes, 0, "grace ichida daqiqa yozilmasin");
});

test("⚠️ grace dan bir daqiqa oshsa — kechikish", () => {
  const r = judge("09:00", "09:06", 5);
  assert.strictEqual(r.status, "late");
  assert.strictEqual(r.lateMinutes, 6, "daqiqa BOSHIDAN sanaladi, grace'dan emas");
});

test("uzoq kechikish to'g'ri sanaladi", () => {
  assert.strictEqual(judge("15:00", "15:47", 5).lateMinutes, 47);
});

test("grace nol bo'lsa bir daqiqa ham kechikish", () => {
  assert.strictEqual(judge("09:00", "09:01", 0).status, "late");
});

test("vaqt noma'lum bo'lsa jarima yozilmaydi", () => {
  // Kutilgan vaqt yo'q — xodimning jadvali umuman yo'q.
  // Shubhali holatda odamni jazolamaymiz.
  assert.strictEqual(judge("", "09:30", 5).status, "present");
  assert.strictEqual(judge("09:00", "", 5).status, "present");
});

test("soat chegarasidan o'tadi", () => {
  assert.strictEqual(judge("09:55", "10:10", 5).lateMinutes, 15);
});

// ── Sozlama ─────────────────────────────────────────────────
test("⚠️ zaxira qiymat modeldagi `default` bilan bir xil", () => {
  // Ular ajralib ketsa, sozlanmagan markazda jarima kutilmaganda
  // paydo bo'lib qolardi
  const at = (k) => Teacher.schema.path(`staffAttendance.${k}`);
  const def = (k) => {
    const p = at(k);
    assert.ok(p, `staffAttendance.${k} sxemada yo'q`);
    return typeof p.defaultValue === "function" ? p.defaultValue() : p.defaultValue;
  };

  assert.strictEqual(def("graceMinutes"), FALLBACK.graceMinutes);
  assert.strictEqual(def("workStart"), FALLBACK.workStart);
  assert.strictEqual(def("latePenalty"), FALLBACK.latePenalty);
  assert.strictEqual(def("absentPenalty"), FALLBACK.absentPenalty);
});

test("⚠️ standart holda O'CHIQ va jarimasiz", () => {
  // Kuzatuv va jarima — markazning ongli qarori bo'lishi kerak,
  // yangilanishdan keyin o'zi yoqilib ketmasin
  const s = normalizeSettings(undefined);
  assert.strictEqual(s.enabled, false);
  assert.strictEqual(s.latePenalty, 0);
  assert.strictEqual(s.absentPenalty, 0);
});

test("qisman sozlama — qolgani zaxiradan", () => {
  const s = normalizeSettings({ enabled: true, latePenalty: 20000 });
  assert.strictEqual(s.enabled, true);
  assert.strictEqual(s.latePenalty, 20000);
  assert.strictEqual(s.graceMinutes, 5);
  assert.strictEqual(s.workStart, "09:00");
});

test("nol qiymat zaxiraga almashib ketmaydi", () => {
  // ⚠️ `||` ishlatilsa `graceMinutes: 0` jimgina 5 ga aylanardi
  assert.strictEqual(normalizeSettings({ graceMinutes: 0 }).graceMinutes, 0);
  assert.strictEqual(normalizeSettings({ latePenalty: 0 }).latePenalty, 0);
});

// ── Oy kaliti ───────────────────────────────────────────────
test("sanadan oy kaliti", () => {
  assert.strictEqual(monthOf("2026-08-15"), "2026-08");
  assert.strictEqual(monthOf("2026-01-01"), "2026-01");
});

test("oy kaliti Salary modeli formatiga mos", () => {
  // Salary.month sxemasi shu shaklni talab qiladi
  assert.match(monthOf("2026-12-31"), /^\d{4}-(0[1-9]|1[0-2])$/);
});
