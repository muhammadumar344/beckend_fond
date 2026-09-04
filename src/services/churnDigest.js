// src/services/churnDigest.js
// ════════════════════════════════════════════════════════════
// HAFTALIK "KETISH ARAFASIDA" XABARI — direktorga Telegram orqali.
//
// `services/churnRisk.js` ro'yxatni allaqachon hisoblaydi va
// CRM'da `/lc/at-risk` sahifasi bor. Lekin ro'yxat SAHIFADA
// yotibdi — direktor esa har kuni saytga kirmaydi. Ketish
// belgilari o'z-o'zidan yo'qolmaydi: bola uch dars kelmadi,
// keyin to'rt, keyin butunlay qoldi. O'sha vaqt ichida hech kim
// qo'ng'iroq qilmadi, chunki hech kim ko'rmadi.
//
// Bu — kassa xabari bilan **aynan bir xil muammo** va aynan
// o'sha kanal orqali yechiladi (`Teacher.telegram`).
//
// ⚠️ TELEFON RAQAMI XABARNING O'ZIDA. Telegram raqamni bosiladigan
//    qilib ko'rsatadi — direktor xabarni o'qib, o'sha yerdan
//    qo'ng'iroq qiladi. Faqat ism yozsak, u CRM'ni ochib,
//    o'quvchini qidirib, raqamni ko'chirishi kerak bo'lardi va
//    aynan shu yerda ish "keyinroq" ga qolardi.
//
// ⚠️ HAFTASIGA BIR MARTA, dushanba ertalab. Har kuni yuborsak
//    ro'yxat deyarli o'zgarmaydi (belgi darslar bo'yicha
//    to'planadi) — bir xil xabar esa o'qilmay qo'yadi. Dushanba:
//    hafta rejalashtiriladigan kun, qo'ng'iroqlar shu kuni
//    qilinadi.
//
// ⚠️ BO'SH RO'YXAT — XABAR YO'Q. "Bu hafta hech kim ketmayapti"
//    degan xabar foydali ko'rinadi, lekin u o'sha odatni
//    buzadi: xabar kelsa — ish bor. Kassa xabaridagi
//    `problems` rejimi bilan bir xil qoida.
//
// ⚠️ QUYIDAGI `buildDigest` SOF FUNKSIYA — bazaga tegmaydi,
//    `test/churnDigest.test.js` uni qulflaydi.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const { atRisk } = require("./churnRisk");

// ⚠️ Xabarga shuncha o'quvchi tushadi. Yigirmata ismli xabarni
//    hech kim o'qimaydi — u ro'yxat emas, devor bo'lib qoladi.
//    Qolganlari "va yana N ta" bo'lib sanaladi va sahifaga
//    yo'naltiradi. Ro'yxat `score` bo'yicha tartiblangan, ya'ni
//    tepada eng og'ir holatlar turadi.
const MAX_ROWS = 8;

// ⚠️ `Intl` UZILMAS PROBEL (U+00A0) qo'yadi. Telegram'da u
//    ko'rinishda oddiy probel, lekin nusxa olinganda va
//    qidirilganda boshqa belgi bo'lib chiqadi.
//
// ⚠️ Almashtiruvda ` ` ESCAPE bilan yozilgan, belgining
//    o'zi bilan emas: uzilmas probel ko'rinmaydi va tahrirlash
//    vositasi uni jimgina oddiy probelga aylantirib yuborsa,
//    almashtiruv hech narsa qilmay qo'yardi — xato ham bermasdi.
const money = (n) =>
  new Intl.NumberFormat("ru-RU")
    .format(Math.round(n || 0))
    .replace(/\u00A0/g, " ");

/**
 * ⚠️ SOF FUNKSIYA. Xavf ostidagi o'quvchilardan xabar matnini yasaydi.
 *
 * @param {object} d
 * @param {string} d.centerName
 * @param {Array}  d.students   churnRisk.atRisk() qaytargan qatorlar
 * @param {string} [d.link]     CRM sahifasiga havola
 * @returns {{ hasRisk: boolean, count: number, text: string }}
 */
function buildDigest(d) {
  const rows = d.students || [];
  const hasRisk = rows.length > 0;

  const lines = [];
  lines.push(`*${d.centerName || "Markaz"}* — ketish arafasida`);
  lines.push("");

  if (!hasRisk) {
    // ⚠️ Bu matn odatda YUBORILMAYDI (cron bo'sh ro'yxatda
    //    xabar yozmaydi). U faqat sozlamalar sahifasidagi
    //    "ko'rib qo'yish" uchun kerak — shuning uchun bor.
    lines.push("Bu hafta e'tibor talab qiladigan o'quvchi yo'q.");
    return { hasRisk, count: 0, text: lines.join("\n") };
  }

  lines.push(`${rows.length} ta o'quvchi qatnashmay qo'ydi:`);
  lines.push("");

  for (const s of rows.slice(0, MAX_ROWS)) {
    const name = s.name || "?";
    const group = s.className ? ` (${s.className})` : "";
    lines.push(`*${name}*${group}`);

    // ── Nima bo'lganini bitta qator bilan ──
    // Direktor "nega bu ro'yxatda?" deb so'ramasin: sabab
    // ismning ostida turadi.
    if (s.absentStreak >= 2) {
      lines.push(`  ketma-ket ${s.absentStreak} dars kelmadi`);
    } else if (s.missedOfWindow) {
      lines.push(
        `  oxirgi ${s.windowSize} darsdan ${s.missedOfWindow} tasiga kelmadi`,
      );
    }
    if (s.debtMonths) {
      lines.push(`  qarz: ${s.debtMonths} oy, ${money(s.debtAmount)} so'm`);
    }
    if (s.lastPresentDate) {
      lines.push(`  oxirgi marta: ${s.lastPresentDate}`);
    }

    // ⚠️ Raqam ALOHIDA qatorda va bezaksiz. Telegram uni
    //    qavs yoki qo'shtirnoq ichida ham taniydi, lekin
    //    Markdown belgilari orasida qolsa bosiladigan
    //    bo'lmay qoladi.
    if (s.parentPhone) lines.push(`  ${s.parentPhone}`);
    lines.push("");
  }

  if (rows.length > MAX_ROWS) {
    lines.push(`va yana ${rows.length - MAX_ROWS} ta.`);
    lines.push("");
  }

  // ⚠️ "Qo'ng'iroq qildim" belgisi CRM'da: bosilgan o'quvchi
  //    bir hafta ro'yxatda ko'rinmaydi. Busiz keyingi dushanba
  //    xabari aynan o'sha ismlar bilan kelardi va direktor
  //    ikkinchi marta qo'ng'iroq qilardi.
  lines.push("Qo'ng'iroq qilgach CRM'da belgilab qo'ying —");
  lines.push("keyingi haftada ro'yxatda ko'rinmaydi.");
  if (d.link) lines.push(d.link);

  return { hasRisk, count: rows.length, text: lines.join("\n") };
}

/**
 * Bitta direktor uchun ma'lumotni bazadan yig'adi.
 *
 * ⚠️ `branchId` berilmaydi — direktor butun markazni ko'radi.
 *    Filial bo'yicha ajratish CRM sahifasida bor va u yerda
 *    ma'noli; bitta xabarni beshta filialga bo'lib yuborish
 *    esa shovqin bo'lardi.
 */
async function collect(director, link = "") {
  const students = await atRisk({
    directorId: director._id,
    branchId: null,
    includeContacted: false,
  });

  return {
    centerName: director.name || "Markaz",
    students,
    link,
  };
}

/**
 * CRM'dagi ro'yxat sahifasi — xabar oxiridagi havola.
 *
 * ⚠️ `FRONTEND_URL` vergul bilan bir nechta domen tutishi mumkin
 *    (CORS ro'yxati bilan bir xil o'zgaruvchi), shuning uchun
 *    birinchisi olinadi.
 */
const crmLink = () => {
  const base = (process.env.FRONTEND_URL || "https://schoolfonds.netlify.app")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
  return `${base}/lc/at-risk`;
};

/**
 * Xabar rejimini o'zgartiradi.
 * `weekly` — dushanba ertalab (standart), `off` — yubormaydi.
 */
async function setMode(directorId, mode) {
  await Teacher.updateOne(
    { _id: directorId },
    { $set: { "churnDigest.mode": mode } },
  );
}

module.exports = { buildDigest, collect, setMode, crmLink, MAX_ROWS };
