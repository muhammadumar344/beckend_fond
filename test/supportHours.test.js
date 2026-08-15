// test/supportHours.test.js
// ════════════════════════════════════════════════════════════
// Markazning support ish vaqti.
//
// ⚠️ NEGA SINALADI: sozlama IKKI joyda yashaydi — modeldagi
//    `default` va `normalizeHours` dagi zaxira qiymat. Ular
//    ajralib ketsa xato JIMGINA yuzaga chiqadi: yangi markazda
//    ish vaqti 09:00–18:00, eski markazda esa boshqacha
//    bo'lib qolardi va sababini topish qiyin bo'lardi.
//
//    Zaxira qiymat kerak, chunki Mongoose sxemadagi `default`
//    ni O'QISHDA qo'shmaydi — bayroq paydo bo'lishidan oldin
//    yaratilgan hujjatlarda maydon umuman yo'q.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");

const { normalizeHours, FALLBACK_HOURS } = require("../src/utils/supportSlots");
const Teacher = require("../src/models/Teacher");

test("⚠️ zaxira qiymat modeldagi `default` bilan bir xil", () => {
  // ⚠️ Mongoose ichma-ich obyektni alohida yo'llarga yoyadi
  //    ("supportHours.start"), subdokument yasamaydi
  const at = (k) => Teacher.schema.path(`supportHours.${k}`);
  const def = (k) => {
    const p = at(k);
    assert.ok(p, `supportHours.${k} sxemada yo'q`);
    return typeof p.defaultValue === "function"
      ? p.defaultValue()
      : p.defaultValue;
  };

  const d = {
    start: def("start"),
    end: def("end"),
    slotMinutes: def("slotMinutes"),
    days: def("days"),
  };

  assert.strictEqual(d.start, FALLBACK_HOURS.start);
  assert.strictEqual(d.end, FALLBACK_HOURS.end);
  assert.strictEqual(d.slotMinutes, FALLBACK_HOURS.slotMinutes);
  assert.deepStrictEqual(d.days, FALLBACK_HOURS.days);
});

test("maydon umuman bo'lmasa zaxira qiymat ishlatiladi", () => {
  for (const empty of [undefined, null, {}]) {
    assert.deepStrictEqual(normalizeHours(empty), FALLBACK_HOURS);
  }
});

test("qisman to'ldirilgan sozlama — qolgani zaxiradan", () => {
  const h = normalizeHours({ start: "10:00" });
  assert.strictEqual(h.start, "10:00");
  assert.strictEqual(h.end, FALLBACK_HOURS.end);
  assert.strictEqual(h.slotMinutes, 30);
});

test("bo'sh kunlar ro'yxati zaxiraga qaytadi", () => {
  // ⚠️ Bo'sh massivni shundayligicha qoldirsak, markaz
  //    HECH QACHON ochiq bo'lmasdi va o'quvchi sababini
  //    bilmasdi. Bo'sh ro'yxat — sozlanmagan degani.
  assert.deepStrictEqual(normalizeHours({ days: [] }).days, FALLBACK_HOURS.days);
});

test("to'liq sozlama o'zgarishsiz qaytadi", () => {
  const custom = { start: "08:30", end: "20:00", days: [0, 2, 4], slotMinutes: 45 };
  assert.deepStrictEqual(normalizeHours(custom), custom);
});

test("standart holda yakshanba ish kuni emas", () => {
  // 6 = Yakshanba (loyihada 0 = Dushanba)
  assert.ok(!FALLBACK_HOURS.days.includes(6));
  assert.ok(FALLBACK_HOURS.days.includes(5), "shanba ish kuni bo'lsin");
});
