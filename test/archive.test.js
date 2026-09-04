// test/archive.test.js
// Arxiv — o'chirishning o'rniga.
//
// ⚠️ Ilgari guruhni "yopish" ning yagona yo'li `deleteClass` /
//    `deleteGroup` edi va ular guruh bilan birga BARCHA
//    o'quvchi, to'lov va xarajatni o'chirardi. Ya'ni o'tgan
//    o'quv yilini yopish uchun o'sha yilning butun moliyaviy
//    tarixini yo'q qilish kerak bo'lardi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (rel) =>
  fs.readFileSync(path.join(__dirname, "../src", rel), "utf8");

const CLASS_MODEL = read("models/Class.js");
const GROUP_MODEL = read("models/Group.js");
const TEACHER = read("controllers/teacherController.js");
const GROUPS = read("controllers/groupController.js");

test("Class va Group bir xil maydonga ega (bitta kolleksiya)", () => {
  assert.ok(CLASS_MODEL.includes("archivedAt"));
  assert.ok(GROUP_MODEL.includes("archivedAt"));
});

test("⚠️ `isActive` emas, `archivedAt` — qachon yopilgani ham kerak", () => {
  // Bulean "qachon" degan savolga javob bermaydi, hisobotda esa
  // aynan shu so'raladi.
  const block = CLASS_MODEL.slice(CLASS_MODEL.indexOf("archivedAt"));
  assert.ok(block.includes("type: Date"));
});

test("arxivdagi guruh ro'yxatda ko'rinmaydi, lekin so'ralsa keladi", () => {
  assert.ok(TEACHER.includes('req.query.includeArchived !== "1"'));
  assert.ok(GROUPS.includes('req.query.includeArchived !== "1"'));
});

test("⚠️ filtr `archivedAt: null` — eski hujjatlarda maydon YO'Q", () => {
  // Mongo'da `{ archivedAt: null }` maydoni umuman yo'q hujjatni
  // ham topadi. `{ archivedAt: { $exists: false } }` yozsak yoki
  // `false` bilan solishtirsak, eski sinflar ro'yxatdan
  // yo'qolardi (sxemadagi standart qiymat mavjud hujjatlarga
  // tushmaydi — loyihadagi ma'lum tuzoq).
  assert.ok(TEACHER.includes("query.archivedAt = null"));
  assert.ok(GROUPS.includes("query.archivedAt = null"));
});

test("arxivdagi guruh tarif chegarasini band qilmaydi", () => {
  // O'tgan yilni yopgan direktor yangi guruh ocholmay qolmasin.
  const fn = TEACHER.slice(
    TEACHER.indexOf("const createClass"),
    TEACHER.indexOf("const getMyClasses"),
  );
  assert.ok(fn.includes("archivedAt: null"));
});

test("updateClass arxivni HAQIQATAN yozadi", () => {
  // Ilgari `cls.isActive = isActive` turgandi va sxemada bunday
  // maydon yo'q edi — Mongoose uni jimgina tashlab yuborardi.
  const fn = TEACHER.slice(TEACHER.indexOf("const updateClass"));
  assert.ok(fn.includes("cls.archivedAt = archived ? new Date() : null"));
  // Izohda eski satr tarix sifatida qoladi — faqat KOD qaraladi
  const code = fn
    .slice(0, fn.indexOf("const updateInitialBalance"))
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
  assert.ok(!code.includes("cls.isActive"));
});

test("LC guruhida ham arxivlash bor", () => {
  const fn = GROUPS.slice(GROUPS.indexOf("exports.updateGroup"));
  assert.ok(fn.includes("group.archivedAt = archived ? new Date() : null"));
});
