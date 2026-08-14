// test/notify.test.js
// ════════════════════════════════════════════════════════════
// Xabarnoma qoidalari.
//
// Ikkita narsa muhim va ikkalasi ham jimgina buziladi:
//   1. Ortiqcha xabar — ota-ona botni o'chirib qo'yadi va keyin
//      rostdan muhim xabarni ham ko'rmaydi
//   2. Xabar so'rovni kutdirsa — ustoz "Saqlanmoqda…" ni
//      o'nlab soniya kuzatib turadi
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

const { notableChanges, inBackground } = require("../src/services/notify");

test("⚠️ 'keldi' haqida xabar yuborilmaydi — shovqin bo'lardi", () => {
  const out = notableChanges([
    { studentId: "1", status: "present" },
    { studentId: "2", status: "absent" },
    { studentId: "3", status: "present" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].studentId, "2");
});

test("kelmadi, kechikdi va sababli — uchalasi ham xabar beradi", () => {
  const out = notableChanges([
    { studentId: "1", status: "absent" },
    { studentId: "2", status: "late" },
    { studentId: "3", status: "excused" },
  ]);
  assert.equal(out.length, 3);
});

test("noma'lum holat o'tkazilmaydi", () => {
  const out = notableChanges([
    { studentId: "1", status: "kelajakda_qo_shiladigan_holat" },
    { studentId: "2", status: "" },
    { studentId: "3", status: null },
  ]);
  assert.deepEqual(out, []);
});

test("bo'sh yoki buzuq ro'yxat yiqitmaydi", () => {
  assert.deepEqual(notableChanges([]), []);
  assert.deepEqual(notableChanges(null), []);
  assert.deepEqual(notableChanges(undefined), []);
  assert.deepEqual(notableChanges([null, undefined]), []);
});

test("inBackground darhol qaytadi — so'rovni kutdirmaydi", () => {
  let finished = false;
  const slow = () =>
    new Promise((r) => setTimeout(() => { finished = true; r(); }, 50));

  const t0 = Date.now();
  inBackground(slow, {});
  const elapsed = Date.now() - t0;

  assert.ok(elapsed < 20, `${elapsed}ms kutdi — kutmasligi kerak edi`);
  assert.equal(finished, false, "vazifa hali tugamagan bo'lishi kerak");
});

test("⚠️ inBackground xatoni yutadi — davomat saqlanishi buzilmasin", async () => {
  const boom = async () => {
    throw new Error("Telegram javob bermadi");
  };

  // Otsa, bu chaqiruv testni yiqitardi
  assert.doesNotThrow(() => inBackground(boom, {}));

  // Ushlanmagan rad etish ham bo'lmasligi kerak
  let unhandled = null;
  const onRejection = (e) => { unhandled = e; };
  process.once("unhandledRejection", onRejection);
  await new Promise((r) => setTimeout(r, 30));
  process.off("unhandledRejection", onRejection);

  assert.equal(unhandled, null, "ushlanmagan rad etish qoldi");
});
