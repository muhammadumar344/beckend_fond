// test/telegramGroup.test.js
// ════════════════════════════════════════════════════════════
// Sinf ota-onalarining Telegram guruhiga xabar yuborish.
//
// Bazaga ham, Telegram'ga ham ULANMAYDI: modellar qo'lda almashtiriladi,
// bot — soxta. Almashtirilgan `Class.findOne` Mongo'ning haqiqiy
// qoidasiga amal qiladi (faqat BERILGAN kalitlar bo'yicha moslashadi),
// shuning uchun servis filtrdan `teacher` ni tashlab yuborsa, "boshqa
// direktor sinfi" testi sinadi — xuddi haqiqiy bazadagidek.
//
// ⚠️ `src/server.js` NI CHAQIRMAYDI (jonli bot/bazaga ulanib ketadi).
// ════════════════════════════════════════════════════════════
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { EventEmitter } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Class = require("../src/models/Class");
const Teacher = require("../src/models/Teacher");
const Staff = require("../src/models/Staff");
const Student = require("../src/models/Student");
const Enrollment = require("../src/models/Enrollment");
const MonthlyPayment = require("../src/models/MonthlyPayment");
const AuditLog = require("../src/models/AuditLog");
const svc = require("../src/services/groupTelegram");

const oid = () => new mongoose.Types.ObjectId();

// ── Yordamchilar ─────────────────────────────────────────────

/** Mongoose so'rovini taqlid qiladi: zanjir ham, await ham ishlaydi */
const chain = (result) => ({
  select() { return this; },
  lean() { return this; },
  sort() { return this; },
  then(res, rej) { return Promise.resolve(result).then(res, rej); },
});

/** Almashtirilgan funksiyalarni test oxirida qaytaradi */
function patcher() {
  const undo = [];
  return {
    set(obj, key, value) {
      const prev = obj[key];
      obj[key] = value;
      undo.push(() => { obj[key] = prev; });
    },
    restore() { while (undo.length) undo.pop()(); },
  };
}

const FUTURE = new Date(Date.now() + 30 * 86400000);
const teacherDoc = (over = {}) =>
  new Teacher({ plan: "pro", planExpiresAt: FUTURE, institutionType: "school", ...over });

/** Mongo kabi: faqat filtrda BERILGAN kalitlar tekshiriladi */
const mongoMatches = (doc, filter) =>
  Object.entries(filter).every(([k, v]) => {
    if (!(k in doc)) return false;
    return String(doc[k]) === String(v);
  });

/**
 * Bitta "dunyo": direktor A ning sinfi, o'quvchilar, to'lovlar, soxta bot.
 * Qaytaradi: { calls, sent, bot, cls, dirA, restore }
 */
function world(opts = {}) {
  const p = patcher();
  const dirA = opts.dirA || oid();
  const students = opts.students || [];
  const calls = { classFilters: [], classUpdates: [], paymentFilters: [] };
  const sent = [];

  const cls =
    "cls" in opts
      ? opts.cls
      : {
          _id: oid(),
          name: "5-A",
          teacher: dirA,
          defaultAmount: 100000,
          telegramGroup: { chatId: -1001234567890 },
        };

  p.set(Teacher, "findById", () => chain(opts.teacher || teacherDoc()));
  p.set(Class, "findOne", (filter) => {
    calls.classFilters.push(filter);
    return chain(cls && mongoMatches(cls, filter) ? cls : null);
  });
  p.set(Class, "updateOne", async (filter, update) => {
    calls.classUpdates.push({ filter, update });
    return { matchedCount: cls && mongoMatches(cls, filter) ? 1 : 0 };
  });
  p.set(Student, "find", () => chain(students));
  p.set(Enrollment, "find", () => chain(opts.enrollments || []));
  p.set(MonthlyPayment, "find", (filter) => {
    calls.paymentFilters.push(filter);
    return chain(opts.records || []);
  });

  const bot = {
    sendMessage: async (chatId, text, o) => {
      if (opts.sendError) throw opts.sendError;
      sent.push({ chatId, text, o });
      return {};
    },
    getMe: async () => ({ username: "LumoTestBot" }),
  };
  return { calls, sent, bot, cls, dirA, restore: () => p.restore(), deps: { getBot: () => bot, now: new Date(2026, 8, 15) } };
}

const stu = (name, extra = {}) => ({ _id: oid(), name, rollNumber: 1, ...extra });
const tgErr = (description, error_code = 400, parameters) => {
  const e = new Error(`ETELEGRAM: ${error_code} ${description}`);
  e.response = { body: { ok: false, error_code, description, parameters } };
  return e;
};

// ═══════════════════════════════════════════════════════════
// 1. Markdown himoyasi
// ═══════════════════════════════════════════════════════════
test("escapeMd: Markdown'ni buzadigan belgilar himoyalanadi", () => {
  assert.strictEqual(svc.escapeMd("Ali_Vali"), "Ali\\_Vali");
  assert.strictEqual(svc.escapeMd("Sevinch*"), "Sevinch\\*");
  assert.strictEqual(svc.escapeMd("A`B[C"), "A\\`B\\[C");
});

test("escapeMd: yolg'iz teskari chiziq keyingi belgini yutib yubormaydi", () => {
  assert.strictEqual(svc.escapeMd("Ali\\_Vali"), "Ali\\_Vali"); // \ olib tashlanadi, _ qaytadan himoyalanadi
  assert.ok(!/\\\\/.test(svc.escapeMd("A\\\\B")));
});

test("escapeMd: qator uzilishi bitta bo'shliqqa, juda uzun ism qirqiladi, bo'sh qiymat xavfsiz", () => {
  assert.strictEqual(svc.escapeMd("Ali\nVali"), "Ali Vali");
  assert.ok(svc.escapeMd("x".repeat(500)).length <= 120);
  assert.strictEqual(svc.escapeMd(null), "");
  assert.strictEqual(svc.escapeMd(undefined), "");
});

// ═══════════════════════════════════════════════════════════
// 2. Xabar matni
// ═══════════════════════════════════════════════════════════
const BASE = { className: "5-A", month: 9, year: 2026, mode: "school" };

test("xabar: so'ralgan format — salom, tartib raqamli ro'yxat, iltimos, rahmat", () => {
  const [m, ...rest] = svc.buildUnpaidMessages({ ...BASE, names: ["Ali Valiyev", "Hasan Karimov"] });
  assert.strictEqual(rest.length, 0);
  assert.match(m, /Assalomu alaykum, hurmatli ota-onalar!/);
  assert.match(m, /fond to'lovi hali amalga oshirilmagan:/);
  assert.match(m, /1\. Ali Valiyev\n2\. Hasan Karimov/);
  assert.match(m, /Iltimos, fond uchun to'lovni amalga oshiring\./);
  assert.match(m, /Rahmat!$/);
  assert.match(m, /5-A/);
  assert.match(m, /Sentabr 2026/);
});

test("xabar: hech kim qarzdor bo'lmasa — 'hammasi to'langan' xabari, ro'yxatsiz", () => {
  const out = svc.buildUnpaidMessages({ ...BASE, names: [] });
  assert.strictEqual(out.length, 1);
  assert.match(out[0], /Barcha o'quvchilarning fond to'lovlari amalga oshirilgan\./);
  assert.doesNotMatch(out[0], /Assalomu alaykum|1\./);
});

test("xabar: o'quv markazi rejimida 'fond' so'zi ishlatilmaydi", () => {
  const [m] = svc.buildUnpaidMessages({ ...BASE, mode: "learning_center", names: ["Ali"] });
  assert.doesNotMatch(m, /fond/i);
  assert.match(m, /oylik to'lovi hali amalga oshirilmagan/);
  const [ok] = svc.buildUnpaidMessages({ ...BASE, mode: "learning_center", names: [] });
  assert.doesNotMatch(ok, /fond/i);
});

test("xabar: ism va sinf nomidagi maxsus belgilar himoyalangan", () => {
  const [m] = svc.buildUnpaidMessages({ ...BASE, className: "5_A*", names: ["Ali_Vali", "Sevinch*"] });
  assert.match(m, /1\. Ali\\_Vali/);
  assert.match(m, /2\. Sevinch\\\*/);
  assert.match(m, /5\\_A\\\*/);
});

test("xabar: uzun ro'yxat Telegram chegarasidan oshmaydi, hech kim tushib qolmaydi va takrorlanmaydi", () => {
  const names = Array.from({ length: 400 }, (_, i) => `O'quvchi Familiya${i + 1} Otasining-ismi`);
  const parts = svc.buildUnpaidMessages({ ...BASE, names });
  assert.ok(parts.length > 1, "bir nechta xabarga bo'linishi kerak");
  for (const p of parts) assert.ok(p.length <= 4096, `xabar uzunligi ${p.length}`);

  assert.match(parts[0], /Assalomu alaykum/);
  assert.match(parts[parts.length - 1], /Rahmat!$/);
  for (const p of parts.slice(0, -1)) assert.doesNotMatch(p, /Rahmat!/);
  for (const p of parts.slice(1)) assert.doesNotMatch(p, /Assalomu alaykum/);

  const all = parts.join("\n");
  const nums = [...all.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.strictEqual(nums.length, 400);
  assert.deepStrictEqual(nums, Array.from({ length: 400 }, (_, i) => i + 1));
});

// ═══════════════════════════════════════════════════════════
// 3. Kim to'lamagan
// ═══════════════════════════════════════════════════════════
test("computeUnpaid: to'lagan chiqariladi; yozuvi yo'q o'quvchi to'lamagan hisoblanadi", () => {
  const [a, b, c] = [stu("A"), stu("B"), stu("C")];
  const cls = { defaultAmount: 100000 };
  const records = [
    { student: a._id, status: "paid", amount: 100000 },
    { student: b._id, status: "not_paid", amount: 100000 },
  ]; // c uchun yozuv umuman yo'q
  const out = svc.computeUnpaid({ students: [a, b, c], records, cls });
  assert.deepStrictEqual(out.map((s) => s.name), ["B", "C"]);
});

test("computeUnpaid: narxi 0 (bepul) o'quvchi ro'yxatga tushmaydi", () => {
  const free = stu("Bepul", { priceOverride: 0 });
  const payer = stu("Tolaydi");
  const out = svc.computeUnpaid({ students: [free, payer], records: [], cls: { defaultAmount: 100000 } });
  assert.deepStrictEqual(out.map((s) => s.name), ["Tolaydi"]);
});

test("computeUnpaid: yozuvdagi summa (>0) asosiy; yozuvdagi 0 — bepul", () => {
  const a = stu("A");
  const b = stu("B");
  const out = svc.computeUnpaid({
    students: [a, b],
    records: [
      { student: a._id, status: "not_paid", amount: 0 },
      { student: b._id, status: "not_paid", amount: 50000 },
    ],
    cls: { defaultAmount: 100000 },
  });
  assert.deepStrictEqual(out.map((s) => s.name), ["B"]);
});

test("computeUnpaid: qo'shimcha guruh narxi (Enrollment.priceOverride) hisobga olinadi", () => {
  const a = stu("A");
  const out = svc.computeUnpaid({
    students: [a],
    records: [],
    cls: { defaultAmount: 100000 },
    enrollments: [{ student: a._id, priceOverride: 0 }],
  });
  assert.strictEqual(out.length, 0);
});

// ═══════════════════════════════════════════════════════════
// 4. Telegram xatolari
// ═══════════════════════════════════════════════════════════
test("mapTelegramError: aniq kodlar va holatlar", () => {
  const cases = [
    [tgErr("Forbidden: bot was kicked from the supergroup chat", 403), "BOT_NOT_IN_GROUP", 409],
    [tgErr("Forbidden: bot is not a member of the group chat", 403), "BOT_NOT_IN_GROUP", 409],
    [tgErr("Bad Request: chat not found"), "BOT_NOT_IN_GROUP", 409],
    [tgErr("Forbidden: not enough rights to send text messages to the chat", 403), "BOT_NO_PERMISSION", 409],
    [tgErr("Bad Request: have no rights to send a message"), "BOT_NO_PERMISSION", 409],
    [tgErr("Bad Request: group chat was upgraded to a supergroup chat", 400, { migrate_to_chat_id: -100999 }), "GROUP_UPGRADED", 409],
    [tgErr("Too Many Requests: retry after 12", 429, { retry_after: 12 }), "TELEGRAM_RATE_LIMIT", 429],
    [tgErr("Internal Server Error", 500), "TELEGRAM_ERROR", 502],
    [new Error("ETIMEDOUT"), "TELEGRAM_ERROR", 502],
  ];
  for (const [err, code, status] of cases) {
    const m = svc.mapTelegramError(err);
    assert.ok(m instanceof svc.GroupError);
    assert.strictEqual(m.code, code, String(err.message));
    assert.strictEqual(m.status, status, String(err.message));
  }
  assert.strictEqual(svc.mapTelegramError(tgErr("Too Many Requests", 429, { retry_after: 12 })).retryAfter, 12);
});

test("mapTelegramError: Telegram'ning xom matni foydalanuvchiga chiqmaydi", () => {
  const m = svc.mapTelegramError(tgErr("Forbidden: SECRET internal chat -100123 details", 403));
  assert.doesNotMatch(m.message, /SECRET|-100123/);
});

test("periodOf: berilmasa hozirgi oy; noto'g'ri qiymat 400", () => {
  assert.deepStrictEqual(svc.periodOf(undefined, undefined, new Date(2026, 8, 15)), { month: 9, year: 2026 });
  assert.deepStrictEqual(svc.periodOf("3", "2026"), { month: 3, year: 2026 });
  for (const [m, y] of [[13, 2026], [0, 2026], ["abc", 2026], [5, 1999], [5, "x"]]) {
    assert.throws(() => svc.periodOf(m, y), (e) => e.code === "INVALID_PERIOD" && e.status === 400);
  }
});

// ═══════════════════════════════════════════════════════════
// 5. sendUnpaidReport — ma'lumot aloxidaligi va oqim
// ═══════════════════════════════════════════════════════════
const rejects = (promise, code, status) =>
  assert.rejects(promise, (e) => {
    assert.ok(e instanceof svc.GroupError, `GroupError kutilgan edi, keldi: ${e && e.message}`);
    assert.strictEqual(e.code, code);
    if (status) assert.strictEqual(e.status, status);
    return true;
  });

test("yuborish: BOSHQA direktorning sinfi — 404, guruhga hech narsa ketmaydi, o'quvchilar o'qilmaydi", async () => {
  const w = world({ students: [stu("Maxfiy Ism")] });
  const attacker = oid();
  try {
    await rejects(svc.sendUnpaidReport({ directorId: attacker, classId: String(w.cls._id) }, w.deps), "CLASS_NOT_FOUND", 404);
    assert.strictEqual(w.sent.length, 0);
    assert.strictEqual(w.calls.paymentFilters.length, 0, "to'lovlar so'ralmasligi kerak");
    // filtr aynan hujumchi ID'si bilan yuborilgan
    assert.ok(w.calls.classFilters.every((f) => String(f.teacher) === String(attacker)));
  } finally { w.restore(); }
});

test("yuborish: sinf ID'si noto'g'ri formatda — bazaga bormasdan 404", async () => {
  const w = world();
  try {
    await rejects(svc.sendUnpaidReport({ directorId: w.dirA, classId: "not-an-id" }, w.deps), "CLASS_NOT_FOUND", 404);
    await rejects(svc.sendUnpaidReport({ directorId: w.dirA, classId: { $ne: null } }, w.deps), "CLASS_NOT_FOUND", 404);
    assert.strictEqual(w.calls.classFilters.length, 0);
  } finally { w.restore(); }
});

test("yuborish: tarifda Telegram yo'q (free) — 403 + requiresUpgrade, sinf ham o'qilmaydi", async () => {
  const w = world({ teacher: teacherDoc({ plan: "free", planExpiresAt: null }), students: [stu("A")] });
  try {
    await assert.rejects(svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps), (e) => {
      assert.strictEqual(e.code, "UPGRADE_REQUIRED");
      assert.strictEqual(e.status, 403);
      assert.strictEqual(e.requiresUpgrade, true);
      return true;
    });
    assert.strictEqual(w.calls.classFilters.length, 0);
    assert.strictEqual(w.sent.length, 0);
  } finally { w.restore(); }
});

test("yuborish: guruh ulanmagan — 409 GROUP_NOT_LINKED, hech narsa yuborilmaydi", async () => {
  const dirA = oid();
  const w = world({ dirA, cls: { _id: oid(), name: "5-A", teacher: dirA, defaultAmount: 1, telegramGroup: { chatId: null } }, students: [stu("A")] });
  try {
    await rejects(svc.sendUnpaidReport({ directorId: dirA, classId: String(w.cls._id) }, w.deps), "GROUP_NOT_LINKED", 409);
    assert.strictEqual(w.sent.length, 0);
  } finally { w.restore(); }
});

test("yuborish: sinfda o'quvchi yo'q — 400 NO_STUDENTS", async () => {
  const w = world({ students: [] });
  try {
    await rejects(svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps), "NO_STUDENTS", 400);
    assert.strictEqual(w.sent.length, 0);
  } finally { w.restore(); }
});

test("yuborish: bot o'chiq — 503 BOT_OFFLINE", async () => {
  const w = world({ students: [stu("A")] });
  try {
    await rejects(
      svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, { ...w.deps, getBot: () => null }),
      "BOT_OFFLINE",
      503,
    );
  } finally { w.restore(); }
});

test("yuborish: faqat to'lamaganlar ketadi, aynan shu sinfning guruhiga, Markdown rejimida", async () => {
  const paid = stu("Tolagan Bola");
  const debtor1 = stu("Qarzdor Bir", { rollNumber: 2 });
  const debtor2 = stu("Qarzdor_Ikki", { rollNumber: 3 });
  const w = world({
    students: [paid, debtor1, debtor2],
    records: [{ student: paid._id, status: "paid", amount: 100000 }],
  });
  try {
    const out = await svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps);

    assert.strictEqual(out.unpaidCount, 2);
    assert.strictEqual(out.total, 3);
    assert.strictEqual(out.className, "5-A");
    assert.strictEqual(w.sent.length, 1);
    assert.strictEqual(w.sent[0].chatId, -1001234567890);
    assert.strictEqual(w.sent[0].o.parse_mode, "Markdown");
    assert.match(w.sent[0].text, /1\. Qarzdor Bir\n2\. Qarzdor\\_Ikki/);
    assert.doesNotMatch(w.sent[0].text, /Tolagan Bola/);

    // to'lovlar so'rovi direktor VA sinf bilan cheklangan, oy — server soatidan
    const f = w.calls.paymentFilters[0];
    assert.strictEqual(String(f.teacher), String(w.dirA));
    assert.strictEqual(String(f.class), String(w.cls._id));
    assert.deepStrictEqual([f.month, f.year], [9, 2026]);

    // muvaffaqiyatli yuborilgach — oxirgi yuborilgan vaqt yoziladi (shu direktor bilan cheklangan)
    const upd = w.calls.classUpdates.at(-1);
    assert.ok(upd.update.$set["telegramGroup.lastMessageAt"] instanceof Date);
    assert.strictEqual(String(upd.filter.teacher), String(w.dirA));
  } finally { w.restore(); }
});

test("yuborish: hamma to'lagan — 'hammasi to'langan' xabari ketadi", async () => {
  const a = stu("A");
  const w = world({ students: [a], records: [{ student: a._id, status: "paid", amount: 100000 }] });
  try {
    const out = await svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps);
    assert.strictEqual(out.unpaidCount, 0);
    assert.strictEqual(w.sent.length, 1);
    assert.match(w.sent[0].text, /Barcha o'quvchilarning fond to'lovlari amalga oshirilgan\./);
  } finally { w.restore(); }
});

test("yuborish: Telegram xatosi (bot guruhdan chiqarilgan) — aniq kod, 'oxirgi yuborilgan' YOZILMAYDI", async () => {
  const w = world({
    students: [stu("A")],
    sendError: tgErr("Forbidden: bot was kicked from the supergroup chat", 403),
  });
  const origErr = console.error;
  console.error = () => {}; // kutilgan xato — logni to'ldirmaymiz
  try {
    await rejects(svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps), "BOT_NOT_IN_GROUP", 409);
    assert.strictEqual(w.calls.classUpdates.length, 0);
  } finally { console.error = origErr; w.restore(); }
});

test("yuborish: ro'yxat bir nechta xabarga bo'linsa, ularning hammasi bir xil guruhga ketadi", async () => {
  const many = Array.from({ length: 300 }, (_, i) => stu(`Uzun Ismli O'quvchi Nomer${i + 1}`, { rollNumber: i + 1 }));
  const w = world({ students: many });
  try {
    const out = await svc.sendUnpaidReport({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps);
    assert.ok(out.parts > 1);
    assert.strictEqual(w.sent.length, out.parts);
    assert.ok(w.sent.every((s) => s.chatId === -1001234567890));
  } finally { w.restore(); }
});

// ═══════════════════════════════════════════════════════════
// 6. Ulash havolasi va token
// ═══════════════════════════════════════════════════════════
test("havola: token bazada FAQAT hash bo'lib saqlanadi, havolada esa ochiq; bot username ishlatiladi", async () => {
  const w = world();
  try {
    const out = await svc.createGroupLink({ directorId: w.dirA, classId: String(w.cls._id) }, w.deps);
    const token = /startgroup=grp_(\S+)$/.exec(out.link)[1];
    assert.match(out.link, /^https:\/\/t\.me\/LumoTestBot\?startgroup=grp_/);
    assert.strictEqual(out.command, `/link grp_${token}`);
    assert.ok(token.length >= 30 && token.length <= 60); // startgroup parametri 64 belgigacha
    assert.match(token, /^[A-Za-z0-9_-]+$/);

    const set = w.calls.classUpdates[0].update.$set;
    assert.notStrictEqual(set["telegramGroup.linkTokenHash"], token);
    assert.ok(!JSON.stringify(w.calls.classUpdates).includes(token), "ochiq token bazaga yozilmasligi kerak");
    assert.ok(set["telegramGroup.linkTokenExpires"] > new Date());
    assert.strictEqual(String(w.calls.classUpdates[0].filter.teacher), String(w.dirA));
  } finally { w.restore(); }
});

test("havola: BOSHQA direktorning sinfi uchun token yaratib bo'lmaydi", async () => {
  const w = world();
  try {
    await rejects(svc.createGroupLink({ directorId: oid(), classId: String(w.cls._id) }, w.deps), "CLASS_NOT_FOUND", 404);
    assert.strictEqual(w.calls.classUpdates.length, 0, "token yozilmasligi kerak");
  } finally { w.restore(); }
});

test("havola: bot o'chiq yoki tarifda yo'q bo'lsa — mos xato", async () => {
  const w = world();
  try {
    await rejects(svc.createGroupLink({ directorId: w.dirA, classId: String(w.cls._id) }, { getBot: () => null }), "BOT_OFFLINE", 503);
  } finally { w.restore(); }
  const w2 = world({ teacher: teacherDoc({ plan: "free", planExpiresAt: null }) });
  try {
    await rejects(svc.createGroupLink({ directorId: w2.dirA, classId: String(w2.cls._id) }, w2.deps), "UPGRADE_REQUIRED", 403);
  } finally { w2.restore(); }
});

/** consumeGroupToken uchun: sinf holatini saqlovchi minimal soxta */
function consumeWorld({ pending, taken, dupOnUpdate = false }) {
  const p = patcher();
  const calls = { updates: [] };
  p.set(Class, "findOne", (filter) => {
    if ("telegramGroup.linkTokenHash" in filter) return chain(pending || null);
    if ("telegramGroup.chatId" in filter) return chain(taken || null);
    return chain(null);
  });
  p.set(Class, "findOneAndUpdate", (filter, update) => {
    calls.updates.push({ filter, update });
    if (dupOnUpdate) {
      // Haqiqiy Query kabi: rad etish `await` paytida bo'ladi, oldin emas
      const e = new Error("E11000 duplicate key");
      e.code = 11000;
      return { select() { return this; }, then(res, rej) { return Promise.reject(e).then(res, rej); } };
    }
    return chain({ name: pending.name });
  });
  return { calls, restore: () => p.restore() };
}

test("ulash: to'g'ri token — guruh yoziladi, token o'chadi (bir martalik)", async () => {
  const pending = { _id: oid(), name: "5-A" };
  const w = consumeWorld({ pending });
  try {
    const out = await svc.consumeGroupToken("sirli-token", { chatId: -100777, title: "5-A ota-onalar" });
    assert.deepStrictEqual(out, { status: "ok", className: "5-A" });
    const set = w.calls.updates[0].update.$set;
    assert.strictEqual(set["telegramGroup.chatId"], -100777);
    assert.strictEqual(set["telegramGroup.title"], "5-A ota-onalar");
    assert.strictEqual(set["telegramGroup.linkTokenHash"], null);
    assert.strictEqual(set["telegramGroup.linkTokenExpires"], null);
    // yangilash shartli: token hash va muddat filtrda — ikki marta ishlatib bo'lmaydi
    const f = w.calls.updates[0].filter;
    assert.ok(f["telegramGroup.linkTokenHash"] && f["telegramGroup.linkTokenExpires"].$gt instanceof Date);
  } finally { w.restore(); }
});

test("ulash: noma'lum yoki muddati o'tgan token — 'invalid', hech narsa yozilmaydi", async () => {
  const w = consumeWorld({ pending: null });
  try {
    assert.deepStrictEqual(await svc.consumeGroupToken("xato", { chatId: -1, title: "x" }), { status: "invalid" });
    assert.deepStrictEqual(await svc.consumeGroupToken("", { chatId: -1, title: "x" }), { status: "invalid" });
    assert.strictEqual(w.calls.updates.length, 0);
  } finally { w.restore(); }
});

test("ulash: guruh boshqa sinfga ulangan — 'taken', yozuv qilinmaydi (begona token bilan 'tortib olib' bo'lmaydi)", async () => {
  const pending = { _id: oid(), name: "6-B" };
  const w = consumeWorld({ pending, taken: { _id: oid() } });
  try {
    assert.deepStrictEqual(await svc.consumeGroupToken("t", { chatId: -100777, title: "x" }), { status: "taken" });
    assert.strictEqual(w.calls.updates.length, 0);
  } finally { w.restore(); }
});

test("ulash: o'sha sinfning o'zi qayta ulansa (boshqa guruhga ko'chirish) ruxsat", async () => {
  const id = oid();
  const w = consumeWorld({ pending: { _id: id, name: "5-A" }, taken: { _id: id } });
  try {
    assert.strictEqual((await svc.consumeGroupToken("t", { chatId: -100777, title: "yangi" })).status, "ok");
  } finally { w.restore(); }
});

test("ulash: bir vaqtdagi poyga (unikal indeks xatosi) — 'taken', xato tashqariga chiqmaydi", async () => {
  const w = consumeWorld({ pending: { _id: oid(), name: "5-A" }, dupOnUpdate: true });
  try {
    assert.deepStrictEqual(await svc.consumeGroupToken("t", { chatId: -100777, title: "x" }), { status: "taken" });
  } finally { w.restore(); }
});

test("uzish: faqat o'z sinfi uchun; begonaniki — 404", async () => {
  const w = world();
  try {
    await svc.unlinkGroup({ directorId: w.dirA, classId: String(w.cls._id) });
    assert.strictEqual(w.calls.classUpdates[0].update.$set["telegramGroup.chatId"], null);
    await rejects(svc.unlinkGroup({ directorId: oid(), classId: String(w.cls._id) }), "CLASS_NOT_FOUND", 404);
    await rejects(svc.unlinkGroup({ directorId: w.dirA, classId: "x" }), "CLASS_NOT_FOUND", 404);
  } finally { w.restore(); }
});

test("holat ro'yxati: guruh ID'si va token FRONTENDGA chiqmaydi", async () => {
  const p = patcher();
  const dir = oid();
  const doc = {
    _id: oid(), name: "5-A",
    telegramGroup: { chatId: -100555, title: "5-A ota-onalar", linkedAt: new Date(), lastMessageAt: null, linkTokenHash: "HASH" },
  };
  p.set(Class, "find", () => chain([doc, { _id: oid(), name: "6-B" }]));
  try {
    const list = await svc.listGroups(dir);
    const json = JSON.stringify(list);
    assert.ok(!json.includes("-100555") && !json.includes("HASH") && !/chatId|linkToken/.test(json));
    assert.strictEqual(list[0].linked, true);
    assert.strictEqual(list[0].title, "5-A ota-onalar");
    assert.strictEqual(list[1].linked, false);
  } finally { p.restore(); }
});

// ═══════════════════════════════════════════════════════════
// 7. Model: maxfiy maydonlar `select: false`
// ═══════════════════════════════════════════════════════════
test("'classes' kolleksiyasini o'qiydigan HAR BIR model guruh ID'si va token hash'ini yashiradi", () => {
  // ⚠️ Bitta kolleksiyani ikkita model o'qiydi: Class (Fond) va Group (LC).
  //    Group sxemasida maydon e'lon qilinmagan paytda Mongoose uni "noma'lum"
  //    deb `select: false` ni qo'llamas va LC javoblari guruh ID'sini
  //    frontendga sizdirardi. Kelajakda yana shunday model qo'shilsa ham
  //    shu test uni ushlaydi.
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(__dirname, "../src/models");
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".js")) require(path.join(dir, f));

  const onClasses = Object.values(mongoose.models).filter((m) => m.collection.name === "classes");
  const names = onClasses.map((m) => m.modelName).sort();
  assert.ok(names.includes("Class") && names.includes("Group"), `kutilgan modellar topilmadi: ${names}`);

  for (const M of onClasses) {
    for (const key of ["chatId", "linkTokenHash", "linkTokenExpires"]) {
      const sp = M.schema.path(`telegramGroup.${key}`);
      assert.ok(sp, `${M.modelName}: telegramGroup.${key} sxemada e'lon qilinmagan (sizib chiqadi)`);
      assert.strictEqual(sp.options.select, false, `${M.modelName}: telegramGroup.${key} select:false bo'lishi kerak`);
    }
  }
});

test("Class modeli: bitta Telegram guruh — bitta sinf (unikal indeks)", () => {
  const uniq = Class.schema.indexes().find(([k]) => "telegramGroup.chatId" in k);
  assert.ok(uniq && uniq[1].unique, "chatId unikal bo'lishi kerak");
  // null/yo'q qiymatlar unikallikka tushmasligi uchun qisman indeks; Telegram guruh ID'lari
  // doim manfiy — `$lt` har qanday MongoDB versiyasida qo'llab-quvvatlanadi
  assert.deepStrictEqual(uniq[1].partialFilterExpression, { "telegramGroup.chatId": { $lt: 0 } });
  // Ishga tushishda quriladigan YAGONA yangi indeks — qurilmay qolsa jarayon yiqilishi mumkin
  const tgIndexes = Class.schema.indexes().filter(([k]) => Object.keys(k).some((x) => x.startsWith("telegramGroup")));
  assert.strictEqual(tgIndexes.length, 1);
});

// ═══════════════════════════════════════════════════════════
// 8. HTTP: haqiqiy router, auth va rol tekshiruvi
// ═══════════════════════════════════════════════════════════
const sign = (role, id) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "1h" });

function call(app, method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          port: server.address().port, path, method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            server.close(() => {
              let json = null;
              try { json = JSON.parse(raw); } catch {}
              resolve({ status: res.statusCode, json, raw });
            });
          });
        },
      );
      req.on("error", (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

function httpWorld(opts = {}) {
  const w = world(opts);
  const p = patcher();
  // auth middleware: hisob holati
  p.set(Staff, "findById", () => chain({ isActive: true, passwordChangedAt: null }));
  // audit jurnali bazaga yozmasin
  p.set(AuditLog, "create", async () => ({}));
  // jonli bot o'rniga soxta (servis uni funksiya ichida `require` qiladi)
  const botModule = require("../src/bot/bot");
  p.set(botModule, "getBot", () => w.bot);

  const app = express();
  app.use(express.json());
  app.use("/api/teacher", require("../src/routes/teacher"));
  return { ...w, app, restore: () => { p.restore(); w.restore(); } };
}

const ENDPOINTS = [
  ["GET", "/api/teacher/telegram/groups"],
  ["POST", "/api/teacher/telegram/group/link"],
  ["DELETE", "/api/teacher/telegram/group"],
  ["POST", "/api/teacher/telegram/group/send"],
];

test("HTTP: tokensiz so'rov — 401", async () => {
  const w = httpWorld();
  try {
    for (const [m, path] of ENDPOINTS) {
      const r = await call(w.app, m, path, { body: { classId: String(w.cls._id) } });
      assert.strictEqual(r.status, 401, `${m} ${path}`);
    }
    assert.strictEqual(w.sent.length, 0);
  } finally { w.restore(); }
});

test("HTTP: xodim (staff) tokeni — 403, guruhga hech narsa ketmaydi", async () => {
  const w = httpWorld({ students: [stu("A")] });
  try {
    const token = sign("staff", oid());
    for (const [m, path] of ENDPOINTS) {
      const r = await call(w.app, m, path, { token, body: { classId: String(w.cls._id) } });
      assert.strictEqual(r.status, 403, `${m} ${path}`);
    }
    assert.strictEqual(w.sent.length, 0);
    assert.strictEqual(w.calls.classFilters.length, 0);
  } finally { w.restore(); }
});

test("HTTP: boshqa direktorning sinfi — 404 CLASS_NOT_FOUND, ma'lumot sizmaydi", async () => {
  const w = httpWorld({ students: [stu("Maxfiy Ism")] });
  try {
    const token = sign("teacher", oid()); // egasi emas
    const r = await call(w.app, "POST", "/api/teacher/telegram/group/send", { token, body: { classId: String(w.cls._id) } });
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.json.code, "CLASS_NOT_FOUND");
    assert.ok(!r.raw.includes("Maxfiy Ism") && !r.raw.includes("1001234567890"));
    assert.strictEqual(w.sent.length, 0);
  } finally { w.restore(); }
});

test("HTTP: egasi — yuboradi; javobda guruh ID'si yo'q; to'liq xabar guruhga ketadi", async () => {
  const debtor = stu("Qarzdor Bola");
  const w = httpWorld({ students: [debtor] });
  try {
    const token = sign("teacher", w.dirA);
    const r = await call(w.app, "POST", "/api/teacher/telegram/group/send", { token, body: { classId: String(w.cls._id) } });
    assert.strictEqual(r.status, 200, r.raw);
    assert.strictEqual(r.json.success, true);
    assert.strictEqual(r.json.unpaidCount, 1);
    assert.ok(!r.raw.includes("1001234567890"), "guruh ID'si javobda bo'lmasligi kerak");
    assert.strictEqual(w.sent.length, 1);
    assert.match(w.sent[0].text, /1\. Qarzdor Bola/);
  } finally { w.restore(); }
});

test("HTTP: Telegram xatosi frontend tushunadigan { error, code } bilan qaytadi", async () => {
  const w = httpWorld({
    students: [stu("A")],
    sendError: tgErr("Forbidden: not enough rights to send text messages to the chat", 403),
  });
  const origErr = console.error;
  console.error = () => {};
  try {
    const r = await call(w.app, "POST", "/api/teacher/telegram/group/send", { token: sign("teacher", w.dirA), body: { classId: String(w.cls._id) } });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.json.success, false);
    assert.strictEqual(r.json.code, "BOT_NO_PERMISSION");
    assert.ok(r.json.error && r.json.error.length > 10);
  } finally { console.error = origErr; w.restore(); }
});

test("HTTP: holat ro'yxati faqat o'z sinflarini beradi va maxfiy maydon qaytarmaydi", async () => {
  const w = httpWorld();
  const p = patcher();
  const seen = [];
  p.set(Class, "find", (f) => { seen.push(f); return chain([{ _id: oid(), name: "5-A", telegramGroup: { chatId: -100321, title: "Guruh", linkTokenHash: "H" } }]); });
  try {
    const r = await call(w.app, "GET", "/api/teacher/telegram/groups", { token: sign("teacher", w.dirA) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(String(seen[0].teacher), String(w.dirA));
    assert.ok(!/-100321|"H"|chatId|linkToken/.test(r.raw));
  } finally { p.restore(); w.restore(); }
});

test("HTTP: ketma-ket ko'p yuborish cheklanadi (ota-onalar guruhi spamga tushmasin)", async () => {
  const a = stu("A");
  const w = httpWorld({ students: [a], records: [{ student: a._id, status: "paid", amount: 1 }] });
  try {
    const token = sign("teacher", w.dirA); // noyob foydalanuvchi — boshqa testlarga ta'sir qilmaydi
    const statuses = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await call(w.app, "POST", "/api/teacher/telegram/group/send", { token, body: { classId: String(w.cls._id) } })).status);
    }
    assert.deepStrictEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.ok(statuses.slice(5).every((s) => s === 429), `6-so'rovdan keyin 429 kutilgan edi: ${statuses}`);
    assert.strictEqual(w.sent.length, 5);
  } finally { w.restore(); }
});

// ═══════════════════════════════════════════════════════════
// 9. Bot: guruhda FAQAT ulash buyrug'i ishlaydi (maxfiylik himoyasi)
//
// NEGA BU TEST ENG MUHIMI: bot endi ota-onalar GURUHLARIGA qo'shiladi.
// Mavjud buyruqlar (/baholar, /tolovlar ...) javobni `msg.chat.id` ga
// yozadi — guruhda bu bolaning baholari/to'lovi HAMMAGA ko'rinishi
// demak. Bu yerda soxta bot orqali haqiqiy bot.js ulanishi sinaladi.
// ═══════════════════════════════════════════════════════════
test("bot: guruhda faqat ulash buyrug'i ishlaydi; shaxsiy chat o'zgarishsiz", async () => {
  const https = require("node:https");
  const Module = require("node:module");
  const handlersPath = require.resolve("../src/bot/handlers");
  const commandsPath = require.resolve("../src/bot/commands");
  const botPath = require.resolve("../src/bot/bot");
  const tgLibPath = require.resolve("node-telegram-bot-api");

  // 1) Soxta Telegram kutubxonasi: ro'yxatdan o'tgan handlerlarni yig'adi
  const registry = { text: [], on: {} };
  class FakeBot extends EventEmitter {
    constructor() {
      super();
      // _attachHandlers `setMyCommands` va boshqalarni chaqiradi — test uchun
      // hammasi jim muvaffaqiyatli bo'lsin (ro'yxatga olishdan boshqasi muhim emas)
      return new Proxy(this, {
        get: (t, k) => (k in t || typeof k === "symbol" || k === "then" ? t[k] : () => Promise.resolve({})),
      });
    }
    onText(re, cb) { registry.text.push([re, cb]); }
    on(ev, cb) { (registry.on[ev] ||= []).push(cb); return this; }
    removeAllListeners() { registry.text = []; registry.on = {}; }
    deleteWebHook() { return Promise.resolve(); }
    getMe() { return Promise.resolve({ id: 1, username: "fake" }); }
  }
  // 2) Soxta handlers: qaysi biri chaqirilganini yozib boradi
  const called = [];
  const spy = (name) => (...a) => { called.push(name); return Promise.resolve(); };
  const fakeHandlers = {
    handleStart: spy("handleStart"), handleHelp: spy("handleHelp"), handleReset: spy("handleReset"),
    handleContact: spy("handleContact"), handleMessage: spy("handleMessage"),
    handleCallbackQuery: spy("handleCallbackQuery"), handleGroupStart: spy("handleGroupStart"),
    handleGroupJoined: spy("handleGroupJoined"), handleDigest: spy("handleDigest"),
    handleToday: spy("handleToday"), appUrl: () => "",
  };
  const fakeCommands = { handleDigest: spy("handleDigest"), RENDER: {}, shortDate: () => "", money: () => "" };

  // ⚠️ bot.js har /start, /reset ... uchun emoji bilan console.log qiladi. Node
  //    test-runner natijalarni bola jarayonning stdout'i orqali serializatsiya
  //    qilib yuboradi; shu oqimga qo'shilgan ko'p qatorli (emojili) log ba'zan
  //    kadrni buzib, FAYLNING HAMMA natijasini "Unable to deserialize cloned
  //    data" bilan yo'qotardi (6 dan 4 marta). Shuning uchun bu testda log
  //    jim qilinadi va oxirida qaytariladi.
  const realLog = { log: console.log, info: console.info, warn: console.warn };
  console.log = console.info = console.warn = () => {};

  const saved = {
    tg: require.cache[tgLibPath], handlers: require.cache[handlersPath], commands: require.cache[commandsPath], bot: require.cache[botPath],
    token: process.env.TELEGRAM_BOT_TOKEN, env: process.env.NODE_ENV, httpsGet: https.get,
  };
  const stub = (p, exports) => { require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] }; };

  try {
    process.env.TELEGRAM_BOT_TOKEN = "123456:TEST";
    process.env.NODE_ENV = "development";
    // checkToken tarmoqqa chiqmasin
    https.get = () => { const r = new EventEmitter(); r.destroy = () => {}; setImmediate(() => r.emit("error", new Error("offline"))); return r; };
    stub(tgLibPath, FakeBot);
    stub(handlersPath, fakeHandlers);
    stub(commandsPath, fakeCommands);
    delete require.cache[botPath];

    const { initBot } = require("../src/bot/bot");
    await initBot({ use() {}, post() {} });
    await new Promise((r) => setTimeout(r, 30)); // deleteWebHook().then(_attachHandlers)

    const fire = async (msg) => {
      called.length = 0;
      const text = msg.text || "";
      for (const [re, cb] of registry.text) if (re.test(text)) cb(msg);
      if (msg.contact) for (const cb of registry.on.contact || []) cb(msg);
      for (const cb of registry.on.message || []) cb(msg);
      if (msg.new_chat_members) for (const cb of registry.on.new_chat_members || []) cb(msg);
      await new Promise((r) => setImmediate(r));
      return [...new Set(called)];
    };
    const group = (text, extra = {}) => ({ chat: { id: -100, type: "supergroup", title: "G" }, from: { id: 7 }, text, ...extra });
    const priv = (text, extra = {}) => ({ chat: { id: 7, type: "private" }, from: { id: 7 }, text, ...extra });

    assert.ok(Object.keys(registry.on).length > 0 && registry.text.length > 0, "handlerlar ulanmadi");

    // ── GURUH: hech qanday ma'lumot beruvchi buyruq ishlamasligi kerak ──
    // bot.js dagi DIGEST ro'yxatining HAMMA nomi (inglizcha + o'zbekcha taxalluslar)
    const DIGEST_NAMES = ["grades", "baholar", "baho", "attendance", "davomat", "payments", "tolov", "tolovlar", "homework", "vazifa", "uyvazifasi", "support", "mashgulot", "qoshimcha"];
    for (const cmd of ["/help", "/reset", "/start", "/start@LumoBot", ...DIGEST_NAMES.flatMap((n) => [`/${n}`, `/${n}@LumoBot`])]) {
      const out = await fire(group(cmd));
      assert.deepStrictEqual(out.filter((n) => n !== "handleGroupStart"), [], `guruhda ${cmd} javob bermasligi kerak, chaqirildi: ${out}`);
    }
    assert.deepStrictEqual(await fire(group("hello 1234 taklif kodi")), [], "guruh matni taklif kodi sifatida o'qilmasligi kerak");
    assert.deepStrictEqual(await fire(group("", { contact: { phone_number: "+998901234567" } })), [], "guruhda kontakt qabul qilinmaydi");

    // ── GURUH: ulash buyrug'i ishlaydi ──
    assert.deepStrictEqual(await fire(group("/start grp_abc123")), ["handleGroupStart"]);
    assert.deepStrictEqual(await fire(group("/start@LumoBot grp_abc123")), ["handleGroupStart"]);
    assert.deepStrictEqual(await fire(group("/link grp_abc123")), ["handleGroupStart"]);
    assert.deepStrictEqual(await fire(group("/link@LumoBot grp_abc123")), ["handleGroupStart"]);
    // shaxsiy chatda /link ishlamaydi (token ochiq chatda emas, guruhda ishlatiladi)
    assert.ok(!(await fire(priv("/link grp_abc123"))).includes("handleGroupStart"));

    // ── GURUH: bot qo'shilganda salomlashadi ──
    assert.deepStrictEqual(await fire(group("", { new_chat_members: [{ id: 1 }] })), ["handleGroupJoined"]);

    // ── SHAXSIY CHAT: avvalgi xatti-harakat saqlangan ──
    assert.deepStrictEqual(await fire(priv("/start")), ["handleStart"]);
    assert.deepStrictEqual(await fire(priv("/help")), ["handleHelp"]);
    assert.deepStrictEqual(await fire(priv("/reset")), ["handleReset"]);
    assert.deepStrictEqual(await fire(priv("taklif kodi")), ["handleMessage"]);
    assert.deepStrictEqual(await fire(priv("", { contact: { phone_number: "+998901234567" } })), ["handleContact"]);
    // shaxsiy chatda barcha digest buyruqlari (taxalluslari bilan) avvalgidek ishlaydi
    for (const n of DIGEST_NAMES) {
      assert.deepStrictEqual(await fire(priv(`/${n}`)), ["handleDigest"], `shaxsiy chatda /${n} ishlashi kerak`);
    }

    // callback_query: guruhda e'tiborsiz, shaxsiyda ishlaydi
    called.length = 0;
    for (const cb of registry.on.callback_query || []) cb({ id: "1", data: "x", message: { chat: { id: -100, type: "supergroup" } }, from: { id: 7 } });
    assert.deepStrictEqual(called, []);
    for (const cb of registry.on.callback_query || []) cb({ id: "1", data: "x", message: { chat: { id: 7, type: "private" } }, from: { id: 7 } });
    assert.deepStrictEqual(called, ["handleCallbackQuery"]);
  } finally {
    Object.assign(console, realLog);
    https.get = saved.httpsGet;
    process.env.TELEGRAM_BOT_TOKEN = saved.token === undefined ? "" : saved.token;
    if (saved.token === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.NODE_ENV = saved.env;
    for (const [p, v] of [[tgLibPath, saved.tg], [handlersPath, saved.handlers], [commandsPath, saved.commands], [botPath, saved.bot]]) {
      if (v) require.cache[p] = v; else delete require.cache[p];
    }
  }
});

// ═══════════════════════════════════════════════════════════
// 10. Bot handlerlari (haqiqiy handlers.js)
// ═══════════════════════════════════════════════════════════
test("handleGroupStart: javob matnlari holatga mos va ma'lumot sizdirmaydi", async () => {
  const { handleGroupStart, handleGroupJoined } = require("../src/bot/handlers");
  const mk = () => { const out = []; return { out, bot: { sendMessage: async (id, t) => out.push({ id, t }), getMe: async () => ({ id: 1 }) } }; };
  const msg = (text) => ({ chat: { id: -100, type: "supergroup", title: "Ota-onalar" }, from: { id: 7 }, text });

  // tokensiz /start guruhda — jim
  let m = mk();
  await handleGroupStart(m.bot, msg("/start"));
  assert.strictEqual(m.out.length, 0);

  // 1) muvaffaqiyat
  let w = consumeWorld({ pending: { _id: oid(), name: "5_A" } });
  m = mk();
  try { await handleGroupStart(m.bot, msg("/start grp_TOKEN")); } finally { w.restore(); }
  assert.strictEqual(m.out.length, 1);
  assert.match(m.out[0].t, /ulandi/);
  assert.match(m.out[0].t, /5\\_A/); // sinf nomi Markdown uchun himoyalangan

  // 2) eskirgan token
  w = consumeWorld({ pending: null });
  m = mk();
  try { await handleGroupStart(m.bot, msg("/link grp_OLD")); } finally { w.restore(); }
  assert.match(m.out[0].t, /eskirgan|ishlatilgan/);

  // 3) band guruh — qaysi sinfga ulangani aytilmaydi
  w = consumeWorld({ pending: { _id: oid(), name: "6-B" }, taken: { _id: oid(), name: "BEGONA-SINF" } });
  m = mk();
  try { await handleGroupStart(m.bot, msg("/start grp_X")); } finally { w.restore(); }
  assert.match(m.out[0].t, /allaqachon boshqa sinfga/);
  assert.doesNotMatch(m.out[0].t, /BEGONA|6-B/);

  // bot guruhga qo'shilganda: ulanmagan guruhga bir marta tushuntiradi, ulangan guruhda jim
  const p = patcher();
  const joinMsg = { chat: { id: -100, type: "group" }, new_chat_members: [{ id: 1 }] };
  try {
    p.set(Class, "exists", async () => null);
    m = mk();
    await handleGroupJoined(m.bot, joinMsg, { delayMs: 0 });
    assert.strictEqual(m.out.length, 1);
    assert.match(m.out[0].t, /Guruhni ulash/);

    p.set(Class, "exists", async () => ({ _id: oid() }));
    m = mk();
    await handleGroupJoined(m.bot, joinMsg, { delayMs: 0 });
    assert.strictEqual(m.out.length, 0);

    // startgroup oqimi: "qo'shildi" xabari kelgach, kutish paytida ulanish tugasa — jim
    let linkedNow = false;
    p.set(Class, "exists", async () => (linkedNow ? { _id: oid() } : null));
    m = mk();
    const pending = handleGroupJoined(m.bot, joinMsg, { delayMs: 40 });
    linkedNow = true; // /start grp_<token> shu orada ishlandi
    await pending;
    assert.strictEqual(m.out.length, 0, "ulanib bo'lgan guruhga 'ulang' deb aytilmasligi kerak");

    // boshqa odam qo'shilsa (bot emas) — jim
    p.set(Class, "exists", async () => null);
    m = mk();
    await handleGroupJoined(m.bot, { ...joinMsg, new_chat_members: [{ id: 999 }] }, { delayMs: 0 });
    assert.strictEqual(m.out.length, 0);
  } finally { p.restore(); }
});
