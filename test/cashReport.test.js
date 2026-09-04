// test/cashReport.test.js
// Kunlik kassa xabari.
//
// Eng muhim qoida: JIM KUN JIM QOLADI. Har kuni "hammasi
// joyida" yozsak, direktor bir haftada xabarni o'qimay qo'yadi
// va rostdan muhim kunini ham ko'rmaydi. Test aynan shuni
// qulflaydi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildReport, money } = require('../src/services/cashReport');

const base = {
  date: '2026-08-20',
  centerName: 'Lumo Markaz',
  totals: { cashIn: 500000, card: 200000, transfer: 0, total: 700000, count: 7 },
  closed: [{ name: 'Aziza', countedCash: 500000, difference: 0 }],
  openDays: [],
  pendingHandovers: [],
  disputed: [],
};

// ── Muammo bor-yo'qligi ─────────────────────────────────────

test('hammasi joyida bo\'lsa — muammo YO\'Q', () => {
  const r = buildReport(base);
  assert.equal(r.hasProblems, false);
  assert.match(r.text, /Hammasi yopilgan/);
});

test('yopilmagan kun — muammo', () => {
  // Eng muhimi. Yopilgan smenalar ro'yxati o'z-o'zicha
  // aldamchi: pulni olib, kunini umuman yopmagan odam u
  // yerda KO'RINMAYDI.
  const r = buildReport({
    ...base,
    openDays: [{ name: 'Bekzod', date: '2026-08-19', cash: 300000 }],
  });
  assert.equal(r.hasProblems, true);
  assert.match(r.text, /Yopilmagan kun: 1/);
  assert.match(r.text, /Bekzod/);
});

test('kassada farq — muammo', () => {
  const r = buildReport({
    ...base,
    closed: [{ name: 'Aziza', countedCash: 450000, difference: -50000 }],
  });
  assert.equal(r.hasProblems, true);
  assert.match(r.text, /kamomad/);
});

test('ortiqcha ham farq — va boshqacha yoziladi', () => {
  // "Kamomad" va "ortiqcha" bir xil so'z bilan aytilsa,
  // direktor qaysi tomonga ekanini bilmaydi.
  const r = buildReport({
    ...base,
    closed: [{ name: 'Aziza', countedCash: 530000, difference: 30000 }],
  });
  assert.match(r.text, /ortiqcha/);
  assert.ok(!/kamomad/.test(r.text));
});

test('tasdiqlanmagan topshiriq — muammo', () => {
  // Pul yo'lda qolib ketgan: kimdir topshirgan, qabul
  // qiluvchi hali sanamagan.
  const r = buildReport({
    ...base,
    pendingHandovers: [
      { fromName: 'Aziza', toName: 'Direktor', amount: 500000, days: 2 },
    ],
  });
  assert.equal(r.hasProblems, true);
  assert.match(r.text, /Tasdiqlanmagan topshiriq/);
  assert.match(r.text, /2 kun/);
});

test('bugungi topshiriqda kun soni yozilmaydi', () => {
  const r = buildReport({
    ...base,
    pendingHandovers: [
      { fromName: 'Aziza', toName: 'Direktor', amount: 500000, days: 0 },
    ],
  });
  assert.ok(!/0 kun/.test(r.text));
});

test('topshirishdagi farq — muammo va ikkala son ham ko\'rinadi', () => {
  const r = buildReport({
    ...base,
    disputed: [
      {
        fromName: 'Aziza',
        toName: 'Direktor',
        amount: 500000,
        confirmedAmount: 480000,
      },
    ],
  });
  assert.equal(r.hasProblems, true);
  assert.match(r.text, /Topshirishda farq/);
  // Ikkala son ham: biri ikkinchisini bosmaydi
  assert.match(r.text, /500 000/);
  assert.match(r.text, /480 000/);
  assert.match(r.text, /−20 000/);
});

// ── Kun yakuni ──────────────────────────────────────────────

test('tushum har doim yoziladi', () => {
  const r = buildReport(base);
  assert.match(r.text, /Tushum/);
  assert.match(r.text, /700 000/);
  assert.match(r.text, /7 ta to'lov/);
});

test('nol bo\'lgan usul yozilmaydi — ortiqcha qator shovqin', () => {
  const r = buildReport(base); // transfer: 0
  assert.ok(!/o'tkazma/.test(r.text));
  assert.match(r.text, /karta/);
});

test('naqd chiqim alohida qator bo\'lib chiqadi', () => {
  const r = buildReport({
    ...base,
    totals: { ...base.totals, expenses: 200000 },
  });
  assert.match(r.text, /Naqd chiqim/);
  assert.match(r.text, /200 000/);
});

test('chiqim nol bo\'lsa qator umuman yo\'q', () => {
  const r = buildReport(base);
  assert.ok(!/chiqim/.test(r.text));
});

test('markaz nomi va sana sarlavhada', () => {
  const r = buildReport(base);
  assert.match(r.text, /Lumo Markaz/);
  assert.match(r.text, /2026-08-20/);
});

test('bo\'sh kirish yiqitmaydi', () => {
  const r = buildReport({ date: '2026-08-20' });
  assert.equal(r.hasProblems, false);
  assert.ok(r.text.length > 0);
});

test('ro\'yxatlar uzun bo\'lsa qirqiladi — xabar cheksiz o\'smasin', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    name: `X${i}`,
    date: '2026-08-19',
    cash: 1000,
  }));
  const r = buildReport({ ...base, openDays: many });
  // Sarlavhada haqiqiy son, ro'yxatda esa o'ntasi
  assert.match(r.text, /Yopilmagan kun: 30/);
  assert.equal((r.text.match(/· X\d+/g) || []).length, 10);
});

// ── Formatlash ──────────────────────────────────────────────

test('summa bo\'sh joy bilan ajratiladi', () => {
  // Telegram'da "1200000" o'qib bo'lmaydi
  assert.equal(money(1200000), '1 200 000');
  assert.equal(money(0), '0');
  assert.equal(money(null), '0');
});

// ── Cron qoidalari ──────────────────────────────────────────

const CRON = fs.readFileSync(
  path.join(__dirname, '../src/cron/cashReportCron.js'),
  'utf8'
);

test('`problems` rejimida jim kun JIM QOLADI', () => {
  // Butun funksiyaning ma'nosi shu shartda.
  assert.ok(
    CRON.includes('mode === "problems" && !hasProblems'),
    "jim kun ham yuboriladigan bo'lib qolgan — bir haftada o'qilmay qoladi"
  );
});

test('faqat LC rejimidagi direktorlarga', () => {
  // Fond'da kassa tushunchasi yo'q — sinf rahbariga
  // "smena yopilmagan" deb yozish ma'nosiz.
  assert.ok(CRON.includes('institutionType: "learning_center"'));
});

test("o'chirilayotgan va bloklangan hisoblar chetlab o'tiladi", () => {
  assert.ok(CRON.includes('deletionScheduledFor: null'));
  assert.ok(CRON.includes('isActive'));
});

test('bitta direktordagi xato qolganlarini to\'xtatmaydi', () => {
  const loop = CRON.slice(CRON.indexOf('for (const dir of directors)'));
  assert.ok(loop.includes('try {'));
  assert.ok(loop.includes('catch'));
});

test('botni bloklagan direktorning ulanishi tozalanadi', () => {
  // Aks holda har kuni log'ga bir xil xato yozilib turardi
  assert.ok(CRON.includes('403'));
  assert.ok(CRON.includes('"telegram.chatId": null'));
});

test("maydoni yo'q eski hisoblar ham xabar oladi", () => {
  // ⚠️ HAQIQIY BUG edi. Mongoose standart qiymatni faqat hujjat
  //    SAQLANGANDA yozadi; ulanish esa `updateOne` bilan ketadi.
  //    Ya'ni `cashReport` maydoni paydo bo'lishidan oldin
  //    ochilgan hisoblarda u bazada yo'q va `$in: [...]` ularni
  //    topmasdi — kunlik xabar o'sha direktorlarga hech qachon
  //    kelmasdi, xatosiz va jimgina.
  assert.ok(CRON.includes('"cashReport.mode": { $ne: "off" }'));
  assert.ok(!CRON.includes('$in: ["problems", "daily"]'));
  // Maydon yo'q bo'lsa `problems` deb olinadi (sxemadagi standart)
  assert.ok(CRON.includes('dir.cashReport?.mode || "problems"'));
});

test('vaqt mintaqasi Toshkent — server UTC da ishlaydi', () => {
  assert.ok(CRON.includes('timezone: "Asia/Tashkent"'));
  assert.ok(CRON.includes('"0 21 * * *"'));
});

// ── Ota-ona kutayotgan to'lovlar ────────────────────────────
// Ota-ona kartaga o'tkazdi va ilovada "to'ladim" dedi. Hech kim
// tasdiqlamasa, uning qarzi ochiq turadi va u markazni
// e'tiborsiz deb biladi — pul esa allaqachon kelgan.

test("tasdiqlanmagan to'lov — muammo", () => {
  const r = buildReport({
    ...base,
    claims: { count: 3, amount: 1200000, oldestDays: 2 },
  });
  assert.equal(r.hasProblems, true);
  assert.match(r.text, /Tasdiqlanmagan to'lov: 3 ta/);
  assert.match(r.text, /1 200 000/);
  assert.match(r.text, /2 kundan beri/);
});

test("bugun kelgan so'rovda kun soni yozilmaydi", () => {
  // "0 kundan beri kutyapti" — ma'nosiz gap.
  const r = buildReport({
    ...base,
    claims: { count: 1, amount: 400000, oldestDays: 0 },
  });
  assert.equal(r.hasProblems, true);
  assert.doesNotMatch(r.text, /kundan beri/);
});

test("claims umuman berilmasa eski xatti-harakat saqlanadi", () => {
  // Eski chaqiruvlar (va testlar) `claims` yubormaydi —
  // xabar o'sha-o'sha bo'lib qolsin.
  const r = buildReport(base);
  assert.equal(r.hasProblems, false);
  assert.doesNotMatch(r.text, /Tasdiqlanmagan to'lov/);
});

// ── Ulanish tokeni ──────────────────────────────────────────

const TG = fs.readFileSync(
  path.join(__dirname, '../src/services/directorTelegram.js'),
  'utf8'
);

test('token bazada HASH bo\'lib yotadi', () => {
  // Parol tiklash tokeni bilan bir xil qoida: baza nusxasi
  // chiqib ketsa ham u bilan ulanib bo'lmaydi.
  assert.ok(TG.includes("createHash(\"sha256\")"));
  assert.ok(TG.includes('linkTokenHash'));
});

test('token BIR MARTALIK va muddatli', () => {
  assert.ok(TG.includes('"telegram.linkTokenHash": null'), 'token ishlatilgach tozalanmaydi');
  assert.ok(TG.includes('$gt: new Date()'), 'muddat tekshirilmaydi');
});

test('ulanish shartli yangilash bilan — ikki kishi bir vaqtda ocholmaydi', () => {
  assert.ok(TG.includes('findOneAndUpdate'));
});

test('uzishda sozlama SAQLANADI', () => {
  // Direktor telefonini almashtirib qayta ulansa, tanlovini
  // boshqatdan qilishi shart emas.
  const unlinkBlock = TG.slice(
    TG.indexOf('async function unlink'),
    TG.indexOf('/** Shu Telegram hisobiga'),
  );
  assert.ok(!unlinkBlock.includes('cashReport'));
});
