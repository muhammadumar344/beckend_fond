// test/groupMigration.test.js
// ════════════════════════════════════════════════════════════
// MIGRATSIYA SKRIPTI JONLI MA'LUMOTGA TEGMASIN.
//
// `src/scripts/migrateGroups.js` **B varianti** uchun yozilgan:
// `Group` alohida kolleksiyada bo'lishi kerak edi. Loyihada esa
// **A varianti** deploy qilingan — `models/Group.js` aynan
// `classes` kolleksiyasiga bog'langan.
//
// Shu holatda skript ikki xil zarar keltiradi:
//   · `--apply`    → o'sha `_id` bilan o'sha kolleksiyaga yozadi
//   · `--rollback` → JONLI `classes` dan o'chirishga urinadi
//
// HANDOFF va CLAUDE.md esa "bazadan nusxa oling va ishlating"
// deb yozib turibdi. Shuning uchun skript o'zini to'xtatadi va
// bu test o'sha to'xtatuvchini qulflaydi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Group = require("../src/models/Group");
const Class = require("../src/models/Class");

const script = fs.readFileSync(
  path.join(__dirname, "..", "src/scripts/migrateGroups.js"),
  "utf8",
);

test("Group va Class hozir BITTA kolleksiyada (A varianti)", () => {
  assert.equal(Group.collection.name, "classes");
  assert.equal(Class.collection.name, "classes");
});

test("migrateGroups o'zini to'xtatadigan tekshiruvga ega", () => {
  assert.ok(
    /Group\.collection\.name/.test(script) && /Class\.collection\.name/.test(script),
    "kolleksiya nomlari solishtirilishi kerak",
  );
  assert.ok(/process\.exit\(1\)/.test(script), "to'xtaganda exit 1");
});

test("tekshiruv bazaga ULANISHDAN OLDIN chaqiriladi", () => {
  // ⚠️ Tartib muhim: noto'g'ri holatda umuman ulanmagan ma'qul.
  //    Ulangandan keyin to'xtasak ham zarar yo'q, lekin
  //    `.env` dagi ISHLAB TURGAN bazaga ulanib o'tirishning
  //    ma'nosi yo'q (bu loyihada bir marta bot'ni buzgan xato).
  const guard = script.indexOf("guardSameCollection();");
  const connect = script.indexOf("mongoose.connect");
  assert.ok(guard > 0, "guardSameCollection() chaqirilmagan");
  assert.ok(guard < connect, "tekshiruv connect'dan oldin turishi kerak");
});

test("`migratedFromClass` sxemada yo'q — marker yozilmaydi", () => {
  // Skript shu maydonni yozadi va keyin u bo'yicha o'chiradi.
  // Mongoose uni jimgina tashlab yuboradi (strict rejim), ya'ni
  // "allaqachon ko'chirilgan" ro'yxati DOIM bo'sh bo'lardi va
  // rollback hech narsa topmasdi. Skript to'xtatilgani uchun bu
  // endi zarar keltirmaydi — lekin holatning o'zi yozib qo'yilsin.
  assert.equal(
    Group.schema.path("migratedFromClass"),
    undefined,
    "maydon paydo bo'lsa, rollback JONLI `classes` ga tushadi — " +
      "skriptni avval alohida kolleksiyaga o'tkazing",
  );
});

// ── Boshqa migratsiya skriptlari ────────────────────────────
//
// ⚠️ BAZAGA YOZADIGAN SKRIPT QURUQ YURISHSIZ BO'LMASIN.
//    Bu loyihada uchtasi shunday edi va ikkitasi jonli
//    bazada zarar keltirardi. Skript bir marta ishlatiladi,
//    odatda shoshib va Render Shell'da — u yerda "orqaga"
//    tugmasi yo'q.
const WRITERS = [
  "src/scripts/migrateExistingTeachers.js",
  "src/scripts/fixRolePermissions.js",
  "src/scripts/migrateGroups.js",
];

test("bazaga yozadigan har bir skriptda `--apply` bor", () => {
  const bad = [];
  for (const rel of WRITERS) {
    const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    if (!/--apply/.test(src)) bad.push(rel);
  }
  assert.deepEqual(bad, [], "quruq yurishsiz skript: " + bad.join(", "));
});

test("teacher migratsiyasi tanlangan rejimga TEGMAYDI", () => {
  // ⚠️ `institutionType` ro'yxatdan o'tishda tanlanadi va keyin
  //    o'zgartirilmaydi. Skript uni majburan `school` qilardi —
  //    ya'ni onboarding'ni tugatmagan LC direktori jimgina
  //    Fond'ga aylanardi va butun LC menyusini yo'qotardi.
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src/scripts/migrateExistingTeachers.js"),
    "utf8",
  );
  assert.ok(
    /institutionType: \{ \$exists: false \}/.test(src),
    "filtr faqat rejimi tanlanmagan hisoblarni olishi kerak",
  );
  assert.ok(
    !/institutionName: ''/.test(src),
    "`institutionName` bo'shatilmasin — to'ldirgan odam ma'lumotini yo'qotardi",
  );
});
