// test/cloudinary.test.js
// ════════════════════════════════════════════════════════════
// Cloudinary imzosi va o'chiq holatdagi xatti-harakat.
//
// Imzo — eng nozik joyi: bitta parametr tartibsiz ketsa yoki
// imzolanmagan qiymat yuborilsa, Cloudinary "Invalid Signature"
// beradi va sabab javobda ko'rinmaydi. Shuning uchun qoida
// alohida sinaladi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// ⚠️ Modul yuklanishidan OLDIN qo'yiladi — config env ni bir marta o'qiydi
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "123456789";
process.env.CLOUDINARY_API_SECRET = "abcd";
process.env.CLOUDINARY_FOLDER = "lumo";

const cloudinary = require("../src/services/cloudinary");
const cfg = require("../src/config/cloudinary");

test("kalitlar to'liq bo'lsa yoqiladi", () => {
  assert.equal(cloudinary.enabled(), true);
  assert.equal(cfg.cloudName, "test-cloud");
  assert.equal(cfg.folders.logos, "lumo/logos");
  assert.equal(cfg.apiBase, "https://api.cloudinary.com/v1_1/test-cloud");
});

test("imzo — parametrlar alifbo tartibida, oxirida api_secret", () => {
  // Cloudinary hujjatidagi qoida: k=v juftliklari alifbo bo'yicha
  // `&` bilan ulanadi, ketidan api_secret qo'shilib sha1 olinadi.
  const expected = crypto
    .createHash("sha1")
    .update("public_id=sample_image&timestamp=1315060510" + "abcd")
    .digest("hex");

  // Ataylab TESKARI tartibda beramiz — funksiya o'zi saralashi kerak
  const got = cloudinary.sign({
    timestamp: 1315060510,
    public_id: "sample_image",
  });

  assert.equal(got, expected);
  assert.equal(got, "b4ad47fb4e25c7bf5f92a20089f9db59bc302313");
});

test("imzo — bo'sh qiymatlar hisobga olinmaydi", () => {
  const withEmpty = cloudinary.sign({
    public_id: "sample_image",
    timestamp: 1315060510,
    folder: "",
    tags: undefined,
    context: null,
  });
  const without = cloudinary.sign({
    public_id: "sample_image",
    timestamp: 1315060510,
  });
  assert.equal(
    withEmpty,
    without,
    "Bo'sh parametr imzoga tushib qolsa, yuborilgan tana bilan mos kelmaydi",
  );
});

test("yetkazish manzili — f_auto,q_auto qo'shiladi", () => {
  const raw =
    "https://res.cloudinary.com/test-cloud/image/upload/v1/lumo/logos/director-1.png";
  assert.equal(
    cloudinary.deliveryUrl(raw),
    "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/v1/lumo/logos/director-1.png",
  );
});

test("yetkazish manzili — bo'sh qiymatda yiqilmaydi", () => {
  assert.equal(cloudinary.deliveryUrl(""), "");
  assert.equal(cloudinary.deliveryUrl(null), "");
  assert.equal(cloudinary.deliveryUrl(undefined), "");
});

test("destroyImage — publicId bo'lmasa tarmoqqa chiqmaydi", async () => {
  // Tarmoq chaqiruvi bo'lsa test osilib qolardi yoki xato berardi
  assert.equal(await cloudinary.destroyImage(""), false);
  assert.equal(await cloudinary.destroyImage(null), false);
});

test("kalit yo'q bo'lsa — o'chiq, uploadImage 503 beradi", async () => {
  // Alohida jarayonda toza env bilan tekshiramiz: `require` keshi
  // tufayli shu jarayonda modulni "qayta yoqib" bo'lmaydi.
  const { execFileSync } = require("child_process");
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `const c = require("./src/services/cloudinary");
       c.uploadImage("data:image/png;base64,AAAA")
        .then(() => console.log("YOQIQ"))
        .catch((e) => console.log(e.status + "|" + e.message));`,
    ],
    {
      cwd: require("path").join(__dirname, ".."),
      env: {
        ...process.env,
        CLOUDINARY_CLOUD_NAME: "",
        CLOUDINARY_API_KEY: "",
        CLOUDINARY_API_SECRET: "",
      },
      encoding: "utf8",
    },
  );
  assert.match(out.trim(), /^503\|/);
});
