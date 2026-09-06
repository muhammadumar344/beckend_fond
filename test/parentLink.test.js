// test/parentLink.test.js
// ════════════════════════════════════════════════════════════
// SINF HAVOLASI ORQALI OTA-ONANI ULASH.
//
// ⚠️ Bu yerdagi xato eng qimmat xato turi: havola sinf guruhiga
//    tashlanadi, ya'ni u ochiq deb hisoblanishi kerak. Agar
//    havolaning O'ZI ro'yxatdan istalgan bolani tanlashga imkon
//    bersa, guruhga kirgan har kim begona bolaning baholarini
//    ochardi — eski botdagi aynan o'sha teshik (CLAUDE.md →
//    `legacy`).
//
//    Shu sababli testlarning ko'pchiligi KODNING O'ZINI o'qiydi:
//    mantiqni sinash uchun bazaga ulanish kerak bo'lardi, tuzoq
//    esa "tekshiruv tushib qolgan" shaklida keladi, "formula
//    noto'g'ri" shaklida emas.
// ════════════════════════════════════════════════════════════
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/** Izohlarni olib tashlab o'qish — izohdagi so'z testni aldab qo'ymasin */
const readCode = (rel) =>
  fs
    .readFileSync(path.join(__dirname, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const handlers = readCode("../src/bot/handlers.js");
const controller = readCode("../src/controllers/teacherController.js");

// ── Eng muhimi: tanlashning o'zi hech narsa ochmaydi ──────────

test("ro'yxatdan tanlash TASDIQ KUTADIGAN yozuv yaratadi", () => {
  const pick = handlers.slice(handlers.indexOf("async function handlePick"));
  const body = pick.slice(0, pick.indexOf("\n}"));

  assert.match(body, /status:\s*['"]pending['"]/, "so'rov `pending` emas");
  assert.match(body, /isActive:\s*false/, "yozuv darrov ochilib ketadi");
  assert.match(body, /requestedClass/, "qaysi sinf ekani yozilmaydi");
  // ⚠️ `isActive: true` bu blokda UMUMAN bo'lmasligi kerak
  assert.ok(!/isActive:\s*true/.test(body), "handlePick yozuvni ochib yuboradi");
});

test("tugma bosilganda token QAYTA tekshiriladi", () => {
  // Tugma yozishmada qolib ketadi. Sinf rahbari havolani bekor
  // qilgan bo'lsa, eski tugma ham o'lishi kerak — aks holda
  // "bekor qilish" hech narsani bekor qilmasdi.
  const pick = handlers.slice(handlers.indexOf("async function handlePick"));
  const body = pick.slice(0, pick.indexOf("\n}"));
  assert.match(body, /parentToken/, "tugma tokendan mustaqil ishlaydi");
  assert.match(body, /archivedAt:\s*null/, "arxivlangan sinf ham ochiladi");
});

test("ro'yxat ko'rsatishdan oldin ham token tekshiriladi", () => {
  const fn = handlers.slice(handlers.indexOf("async function sendRoster"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /parentToken/, "bekor qilingan havola ro'yxat ko'rsatadi");
  assert.match(body, /archivedAt:\s*null/, "arxivlangan sinf ro'yxati chiqadi");
});

test("havola bloklangan/o'chirilayotgan hisobda ishlamaydi", () => {
  const fn = handlers.slice(handlers.indexOf("async function handleClassLink"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /archivedAt:\s*null/, "arxivlangan sinf ochiladi");
  assert.match(body, /isActive === false/, "bloklangan hisob tekshirilmaydi");
  assert.match(body, /deletionScheduledFor/, "o'chirilayotgan hisob ochiladi");
});

test("raqam qidiruvi sinf bilan cheklanadi", () => {
  // Bitta raqam ikki markazda bo'lishi mumkin (aka-uka boshqa
  // maktabda). Havolani bosgan odam AYNAN shu sinfga ulanmoqchi.
  const fn = handlers.slice(handlers.indexOf("const handleContact"));
  const body = fn.slice(0, fn.indexOf("\n// ──"));
  assert.match(body, /linkClassId/, "sinf bo'yicha cheklov yo'q");
  assert.match(
    body,
    /linkClassId\s*\?\s*\{\s*class:\s*linkClassId\s*\}/,
    "so'rovga sinf filtri qo'shilmagan",
  );
});

// ── Tasdiqlash tomoni ────────────────────────────────────────

test("tasdiqlash faqat `approved` da ochadi", () => {
  const fn = controller.slice(controller.indexOf("const reviewParentRequest"));
  const body = fn.slice(0, fn.indexOf("\n};"));

  assert.match(
    body,
    /isActive\s*=\s*decision === ["']approved["']/,
    "rad etilgan so'rov ham ochilib ketishi mumkin",
  );
  // Boshqa markaz tasdiqlay olmasin
  assert.match(body, /requestedClass\?\.teacher/, "markaz tekshirilmaydi");
  assert.match(body, /branchFilter/, "filial cheklovi yo'q");
  assert.match(body, /status !== ["']pending["']/, "takror tasdiqlash ochiq");
});

test("qaror ota-onaga xabar qilinadi", () => {
  // Bot "tasdiqlangach xabar keladi" deb va'da beradi. Xabarsiz
  // qolgan ota-ona har kuni /start bosib tekshirib turardi.
  const fn = controller.slice(controller.indexOf("const reviewParentRequest"));
  const body = fn.slice(0, fn.indexOf("\n};"));
  assert.match(body, /clsApproved/, "tasdiq xabari yo'q");
  assert.match(body, /clsRejected/, "rad etish xabari yo'q");
  assert.match(body, /inBackground/, "xabar so'rovni kutdiradi");
  assert.match(body, /tgLang/, "xabar ota-ona tilida ketmaydi");
});

test("so'rovlar ro'yxati faqat o'z sinflaridan olinadi", () => {
  const fn = controller.slice(controller.indexOf("const getParentRequests"));
  const body = fn.slice(0, fn.indexOf("\n};"));
  assert.match(body, /teacher:\s*ctx\.directorId/, "markaz bo'yicha cheklov yo'q");
  assert.match(body, /status:\s*["']pending["']/, "hamma yozuv chiqadi");
});

test("havolani yaratish faqat direktorga ochiq", () => {
  const fn = controller.slice(controller.indexOf("const parentLinkClass"));
  const body = fn.slice(0, fn.indexOf("\n};"));
  assert.match(body, /ctx\.isDirector/, "xodim ham havola yarata oladi");
  assert.match(body, /teacher:\s*ctx\.directorId/, "begona sinfga havola");
});

// ── Ruxsat darajasi ──────────────────────────────────────────

test("tasdiqlanmagan bog'lanish hech narsa ko'rmaydi", () => {
  const { canSee, visibleSections } = require("../src/utils/tmaAccess");
  const pending = { isActive: false, verifiedVia: "approved" };
  assert.equal(canSee(pending, "payments"), false);
  assert.equal(canSee(pending, "grades"), false);
  assert.deepEqual(visibleSections(pending), []);
});

test("tasdiqlangan bog'lanish kod bilan bir darajada", () => {
  const { canSee, isVerified } = require("../src/utils/tmaAccess");
  const ok = { isActive: true, verifiedVia: "approved" };
  assert.equal(isVerified(ok), true);
  for (const s of ["payments", "grades", "attendance", "homework"]) {
    assert.equal(canSee(ok, s), true, `${s} yopiq qolgan`);
  }
});

test("`approved` sxema enum'ida bor", () => {
  // Enum'ga qo'shilmasa Mongoose yozuvni jimgina RAD ETADI va
  // ota-onaning so'rovi umuman yaratilmasdi.
  const StudentLink = require("../src/models/StudentLink");
  const via = StudentLink.schema.path("verifiedVia");
  assert.ok(via.enumValues.includes("approved"), "enum'da `approved` yo'q");
  const st = StudentLink.schema.path("status");
  assert.ok(st.enumValues.includes("pending"), "enum'da `pending` yo'q");
});

// ── Klaviatura ───────────────────────────────────────────────

test("ro'yxat tugmalari Telegram cheklovidan oshmaydi", () => {
  const { rosterKeyboard } = require("../src/bot/keyboards");
  const students = Array.from({ length: 7 }, (_, i) => ({
    _id: "a".repeat(24),
    name: `O'quvchi ${i + 1}`,
  }));
  const kb = rosterKeyboard(students);

  assert.equal(kb.inline_keyboard.length, 4, "ikki ustun emas");
  for (const row of kb.inline_keyboard) {
    assert.ok(row.length <= 2);
    for (const btn of row) {
      assert.ok(
        Buffer.byteLength(btn.callback_data) <= 64,
        "callback_data 64 baytdan oshdi — Telegram tugmani rad etadi",
      );
      assert.match(btn.callback_data, /^pick_[a-f0-9]{24}$/);
    }
  }
});

test("bot matnlari uz va ru da bor", () => {
  const { PACKS } = require("../src/bot/texts");
  const keys = [
    "clsWelcome",
    "clsNotFound",
    "clsPickTitle",
    "clsPickEmpty",
    "clsPending",
    "clsAlreadyPending",
    "clsApproved",
    "clsRejected",
  ];
  for (const k of keys) {
    // ⚠️ Ruscha yo'q bo'lsa `t()` jimgina o'zbekchaga tushadi —
    //    ruscha gapiradigan ota-ona buni faqat o'zi ko'radi.
    assert.ok(PACKS.uz[k], `uz.${k} yo'q`);
    assert.ok(PACKS.ru[k], `ru.${k} yo'q`);
  }
});
