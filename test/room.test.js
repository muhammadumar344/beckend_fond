// test/room.test.js
// Xona bandligi. Eng nozik joyi — bitta xona bazada IKKI XIL
// ko'rinishda yotadi: yangi darslarda `roomRef` (haqiqiy xona),
// eskilarida esa faqat matn. Tekshiruv ikkalasini ham bir xil
// kalitga keltira olishi kerak, aks holda yangi dars eski
// darsning ustiga jimgina tushib ketadi.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normaliseRoomName,
  roomKeyOf,
  pickRoomConflicts,
  timesOverlap,
} = require("../src/utils/roomAvailability");

// ── Nomni soddalashtirish ────────────────────────────────────

test("registr, bo'shliq va tire farqi bitta xonani ikkitaga bo'lmaydi", () => {
  const want = "lab1";
  assert.equal(normaliseRoomName("Lab-1"), want);
  assert.equal(normaliseRoomName("lab 1"), want);
  assert.equal(normaliseRoomName("LAB - 1"), want);
  assert.equal(normaliseRoomName("  Lab_1  "), want);
});

test("bo'sh nom bo'sh kalit beradi", () => {
  assert.equal(normaliseRoomName(""), "");
  assert.equal(normaliseRoomName("   "), "");
  assert.equal(normaliseRoomName(null), "");
  assert.equal(normaliseRoomName(undefined), "");
});

test("har xil xonalar har xil kalit beradi", () => {
  assert.notEqual(normaliseRoomName("205"), normaliseRoomName("206"));
});

// ── Kalit ────────────────────────────────────────────────────

test("roomRef bo'lsa matn e'tiborga olinmaydi", () => {
  // Nom nusxasi eskirgan bo'lishi mumkin (xona qayta nomlangan).
  // Haqiqat — id, matn emas.
  assert.equal(roomKeyOf({ roomRef: "abc123", room: "eski nom" }), "id:abc123");
});

test("roomRef yo'q bo'lsa nomdan kalit yasaladi", () => {
  assert.equal(roomKeyOf({ room: "Lab-1" }), "name:lab1");
});

test("xonasiz dars hech kimga xalaqit qilmaydi", () => {
  assert.equal(roomKeyOf({}), null);
  assert.equal(roomKeyOf({ room: "" }), null);
  assert.equal(roomKeyOf({ room: "   " }), null);
});

// ── Ziddiyat topish ──────────────────────────────────────────

const lesson = (over) => ({
  _id: "s1",
  roomRef: null,
  room: "205",
  startTime: "18:00",
  endTime: "19:30",
  dayOfWeek: 0,
  class: { _id: "c1", name: "Ingliz A2" },
  ...over,
});

test("bir xil xona, kesishgan vaqt — ziddiyat", () => {
  const found = pickRoomConflicts([lesson()], "name:205", "19:00", "20:00");
  assert.equal(found.length, 1);
});

test("boshqa xona — ziddiyat yo'q", () => {
  const found = pickRoomConflicts([lesson()], "name:206", "18:00", "19:30");
  assert.equal(found.length, 0);
});

test("ketma-ket darslar bitta xonada ziddiyat emas", () => {
  // 18:00–19:30 tugadi, 19:30–21:00 boshlanadi. Bloklasak bitta
  // xonaga kuniga bittadan ortiq dars qo'yib bo'lmasdi.
  const found = pickRoomConflicts([lesson()], "name:205", "19:30", "21:00");
  assert.equal(found.length, 0);
});

test("tahrirlanayotgan darsning o'zi ziddiyat sanalmaydi", () => {
  // Busiz dars vaqtini tahrirlaganda u o'z-o'ziga "band" derdi.
  const found = pickRoomConflicts([lesson()], "name:205", "18:00", "19:30", "s1");
  assert.equal(found.length, 0);
});

test("xonasiz dars hech qachon ziddiyat bermaydi", () => {
  const found = pickRoomConflicts([lesson({ room: "" })], "name:205", "18:00", "19:30");
  assert.equal(found.length, 0);
});

test("kalit bo'sh bo'lsa tekshiruv umuman ishlamaydi", () => {
  // Xona tanlanmagan dars — bandlik tushunchasi yo'q.
  assert.deepEqual(pickRoomConflicts([lesson()], null, "18:00", "19:30"), []);
});

test("yangi (roomRef) va eski (matn) dars bir xil nom bilan uchrashadi", () => {
  // Aynan shu holat uchun `normaliseRoomName` kerak: eski dars
  // "205 " deb yozilgan, yangisi xonaga bog'langan. Ular BIR XIL
  // xona bo'lsa ham kalitlari har xil — shuning uchun import
  // (`POST /lc/rooms/import`) kerak. Test shu chegarani qulflaydi:
  // xatti-harakat kutilgan, tasodifiy emas.
  const eski = lesson({ _id: "s2", room: "205 " });
  const yangiKalit = "id:room-205";
  assert.equal(pickRoomConflicts([eski], yangiKalit, "18:00", "19:30").length, 0);
  // Import qilingandan keyin ikkalasi ham id kaliti bilan yuradi
  const importQilingan = lesson({ _id: "s2", roomRef: "room-205", room: "205" });
  assert.equal(
    pickRoomConflicts([importQilingan], yangiKalit, "18:00", "19:30").length,
    1,
  );
});

test("bir nechta dars orasidan faqat kesishgani qaytadi", () => {
  const kun = [
    lesson({ _id: "a", startTime: "09:00", endTime: "10:30" }),
    lesson({ _id: "b", startTime: "11:00", endTime: "12:30" }),
    lesson({ _id: "c", startTime: "14:00", endTime: "15:30" }),
  ];
  const found = pickRoomConflicts(kun, "name:205", "12:00", "14:30");
  assert.deepEqual(
    found.map((s) => s._id),
    ["b", "c"],
  );
});

test("vaqt kesishuvi teacherAvailability bilan bir xil qoidada", () => {
  // Ikkala fayl ham "start1 < end2 && start2 < end1" ishlatadi.
  // Agar biri o'zgarsa, ikkinchisi ham o'zgarishi kerak.
  assert.equal(timesOverlap("18:00", "19:00", "19:00", "20:00"), false);
  assert.equal(timesOverlap("18:00", "19:01", "19:00", "20:00"), true);
});
