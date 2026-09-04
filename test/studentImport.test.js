// test/studentImport.test.js
// Excel'dan o'quvchilarni import qilish.
//
// Yangi markaz 200 ta o'quvchini qo'lda kiritishi kerak edi —
// tizimga o'tishning eng katta to'sig'i. Ro'yxat esa allaqachon
// uning Excel faylida.
//
// Eng muhim qoidalar:
//   1. Avval KO'RSATADI, keyin yozadi.
//   2. Takror bola ikki marta tushmaydi — telefon oxirgi 9 raqam
//      bo'yicha solishtiriladi (`utils/phone.js` qoidasi).
//   3. Yarim import yo'q: chegaradan oshsa hech narsa yozilmaydi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const {
  parseTable,
  readFile,
  MAX_ROWS,
} = require("../src/services/studentImport");

// ── Ustun nomlari ───────────────────────────────────────────

test("o'zbekcha sarlavhalar taniladi", () => {
  const r = parseTable([
    ["F.I.O", "Ota-ona telefoni"],
    ["Ali Valiyev", "901234567"],
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].name, "Ali Valiyev");
  assert.equal(r.rows[0].phone, "901234567");
});

test("inglizcha va ruscha sarlavhalar ham", () => {
  assert.equal(parseTable([["Name", "Phone"], ["A", "1"]]).rows.length, 1);
  assert.equal(parseTable([["Имя", "Телефон"], ["B", "2"]]).rows.length, 1);
});

test("katta-kichik harf va ortiqcha probel muhim emas", () => {
  const r = parseTable([["  ISM  ", "TELEFON"], ["Ali", "901234567"]]);
  assert.equal(r.rows.length, 1);
});

test("ism ustuni topilmasa — tushunarli xato va FAYLDAGI sarlavhalar", () => {
  // Odam nimani tuzatishni bilsin: quruq "xato" foydasiz.
  const r = parseTable([["Kod", "Summa"], ["1", "2"]]);
  assert.equal(r.ok, false);
  assert.match(r.error, /Ism ustuni/);
  assert.deepEqual(r.headers, ["Kod", "Summa"]);
});

test("telefon ustuni bo'lmasa ham import ishlaydi", () => {
  const r = parseTable([["Ism"], ["Ali"], ["Bek"]]);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.hasPhoneColumn, false);
  assert.equal(r.rows[0].phone, "");
});

// ── Takror ──────────────────────────────────────────────────

test("faylda bir xil bola ikki marta bo'lsa — bittasi", () => {
  const r = parseTable([
    ["Ism", "Telefon"],
    ["Ali Valiyev", "+998 90 123 45 67"],
    ["Ali Valiyev", "90 123 45 67"],
  ]);
  // ⚠️ Xom matn bo'yicha solishtirsak ikkalasi ham tushardi:
  //    `998901234567` va `901234567` boshqa satr.
  assert.equal(r.rows.length, 1);
  assert.equal(r.duplicates.length, 1);
  assert.match(r.duplicates[0].reason, /takror/);
});

test("bir xil ismli IKKI BOLA — ikkalasi ham tushadi", () => {
  // Bu haqiqiy hol: "Muhammad Aliyev" bitta guruhda ikkita
  // bo'lishi mumkin. Faqat ism bo'yicha solishtirsak ikkinchisi
  // yo'qolardi.
  const r = parseTable([
    ["Ism", "Telefon"],
    ["Muhammad Aliyev", "901111111"],
    ["Muhammad Aliyev", "902222222"],
  ]);
  assert.equal(r.rows.length, 2);
});

test("bazada bor bola qayta qo'shilmaydi", () => {
  const r = parseTable(
    [["Ism", "Telefon"], ["Ali", "+998901234567"], ["Yangi", "905554433"]],
    [{ name: "ali", parentPhone: "90 123 45 67" }],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].name, "Yangi");
  assert.match(r.duplicates[0].reason, /allaqachon/);
});

// ── Xato qatorlar ───────────────────────────────────────────

test("ismsiz qator o'tkazib yuboriladi va qator raqami yoziladi", () => {
  const r = parseTable([["Ism", "Telefon"], ["", "901234567"], ["Bek", ""]]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.invalid.length, 1);
  assert.equal(r.invalid[0].row, 2); // Excel'dagi haqiqiy qator
});

test("bo'sh qatorlar butunlay e'tiborsiz", () => {
  const r = parseTable([["Ism"], [""], ["   "], ["Ali"]]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.invalid.length, 0);
});

test("bo'sh fayl — tushunarli xato", () => {
  assert.equal(parseTable([]).ok, false);
  assert.equal(parseTable([[""], ["  "]]).ok, false);
});

// ── Uzunlik ─────────────────────────────────────────────────

test("juda uzun fayl qirqiladi va nechta qolgani aytiladi", () => {
  const rows = [["Ism"]];
  for (let i = 0; i < MAX_ROWS + 7; i++) rows.push([`O'quvchi ${i}`]);
  const r = parseTable(rows);
  assert.equal(r.rows.length, MAX_ROWS);
  assert.equal(r.truncated, 7);
});

// ── Haqiqiy fayl ────────────────────────────────────────────

test("haqiqiy .xlsx fayl o'qiladi", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["F.I.O", "Ota-ona telefoni"],
    ["Ali Valiyev", "901234567"],
    ["Bek Toshev", "907654321"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Ro'yxat");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const table = readFile(buf.toString("base64"));
  const r = parseTable(table);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].name, "Bek Toshev");
});

test("CSV ham o'qiladi (odam ko'pincha shuni eksport qiladi)", () => {
  const csv = "Ism,Telefon\nAli,901234567\nBek,907654321\n";
  const table = readFile(Buffer.from(csv).toString("base64"));
  const r = parseTable(table);
  assert.equal(r.rows.length, 2);
});

test("data: prefiksli base64 ham qabul qilinadi", () => {
  const csv = "Ism\nAli\n";
  const b64 = Buffer.from(csv).toString("base64");
  const table = readFile(`data:text/csv;base64,${b64}`);
  assert.equal(parseTable(table).rows.length, 1);
});

// ── Ulanish ─────────────────────────────────────────────────

const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/teacherController.js"),
  "utf8",
);
const ROUTES = fs.readFileSync(
  path.join(__dirname, "../src/routes/teacher.js"),
  "utf8",
);

test("route'ga ulangan (yozilgan-u ulanmagan bo'lib qolmasin)", () => {
  assert.ok(ROUTES.includes("students/import"));
  assert.ok(ROUTES.includes("ctrl.importStudents"));
});

test("avval ko'rsatadi: apply berilmasa yozmaydi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const importStudents"));
  assert.ok(fn.includes("if (!apply)"));
  assert.ok(fn.indexOf("preview: true") < fn.indexOf("insertMany"));
});

test("chegaradan oshsa HECH NARSA yozilmaydi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const importStudents"));
  assert.ok(fn.indexOf("overLimit") < fn.indexOf("insertMany"));
  assert.ok(fn.includes("requiresUpgrade: true"));
});

test("import jurnalga tushadi", () => {
  const fn = CTRL.slice(CTRL.indexOf("const importStudents"));
  assert.ok(fn.includes('action: "student.imported"'));
});
