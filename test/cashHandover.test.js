// test/cashHandover.test.js
// Pulni topshirish — kassaning ikkinchi yarmi.
//
// Bazaga ulanmaymiz: qoidalar sxema va manba matni darajasida
// tekshiriladi (`test/cash.test.js` dagi bilan bir xil uslub).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CashHandover = require('../src/models/CashHandover');
const svc = require('../src/services/cashHandover');

const SRC = fs.readFileSync(
  path.join(__dirname, '../src/services/cashHandover.js'),
  'utf8'
);

// ── Model qoidalari ─────────────────────────────────────────

test('yozuv O\'CHIRILMAYDI — uch amal ham bloklangan', () => {
  // Topshiriq yozuvini o'chira oladigan odam uchun u hech
  // narsani isbotlamaydi.
  for (const op of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
    const hooks = CashHandover.schema.s.hooks._pres.get(op) || [];
    assert.ok(hooks.length > 0, `${op} bloklanmagan`);
  }
});

test("`updateOne` ATAYLAB ochiq — tasdiqlash shu orqali ketadi", () => {
  // Lekin servis uni `status: 'pending'` sharti bilan
  // chaqiradi, ya'ni tasdiqlangan yozuvga baribir tegib
  // bo'lmaydi. Shart yo'qolsa bu test ogohlantiradi.
  assert.ok(
    SRC.includes("status: 'pending'"),
    "shartli yangilash yo'qolgan — tasdiqlangan yozuv o'zgarib ketishi mumkin"
  );
});

test('holatlar to\'plami — `disputed` alohida holat', () => {
  const vals = CashHandover.schema.path('status').enumValues;
  assert.deepEqual(vals.sort(), ['cancelled', 'confirmed', 'disputed', 'pending']);
});

test('ikkala summa ham saqlanadi — biri ikkinchisini bosmaydi', () => {
  // Topshiruvchi "500 000" deydi, qabul qiluvchi "480 000"
  // sanaydi. Hakamlik odamniki, tizim faqat kim nima
  // deganini saqlaydi.
  assert.ok(CashHandover.schema.path('amount'));
  assert.ok(CashHandover.schema.path('confirmedAmount'));
  assert.equal(CashHandover.schema.path('confirmedAmount').options.default, null);
});

test('ism NUSXA qilib saqlanadi — populate emas', () => {
  // Xodim ishdan ketsa ham o'tgan topshiriqlar egasiz qolmasin
  assert.ok(CashHandover.schema.path('from.name'));
  assert.ok(CashHandover.schema.path('to.name'));
  assert.ok(CashHandover.schema.path('from.roleName'));
});

// ── Servis qoidalari ────────────────────────────────────────

test("bekor qilingan topshiriq qoldiqni QAYTARADI", () => {
  // `cancelled` ochiq holatlar ro'yxatida bo'lmasligi shart:
  // aks holda adashib bosilgan tugma pulni tizimdan butunlay
  // yo'qotib yuborardi.
  assert.deepEqual(svc.OPEN_STATUSES, ['pending', 'confirmed', 'disputed']);
  assert.ok(!svc.OPEN_STATUSES.includes('cancelled'));
});

test("o'ziga o'zi topshirish bloklangan", () => {
  assert.ok(
    SRC.includes("O'zingizga o'zingiz topshira olmaysiz"),
    "o'z-o'ziga topshirish tekshiruvi yo'q — yozuvning ma'nosi qolmaydi"
  );
});

test('qabul qiluvchidan `viewCash` talab qilinadi', () => {
  assert.ok(
    SRC.includes("includes('viewCash')"),
    "har qanday xodim pul qabul qila oladigan bo'lib qolgan"
  );
});

test('tasdiqlashda sanalgan summa MAJBURIY', () => {
  // "Tasdiqlash" tugmasini o'ylamasdan bosish oson; summani
  // yozish esa qo'lidagi pulni sanashga majbur qiladi.
  assert.ok(SRC.includes('countedAmount'));
  assert.ok(SRC.includes("Sanalgan summa noto'g'ri"));
});

test('tasdiqlash faqat KIMGA topshirilgan bo\'lsa — o\'sha odam', () => {
  assert.ok(
    SRC.includes("String(doc.to.id) !== String(me.id)"),
    'qabul qiluvchi tekshiruvi yo\'q — birov boshqasining pulini "oldim" deb yozardi'
  );
});

test("bekor qilish faqat O'ZINIKI va faqat tasdiqlanmagani", () => {
  const cancelBlock = SRC.slice(SRC.indexOf('async function cancel'));
  assert.ok(cancelBlock.includes("'from.id': me.id"), 'boshqaning yozuvini bekor qilib bo\'ladi');
  assert.ok(cancelBlock.includes("status: 'pending'"), 'tasdiqlangan yozuv bekor qilinadi');
});

test("o'chirish emas, `cancelled` — iz qoladi", () => {
  const cancelBlock = SRC.slice(SRC.indexOf('async function cancel'));
  assert.ok(cancelBlock.includes("status: 'cancelled'"));
  assert.ok(!cancelBlock.includes('deleteOne'));
});

test('faqat YOPILGAN smenalar topshirishga kiradi', () => {
  // Yopilmagan kunning summasi hali ma'lum emas — uni
  // "qarz" deb ko'rsatsak, tizim o'ylab topilgan raqamni
  // aytgan bo'lardi.
  const owedBlock = SRC.slice(SRC.indexOf('async function owedBy'), SRC.indexOf('function selfPerson'));
  assert.ok(owedBlock.includes('CashShift.find'));
  assert.ok(owedBlock.includes('countedCash'));
  // `expected.cash` EMAS: odamning qo'lida sanalgan pul bor
  assert.ok(!owedBlock.includes('expected.cash'));
});

test('farq bo\'lganda `confirmedAmount` ayiriladi', () => {
  // Qabul qiluvchi 480 000 sanagan bo'lsa, "500 000 topshirdim"
  // qoldiqni yopmaydi — 20 000 ustida qolib turadi.
  assert.ok(
    SRC.includes('h.confirmedAmount ?? h.amount'),
    'farq qoldiqda ko\'rinmay qoladi'
  );
});

test('topshirilmagandan ko\'p pul topshirib bo\'lmaydi', () => {
  assert.ok(SRC.includes('sum > owed'));
});

// ── Hisob-kitob mantig'i ────────────────────────────────────

test('qoldiq = yig\'ilgan − topshirilgan', () => {
  // `owedBy` ichidagi formula. Sof qism bo'lmagani uchun
  // qo'lda takrorlaymiz va natijani solishtiramiz — formula
  // o'zgarsa bu test emas, yuqoridagi manba testlari
  // ogohlantiradi.
  const shifts = [{ countedCash: 500000 }, { countedCash: 300000 }];
  const handovers = [
    { amount: 500000, confirmedAmount: 480000 }, // farq bilan qabul qilingan
    { amount: 100000, confirmedAmount: null }, // hali tasdiqlanmagan
  ];
  const collected = shifts.reduce((s, x) => s + x.countedCash, 0);
  const handed = handovers.reduce((s, h) => s + (h.confirmedAmount ?? h.amount), 0);

  assert.equal(collected, 800000);
  assert.equal(handed, 580000); // 480 000 + 100 000
  assert.equal(collected - handed, 220000); // 20 000 farq ham shu yerda
});

test('accountPurge CashHandover ni o\'zgarmas deb biladi', () => {
  // Model `deleteMany` ni bloklaydi, shuning uchun hisob
  // butunlay o'chirilganda drayver darajasida o'chirilishi
  // shart — aks holda egasiz yozuvlar qolib ketardi.
  const purge = fs.readFileSync(
    path.join(__dirname, '../src/utils/accountPurge.js'),
    'utf8'
  );
  assert.ok(purge.includes('"CashHandover"'));
  assert.ok(/IMMUTABLE = new Set\(\[[^\]]*"CashHandover"/.test(purge));
});
