// test/security.test.js
// ════════════════════════════════════════════════════════════
// So'rov cheklagichi va xavfsizlik sarlavhalari.
//
// Cheklagich noto'g'ri ishlasa ikki tomonlama yomon: yumshoq
// bo'lsa parol terib topiladi, qattiq bo'lsa haqiqiy
// foydalanuvchi o'z hisobiga kira olmay qoladi. Shuning uchun
// ikkala chegara ham sinaladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");

const { rateLimit, clearKey } = require("../src/middleware/rateLimit");
const { securityHeaders } = require("../src/middleware/security");

/** Soddalashtirilgan res — faqat kerakli qismi */
function fakeRes() {
  return {
    headers: {},
    code: 200,
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

/** Cheklagichni bir marta chaqirib, o'tdi-o'tmadi qaytaradi */
function hit(limiter, req) {
  const res = fakeRes();
  let passed = false;
  limiter(req, res, () => {
    passed = true;
  });
  return { passed, res };
}

test("chegaragacha o'tkazadi, undan keyin to'xtatadi", () => {
  const limiter = rateLimit({ name: "t1", windowMs: 60000, max: 3 });
  const req = { ip: "10.0.0.1" };

  assert.equal(hit(limiter, req).passed, true, "1-so'rov o'tishi kerak");
  assert.equal(hit(limiter, req).passed, true, "2-so'rov o'tishi kerak");
  assert.equal(hit(limiter, req).passed, true, "3-so'rov o'tishi kerak");

  const fourth = hit(limiter, req);
  assert.equal(fourth.passed, false, "4-so'rov to'xtatilishi kerak");
  assert.equal(fourth.res.code, 429);
  assert.match(fourth.res.body.error, /urinish/i);
});

test("turli IP lar bir-biriga xalaqit bermaydi", () => {
  const limiter = rateLimit({ name: "t2", windowMs: 60000, max: 2 });

  hit(limiter, { ip: "10.0.0.1" });
  hit(limiter, { ip: "10.0.0.1" });
  // Birinchi IP to'ldi
  assert.equal(hit(limiter, { ip: "10.0.0.1" }).passed, false);
  // Ikkinchisi hali toza — aks holda bitta hujumchi hammani bloklardi
  assert.equal(hit(limiter, { ip: "10.0.0.2" }).passed, true);
});

test("vaqt oynasi o'tgach sanagich nolga qaytadi", async () => {
  const limiter = rateLimit({ name: "t3", windowMs: 60, max: 1 });
  const req = { ip: "10.0.0.3" };

  assert.equal(hit(limiter, req).passed, true);
  assert.equal(hit(limiter, req).passed, false);

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(hit(limiter, req).passed, true, "oyna yopilgach yana o'tsin");
});

test("email bo'yicha cheklash — IP almashtirish yordam bermaydi", () => {
  const limiter = rateLimit({
    name: "t4",
    windowMs: 60000,
    max: 2,
    keyBy: (req) => req.body?.email?.toLowerCase() || null,
  });

  const attempt = (ip) => hit(limiter, { ip, body: { email: "A@b.uz" } });

  assert.equal(attempt("1.1.1.1").passed, true);
  assert.equal(attempt("2.2.2.2").passed, true);
  // Uchinchi urinish BOSHQA IP dan, lekin o'sha email — to'xtashi kerak
  assert.equal(attempt("3.3.3.3").passed, false);
});

test("email yo'q bo'lsa cheklamaydi — validatsiya baribir 400 beradi", () => {
  const limiter = rateLimit({
    name: "t5",
    windowMs: 60000,
    max: 1,
    keyBy: (req) => req.body?.email || null,
  });

  assert.equal(hit(limiter, { ip: "1.1.1.1", body: {} }).passed, true);
  assert.equal(hit(limiter, { ip: "1.1.1.1", body: {} }).passed, true);
});

test("clearKey sanagichni tozalaydi", () => {
  const limiter = rateLimit({ name: "t6", windowMs: 60000, max: 1 });
  const req = { ip: "10.0.0.6" };

  assert.equal(hit(limiter, req).passed, true);
  assert.equal(hit(limiter, req).passed, false);

  clearKey("t6", "10.0.0.6");
  assert.equal(hit(limiter, req).passed, true);
});

test("qolgan urinishlar sarlavhada ko'rinadi", () => {
  const limiter = rateLimit({ name: "t7", windowMs: 60000, max: 5 });
  const { res } = hit(limiter, { ip: "10.0.0.7" });
  assert.equal(res.headers["X-RateLimit-Limit"], "5");
  assert.equal(res.headers["X-RateLimit-Remaining"], "4");
});

test("to'xtatilganda Retry-After yuboriladi", () => {
  const limiter = rateLimit({ name: "t8", windowMs: 60000, max: 1 });
  hit(limiter, { ip: "10.0.0.8" });
  const { res } = hit(limiter, { ip: "10.0.0.8" });
  assert.ok(Number(res.headers["Retry-After"]) > 0);
});

// ── Sarlavhalar ─────────────────────────────────────────────

test("xavfsizlik sarlavhalari qo'yiladi", () => {
  const res = fakeRes();
  let next = false;
  securityHeaders({}, res, () => {
    next = true;
  });

  assert.equal(next, true, "zanjir davom etishi kerak");
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
  assert.equal(
    res.headers["Referrer-Policy"],
    "strict-origin-when-cross-origin",
  );
  assert.match(res.headers["Permissions-Policy"], /camera=\(\)/);
});

test("HSTS faqat produksiyada — localhost'ni buzib qo'ymaslik uchun", () => {
  const before = process.env.NODE_ENV;

  process.env.NODE_ENV = "development";
  const dev = fakeRes();
  securityHeaders({}, dev, () => {});
  assert.equal(dev.headers["Strict-Transport-Security"], undefined);

  process.env.NODE_ENV = "production";
  const prod = fakeRes();
  securityHeaders({}, prod, () => {});
  assert.match(prod.headers["Strict-Transport-Security"], /max-age=\d+/);

  process.env.NODE_ENV = before;
});
