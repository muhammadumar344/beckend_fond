// test/checkDead.test.js
// Guardrail'ning o'zi ishlayaptimi.
//
// ⚠️ Tekshiruv skriptining eng katta xavfi — SOXTA XATO. Birinchi
//    urinishda u 44 ta nom qaytardi (konstantalar, testlar uchun
//    eksport qilingan cron funksiyalari) va shunday ro'yxatga
//    hech kim qaramaydi: guardrail o'zi shovqinga aylanadi.
//    Shuning uchun heuristika o'tkirlashtirildi va aynan shu
//    o'tkirlik test bilan qulflanadi.
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../src/scripts/checkDead.js");
const run = () => {
  try {
    return { code: 0, out: execFileSync("node", [SCRIPT], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || "") };
  }
};

test("hozirgi kod toza — exit 0", () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test("konstantalar tekshirilmaydi (soxta xatoning asosiy manbai)", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("isConstantName"));
});

test("o'z faylida ishlatiladigan funksiya o'lik hisoblanmaydi", () => {
  // Cron funksiyalari test uchun eksport qilinadi, lekin o'z
  // faylidagi `startXCron` ularni chaqiradi.
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("usedInOwnFile"));
});

test("ataylab qoldirilganlar izoh bilan yozilgan", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const allow = src.slice(src.indexOf("const ALLOW"), src.indexOf("]);"));
  // Har bir nom uchun sabab bo'lsin — "shunchaki o'chirib qo'yish"
  // guardrail'ni ma'nosiz qiladi.
  assert.ok(allow.includes("//"), "ALLOW ro'yxatida izoh yo'q");
  assert.ok(allow.includes("getStudents"));
});

test("npm run check ichida", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"),
  );
  assert.match(pkg.scripts.check, /check:dead/);
});

test("⚠️ eksport qatorining O'ZI 'ishlatilgan' deb sanalmaydi", () => {
  // Birinchi variantda aynan shu sabab guardrail o'z sinovidan
  // o'tmadi: ataylab qo'shilgan, hech kim chaqirmaydigan funksiya
  // "ishlatilyapti" bo'lib chiqdi (ta'rif + module.exports = 2 ta).
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("withoutExports"));
});

test("eksport blokidagi QIYMAT esa sanaladi", () => {
  // `requireSchoolMode: requireMode("school")` — bu yerda
  // `requireMode` haqiqatan ishlatilyapti. Blokni butunlay
  // o'chirsak, u soxta xato bo'lib chiqardi.
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("kalit ketdi, qiymat qoldi"));
});

test("ataylab qo'shilgan o'lik funksiyani ushlaydi", () => {
  // Guardrail'ni ataylab buzib sinash — loyihadagi qoida.
  const target = path.join(__dirname, "../src/services/churnDigest.js");
  const original = fs.readFileSync(target, "utf8");
  try {
    fs.writeFileSync(
      target,
      original.replace(
        "module.exports = {",
        "function sinovUchunOlikFunksiya() { return 1; }\n\nmodule.exports = { sinovUchunOlikFunksiya,",
      ),
    );
    const r = run();
    assert.equal(r.code, 1, "o'lik funksiya ushlanmadi");
    assert.match(r.out, /sinovUchunOlikFunksiya/);
  } finally {
    fs.writeFileSync(target, original);
  }
});
