// test/botWebhook.test.js
// ════════════════════════════════════════════════════════════
// Telegram webhook route'i 404-tutuvchidan OLDIN turadimi?
//
// NEGA BU TEST BOR: bot webhook rejimida jimgina o'lgan edi.
// `initBot` bazaga ulangandan KEYIN ishlaydi, ya'ni webhook
// route'i 404-tutuvchidan KEYIN qo'shilardi. Express esa
// middleware'larni qo'shilish tartibida yuradi — Telegram
// yuborgan har bir yangilanish "Route topilmadi" bo'lib
// qaytardi. Xato loglarda ko'rinmasdi: Telegram 404 ni jim
// yutadi, bizning logda esa oddiy so'rov qatoridan boshqa
// hech narsa yo'q edi. Sababini topish uchun bir kun ketdi.
//
// Yechim: Router'ni oldindan ulab qo'yish. Router o'z
// route'larini SO'ROV PAYTIDA qaraydi, shuning uchun keyin
// qo'shilgani ham ishlaydi.
//
// ⚠️ `src/server.js` NI CHAQIRMAYDI. U import qilinganidayoq
//    `app.listen()`, `mongoose.connect()` va `initBot()` ni
//    ishga tushiradi — bir marta shu sababli jonli botga
//    ulanib ketgan edi. Bu yerda faqat MEXANIZM tekshiriladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const http = require("node:http");

/** Serverni ko'tarib bitta POST yuboradi, keyin yopadi */
function post(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request(
        {
          port: server.address().port,
          path,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            server.close(() => resolve({ status: res.statusCode, body }));
          });
        },
      );
      req.on("error", (e) => server.close(() => reject(e)));
      req.end(JSON.stringify({ update_id: 1 }));
    });
  });
}

test("keyin qo'shilgan webhook route 404 dan oldin ishlaydi", async () => {
  const app = express();
  app.use(express.json());

  // ── server.js dagi tartib ──
  const botWebhook = express.Router();
  app.use(botWebhook); // joy oldindan band qilinadi
  app.use((req, res) => res.status(404).json({ error: "Route topilmadi" }));

  // ── initBot keyinroq, asinxron ishlaydi ──
  await new Promise((r) => setTimeout(r, 5));
  let received = null;
  botWebhook.post("/bot-webhook-XXX", (req, res) => {
    received = req.body;
    res.sendStatus(200);
  });

  const res = await post(app, "/bot-webhook-XXX");
  assert.strictEqual(res.status, 200, "webhook 404 ga tushib qolgan");
  assert.deepStrictEqual(received, { update_id: 1 }, "tana o'qilmadi");
});

test("⚠️ eski tartib (app ga to'g'ridan-to'g'ri) 404 beradi", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res) => res.status(404).json({ error: "Route topilmadi" }));

  await new Promise((r) => setTimeout(r, 5));
  app.post("/bot-webhook-XXX", (req, res) => res.sendStatus(200));

  const res = await post(app, "/bot-webhook-XXX");
  // Bu testning maqsadi — muammo HAQIQIY ekanini qayd etish.
  // Kimdir "Router ortiqcha ekan" deb soddalashtirmoqchi bo'lsa,
  // shu yerda nima yo'qotilishini ko'radi.
  assert.strictEqual(res.status, 404);
});

test("boshqa noma'lum manzil baribir 404 qaytaradi", async () => {
  const app = express();
  app.use(express.json());
  const botWebhook = express.Router();
  app.use(botWebhook);
  app.use((req, res) => res.status(404).json({ error: "Route topilmadi" }));
  botWebhook.post("/bot-webhook-XXX", (req, res) => res.sendStatus(200));

  const res = await post(app, "/api/yoq-narsa");
  assert.strictEqual(res.status, 404, "bo'sh Router hamma so'rovni yutib yubormasin");
});
