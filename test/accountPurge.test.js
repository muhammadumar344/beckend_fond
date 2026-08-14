// test/accountPurge.test.js
// ════════════════════════════════════════════════════════════
// Hisob o'chirilganda ORQADA MA'LUMOT QOLMASLIGINI tekshiradi.
//
// Bu testning asosiy vazifasi — kelajakdagi unutuvchanlikni
// ushlash. Kimdir yangi model qo'shsa va uni `accountPurge.js`
// ro'yxatiga kiritmasa, o'chirilgan direktorning hujjatlari
// bazada egasiz qolib ketadi. Buni qo'lda sezish deyarli
// imkonsiz — shuning uchun test modellar papkasini o'zi o'qiydi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { OWNED } = require("../src/utils/accountPurge");

const MODELS_DIR = path.join(__dirname, "..", "src", "models");

// Ro'yxatda ATAYLAB yo'q modellar va sababi
const EXEMPT = {
  // Direktorning o'zi — purgeDirector oxirida alohida o'chiradi
  Teacher: "o'zi",
  // `classes` to'plamida Class bilan BIR XIL hujjatlar
  Group: "Class bilan bitta to'plam",
  // Direktor maydoni yo'q — sinf orqali o'chiriladi
  Student: "class orqali",
  // Platforma admini, direktorga tegishli emas
  Admin: "platforma admini",
  // Global sozlama, egasiz
  FreezeSettings: "global sozlama",
};

/** Modellar papkasidagi hamma fayl nomi */
const modelNames = fs
  .readdirSync(MODELS_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.basename(f, ".js"));

test("purge ro'yxati — Teacher'ga bog'langan HAR BIR model qamrab olingan", () => {
  const listed = new Set(OWNED.map(([name]) => name));
  const missing = [];

  for (const name of modelNames) {
    if (EXEMPT[name]) continue;
    const src = fs.readFileSync(path.join(MODELS_DIR, `${name}.js`), "utf8");
    const refsTeacher = /ref:\s*['"]Teacher['"]/.test(src);
    if (refsTeacher && !listed.has(name)) missing.push(name);
  }

  assert.deepEqual(
    missing,
    [],
    `Bu modellar accountPurge.js ro'yxatiga qo'shilmagan — ` +
      `hisob o'chirilganda ularning hujjatlari bazada qoladi: ${missing.join(", ")}`,
  );
});

test("purge ro'yxatidagi maydon nomlari modelda rostdan bor", () => {
  for (const [name, field] of OWNED) {
    const file = path.join(MODELS_DIR, `${name}.js`);
    assert.ok(fs.existsSync(file), `${name}.js topilmadi`);
    const src = fs.readFileSync(file, "utf8");
    // `field:` shaklida e'lon qilinganmi
    const re = new RegExp(`(^|[\\s{,])${field}\\s*:`, "m");
    assert.ok(
      re.test(src),
      `${name} modelida "${field}" maydoni yo'q — o'chirish filtri ` +
        `hech narsaga mos kelmaydi va hujjatlar qolib ketadi`,
    );
  }
});

test("purge ro'yxatida takror yo'q", () => {
  const names = OWNED.map(([n]) => n);
  assert.equal(
    names.length,
    new Set(names).size,
    "Bir model ikki marta yozilgan",
  );
});

test("Group ataylab chiqarilgan — Class bilan bitta to'plamda", () => {
  const listed = new Set(OWNED.map(([name]) => name));
  assert.ok(listed.has("Class"), "Class ro'yxatda bo'lishi shart");
  assert.ok(
    !listed.has("Group"),
    "Group ro'yxatda BO'LMASLIGI kerak — `classes` to'plamini ikki marta o'chirardi",
  );

  // Group rostdan ham `classes` to'plamiga bog'langanmi
  const groupSrc = fs.readFileSync(path.join(MODELS_DIR, "Group.js"), "utf8");
  assert.match(
    groupSrc,
    /"classes"|'classes'/,
    "Group.js endi `classes` to'plamiga bog'lanmagan — yuqoridagi farazni qayta ko'ring",
  );
});
