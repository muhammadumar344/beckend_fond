// test/supportWindow.test.js
// ════════════════════════════════════════════════════════════
// Yozilish oynasi: ertadan +7 kungacha.
//
// ⚠️ NEGA SINALADI: bu qoida IKKI joyda ko'rinadi — Mini App
//    tugmalarida va serverdagi tekshiruvda. Ular bir-biriga
//    mos kelmasa, o'quvchi ko'ringan kunni tanlab, "Yozilish"
//    bosib, tushunarsiz xato olardi.
//
// ⚠️ Vaqt mintaqasi alohida sinaladi. Render UTC da ishlaydi,
//    o'quvchi esa Toshkentda. Kechqurun soat 19:00 dan keyin
//    (UTC 14:00) sana bir kun surilib ketishi mumkin edi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");

const {
  bookableDates,
  isBookable,
  todayInTashkent,
  addDays,
  daysBetween,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
} = require("../src/utils/supportWindow");

// 15-avgust 2026, Toshkent bo'yicha soat 12:00 (UTC 07:00)
const NOON = Date.UTC(2026, 7, 15, 7, 0, 0);

test("bugun Toshkent bo'yicha aniqlanadi", () => {
  assert.strictEqual(todayInTashkent(NOON), "2026-08-15");
});

test("⚠️ kech soat 23:30 da ham sana surilib ketmaydi", () => {
  // Toshkent 23:30 = UTC 18:30 (o'sha kuni)
  const late = Date.UTC(2026, 7, 15, 18, 30);
  assert.strictEqual(todayInTashkent(late), "2026-08-15");
});

test("⚠️ UTC yarim tunidan keyin Toshkentda allaqachon ertaga", () => {
  // UTC 20:00 = Toshkentda ertasi kun soat 01:00
  const night = Date.UTC(2026, 7, 15, 20, 0);
  assert.strictEqual(todayInTashkent(night), "2026-08-16");
});

test("yetti kun taklif qilinadi va ertadan boshlanadi", () => {
  const dates = bookableDates(NOON);
  assert.strictEqual(dates.length, MAX_DAYS_AHEAD - MIN_DAYS_AHEAD + 1);
  assert.strictEqual(dates.length, 7);
  assert.strictEqual(dates[0], "2026-08-16", "birinchi kun ertaga bo'lsin");
  assert.strictEqual(dates[6], "2026-08-22");
  assert.ok(!dates.includes("2026-08-15"), "⚠️ bugun ro'yxatda bo'lmasin");
});

test("⚠️ bugunga yozilib bo'lmaydi", () => {
  const r = isBookable("2026-08-15", NOON);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /bugun/i);
});

test("o'tgan kunga ham yozilib bo'lmaydi", () => {
  assert.strictEqual(isBookable("2026-08-10", NOON).ok, false);
});

test("ertaga — mumkin", () => {
  assert.strictEqual(isBookable("2026-08-16", NOON).ok, true);
});

test("yettinchi kun — hali mumkin", () => {
  assert.strictEqual(isBookable("2026-08-22", NOON).ok, true);
});

test("⚠️ sakkizinchi kun — endi mumkin emas", () => {
  const r = isBookable("2026-08-23", NOON);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /7/);
});

test("buzuq sana rad etiladi", () => {
  for (const bad of ["", null, "15-08-2026", "2026/08/16", "kecha", "2026-8-6"]) {
    assert.strictEqual(isBookable(bad, NOON).ok, false, `"${bad}" o'tib ketdi`);
  }
});

test("bookableDates dagi HAR BIR kun isBookable dan o'tadi", () => {
  // Ikkalasi bitta qoidaga tayanishi shart — aks holda
  // interfeys ko'rsatgan kun serverda rad etilardi
  for (const d of bookableDates(NOON)) {
    assert.strictEqual(isBookable(d, NOON).ok, true, `${d} rad etildi`);
  }
});

test("oy va yil chegarasidan o'tadi", () => {
  // 28-dekabr → yanvarga o'tib ketadi
  const dec = Date.UTC(2026, 11, 28, 7, 0);
  const dates = bookableDates(dec);
  assert.strictEqual(dates[0], "2026-12-29");
  assert.strictEqual(dates[6], "2027-01-04");
  for (const d of dates) assert.strictEqual(isBookable(d, dec).ok, true);
});

test("kabisa yili fevrali to'g'ri sanaladi", () => {
  // 2028 kabisa yili — 29-fevral bor
  const feb = Date.UTC(2028, 1, 26, 7, 0);
  const dates = bookableDates(feb);
  assert.ok(dates.includes("2028-02-29"), "29-fevral tushib qolgan");
});

test("yordamchi funksiyalar", () => {
  assert.strictEqual(addDays("2026-08-31", 1), "2026-09-01");
  assert.strictEqual(daysBetween("2026-08-15", "2026-08-22"), 7);
  assert.strictEqual(daysBetween("2026-08-22", "2026-08-15"), -7);
});

// ── QR vaqt oynasi ──────────────────────────────────────────
const { qrWindow, tashkentEpoch } = require("../src/utils/supportWindow");

const BOOKING = { date: "2026-08-16", startTime: "13:00", endTime: "13:30" };
/** Toshkent bo'yicha o'sha kuni soat HH:MM */
const at = (hh, mm = 0) => tashkentEpoch("2026-08-16", `${hh}:${String(mm).padStart(2, "0")}`);

test("⚠️ mashg'ulot boshlanmaguncha QR yopiq", () => {
  const w = qrWindow(BOOKING, at(12, 59));
  assert.strictEqual(w.open, false);
  assert.strictEqual(w.expired, false);
  assert.strictEqual(w.secondsUntilOpen, 60);
});

test("ertalabdan beri yopiq — 'keldim' qilib ketib bo'lmaydi", () => {
  // Aynan shu teshik uchun tekshiruv qo'shilgan edi: ilgari
  // ustoz QR ni istalgan paytda ocha olardi
  assert.strictEqual(qrWindow(BOOKING, at(8)).open, false);
  assert.ok(qrWindow(BOOKING, at(8)).secondsUntilOpen > 0);
});

test("boshlanish daqiqasida ochiladi", () => {
  assert.strictEqual(qrWindow(BOOKING, at(13, 0)).open, true);
});

test("oxirgi daqiqada hali ochiq", () => {
  assert.strictEqual(qrWindow(BOOKING, at(13, 29)).open, true);
});

test("⚠️ tugash daqiqasida yopiladi", () => {
  // Cron shu chegaradan keyin "kelmadi" deb belgilaydi —
  // ikkalasi bir xil vaqtga tayanishi shart
  const w = qrWindow(BOOKING, at(13, 30));
  assert.strictEqual(w.open, false);
  assert.strictEqual(w.expired, true);
});

test("kechqurun ham yopiq", () => {
  assert.strictEqual(qrWindow(BOOKING, at(20)).open, false);
  assert.strictEqual(qrWindow(BOOKING, at(20)).expired, true);
});

test("⚠️ vaqt Toshkent bo'yicha, server mintaqasi bo'yicha emas", () => {
  // 13:00 Toshkent = 08:00 UTC. Server UTC da ishlaydi, ya'ni
  // mintaqa hisobga olinmasa QR besh soat kech ochilardi.
  assert.strictEqual(tashkentEpoch("2026-08-16", "13:00"), Date.UTC(2026, 7, 16, 8, 0));
});

test("ertangi mashg'ulot bugun ochilmaydi", () => {
  const tomorrow = { date: "2026-08-17", startTime: "13:00", endTime: "13:30" };
  assert.strictEqual(qrWindow(tomorrow, at(13, 0)).open, false);
  assert.strictEqual(qrWindow(tomorrow, at(13, 0)).expired, false);
});

test("⚠️ QR yopilishi va cron'ning 'kelmadi' chegarasi BIR XIL", () => {
  // Ikkalasi ajralib ketsa yomon holat chiqardi: cron yozuvni
  // "kelmadi" deb belgilab bo'lgan, QR esa hali ochiq turardi —
  // o'quvchi skanerlaydi, lekin allaqachon jazolangan bo'ladi.
  //
  // ⚠️ `supportCron` ni import qilish XAVFSIZ: u faqat funksiya
  //    e'lon qiladi, `startSupportCron()` chaqirilmasa hech
  //    qanday interval ishga tushmaydi.
  const { closeMoment } = require("../src/cron/supportCron");

  for (const b of [
    { date: "2026-08-16", startTime: "13:00", endTime: "13:30" },
    { date: "2026-01-01", startTime: "09:00", endTime: "09:20" },
    { date: "2026-12-31", startTime: "23:00", endTime: "23:45" },
  ]) {
    assert.strictEqual(
      qrWindow(b).closesAt,
      closeMoment(b),
      `${b.date} ${b.endTime} — chegaralar mos kelmadi`,
    );
  }
});
