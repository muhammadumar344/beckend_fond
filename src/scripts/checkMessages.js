// src/scripts/checkMessages.js
// ════════════════════════════════════════════════════════════
// Kodda yozilgan foydalanuvchi xabarlarini `utils/messages.js`
// lug'ati bilan solishtiradi.
//
//   node src/scripts/checkMessages.js
//
// Nima uchun kerak: xabar matnini kodda o'zgartirsangiz lug'atdagi
// kalit eskirib qoladi va o'sha xabar jimgina o'zbekcha chiqaveradi.
// Bu skript shuni ko'rsatadi.
//
// Hech narsani o'zgartirmaydi — faqat hisobot.
// ════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const { MESSAGES } = require("../utils/messages");

const ROOT = path.join(__dirname, "..");
const DIRS = ["controllers", "utils", "services", "middleware"];

// Ataylab tarjima qilinmaydiganlar:
//  - oxiri ": " bilan tugaydigan prefikslar (keyin xato matni qo'shiladi)
//  - ichki xatolar: foydalanuvchiga YETIB BORMAYDI, controller ularni
//    ushlab, o'rniga tushunarli matn qaytaradi. Faqat logda ko'rinadi.
const SKIP = new Set([
  "Excel export xatosi: ",
  "Word export xatosi: ",
  "Cloudinary sozlanmagan",
]);

/** Manba kodidagi "\'" ni haqiqiy qiymatga aylantiradi */
function unescape(s) {
  return s.replace(/\\(['"\\])/g, "$1");
}

const found = new Map(); // matn → [fayl:qator]
let templateCount = 0;

// Skanerlanadigan fayllar: DIRS ichidagilar + src/server.js
const files = [["server.js", path.join(ROOT, "server.js")]];
for (const d of DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".js")) files.push([`${d}/${f}`, path.join(dir, f)]);
  }
}

{
  for (const [rel, abs] of files) {
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);

    lines.forEach((line, i) => {
      const patterns = [
        /(?:error|message):\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
        /new Error\((["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
      ];
      for (const re of patterns) {
        for (const m of line.matchAll(re)) {
          const s = unescape(m[2]);
          if (!/[A-Za-zА-Яа-я]/.test(s) || s.length <= 2) continue;
          if (!found.has(s)) found.set(s, []);
          found.get(s).push(`${rel}:${i + 1}`);
        }
      }
      if (/(?:error|message):\s*`/.test(line)) templateCount++;
    });
  }
}

const missing = [...found.entries()].filter(
  ([text]) => !MESSAGES[text] && !SKIP.has(text),
);
const orphan = Object.keys(MESSAGES).filter((k) => !found.has(k));

console.log("═══ Xabarlar tarjimasi ═══\n");
console.log(`Kodda topilgan matn : ${found.size}`);
console.log(`Lug'atdagi kalit    : ${Object.keys(MESSAGES).length}`);
console.log(`Shablonli (\${...})  : ${templateCount}  — tarjima qilinmaydi`);
console.log(`Ataylab o'tkazilgan : ${SKIP.size}\n`);

if (missing.length) {
  console.log(`⚠️  Tarjimasiz ${missing.length} ta matn:`);
  for (const [text, locs] of missing) {
    console.log(`   "${text}"`);
    console.log(`      ${locs.slice(0, 3).join(", ")}${locs.length > 3 ? ` (+${locs.length - 3})` : ""}`);
  }
  console.log("");
} else {
  console.log("✅ Barcha oddiy matnlar tarjima qilingan\n");
}

if (orphan.length) {
  console.log(`ℹ️  Lug'atda bor, lekin kodda topilmadi (${orphan.length} ta) —`);
  console.log("   matn o'zgargan yoki olib tashlangan bo'lishi mumkin:");
  orphan.forEach((k) => console.log(`   "${k}"`));
  console.log("");
}

// Tarjima to'liqligi
const incomplete = Object.entries(MESSAGES).filter(
  ([, v]) => !v || !v.ru || !v.en,
);
if (incomplete.length) {
  console.log(`❌ To'liq bo'lmagan yozuv (${incomplete.length} ta):`);
  incomplete.forEach(([k]) => console.log(`   "${k}"`));
  process.exitCode = 1;
} else {
  console.log("✅ Har bir kalitda ru va en bor");
}
