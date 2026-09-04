// test/churnDigest.test.js
// Haftalik "ketish arafasida" xabari.
//
// Eng muhim ikki qoida:
//   1. BO'SH HAFTA — XABAR YO'Q (kassa xabaridagi `problems`
//      bilan bir xil mantiq: xabar kelsa — ish bor).
//   2. TELEFON RAQAMI XABARDA. Direktor xabarni o'qib o'sha
//      yerdan qo'ng'iroq qiladi; raqam tushib qolsa u CRM'ni
//      ochib qidirishi kerak bo'ladi va ish "keyinroq"ga qoladi.
const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDigest, MAX_ROWS } = require("../src/services/churnDigest");

const student = (over = {}) => ({
  studentId: "1",
  name: "Ali Valiyev",
  className: "Ingliz A2",
  parentPhone: "+998901234567",
  reasons: ["streak"],
  absentStreak: 3,
  missedOfWindow: 3,
  windowSize: 5,
  lastMarkDate: "2026-08-19",
  lastPresentDate: "2026-08-10",
  debtMonths: 0,
  debtAmount: 0,
  contacted: false,
  score: 39,
  ...over,
});

// ── Yuboriladimi ────────────────────────────────────────────

test("bo'sh ro'yxat — xabar yo'q", () => {
  const r = buildDigest({ centerName: "Lumo", students: [] });
  assert.equal(r.hasRisk, false);
  assert.equal(r.count, 0);
});

test("bitta o'quvchi ham xabar sababi", () => {
  const r = buildDigest({ centerName: "Lumo", students: [student()] });
  assert.equal(r.hasRisk, true);
  assert.equal(r.count, 1);
});

// ── Xabar ichida nima bor ───────────────────────────────────

test("ism, guruh va telefon xabarda bo'ladi", () => {
  const r = buildDigest({ centerName: "Lumo", students: [student()] });
  assert.match(r.text, /Ali Valiyev/);
  assert.match(r.text, /Ingliz A2/);
  assert.match(r.text, /\+998901234567/);
});

test("telefon o'z qatorida — Markdown belgilari orasida qolmaydi", () => {
  // Telegram raqamni bosiladigan qiladi, lekin `*` yoki `_`
  // ichida qolsa taniy olmaydi.
  const r = buildDigest({ centerName: "Lumo", students: [student()] });
  const line = r.text.split("\n").find((l) => l.includes("+998901234567"));
  assert.equal(line.trim(), "+998901234567");
});

test("sabab yoziladi: ketma-ket kelmagan darslar", () => {
  const r = buildDigest({
    centerName: "Lumo",
    students: [student({ absentStreak: 4 })],
  });
  assert.match(r.text, /ketma-ket 4 dars/);
});

test("surilib ketayotgan o'quvchi boshqacha yoziladi", () => {
  // Ketma-ket emas, lekin oxirgi 5 darsdan 3 tasiga kelmagan.
  const r = buildDigest({
    centerName: "Lumo",
    students: [
      student({ absentStreak: 1, missedOfWindow: 3, reasons: ["drifting"] }),
    ],
  });
  assert.match(r.text, /oxirgi 5 darsdan 3 tasiga/);
  assert.doesNotMatch(r.text, /ketma-ket/);
});

test("qarz bo'lsa summa bilan ko'rinadi", () => {
  const r = buildDigest({
    centerName: "Lumo",
    students: [student({ debtMonths: 2, debtAmount: 800000 })],
  });
  assert.match(r.text, /2 oy/);
  assert.match(r.text, /800 000/);
});

test("qarz yo'q bo'lsa qarz qatori umuman yozilmaydi", () => {
  const r = buildDigest({ centerName: "Lumo", students: [student()] });
  assert.doesNotMatch(r.text, /qarz/);
});

test("telefonsiz o'quvchi xabarni buzmaydi", () => {
  // Raqam kiritilmagan bo'lishi mumkin — "undefined" chiqmasin.
  const r = buildDigest({
    centerName: "Lumo",
    students: [student({ parentPhone: "" })],
  });
  assert.match(r.text, /Ali Valiyev/);
  assert.doesNotMatch(r.text, /undefined/);
});

// ── Uzunlik ─────────────────────────────────────────────────

test("uzun ro'yxat qirqiladi va qolgani sanaladi", () => {
  // Yigirmata ismli xabar ro'yxat emas, devor bo'lib qoladi.
  const many = Array.from({ length: MAX_ROWS + 5 }, (_, i) =>
    student({ studentId: String(i), name: `O'quvchi ${i}` }),
  );
  const r = buildDigest({ centerName: "Lumo", students: many });

  assert.equal(r.count, MAX_ROWS + 5);
  assert.match(r.text, new RegExp(`va yana 5 ta`));
  assert.match(r.text, /O'quvchi 0/);
  assert.doesNotMatch(r.text, new RegExp(`O'quvchi ${MAX_ROWS}\\b`));
});

// ── Keyingi qadam ───────────────────────────────────────────

test("belgilash haqida eslatma va havola bor", () => {
  // Busiz keyingi dushanba aynan o'sha ismlar keladi va
  // direktor ikkinchi marta qo'ng'iroq qiladi.
  const r = buildDigest({
    centerName: "Lumo",
    students: [student()],
    link: "https://schoolfonds.uz/lc/at-risk",
  });
  assert.match(r.text, /belgilab qo'ying/);
  assert.match(r.text, /schoolfonds\.uz\/lc\/at-risk/);
});

test("havola berilmasa xabar baribir to'liq", () => {
  const r = buildDigest({ centerName: "Lumo", students: [student()] });
  assert.match(r.text, /belgilab qo'ying/);
  assert.doesNotMatch(r.text, /undefined/);
});

// ── Cron: qachon va kimga ───────────────────────────────────
// Fayl matni bo'yicha tekshiriladi — cron'ning o'zi bazaga
// ulanadi, test esa hech qachon ulanmaydi.

const fs = require("node:fs");
const path = require("node:path");

const CRON = fs.readFileSync(
  path.join(__dirname, "../src/cron/churnDigestCron.js"),
  "utf8",
);

test("dushanba 09:00, Toshkent vaqti", () => {
  // Server UTC da ishlaydi; mintaqasiz yozilsa xabar
  // O'zbekistonda soat 14:00 da kelardi.
  assert.ok(CRON.includes('"0 9 * * 1"'));
  assert.ok(CRON.includes('timezone: "Asia/Tashkent"'));
});

test("faqat LC va faqat yoqib qo'yganlarga", () => {
  // Fond — bitta sinf rahbari, u bolalarni har kuni ko'radi.
  //
  // ⚠️ `$ne: "off"` shart: Mongoose standart qiymatni faqat
  //    hujjat saqlanganda yozadi, ya'ni mavjud hisoblarda
  //    `churnDigest` maydoni bazada umuman yo'q. Aniq
  //    qiymat bo'yicha qidirsak, xususiyat faqat yangi
  //    hisoblarda ishlagan bo'lardi.
  assert.ok(CRON.includes('institutionType: "learning_center"'));
  assert.ok(CRON.includes('"churnDigest.mode": { $ne: "off" }'));
});

test("o'chirilayotgan va bloklangan hisoblar chetlab o'tiladi", () => {
  assert.ok(CRON.includes("deletionScheduledFor: null"));
  assert.ok(CRON.includes("isActive"));
});

test("bo'sh hafta — xabar yuborilmaydi", () => {
  assert.ok(CRON.includes("if (!hasRisk)"));
});

test("bot bloklansa (403) ulanish tozalanadi", () => {
  // Aks holda har dushanba log'ga bir xil xato yozilib turardi.
  assert.ok(CRON.includes("error_code === 403"));
  assert.ok(CRON.includes('"telegram.chatId": null'));
});

test("bitta direktordagi xato qolganlarini to'xtatmaydi", () => {
  const loop = CRON.slice(CRON.indexOf("for (const dir of directors)"));
  assert.ok(loop.includes("try {"));
});
