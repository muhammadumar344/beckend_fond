// test/planFeatures.test.js
// ════════════════════════════════════════════════════════════
// TARIF BAYROG'I — YOZILGAN-U TEKSHIRILMAGAN.
//
// `PLAN_FEATURES` jadvalidagi har bir bayroq "bu tarifda bor /
// yo'q" degan va'da. Lekin bayroqning O'ZI hech narsani
// to'xtatmaydi — kimdir `hasFeature(...)` yozmasa, `false`
// turgan xususiyat baribir ochiq qolaveradi va hech qanday
// xato chiqmaydi.
//
// Bu loyihada aynan shu naqsh takrorlangan: `canAddStaff` va
// `canOpenBranch` yozilgan edi, lekin hech qayerdan
// chaqirilmasdi — Free hisob cheksiz xodim qo'sha olardi.
//
// Shu sabab: bayroq YO tekshirilishi kerak, YO quyidagi
// `UNGATED` ro'yxatida IZOH bilan turishi kerak. Uchinchi yo'l
// yo'q — aks holda keyingi dasturchi `homework: false` ni
// ko'rib, u ishlayapti deb o'ylaydi.
// ════════════════════════════════════════════════════════════

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

// ⚠️ ATAYLAB TEKSHIRILMAYDIGANLAR. Har biri — MAHSULOT QARORI,
//    xato emas: bugun ochiq turgan xususiyatni yopish, undan
//    allaqachon foydalanayotgan direktordan uni tortib olish
//    demakdir (filial chegarasi bilan bir xil qoida).
//
//    Ro'yxatga qo'shishdan oldin o'ylang: bu haqiqatan qaror
//    bo'ldimi, yoki shunchaki unutilganmi?
const UNGATED = {
  branches:
    "Filial soni CHEGARA bilan boshqariladi (`canOpenBranch`), bayroq bilan emas — free: 1 ta, ya'ni amalda yopiq.",
  homework:
    "Free LC hisoblarida hozir ochiq. Yopish — mahsulot qarori: bugun ishlatayotgan markazlar bor.",
  salaries: "Yuqoridagi bilan bir xil sabab.",
  roles: "Yuqoridagi bilan bir xil sabab.",
  branch_stats: "Yuqoridagi bilan bir xil sabab.",
  reports: "Yuqoridagi bilan bir xil sabab.",
  white_label:
    "Logotip va nom hamma tarifda ishlaydi (`brandingStore`). Yopish — mahsulot qarori.",
};

/** `src/` ichidagi barcha .js fayllar */
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
};

const featureKeys = () => {
  const src = fs.readFileSync(path.join(SRC, "utils/planHelper.js"), "utf8");
  const i = src.indexOf("const PLAN_FEATURES");
  assert.ok(i > 0, "PLAN_FEATURES topilmadi");
  const block = src.slice(i, src.indexOf("\n};", i));
  return [...new Set([...block.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]))];
};

test("PLAN_FEATURES bo'sh emas", () => {
  const keys = featureKeys();
  assert.ok(keys.length >= 5, `kutilmagan sonda bayroq: ${keys.length}`);
  assert.ok(keys.includes("export"));
});

test("har bir bayroq YO tekshiriladi, YO izoh bilan UNGATED da", () => {
  const files = walk(SRC).filter((f) => !f.endsWith("planHelper.js"));
  const body = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const missing = [];
  for (const key of featureKeys()) {
    const used = new RegExp(`hasFeature\\([^)]*["']${key}["']`).test(body);
    if (!used && !UNGATED[key]) missing.push(key);
  }

  assert.deepEqual(
    missing,
    [],
    "Bu bayroqlar hech qayerda tekshirilmaydi va UNGATED da ham yo'q — " +
      "ya'ni tarifda 'yo'q' deb turgan xususiyat aslida ochiq:\n" +
      missing.join(", "),
  );
});

test("UNGATED ro'yxatida haqiqatan mavjud bayroqlar turibdi", () => {
  // Bayroq olib tashlangach ro'yxatda qolib ketmasin — aks
  // holda ro'yxat vaqt o'tib yolg'onga aylanadi.
  const keys = featureKeys();
  const stale = Object.keys(UNGATED).filter((k) => !keys.includes(k));
  assert.deepEqual(stale, [], `PLAN_FEATURES da yo'q: ${stale.join(", ")}`);
});

test("UNGATED dagi har bir bayroqda SABAB yozilgan", () => {
  for (const [k, why] of Object.entries(UNGATED)) {
    assert.ok(
      typeof why === "string" && why.length > 20,
      `${k}: izoh juda qisqa — nega ochiq ekani yozilsin`,
    );
  }
});

test("import tekshiruvi yuklashdan OLDIN turadi", () => {
  // ⚠️ `export` besh joyda tekshirilardi, juftligi `import` esa
  //    umuman ochiq edi. Tekshiruv faylni o'qishdan keyin
  //    tursa, chegaradan oshgan fayl baribir tahlil qilinardi.
  const src = fs.readFileSync(
    path.join(SRC, "controllers/teacherController.js"),
    "utf8",
  );
  const i = src.indexOf("const importStudents");
  assert.ok(i > 0);
  const body = src.slice(i, i + 2500);

  const gate = body.indexOf('hasFeature(director, "import")');
  const read = body.indexOf("studentImport.readFile");
  assert.ok(gate > 0, "import bayrog'i tekshirilmayapti");
  assert.ok(gate < read, "tekshiruv faylni o'qishdan oldin bo'lsin");
});
