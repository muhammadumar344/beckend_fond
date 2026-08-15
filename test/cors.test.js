// test/cors.test.js
// ════════════════════════════════════════════════════════════
// Server o'qiydigan har bir maxsus sarlavha CORS ro'yxatida
// bormi?
//
// ⚠️ BU TEST BITTA OG'IR XATODAN KEYIN YOZILDI. `tmaAuth`
//    `x-telegram-init-data` sarlavhasini o'qirdi, `server.js`
//    dagi `allowedHeaders` ro'yxatida esa u YO'Q edi.
//
//    Oqibati: brauzer maxsus sarlavhali so'rovdan OLDIN OPTIONS
//    yuboradi va javobda sarlavhani ko'rmasa — so'rovni umuman
//    jo'natmaydi. `fetch` "Load failed" deb yiqiladi. Server
//    logida hech narsa yo'q, chunki so'rov serverga yetib
//    bormaydi. Node'dan (curl kabi) sinasangiz ishlaydi —
//    CORS faqat brauzerda amal qiladi. Shu sababli xato uzoq
//    vaqt ko'rinmay turdi va Mini App HECH QACHON ochilmadi.
//
// ⚠️ `src/server.js` NI CHAQIRMAYDI — u import qilinganidayoq
//    `app.listen()`, `mongoose.connect()` va `initBot()` ni
//    ishga tushiradi. Fayl MATN sifatida o'qiladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const serverSrc = fs.readFileSync(path.join(SRC, "server.js"), "utf8");

/** `allowedHeaders: [...]` ichidagi nomlar, kichik harfda */
function allowedHeaders() {
  const m = serverSrc.match(/allowedHeaders:\s*\[([\s\S]*?)\]/);
  assert.ok(m, "server.js da allowedHeaders topilmadi");
  return new Set(
    [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1].toLowerCase()),
  );
}

/** Loyihada o'qiladigan `x-…` sarlavhalari */
function headersUsed() {
  const found = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) {
        const src = fs.readFileSync(p, "utf8");
        // req.headers["x-…"], req.get("X-…") va
        // `const HEADER = "x-…"` ko'rinishlari
        for (const m of src.matchAll(
          /(?:req\.headers\[|req\.get\?\.\(|req\.get\(|=\s*)["'](x-[a-z0-9-]+)["']/gi,
        )) {
          found.add(m[1].toLowerCase());
        }
      }
    }
  };
  walk(SRC);
  return found;
}

test("o'qiladigan har bir x- sarlavha CORS ro'yxatida bor", () => {
  const allowed = allowedHeaders();
  const used = headersUsed();

  assert.ok(used.size > 0, "hech qanday maxsus sarlavha topilmadi — regex buzilgan");

  for (const h of used) {
    assert.ok(
      allowed.has(h),
      `"${h}" o'qiladi, lekin CORS allowedHeaders da yo'q — ` +
        `brauzer so'rovni bloklaydi va "Load failed" chiqadi`,
    );
  }
});

test("⚠️ Mini App'ning kalit sarlavhasi aynan ro'yxatda", () => {
  // Alohida test: yuqoridagisi regexga tayanadi, bu esa
  // to'g'ridan-to'g'ri nomni tekshiradi. Mini App uchun bu
  // sarlavha YAGONA autentifikatsiya yo'li — yo'qolsa butun
  // ilova o'chadi.
  assert.ok(allowedHeaders().has("x-telegram-init-data"));
});

test("X-Lang ham joyida — javob tili shunga bog'liq", () => {
  assert.ok(allowedHeaders().has("x-lang"));
});
