// src/scripts/checkDead.js
// ════════════════════════════════════════════════════════════
// "YOZILGAN-U ULANMAGAN" KODNI TOPADI.
//
//   npm run check:dead
//
// NEGA KERAK: bu loyihada aynan shu xato BESH marta takrorlandi
// va hech biri xato bermadi — funksiya shunchaki YO'Q bo'lib
// turadi:
//
//   • `startReminderCron`      — cron yozilgan, chaqirilmagan.
//     Pro/Premium da sotilayotgan "oylik eslatma" hech qachon
//     ishlamagan.
//   • `canAddStaff`/`canOpenBranch` — tarif chegarasi yozilgan,
//     tekshirilmagan. Free hisob cheksiz xodim qo'sha olardi.
//   • `updateStudent`/`updateClass` — route'ga ulanmagan. Bitta
//     harf xatosi uchun o'quvchini o'chirib qayta yaratish
//     kerak edi, to'lov tarixi bilan birga.
//   • `sendFreezeNotification` — xabar matni yozilgan, hech kim
//     yubormasdi.
//   • `cancelBooking` — servisdagi qoida ishlatilmasdi,
//     controller o'z nusxasini tutardi.
//
// Skript hech narsani o'zgartirmaydi. Topilsa exit code 1.
//
// ⚠️ CHEKLOV: nom dinamik ishlatilsa (`ctrl[name]`) ko'rinmaydi.
//    Shuning uchun ro'yxat "aniq o'lik" emas, "TEKSHIRING"
//    degani. Ataylab qoldirilganini `ALLOW` ga yozing —
//    izoh bilan, nega ekanini.
// ════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..");
const TEST = path.join(__dirname, "../../test");

// Ataylab ulanmagan — har biri izohli
const ALLOW = new Set([
  // ⚠️ `markPayment` — o'lik, LEKIN o'chirishdan oldin o'qing.
  //    Bu `updatePaymentStatus` ning kengroq varianti: u SUMMANI
  //    ham, izohni ham o'zgartira oladi va jurnalga yozadi.
  //    Hozir tizimda noto'g'ri yozilgan summani tuzatishning
  //    boshqa yo'li YO'Q — varaqa guruhning `defaultAmount`
  //    idan keladi va o'zgarmaydi (chegirma, qisman to'lov,
  //    aka-uka uchun narx — hech biri kiritilmaydi).
  //
  //    Ya'ni bu kod "keraksiz" emas, "qaror kutayotgan":
  //    route'ga ulash — pul maydonini tahrirlashga ruxsat
  //    berish demak. Qaror HANDOFF §4.2 da.
  "markPayment",
  // Guruh/sinf ajratishga tayyorgarlik (reja 1.2) — hali ishga
  // tushirilmagan, ataylab import qilinmagan
  "Group",

  // ── 2026-08-21 auditida ko'rib chiqilgan va QOLDIRILGAN ──
  //
  // ⚠️ `getStudents` — ULANMANG: u ham `updateStudent` bilan bir
  //    xil kasal edi, `Student.find({ teacher })` deb qidiradi va
  //    `Student` da bunday maydon YO'Q. Route'ga qo'shilsa doim
  //    bo'sh ro'yxat qaytaradi. Kerak bo'lsa avval tuzating.
  "getStudents",
  // Profil ma'lumoti login javobida va `/teacher/dashboard` da
  // keladi — uchinchi manba shart emas.
  "getProfile",
  // Sinf ma'lumoti ro'yxatdan keladi (`/teacher/classes`)
  "getClassById",
  // Xodim ma'lumoti ro'yxatda to'liq keladi (`/lc/staff`)
  "getStaffById",
  // ⚠️ Parol tiklash `passwordResetController` da BIRLASHTIRILGAN
  //    (direktor + xodim bitta oqim). Buni qayta ulash ikkinchi,
  //    ajralib ketadigan yo'l yaratardi.
  "resetPasswordByToken",

  // Test yoki qo'lda ishga tushirish uchun eksport qilinadi —
  // ishlab turgan kod ularni chaqirmasligi normal:
  "anyEnabled",   // config/payments — "birorta provayder yoqilganmi"
  "clearKey",     // rateLimit — testda holatni tozalash uchun

  // ⚠️ `findByChat` — direktor bot'ga yozganda uni tanish uchun
  //    tayyor turibdi. Hozircha bot direktordan faqat `/start`
  //    ni qabul qiladi; buyruqlar qo'shilganda shu ishlatiladi.
  "findByChat",
  // SMS bitta raqamga — hozircha faqat guruh bo'yicha yuboriladi
  "sendSingle",
  // Fond rejimi uchun alohida route yo'q; LC varianti ishlatiladi
  "requireSchoolMode",
]);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) files.push(p);
  }
};
walk(SRC);

const source = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

// Testlar ham hisobga olinadi: faqat test ishlatadigan nom
// "o'lik" emas, lekin alohida belgilanadi.
const testFiles = fs.existsSync(TEST)
  ? fs.readdirSync(TEST).filter((f) => f.endsWith(".js"))
  : [];
const testSrc = testFiles
  .map((f) => fs.readFileSync(path.join(TEST, f), "utf8"))
  .join("\n");

/** Faylda eksport qilingan nomlar */
function exportedNames(code) {
  const names = new Set();
  for (const m of code.matchAll(/^exports\.(\w+)\s*=/gm)) names.add(m[1]);
  const block = code.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/);
  if (block) {
    for (const raw of block[1].split(",")) {
      const n = raw.split(":")[0].trim();
      if (/^\w+$/.test(n)) names.add(n);
    }
  }
  return names;
}

const rel = (f) => path.relative(SRC, f).replace(/\\/g, "/");

// ⚠️ KONSTANTALAR TEKSHIRILMAYDI (`MAX_ROWS`, `GRACE_DAYS`).
//    Ular ko'pincha hujjat va test uchun eksport qilinadi va
//    ularni ro'yxatga qo'shsak, 40 tadan ortiq soxta xato
//    chiqib, butun tekshiruv o'qilmay qolardi. Haqiqiy beshta
//    bug ham funksiya edi, konstanta emas.
const isConstantName = (n) => /^[A-Z0-9_]+$/.test(n);

/**
 * Nom O'Z faylida ham ishlatiladimi (ta'rif va eksportdan tashqari).
 *
 * ⚠️ EKSPORT QATORI SANALMAYDI. Birinchi variantda u ham
 *    hisoblanardi va guardrail o'z sinovidan o'tmadi: ataylab
 *    qo'shilgan, hech kim chaqirmaydigan funksiya "ishlatilyapti"
 *    bo'lib chiqdi (ta'rif + `module.exports` qatori = 2 ta).
 */
const withoutExports = (code) =>
  code
    .replace(/module\.exports\s*=\s*\{([\s\S]*?)\}/g, (_, body) =>
      // ⚠️ Blokni butunlay o'chirib bo'lmaydi: ichida QIYMAT ham
      //    bo'ladi (`requireSchoolMode: requireMode("school")`) va
      //    u haqiqiy ishlatilish. Faqat KALITLAR olib tashlanadi.
      body
        .split(",")
        .map((entry) => {
          const m = entry.match(/^\s*\w+\s*:([\s\S]*)$/);
          if (m) return m[1]; // kalit ketdi, qiymat qoldi
          return /^\s*\w+\s*$/.test(entry) ? "" : entry; // qisqa yozuv
        })
        .join(" "),
    )
    .replace(/^exports\.\w+\s*=\s*/gm, "");

const usedInOwnFile = (code, name) =>
  (withoutExports(code).match(new RegExp(`\\b${name}\\b`, "g")) || []).length > 1;

// ── A. Controller eksporti route'ga ulanganmi ────────────────
const routeSrc = files
  .filter((f) => rel(f).startsWith("routes/"))
  .map((f) => source.get(f))
  .join("\n");
const serverSrc = source.get(path.join(SRC, "server.js")) || "";

const unrouted = [];
for (const f of files.filter((f) => rel(f).startsWith("controllers/"))) {
  const code = source.get(f);
  for (const name of exportedNames(code)) {
    if (ALLOW.has(name) || isConstantName(name)) continue;
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(routeSrc) || re.test(serverSrc)) continue;
    // Boshqa controller/servis chaqirsa ham ishlatilgan hisoblanadi
    const elsewhere = files.some(
      (o) => o !== f && !rel(o).startsWith("routes/") && re.test(source.get(o)),
    );
    if (elsewhere) continue;
    unrouted.push(`${rel(f)} → ${name}`);
  }
}

// ── B. Funksiya hech qayerda chaqirilmaydi ───────────────────
const dead = [];
for (const f of files) {
  const r = rel(f);
  if (r.startsWith("scripts/") || r === "server.js" || r.startsWith("controllers/")) continue;

  const code = source.get(f);
  for (const name of exportedNames(code)) {
    if (ALLOW.has(name) || isConstantName(name)) continue;
    if (name.length < 4) continue;
    // O'z faylida ishlatilsa — u ichki yordamchi, eksport esa
    // test yoki qo'lda ishga tushirish uchun (masalan cron).
    if (usedInOwnFile(code, name)) continue;

    const usedElsewhere = files.some(
      (o) => o !== f && new RegExp(`\\b${name}\\b`).test(source.get(o)),
    );
    if (usedElsewhere) continue;

    const usedInTest = new RegExp(`\\b${name}\\b`).test(testSrc);
    dead.push(`${r} → ${name}${usedInTest ? "  (faqat testda)" : ""}`);
  }
}

console.log("═══ Ulanmagan kod tekshiruvi ═══\n");
console.log(`Fayl    : ${files.length}`);
console.log(`Ataylab : ${ALLOW.size} ta nom ALLOW ro'yxatida\n`);

console.log("1. Controller eksporti route'ga ulanganmi");
if (unrouted.length) {
  unrouted.forEach((d) => console.log(`   ❌ ${d}`));
  console.log("");
  console.log("   Bu — eng qimmat xato turi: funksiya bor, lekin unga");
  console.log("   yetib bo'lmaydi. Foydalanuvchi uchun u UMUMAN YO'Q.");
  process.exitCode = 1;
} else {
  console.log("   ✅ hammasi ulangan");
}

console.log("\n2. Servis/util funksiyasi chaqiriladimi");
if (dead.length) {
  dead.forEach((d) => console.log(`   ❌ ${d}`));
  console.log("");
  console.log("   Chaqirilmagan cron? Tekshirilmagan chegara?");
  console.log("   Yuborilmayotgan xabar? Ataylab bo'lsa — ALLOW ga.");
  process.exitCode = 1;
} else {
  console.log("   ✅ hammasi chaqiriladi");
}

if (!unrouted.length && !dead.length) {
  console.log("\n════════════════════════════════════════");
  console.log("✅ Yozilgan-u ulanmagan kod topilmadi");
}
