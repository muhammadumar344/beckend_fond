// test/platform.test.js
// PLATFORMANING TO'LOV REKVIZITLARI.
//
// Sahifada `8600 1234 5678 9012` qotirib yozilgandi — u haqiqiy
// karta emas, boshqa ikki faylda `placeholder` sifatida turgan
// namuna matn. Direktor uni nusxa olib pul yuborardi.
//
// Eng muhim qoida: KALIT YO'Q BO'LSA HECH NARSA KO'RSATILMAYDI.
// Yarim sozlangan holatda pul qabul qilishga urinmaymiz —
// `config/payments.js` bilan bir xil falsafa.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const CFG = path.join(__dirname, "../src/config/platform.js");

/** Modulni berilgan env bilan qaytadan yuklaydi */
const loadWith = (env) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[require.resolve(CFG)];
  const mod = require(CFG);
  process.env = saved;
  return mod;
};

test("kalit yo'q — configured: false va bo'sh qiymatlar", () => {
  const p = loadWith({ PLATFORM_CARD: "", PLATFORM_CARD_HOLDER: "" });
  assert.equal(p.configured, false);
  assert.equal(p.card, "");
  assert.equal(p.cardPlain, "");
  assert.equal(p.holder, "");
});

test("to'liq karta — ko'rsatish uchun bo'shliqli, nusxa uchun toza", () => {
  const p = loadWith({
    PLATFORM_CARD: "8600123456789012",
    PLATFORM_CARD_HOLDER: "Muhammadumar",
  });
  assert.equal(p.configured, true);
  assert.equal(p.card, "8600 1234 5678 9012");
  assert.equal(p.cardPlain, "8600123456789012");
  assert.equal(p.holder, "Muhammadumar");
});

test("bo'shliq va chiziqcha bilan yozilgani ham qabul qilinadi", () => {
  const p = loadWith({ PLATFORM_CARD: "8600-1234 5678 9012" });
  assert.equal(p.configured, true);
  assert.equal(p.cardPlain, "8600123456789012");
});

test("⚠️ YARIM YOZILGAN RAQAM — configured: false", () => {
  // Aks holda direktor 12 xonali raqamga pul o'tkazishga
  // urinardi va pul qaytmasdi.
  const p = loadWith({ PLATFORM_CARD: "860012345678" });
  assert.equal(p.configured, false);
  assert.equal(p.card, "");
});

test("egasi yozilmasa ham karta ishlaydi", () => {
  const p = loadWith({ PLATFORM_CARD: "8600123456789012", PLATFORM_CARD_HOLDER: "" });
  assert.equal(p.configured, true);
  assert.equal(p.holder, "");
});

// ── Ulanish ─────────────────────────────────────────────────

test("subscription javobida payTo bor", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/controllers/teacherController.js"),
    "utf8",
  );
  assert.ok(src.includes("payTo:"), "rekvizitlar javobga qo'shilmagan");
  assert.ok(src.includes("platform.configured"));
});

test("soxta karta raqami backendda qolmagan", () => {
  // Faqat izohlarda tarix sifatida qolishi mumkin — kodda emas.
  const dirs = ["controllers", "services", "config", "utils", "routes"];
  for (const d of dirs) {
    const dir = path.join(__dirname, "../src", d);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
      for (const [i, line] of lines.entries()) {
        const code = line.trim();
        // Izoh qatorlari o'tkazib yuboriladi (tarix izohda qoladi)
        if (/^(\/\/|\/?\*)/.test(code)) continue;
        assert.ok(
          !code.includes("8600 1234 5678 9012"),
          `${d}/${f}:${i + 1} — namuna karta raqami kodda`,
        );
      }
    }
  }
});
