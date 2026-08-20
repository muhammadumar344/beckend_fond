// test/slotFinder.test.js
// Bo'sh vaqt qidirgichi. Eng nozik joyi — javob HECH QACHON
// shunchaki "topilmadi" bo'lmasligi kerak: hech nima bo'lmasa
// `blocked` da NEGA bo'lmagani turadi. Administrator "topilmadi"
// dan keyin nima qilishini bilmaydi, "xona yo'q" dan keyin —
// biladi.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findFreeSlots,
  freeTeachersAt,
  freeRoomsAt,
  candidateWindows,
  countUnlinkedLessons,
  toMin,
  toTime,
  REASON,
} = require("../src/utils/slotFinder");

const T1 = { _id: "t1", name: "Malika" };
const T2 = { _id: "t2", name: "Aziz" };
const R1 = { _id: "r1", name: "205", capacity: 12 };
const R2 = { _id: "r2", name: "206", capacity: 0 }; // sig'im belgilanmagan

const lesson = (over) => ({
  _id: "s1",
  dayOfWeek: 0,
  startTime: "18:00",
  endTime: "19:30",
  teacher: "t1",
  roomRef: "r1",
  room: "205",
  ...over,
});

// ── Vaqt o'girish ────────────────────────────────────────────

test("vaqt daqiqaga va orqaga aylanadi", () => {
  assert.equal(toMin("09:00"), 540);
  assert.equal(toMin("18:30"), 1110);
  assert.equal(toTime(540), "09:00");
  assert.equal(toTime(1110), "18:30");
});

test("chiqishda nol bilan to'ldiriladi — matn solishtiruvi shunga tayanadi", () => {
  // "9:00" bo'lsa "18:00" bilan solishtiruv teskari ishlardi.
  assert.equal(toTime(toMin("09:05")), "09:05");
  assert.ok(toTime(540) < "18:00");
});

// ── Nomzod oynalar ───────────────────────────────────────────

test("oynalar qadam bilan yasaladi", () => {
  const w = candidateWindows("18:00", "21:00", 90, 30);
  assert.deepEqual(
    w.map((x) => x.startTime),
    ["18:00", "18:30", "19:00", "19:30"],
  );
  assert.equal(w.at(-1).endTime, "21:00");
});

test("oxirgi oyna chegaradan oshib ketmaydi", () => {
  // 18:00–20:00 oralig'iga 90 daqiqalik dars faqat bir marta sig'adi
  const w = candidateWindows("18:00", "20:00", 90, 30);
  assert.equal(w.length, 2);
  assert.equal(w.at(-1).endTime, "20:00");
});

test("dars oynadan uzun bo'lsa umuman oyna bo'lmaydi", () => {
  assert.deepEqual(candidateWindows("18:00", "19:00", 90, 30), []);
});

// ── Ustoz bandligi ───────────────────────────────────────────

test("darsda turgan ustoz bo'sh emas", () => {
  const free = freeTeachersAt([T1, T2], [lesson()], "18:00", "19:30");
  assert.deepEqual(free.map((t) => t._id), ["t2"]);
});

test("ketma-ket dars ustozni band qilmaydi", () => {
  // 18:00–19:30 tugadi, 19:30–21:00 boshlanadi
  const free = freeTeachersAt([T1, T2], [lesson()], "19:30", "21:00");
  assert.equal(free.length, 2);
});

test("boshqa kundagi dars bu kunga ta'sir qilmaydi", () => {
  // findFreeSlots kun bo'yicha filtrlaydi — bu yerda kirish allaqachon
  // bitta kunniki, shuning uchun ro'yxat bo'sh bo'lsa hamma bo'sh
  const free = freeTeachersAt([T1, T2], [], "18:00", "19:30");
  assert.equal(free.length, 2);
});

// ── Xona bandligi va sig'imi ─────────────────────────────────

test("band xona ro'yxatdan chiqadi", () => {
  const free = freeRoomsAt([R1, R2], [lesson()], "18:00", "19:30");
  assert.deepEqual(free.map((r) => r._id), ["r2"]);
});

test("sig'imi yetmaydigan xona chiqarib tashlanadi", () => {
  // 12 joylik xonaga 20 bola — bu yerda savol "qayerda dars
  // o'tsam bo'ladi", shuning uchun ko'rsatishning ma'nosi yo'q
  const free = freeRoomsAt([R1], [], "09:00", "10:30", 20);
  assert.equal(free.length, 0);
});

test("sig'imi yetadigan xona qoladi", () => {
  const free = freeRoomsAt([R1], [], "09:00", "10:30", 12);
  assert.equal(free.length, 1);
});

test("sig'imi belgilanmagan xona har doim qoladi", () => {
  // Noma'lumni "kichik" deb hisoblash yolg'on bo'lardi
  const free = freeRoomsAt([R2], [], "09:00", "10:30", 100);
  assert.deepEqual(free.map((r) => r._id), ["r2"]);
});

test("matn bilan yozilgan dars haqiqiy xonani band qilmaydi", () => {
  // Ma'lum cheklov: kalit `name:205`, xonaniki `id:r1`. Import
  // (`POST /lc/rooms/import`) shuni yopadi. Test buni QULFLAYDI —
  // xatti-harakat kutilgan, tasodifiy emas.
  const matn = lesson({ roomRef: null, room: "205" });
  const free = freeRoomsAt([R1], [matn], "18:00", "19:30");
  assert.equal(free.length, 1);
  // Shu sababli ogohlantirish sanovi bor:
  assert.equal(countUnlinkedLessons([matn]), 1);
  assert.equal(countUnlinkedLessons([lesson()]), 0);
});

// ── To'liq qidiruv ───────────────────────────────────────────

const base = {
  teachers: [T1, T2],
  rooms: [R1, R2],
  days: [0],
  from: "18:00",
  to: "21:00",
  duration: 90,
  step: 30,
};

test("hamma bo'sh bo'lsa barcha oyna qaytadi", () => {
  const r = findFreeSlots({ ...base, schedules: [] });
  assert.equal(r.days[0].slots.length, 4);
  assert.equal(r.blocked.length, 0);
});

test("band ustoz va xona oynadan chiqarib tashlanadi", () => {
  const r = findFreeSlots({ ...base, schedules: [lesson()] });
  const s = r.days[0].slots.find((x) => x.startTime === "18:00");
  // T1 darsda, R1 band — qolgani ko'rinadi
  assert.deepEqual(s.teachers.map((t) => t._id), ["t2"]);
  assert.deepEqual(s.rooms.map((x) => x._id), ["r2"]);
});

test("ustoz bo'lmasa oyna emas, SABAB qaytadi", () => {
  const r = findFreeSlots({
    ...base,
    teachers: [T1],
    schedules: [lesson()],
  });
  assert.equal(r.days[0].slots.length, 1); // faqat 19:30
  const b = r.blocked.find((x) => x.startTime === "18:00");
  assert.equal(b.reason, REASON.NO_TEACHER);
});

test("xona bo'lmasa sabab boshqacha", () => {
  const r = findFreeSlots({
    ...base,
    rooms: [R1],
    schedules: [lesson({ teacher: "t9" })], // ustoz boshqa, xona R1 band
  });
  const b = r.blocked.find((x) => x.startTime === "18:00");
  assert.equal(b.reason, REASON.NO_ROOM);
});

test("ikkalasi ham bo'lmasa alohida sabab", () => {
  const r = findFreeSlots({
    ...base,
    teachers: [T1],
    rooms: [R1],
    schedules: [lesson()],
  });
  const b = r.blocked.find((x) => x.startTime === "18:00");
  assert.equal(b.reason, REASON.NO_BOTH);
});

test("hech nima topilmasa javob bo'sh EMAS — sabab bor", () => {
  // Eng muhim test. "Topilmadi" javob emas.
  const r = findFreeSlots({
    ...base,
    teachers: [T1],
    rooms: [R1],
    schedules: [lesson({ startTime: "18:00", endTime: "21:00" })],
  });
  assert.equal(r.days[0].slots.length, 0);
  assert.ok(r.blocked.length > 0, "sabab ko'rsatilishi shart");
  assert.ok(r.blocked.every((b) => b.reason === REASON.NO_BOTH));
});

test("har bir kun alohida hisoblanadi", () => {
  const r = findFreeSlots({
    ...base,
    days: [0, 1],
    teachers: [T1],
    rooms: [R1],
    // faqat dushanba band
    schedules: [lesson({ dayOfWeek: 0, startTime: "18:00", endTime: "21:00" })],
  });
  assert.equal(r.days[0].slots.length, 0);
  assert.equal(r.days[1].slots.length, 4);
});

test("guruh sig'maydigan xona oynani yopadi", () => {
  const r = findFreeSlots({
    ...base,
    rooms: [R1], // 12 joy
    schedules: [],
    students: 20,
  });
  assert.equal(r.days[0].slots.length, 0);
  assert.ok(r.blocked.every((b) => b.reason === REASON.NO_ROOM));
});

test("limit kuniga tushadigan oyna sonini cheklaydi", () => {
  const r = findFreeSlots({
    ...base,
    from: "08:00",
    to: "22:00",
    step: 15,
    schedules: [],
    limit: 3,
  });
  assert.equal(r.days[0].slots.length, 3);
});
