// src/services/billingAlert.js
// ════════════════════════════════════════════════════════════
// OY BOSHIDAGI "VARAQA YARATILMAGAN" XABARI — direktorga.
//
// Bu loyihadagi eng qimmat jim xato: oylik to'lov varaqasi
// QO'LDA yaratiladi (`POST /teacher/payments/create-monthly`).
// Administrator bitta guruhni unutsa — o'sha oy o'sha guruhdan
// pul UMUMAN so'ralmaydi. Xato yo'q, belgi yo'q, ota-onaga
// eslatma ham ketmaydi (eslatma faqat MAVJUD varaqa bo'yicha
// yuboriladi — `cron/reminderCron.js`). Oy oxirida faqat
// "nega tushum kam?" degan savol qoladi.
//
// `GET /teacher/health` buni allaqachon ko'rsatadi, lekin u
// SAHIFADA yotibdi — direktor esa har kuni saytga kirmaydi.
// Ketish arafasidagi o'quvchilar bilan aynan bir xil muammo va
// aynan o'sha kanal orqali yechiladi (`Teacher.telegram`).
//
// ⚠️ 2-SANA, 1-sana EMAS. 1-sanada hali HECH BIR guruhda varaqa
//    yo'q — bu unutish emas, tabiiy hol, va xabar butun ro'yxatni
//    sanab chiqib shovqinga aylanardi. 1-sana — varaqa
//    yaratiladigan kun (o'sha kuni 09:00 da ota-onalarga eslatma
//    ham ketadi va administratorni turtadi). 2-sanada esa
//    varaqasiz qolgan guruh — haqiqiy e'tibordan chetda qolish,
//    va oyning qolgan 28 kuni pulni yig'ishga yetadi.
//
// ⚠️ BO'SH RO'YXAT — XABAR YO'Q. Kassa xabaridagi `problems`
//    rejimi bilan bir xil qoida: xabar kelsa — ish bor.
//
// ⚠️ IKKALA REJIM UCHUN HAM (Fond va LC). Ketish xabari faqat
//    LC'da ma'noli edi (sinf rahbari bolalarni har kuni ko'radi),
//    varaqa esa ikkalasida ham bir xil ko'rinmas: sinf rahbari
//    ham fond pulini so'rashni unutishi mumkin.
//
// ⚠️ SANOQ AYNAN `services/billing.js` DAGIDEK olinadi
//    (`Student.find({ class, isActive: { $ne: false } })`).
//    Tugma nima yaratsa, xabar aynan shuni va'da qilishi kerak.
//    ⚠️ Ya'ni `Enrollment` orqali qo'shimcha guruhda o'qiydigan
//       bola bu yerda ham, varaqada ham sanalmaydi. Bu — ochiq
//       savol (HANDOFF §5), lekin uni SHU YERDA "tuzatish"
//       xabarni tugmadan ajratib yuborardi.
//
// ⚠️ QUYIDAGI `buildAlert` SOF FUNKSIYA — bazaga tegmaydi,
//    `test/billingAlert.test.js` uni qulflaydi.
// ════════════════════════════════════════════════════════════

const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Student = require("../models/Student");
const MonthlyPayment = require("../models/MonthlyPayment");

// Xabarga shuncha guruh tushadi, qolgani "va yana N ta".
// Ketish xabari bilan bir xil sabab: uzun ro'yxat o'qilmaydi.
const MAX_ROWS = 8;

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

// ⚠️ `Intl` uzilmas probel (U+00A0) qo'yadi — Telegram'dan nusxa
//    olingan son qidiruvda topilmay qoladi (`cashReport.js` da
//    bir marta o'rganilgan).
const money = (n) =>
  new Intl.NumberFormat("ru-RU")
    .format(Math.round(n || 0))
    .replace(/\u00A0/g, " ");

/**
 * ⚠️ SOF FUNKSIYA. Varaqasiz guruhlardan xabar matnini yasaydi.
 *
 * @param {object} d
 * @param {string} d.centerName
 * @param {number} d.month           1..12
 * @param {number} d.year
 * @param {Array}  d.groups          [{ name, studentCount, amount }] — faqat varaqasizlari
 * @param {string} [d.link]          CRM to'lovlar sahifasi
 * @returns {{ hasGaps: boolean, count: number, text: string }}
 */
function buildAlert(d) {
  const rows = d.groups || [];
  const hasGaps = rows.length > 0;
  const monthName = MONTHS[(Number(d.month) || 1) - 1] || "";

  const lines = [];
  lines.push(`*${d.centerName || "Markaz"}* — to'lov varaqasi`);
  lines.push("");

  if (!hasGaps) {
    // ⚠️ Bu matn odatda YUBORILMAYDI (cron bo'sh ro'yxatda jim
    //    qoladi). U faqat sahifadagi "ko'rib qo'yish" tugmasi
    //    uchun kerak — shuning uchun bor.
    lines.push(`${monthName} oyi uchun hamma guruhga varaqa yaratilgan.`);
    return { hasGaps, count: 0, text: lines.join("\n") };
  }

  lines.push(
    `${rows.length} ta guruhga ${monthName} oyi uchun varaqa yaratilmagan:`,
  );
  lines.push("");

  for (const g of rows.slice(0, MAX_ROWS)) {
    const n = g.studentCount || 0;
    lines.push(`*${g.name || "?"}* — ${n} o'quvchi`);
  }
  lines.push("");

  if (rows.length > MAX_ROWS) {
    lines.push(`va yana ${rows.length - MAX_ROWS} ta.`);
    lines.push("");
  }

  // ⚠️ SUMMA — xabarning eng muhim qatori. "3 ta guruh" ni
  //    o'qigan odam ertaga qilaman deydi; "7 500 000 so'm
  //    so'ralmayapti" ni o'qigan odam hozir qiladi.
  //
  // ⚠️ "Taxminan", chunki bu guruhning standart narxi bo'yicha
  //    hisoblanadi: chegirma, qisman to'lov va aka-uka narxi
  //    varaqa yaratilgandan KEYIN qo'lda kiritiladi.
  const total = rows.reduce(
    (s, g) => s + (g.studentCount || 0) * (g.amount || 0),
    0,
  );
  if (total > 0) {
    lines.push(`Taxminan ${money(total)} so'm so'ralmayapti.`);
    lines.push("");
  }

  lines.push('To\'lovlar sahifasidagi "Hammasiga yaratish" —');
  lines.push("bitta bosishda, mavjudlariga tegmaydi.");
  if (d.link) lines.push(d.link);

  return { hasGaps, count: rows.length, text: lines.join("\n") };
}

/**
 * Bitta direktor uchun ma'lumotni bazadan yig'adi.
 *
 * ⚠️ `branchId` berilmaydi — direktor butun markazni ko'radi
 *    (ketish xabari bilan bir xil qoida).
 *
 * ⚠️ O'QUVCHISI YO'Q GURUH TUSHMAYDI. Bo'sh guruhga varaqa
 *    yaratilmagani muammo emas — `services/billing.js` ham
 *    unga hech narsa yaratmaydi va `centerHealth` ham uni
 *    hisobga olmaydi.
 */
async function collect(director, { month, year, link = "" } = {}) {
  const now = new Date();
  const m = month || now.getMonth() + 1;
  const y = year || now.getFullYear();

  // ⚠️ `archivedAt: null` — Mongo'da u maydoni umuman yo'q
  //    hujjatlarni ham topadi. `$exists: false` yozsak mavjud
  //    guruhlar ro'yxatdan yo'qolardi.
  const groups = await Class.find({
    teacher: director._id,
    archivedAt: null,
  })
    .select("name defaultAmount")
    .lean();

  if (!groups.length) {
    return { centerName: director.name || "Markaz", month: m, year: y, groups: [], link };
  }

  const ids = groups.map((g) => g._id);

  const [payRows, students] = await Promise.all([
    // Shu oy uchun varaqasi bor guruhlar
    MonthlyPayment.aggregate([
      { $match: { class: { $in: ids }, month: m, year: y } },
      { $group: { _id: "$class", n: { $sum: 1 } } },
    ]),
    // ⚠️ `billing.js` bilan AYNAN bir xil shart.
    Student.find({ class: { $in: ids }, isActive: { $ne: false } })
      .select("class")
      .lean(),
  ]);

  const billed = new Set(payRows.map((r) => String(r._id)));
  const countByGroup = new Map();
  for (const s of students) {
    const k = String(s.class);
    countByGroup.set(k, (countByGroup.get(k) || 0) + 1);
  }

  const missing = groups
    .filter((g) => {
      const id = String(g._id);
      // ⚠️ Bo'sh guruh muammo emas; varaqasi bori esa joyida.
      return (countByGroup.get(id) || 0) > 0 && !billed.has(id);
    })
    .map((g) => ({
      name: g.name,
      studentCount: countByGroup.get(String(g._id)) || 0,
      amount: g.defaultAmount || 0,
    }));

  return {
    centerName: director.name || "Markaz",
    month: m,
    year: y,
    groups: missing,
    link,
  };
}

/**
 * CRM'dagi to'lovlar sahifasi — xabar oxiridagi havola.
 *
 * ⚠️ Manzil rejimga qarab boshqa: LC direktori `/lc/payments`,
 *    Fond direktori `/teacher/payments`. Bitta manzil yozsak,
 *    yarim foydalanuvchi bosib "sahifa topilmadi" olardi.
 *
 * ⚠️ `FRONTEND_URL` vergul bilan bir nechta domen tutishi mumkin
 *    (CORS ro'yxati bilan bir xil o'zgaruvchi) — birinchisi.
 */
const crmLink = (isLC) => {
  const base = (process.env.FRONTEND_URL || "https://schoolfonds.netlify.app")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
  return `${base}${isLC ? "/lc" : "/teacher"}/payments`;
};

/**
 * Xabar rejimini o'zgartiradi.
 * `monthly` — oyning 2-sanasi (standart), `off` — yubormaydi.
 */
async function setMode(directorId, mode) {
  await Teacher.updateOne(
    { _id: directorId },
    { $set: { "billingAlert.mode": mode } },
  );
}

module.exports = { buildAlert, collect, setMode, crmLink, MAX_ROWS, MONTHS };
