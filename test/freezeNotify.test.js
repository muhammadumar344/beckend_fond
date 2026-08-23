// test/freezeNotify.test.js
// Obuna muzlatilganda direktorga xabar.
//
// ⚠️ Xabar matni allaqachon yozilgan edi (`telegramService.js`),
//    lekin hech qayerdan chaqirilmasdi — yozilgan paytda
//    direktorga xabar yuboradigan kanalning o'zi yo'q edi.
//    Bu turdagi xato bu loyihada to'rtinchi marta takrorlandi,
//    shuning uchun ULANISHNING O'ZI ham test bilan qulflanadi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { pickRecipients } = require("../src/services/freezeNotify");

const dir = (over = {}) => ({
  _id: "1",
  name: "Direktor",
  telegram: { chatId: 12345 },
  isActive: true,
  deletionScheduledFor: null,
  ...over,
});

test("faqat Telegram'ga ulanganlar", () => {
  const list = pickRecipients([
    dir(),
    dir({ _id: "2", telegram: { chatId: null } }),
    dir({ _id: "3", telegram: {} }),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0]._id, "1");
});

test("o'chirilayotgan hisob bezovta qilinmaydi", () => {
  const list = pickRecipients([
    dir(),
    dir({ _id: "2", deletionScheduledFor: new Date() }),
  ]);
  assert.equal(list.length, 1);
});

test("bloklangan hisob ham chetlab o'tiladi", () => {
  const list = pickRecipients([dir({ isActive: false })]);
  assert.equal(list.length, 0);
});

test("bo'sh ro'yxat yiqilmaydi", () => {
  assert.deepEqual(pickRecipients(), []);
  assert.deepEqual(pickRecipients([null, undefined]), []);
});

// ── Ulanish ─────────────────────────────────────────────────

const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/freezeController.js"),
  "utf8",
);

test("freeze yoqilganda xabar yuboriladi", () => {
  assert.ok(CTRL.includes("notifyFrozen"));
});

test("freeze o'chirilganda ham xabar yuboriladi", () => {
  assert.ok(CTRL.includes("notifyRestored"));
});

test("xabar FONDA yuboriladi — admin so'rovi kutib turmasin", () => {
  // 200 ta hisob + 200 ta Telegram xabari = so'rov timeout bo'lardi.
  assert.ok(CTRL.includes("inBackground(freezeNotify.notifyFrozen"));
  assert.ok(CTRL.includes("inBackground(freezeNotify.notifyRestored"));
});

test("rejim tanloviga qaramaydi — bu hisob haqidagi xabar", () => {
  // `cashReport.mode` / `churnDigest.mode` — kunlik shovqin
  // darajasi. Obuna muzlatilishi esa pulga tegadi.
  // Izohlarda ular tilga olinadi (nega qaramasligi yozilgan),
  // shuning uchun faqat KOD qatorlari tekshiriladi.
  const code = fs
    .readFileSync(path.join(__dirname, "../src/services/freezeNotify.js"), "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
  assert.ok(!code.includes("cashReport"));
  assert.ok(!code.includes("churnDigest"));
});

test("403 bo'lsa ulanish tozalanadi", () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, "../src/services/freezeNotify.js"),
    "utf8",
  );
  assert.ok(SRC.includes("error_code === 403"));
  assert.ok(SRC.includes('"telegram.chatId": null'));
});
