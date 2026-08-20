// test/scheduleException.test.js
// "Bu kuni dars bo'lmaydi". Eng nozik joyi — KO'CHIRILGAN dars:
// u eski kunidan chiqib ketishi VA yangi kunida paydo bo'lishi
// kerak. Faqat bittasi ishlasa, dars yo ikki marta ko'rinadi,
// yo butunlay yo'qoladi — va ikkovi ham ustozni eshik oldida
// qoldiradi.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isDate,
  addDays,
  dateList,
  applyExceptions,
  overlapping,
} = require("../src/utils/scheduleDay");
const { buildLessonMessage } = require("../src/services/notify");
const { projectDayOfWeek } = require("../src/utils/supportSlots");
const ScheduleException = require("../src/models/ScheduleException");

// 2026-08-25 — seshanba (loyihada 1), 2026-08-29 — shanba (5)
const TUE = "2026-08-25";
const SAT = "2026-08-29";

const lesson = (over) => ({
  _id: "s1",
  class: "c1",
  teacher: "t1",
  dayOfWeek: 1, // seshanba
  startTime: "18:00",
  endTime: "19:30",
  roomRef: "r1",
  room: "205",
  ...over,
});

const ex = (over) => ({
  _id: "e1",
  schedule: "s1",
  class: "c1",
  date: TUE,
  type: "cancelled",
  reason: "holiday",
  ...over,
});

// ── Sana yordamchilari ───────────────────────────────────────

test("sana shakli tekshiriladi", () => {
  assert.equal(isDate("2026-08-25"), true);
  assert.equal(isDate("25.08.2026"), false);
  assert.equal(isDate(""), false);
  assert.equal(isDate(null), false);
});

test("oy va yil chegarasida kun qo'shish to'g'ri ishlaydi", () => {
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("bayram oralig'i ikkala chekkani ham o'z ichiga oladi", () => {
  assert.deepEqual(dateList("2026-03-21", "2026-03-23"), [
    "2026-03-21",
    "2026-03-22",
    "2026-03-23",
  ]);
  assert.deepEqual(dateList("2026-03-21", "2026-03-21"), ["2026-03-21"]);
});

// ⚠️ Chegara bo'lmasa adashib yozilgan "2026 → 2030" oralig'i
//    minglab istisno yozuvini yasab qo'yardi.
test("oraliq chegaradan oshmaydi va teskari oraliq bo'sh qaytadi", () => {
  assert.equal(dateList("2026-01-01", "2026-12-31", 5).length, 5);
  assert.deepEqual(dateList("2026-03-23", "2026-03-21"), []);
  assert.deepEqual(dateList("kecha", "bugun"), []);
});

// ── Bekor qilingan dars ──────────────────────────────────────

test("bekor qilingan dars o'sha kuni ro'yxatdan chiqadi", () => {
  const l = lesson();
  const r = applyExceptions({
    lessons: [l],
    exceptions: [ex()],
    date: TUE,
    dayOfWeek: 1,
  });

  assert.equal(r.lessons.length, 0);
  assert.equal(r.cancelled.length, 1);
  assert.equal(r.cancelled[0].exception.reason, "holiday");
});

test("boshqa kunning istisnosi darsga tegmaydi", () => {
  const r = applyExceptions({
    lessons: [lesson()],
    exceptions: [ex({ date: "2026-09-01" })],
    date: TUE,
    dayOfWeek: 1,
  });

  assert.equal(r.lessons.length, 1);
  assert.equal(r.cancelled.length, 0);
});

test("boshqa darsning istisnosi bu darsni bekor qilmaydi", () => {
  const r = applyExceptions({
    lessons: [lesson(), lesson({ _id: "s2", startTime: "20:00", endTime: "21:00" })],
    exceptions: [ex({ schedule: "s2" })],
    date: TUE,
    dayOfWeek: 1,
  });

  assert.deepEqual(
    r.lessons.map((l) => l._id),
    ["s1"],
  );
});

// ── Ko'chirilgan dars ────────────────────────────────────────

test("ko'chirilgan dars ESKI kunida ko'rinmaydi", () => {
  const r = applyExceptions({
    lessons: [lesson()],
    exceptions: [
      ex({ type: "moved", newDate: SAT, newStartTime: "10:00", newEndTime: "11:30" }),
    ],
    date: TUE,
    dayOfWeek: 1,
  });

  assert.equal(r.lessons.length, 0);
  assert.equal(r.cancelled[0].exception.type, "moved");
});

test("ko'chirilgan dars YANGI kunida yangi vaqt va xona bilan chiqadi", () => {
  const r = applyExceptions({
    lessons: [lesson()],
    exceptions: [
      ex({
        type: "moved",
        newDate: SAT,
        newStartTime: "10:00",
        newEndTime: "11:30",
        newRoomRef: "r9",
        newRoom: "301",
      }),
    ],
    date: SAT,
    dayOfWeek: 5, // shanba — darsning o'z kuni EMAS
  });

  assert.equal(r.lessons.length, 1);
  const moved = r.lessons[0];
  assert.equal(moved.startTime, "10:00");
  assert.equal(moved.endTime, "11:30");
  assert.equal(moved.room, "301");
  assert.equal(String(moved.roomRef), "r9");
  assert.equal(moved.movedFrom, TUE);
  // Guruh va ustoz asl darsdan keladi — ular o'zgarmaydi
  assert.equal(moved.class, "c1");
  assert.equal(moved.teacher, "t1");
});

// ⚠️ Dars o'chirilgan bo'lsa (jadvaldan olib tashlangan),
//    istisno osilib qoladi. U hech qayerda "arvoh dars" bo'lib
//    chiqmasligi kerak.
test("darsi yo'q istisno ro'yxatga arvoh dars qo'shmaydi", () => {
  const r = applyExceptions({
    lessons: [],
    exceptions: [
      ex({ type: "moved", newDate: SAT, newStartTime: "10:00", newEndTime: "11:30" }),
    ],
    date: SAT,
    dayOfWeek: 5,
  });

  assert.equal(r.lessons.length, 0);
});

test("darslar vaqt bo'yicha tartiblanadi — ko'chib kelgani ham", () => {
  const r = applyExceptions({
    lessons: [
      lesson({ _id: "s1", dayOfWeek: 5, startTime: "15:00", endTime: "16:00" }),
      lesson({ _id: "s2" }), // seshanba, ko'chiriladi
    ],
    exceptions: [
      ex({
        schedule: "s2",
        type: "moved",
        newDate: SAT,
        newStartTime: "09:00",
        newEndTime: "10:00",
      }),
    ],
    date: SAT,
    dayOfWeek: 5,
  });

  assert.deepEqual(
    r.lessons.map((l) => l.startTime),
    ["09:00", "15:00"],
  );
});

// ── Ziddiyat ─────────────────────────────────────────────────

test("ketma-ket darslar ziddiyat emas, ustma-ust tushgani — ziddiyat", () => {
  const lessons = [lesson({ _id: "s1", startTime: "18:00", endTime: "19:00" })];

  assert.equal(
    overlapping({ lessons, startTime: "19:00", endTime: "20:00" }).length,
    0,
  );
  assert.equal(
    overlapping({ lessons, startTime: "18:30", endTime: "19:30" }).length,
    1,
  );
});

test("o'z darsining ustiga ko'chirish ziddiyat bermaydi", () => {
  const lessons = [lesson({ _id: "s1" })];
  const found = overlapping({
    lessons,
    startTime: "18:00",
    endTime: "19:30",
    skip: (l) => String(l._id) === "s1",
  });
  assert.equal(found.length, 0);
});

test("ziddiyat faqat mos ustoz (yoki xona) bo'yicha sanaladi", () => {
  const lessons = [
    lesson({ _id: "s1", teacher: "t1" }),
    lesson({ _id: "s2", teacher: "t2" }),
  ];
  const found = overlapping({
    lessons,
    startTime: "18:00",
    endTime: "19:00",
    match: (l) => l.teacher === "t2",
  });
  assert.deepEqual(
    found.map((l) => l._id),
    ["s2"],
  );
});

// ── Hafta kuni ───────────────────────────────────────────────
// ⚠️ Loyihada 0 = Dushanba, JS `getDay()` da 0 = Yakshanba.
//    Bu test o'sha o'girishni qulflab turadi: bir kun surilib
//    ketgan istisno faqat ota-ona eshik oldida qolganda
//    bilinardi.

test("sana loyiha hafta kuniga to'g'ri o'giriladi", () => {
  assert.equal(projectDayOfWeek(TUE), 1); // seshanba
  assert.equal(projectDayOfWeek(SAT), 5); // shanba
  assert.equal(projectDayOfWeek("2026-08-30"), 6); // yakshanba
  assert.equal(projectDayOfWeek("2026-08-24"), 0); // dushanba
});

// ── Model qoidasi ────────────────────────────────────────────

test("ko'chirilgan dars yangi sanasiz saqlanmaydi", () => {
  const doc = new ScheduleException({
    director: "000000000000000000000001",
    schedule: "000000000000000000000002",
    class: "000000000000000000000003",
    date: TUE,
    type: "moved",
  });
  const err = doc.validateSync();
  assert.ok(err, "yangi sanasiz 'moved' o'tib ketmasligi kerak");
});

test("bekor qilish qo'shimcha maydonsiz ham to'g'ri", () => {
  const doc = new ScheduleException({
    director: "000000000000000000000001",
    schedule: "000000000000000000000002",
    class: "000000000000000000000003",
    date: TUE,
    type: "cancelled",
  });
  assert.equal(doc.validateSync(), undefined);
});

// ── Ota-onaga ketadigan xabar ────────────────────────────────
// ⚠️ Bayram uch kun bo'lsa ham BITTA xabar ketadi. Uchta
//    alohida xabar — shovqin; ota-ona botni o'chiradi va keyin
//    rostdan muhim xabarni ham ko'rmaydi.

test("bekor qilingan kunlar bitta xabarda ro'yxat bo'lib chiqadi", () => {
  const text = buildLessonMessage({
    className: "Ingliz A2",
    cancelled: ["2026-03-21", "2026-03-22"],
    reason: "holiday",
  });

  assert.match(text, /Ingliz A2/);
  assert.match(text, /21 Mart 2026/);
  assert.match(text, /22 Mart 2026/);
  assert.match(text, /bayram/);
});

test("ko'chirilgan dars xabarida yangi kun va vaqt bor", () => {
  const text = buildLessonMessage({
    className: "Ingliz A2",
    moved: [{ date: TUE, newDate: SAT, newStartTime: "10:00" }],
  });

  assert.match(text, /29 Avgust 2026/);
  assert.match(text, /10:00/);
});

test("izoh berilsa xabarga qo'shiladi, berilmasa bo'sh qator qolmaydi", () => {
  const withNote = buildLessonMessage({
    className: "A1",
    cancelled: [TUE],
    note: "Ustoz kasal",
  });
  assert.match(withNote, /Ustoz kasal/);

  const plain = buildLessonMessage({ className: "A1", cancelled: [TUE] });
  assert.doesNotMatch(plain, /💬/);
  assert.ok(!plain.endsWith("\n"));
});
