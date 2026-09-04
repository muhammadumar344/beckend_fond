// test/studentPurge.test.js
// O'quvchi o'chirilganda unga tegishli HAMMA narsa ham.
//
// ⚠️ Ilgari faqat to'lovlari o'chirilardi. Davomat, baholar,
//    uy vazifasi natijalari, qo'shimcha guruhlarga yozilishi va
//    Telegram bog'lanishi bazada EGASIZ qolardi — davomat foizi
//    esa o'sha yozuvlarni sanashda davom etardi, ya'ni guruh
//    statistikasi abadiy noto'g'ri chiqardi.
//
// Bu test `accountPurge` bilan bir xil qoidada: modellar
// papkasini SKANERLAYDI va ro'yxatdan tushib qolgan modelni
// topadi. Yangi model qo'shilganda test o'zi ogohlantiradi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { OWNED, OTHER } = require("../src/utils/studentPurge");

const MODELS_DIR = path.join(__dirname, "../src/models");
const listed = new Set([...OWNED, ...OTHER].map(([name]) => name));

test("`student` maydoni bor har bir model ro'yxatda", () => {
  const missing = [];

  for (const file of fs.readdirSync(MODELS_DIR)) {
    if (!file.endsWith(".js")) continue;
    const name = file.replace(/\.js$/, "");
    const src = fs.readFileSync(path.join(MODELS_DIR, file), "utf8");

    // Sxemada o'quvchiga ishora qiluvchi maydon bormi
    const refsStudent =
      /\bstudent\s*:\s*\{[\s\S]{0,200}?ref:\s*["']Student["']/.test(src) ||
      /\bstudentId\s*:\s*\{[\s\S]{0,200}?ref:\s*["']Student["']/.test(src);

    // `Student` ning o'zi va `Group` (Class bilan bitta to'plam)
    if (!refsStudent || name === "Student" || name === "Group") continue;
    if (!listed.has(name)) missing.push(name);
  }

  assert.deepEqual(
    missing,
    [],
    `studentPurge ro'yxatiga qo'shilmagan model: ${missing.join(", ")}`,
  );
});

test("ro'yxatdagi har bir model haqiqatan mavjud", () => {
  for (const [name] of [...OWNED, ...OTHER]) {
    const file = path.join(MODELS_DIR, `${name}.js`);
    assert.ok(fs.existsSync(file), `${name} modeli yo'q`);
  }
});

test("⚠️ TelegramParent boshqa maydon nomini ishlatadi", () => {
  // Eski bot ro'yxati `studentId` deb yozadi. `student` deb
  // izlasak, hech narsa o'chmasdi va xato ham bermasdi.
  const entry = OTHER.find(([n]) => n === "TelegramParent");
  assert.ok(entry);
  assert.equal(entry[1], "studentId");
});

// ── Ulanish ─────────────────────────────────────────────────

const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/teacherController.js"),
  "utf8",
);

test("deleteStudent purgeStudent ni chaqiradi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const deleteStudent"));
  assert.ok(fn.includes("purgeStudent(studentId)"));
  // Eski qo'lda o'chirish qolmasin
  const code = fn
    .slice(0, fn.indexOf("const createMonthlyPayments"))
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
  assert.ok(!code.includes("MonthlyPayment.deleteMany({ student: studentId })"));
});

test("nima o'chirilgani jurnalga tushadi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const deleteStudent"));
  assert.ok(fn.includes("o'chirilgan yozuvlar"));
});
