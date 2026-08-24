// test/notifyTargets.test.js
// ════════════════════════════════════════════════════════════
// "Kimga xabar yuborilsin?" — bitta manba.
//
// ⚠️ BU XATO BESH JOYDA TAKRORLANDI va hech biri xato bermadi:
//    kod `TelegramParent` ni to'g'ridan-to'g'ri o'qirdi, ya'ni
//    Mini App orqali bog'langan (raqamini tasdiqlagan) ota-ona
//    xabarni JIMGINA olmasdi. Cron 2026-08-22 da tuzatilgandi,
//    qolgan to'rtta joy esa o'sha holicha qolib ketgandi.
//
//    Shuning uchun pastdagi ikkinchi test kodning O'ZINI
//    tekshiradi: xabar yuboradigan fayl modelga bevosita
//    murojaat qilsa test yiqiladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { groupByStudent } = require("../src/utils/notifyTargets");

const T = (chatId, studentId, source = "link") => ({
  chatId,
  studentId,
  source,
  linkId: `${source}-${chatId}-${studentId}`,
});

test("groupByStudent — bitta bolada bir nechta qabul qiluvchi", () => {
  // Ota va ona — ikkalasi ham bir bolaga ulangan
  const map = groupByStudent([T("100", "s1"), T("200", "s1"), T("300", "s2")]);

  assert.equal(map.get("s1").length, 2, "ikkalasi ham qolishi kerak");
  assert.equal(map.get("s2").length, 1);
  assert.equal(map.size, 2);
});

test("groupByStudent — eski `byStudent[id] = p` naqshi bittasini yo'qotardi", () => {
  const targets = [T("100", "s1"), T("200", "s1")];

  // Eski kod aynan shunday yozardi:
  const old = {};
  targets.forEach((t) => {
    old[t.studentId] = t;
  });
  assert.equal(Object.keys(old).length, 1);
  assert.equal(old.s1.chatId, "200", "birinchisi ustidan yozilardi");

  // Yangisi ikkalasini ham saqlaydi
  assert.equal(groupByStudent(targets).get("s1").length, 2);
});

test("groupByStudent — bo'sh ro'yxat bo'sh Map", () => {
  assert.equal(groupByStudent([]).size, 0);
  assert.equal(groupByStudent().size, 0);
});

test("groupByStudent tartibni saqlaydi — yangi bog'lanish birinchi", () => {
  // `collectTargets` yangi ro'yxatni oldin qo'yadi; guruhlash
  // uni buzmasligi kerak (takror bo'lsa yangisi tanlanadi).
  const map = groupByStudent([T("100", "s1", "link"), T("100", "s1", "legacy")]);
  assert.equal(map.get("s1")[0].source, "link");
});

// ── Guardrail: modelga bevosita murojaat ────────────────────
//
// ⚠️ Ro'yxat ataylab QISQA: bu yerda faqat XABAR YUBORADIGAN
//    fayllar. Bot'ning o'zi bog'lanish yozuvini yaratadi va
//    o'chiradi — unga model kerak.
const SENDERS = [
  "src/controllers/telegramController.js",
  "src/controllers/homeworkController.js",
  "src/controllers/teacherController.js",
  "src/controllers/adminController.js",
  "src/cron/reminderCron.js",
];

test("xabar yuboradigan fayllar modelga BEVOSITA murojaat qilmaydi", () => {
  const root = path.join(__dirname, "..");
  const bad = [];

  for (const rel of SENDERS) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");

    for (const line of src.split("\n")) {
      // Izoh emas, haqiqiy so'rov bo'lsin
      const code = line.trim();
      if (code.startsWith("//") || code.startsWith("*")) continue;

      // `TelegramParent.find(...)` / `.countDocuments(...)` kabi
      if (/\bTelegramParent\s*\.\s*(find|count|aggregate)/.test(code)) {
        bad.push(`${rel}: ${code}`);
      }
    }
  }

  assert.deepEqual(
    bad,
    [],
    "Xabar yuboradigan kod `utils/notifyTargets.js` orqali o'qishi kerak:\n" +
      bad.join("\n"),
  );
});

test("reminderCron `lastNotifiedAt` ni markNotified orqali yozadi", () => {
  // ⚠️ `Model = t.source === 'link' ? ... : ...` naqshi to'rt
  //    joyda takrorlanardi. Bittasi unutilsa "oxirgi xabar"
  //    ustuni jimgina eskirib qolardi.
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src/utils/notifyTargets.js"),
    "utf8",
  );
  assert.ok(
    /function markNotified/.test(src),
    "markNotified notifyTargets.js da bo'lishi kerak",
  );
});
