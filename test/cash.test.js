// test/cash.test.js
// Kunlik kassa — pul bilan bog'liq, ya'ni mantiq sinovdan
// o'tishi shart.
//
// Bazaga ulanmaymiz: `dayRange()` sof funksiya, modellar esa
// sxema darajasida tekshiriladi.
const test = require('node:test');
const assert = require('node:assert/strict');

const { dayRange } = require('../src/services/cashShift');

// ── Kun chegarasi ───────────────────────────────────────────

test('dayRange — kun Toshkent yarim tunidan boshlanadi', () => {
  // ⚠️ Render UTC da ishlaydi. Server sanasiga tayansak,
  //    Toshkentda kechqurun soat 19:00 dan keyin qabul qilingan
  //    har bir to'lov ERTANGI smenaga tushib ketardi va
  //    administrator kechki pulini hech qachon topa olmasdi.
  const { from, to } = dayRange('2026-08-19');

  // Toshkent 00:00 = UTC 19:00 (bir kun oldin)
  assert.equal(from.toISOString(), '2026-08-18T19:00:00.000Z');
  assert.equal(to.toISOString(), '2026-08-19T19:00:00.000Z');
});

test('dayRange — oraliq roppa-rosa 24 soat', () => {
  const { from, to } = dayRange('2026-08-19');
  assert.equal(to - from, 24 * 60 * 60 * 1000);
});

test('dayRange — oy va yil chegarasi to\'g\'ri o\'tadi', () => {
  const dec = dayRange('2026-12-31');
  assert.equal(dec.to.toISOString(), '2026-12-31T19:00:00.000Z');

  const jan = dayRange('2027-01-01');
  // Bir kunning oxiri — keyingi kunning boshi. Orada teshik ham,
  // ustma-ust tushish ham bo'lmasin: aks holda 31-dekabr kechqurun
  // olingan pul ikkala smenada ham ko'rinardi.
  assert.equal(jan.from.getTime(), dec.to.getTime());
});

test('dayRange — noto\'g\'ri sana rad etiladi', () => {
  // Bo'sh yoki buzuq sana bilan butun to'lovlar to'plami bo'yicha
  // so'rov ketib qolmasin.
  for (const bad of ['', '19-08-2026', '2026-8-9', 'bugun', null, undefined]) {
    assert.throws(() => dayRange(bad), /noto'g'ri/i, `qabul qilindi: ${bad}`);
  }
});

// ── CashShift modeli ────────────────────────────────────────

test('CashShift — yopilgan smenani o\'zgartirib bo\'lmaydi', () => {
  // Sanalgan pulni keyin to'g'rilash mumkin bo'lsa, kamomad
  // chiqqan odam uni o'zi tuzatib qo'yadi va imzoning ma'nosi
  // qolmaydi.
  const CashShift = require('../src/models/CashShift');

  const blocked = [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ];

  for (const op of blocked) {
    const hooks = CashShift.schema.s.hooks._pres.get(op);
    assert.ok(
      hooks && hooks.length > 0,
      `${op} uchun to'siq yo'q — yopilgan smena o'zgartirilishi mumkin`
    );
  }
});

test('CashShift — bir odam bir kunni ikki marta yopa olmaydi', () => {
  // Ikki marta bosilgan tugma ham, qo'lda yuborilgan takroriy
  // so'rov ham ikkinchi yozuv yaratmasin.
  const CashShift = require('../src/models/CashShift');

  const unique = CashShift.schema.indexes().find(([, opts]) => opts && opts.unique);
  assert.ok(unique, 'unikal indeks yo\'q');
  assert.deepEqual(unique[0], { director: 1, 'staff.id': 1, date: 1 });
});

test('CashShift — sanalgan pul majburiy va manfiy bo\'lolmaydi', () => {
  const CashShift = require('../src/models/CashShift');
  const path = CashShift.schema.path('countedCash');
  assert.ok(path, 'countedCash maydoni yo\'q');
  assert.equal(path.isRequired, true);
});

test('CashShift — smena egasi Teacher yoki Staff', () => {
  const CashShift = require('../src/models/CashShift');
  assert.deepEqual(CashShift.schema.path('staff.model').enumValues, [
    'Teacher',
    'Staff',
  ]);
  assert.equal(CashShift.schema.path('staff.id').isRequired, true);
});

test('CashShift — director majburiy', () => {
  // Bunsiz bir markazning kassasi boshqasiga ko'rinib ketardi.
  const CashShift = require('../src/models/CashShift');
  assert.equal(CashShift.schema.path('director').isRequired, true);
});

// ── MonthlyPayment ──────────────────────────────────────────

test('MonthlyPayment — to\'lov usuli faqat uch xil, standarti naqd', () => {
  const MonthlyPayment = require('../src/models/MonthlyPayment');
  const path = MonthlyPayment.schema.path('paymentMethod');
  assert.deepEqual(path.enumValues, ['cash', 'card', 'transfer']);
  assert.equal(path.defaultValue, 'cash');
});

test('MonthlyPayment — izoh maydoni sxemada bor', () => {
  // ⚠️ `markPayment` allaqachon `payment.note = note` deb
  //    yozardi, lekin sxemada bunday maydon yo'q edi va Mongoose
  //    uni JIMGINA tashlab yuborardi: xodim izoh yozib
  //    "Saqlash"ni bosardi, xato chiqmasdi, izoh yo'qolardi.
  const MonthlyPayment = require('../src/models/MonthlyPayment');
  assert.ok(MonthlyPayment.schema.path('note'), 'note maydoni yo\'q');
});

test('MonthlyPayment — pulni kim olgani yoziladi', () => {
  const MonthlyPayment = require('../src/models/MonthlyPayment');
  assert.ok(MonthlyPayment.schema.path('receivedBy.id'));
  assert.deepEqual(MonthlyPayment.schema.path('receivedBy.model').enumValues, [
    'Teacher',
    'Staff',
  ]);
});

test('MonthlyPayment — kunlik so\'rov uchun indeks bor', () => {
  // Smena yopish `paidDate` bo'yicha oraliq so'rov qiladi.
  // Indekssiz yil o'tgach butun to'plam skanerlanardi.
  const MonthlyPayment = require('../src/models/MonthlyPayment');
  const found = MonthlyPayment.schema
    .indexes()
    .some(([f]) => f.teacher === 1 && f.paidDate === -1);
  assert.ok(found, '{ teacher, paidDate } indeksi yo\'q');
});

// ── Ruxsatlar ───────────────────────────────────────────────

test('viewCash ruxsati ro\'yxatda bor', () => {
  // ⚠️ Enum'da bo'lmagan ruxsat Mongoose tomonidan jimgina
  //    o'chiriladi: direktor huquqni belgilaydi, saqlaydi va u
  //    hech qachon yozilmaydi.
  const Role = require('../src/models/Role');
  assert.ok(
    Role.schema.path('permissions').caster.enumValues.includes('viewCash'),
    'viewCash enum\'da yo\'q'
  );
});

test('o\'z smenasini yopish uchun viewCash SHART EMAS', () => {
  // Bu qoida kodda emas, controllerda: `/cash/close`
  // `managePayments` so'raydi. Pul olgan odam o'z hisobini
  // yopa olishi kerak, boshqalarni nazorat qilishi esa shart
  // emas — shuning uchun ikki huquq alohida.
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'controllers', 'cashController.js'),
    'utf8'
  );
  const closeBlock = src.slice(src.indexOf('const closeShift'), src.indexOf('const shifts'));
  assert.ok(closeBlock.includes("requirePermission(ctx, 'managePayments')"));
  assert.ok(
    !closeBlock.includes("'viewCash'"),
    'yopish viewCash so\'rayapti — kassaning o\'zi smenasini yopa olmay qoladi'
  );
});
