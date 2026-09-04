// test/nPlusOne.test.js
// Halqa ichida so'rov yubormaslik.
//
// Bu loyihada uchta joyda bir xil naqsh bor edi: ro'yxatni olib,
// har bir element uchun alohida so'rov yuborish. Eng yomoni —
// `MonthlyPayment.find({ class })`: u sinfning BUTUN tarixini
// xotiraga yuklab, keyin JS'da yig'ardi. Uch yillik markazda bu
// o'n minglab hujjat degani, va aynan eng ko'p ochiladigan
// sahifalarda (Dashboard, Sinflar, Admin paneli).
//
// ⚠️ Test manba matnini o'qiydi: bazaga ulanmaymiz, lekin
//    naqshning qaytib kelishini ushlaymiz.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (rel) =>
  fs.readFileSync(path.join(__dirname, "../src", rel), "utf8");

const TEACHER = read("controllers/teacherController.js");
const ADMIN = read("controllers/adminController.js");

test("teacherController da halqa ichida so'rov yo'q", () => {
  assert.ok(!TEACHER.includes(".map(async"), "map(async …) qaytib kelgan");
});

test("adminController da ham yo'q", () => {
  assert.ok(!ADMIN.includes("teachers.map(async"));
});

test("sinf statistikasi bazada yig'iladi", () => {
  const fn = TEACHER.slice(
    TEACHER.indexOf("const getMyClasses"),
    TEACHER.indexOf("const getClassesForStaff"),
  );
  assert.ok(fn.includes("MonthlyPayment.aggregate("));
  assert.ok(fn.includes("Expense.aggregate("));
  // Butun tarixni xotiraga tortadigan chaqiruv qolmasin
  assert.ok(!fn.includes("MonthlyPayment.find({ class: cls._id })"));
});

test("o'quvchilar soni buildGroupStudentMap orqali", () => {
  // ⚠️ Bu funksiya aynan N+1 dan qochish uchun yozilgan
  //    (`utils/enrollment.js`), lekin bu yerda ishlatilmasdi.
  const fn = TEACHER.slice(
    TEACHER.indexOf("const getMyClasses"),
    TEACHER.indexOf("const getClassesForStaff"),
  );
  assert.ok(fn.includes("buildGroupStudentMap(classIds)"));
  assert.ok(!fn.includes("await countGroupStudents(cls._id)"));
});

test("dashboard ham aggregate ishlatadi", () => {
  const fn = TEACHER.slice(TEACHER.indexOf("const getDashboard"));
  assert.ok(fn.includes("dashClassIds"));
  assert.ok(!fn.includes("const classAllPaid = await MonthlyPayment.find("));
});

test("hisob mantig'i saqlangan: to'lanmagan = jami − to'langan", () => {
  const fn = TEACHER.slice(
    TEACHER.indexOf("const getMyClasses"),
    TEACHER.indexOf("const getClassesForStaff"),
  );
  assert.ok(fn.includes("unpaidCount: (total.get(id) || 0) - p.n"));
});

test("boshlang'ich balans qoldiqqa qo'shilishda davom etadi", () => {
  const fn = TEACHER.slice(
    TEACHER.indexOf("const getMyClasses"),
    TEACHER.indexOf("const getClassesForStaff"),
  );
  assert.ok(fn.includes("(cls.initialBalance || 0) + collectedOnSite"));
});
