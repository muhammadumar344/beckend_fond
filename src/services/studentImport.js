// src/services/studentImport.js
// ════════════════════════════════════════════════════════════
// O'QUVCHILARNI EXCEL'DAN IMPORT QILISH.
//
// NEGA KERAK: yangi markaz Lumo'ga o'tayotganda 200 ta o'quvchini
// qo'lda kiritishi kerak edi. Bu — tizimga o'tishning eng katta
// to'sig'i: direktor bir kunlik ishni ko'radi va "keyinroq" deb
// qo'yadi. Ro'yxat esa allaqachon uning Excel faylida turibdi.
//
// ⚠️ AVVAL KO'RSATADI, KEYIN YOZADI. Birinchi so'rov faqat
//    tahlil qiladi (`apply: false`) — nechta o'quvchi qo'shiladi,
//    qaysilari takror, qaysi qatorda xato bor. Direktor ko'rib
//    tasdiqlaydi. Bu — `POST /lc/rooms/import` va `set-brand`
//    skripti bilan bir xil qoida: begona ma'lumotni ko'r-ko'rona
//    bazaga yozmaymiz.
//
// ⚠️ YARIM IMPORT QILINMAYDI. Tarif chegarasidan oshsa, HECH
//    NARSA yozilmaydi. Yarmi tushgan ro'yxat eng yomon holat:
//    direktor qaysi bola tushmaganini bilmaydi va qo'lda
//    solishtirib chiqishga majbur bo'ladi.
//
// ⚠️ USTUN NOMLARI TURLICHA yoziladi: "Ism", "F.I.O", "Name",
//    "Telefon", "Ota-ona telefoni"… Shuning uchun sarlavha
//    taxallus ro'yxati bilan solishtiriladi. Topilmasa — xato
//    matnida FAYLDAGI sarlavhalar qaytariladi, aks holda odam
//    nima noto'g'ri ekanini topa olmasdi.
// ════════════════════════════════════════════════════════════

const XLSX = require("xlsx");
const { samePhone, phoneKey } = require("../utils/phone");

// Bitta faylda shuncha qatorgacha. Kattaroq fayl — odatda
// butunlay boshqa narsa (masalan buxgalteriya jadvali).
const MAX_ROWS = 500;

/** Sarlavha taxalluslari — kichik harfga keltirib solishtiriladi */
const NAME_KEYS = [
  "ism", "ismi", "f.i.o", "fio", "f.i.sh", "fish", "familiya",
  "o'quvchi", "oquvchi", "o‘quvchi", "talaba", "bola",
  "name", "full name", "student", "фио", "имя", "ученик",
];
const PHONE_KEYS = [
  "telefon", "tel", "raqam", "telefon raqami", "ota-ona telefoni",
  "ota-ona", "otasi", "onasi", "phone", "mobile", "телефон", "номер",
];

const norm = (v) => String(v ?? "").trim();
const key = (v) => norm(v).toLowerCase().replace(/\s+/g, " ");

/**
 * ⚠️ SOF FUNKSIYA. Jadval qatorlaridan o'quvchilar ro'yxatini yasaydi.
 *
 * @param {Array<Array>} table  birinchi qator — sarlavha
 * @param {Array} existing      [{ name, parentPhone }] — bazadagilar
 * @returns {{ ok, error, headers, rows, duplicates, invalid }}
 */
function parseTable(table = [], existing = []) {
  const clean = table.filter((r) => r?.some((c) => norm(c)));
  if (!clean.length) {
    return { ok: false, error: "Fayl bo'sh", headers: [], rows: [], duplicates: [], invalid: [] };
  }

  const headers = (clean[0] || []).map(norm);
  const lower = headers.map(key);

  const nameIdx = lower.findIndex((h) => NAME_KEYS.includes(h));
  const phoneIdx = lower.findIndex((h) => PHONE_KEYS.includes(h));

  if (nameIdx === -1) {
    return {
      ok: false,
      // ⚠️ Fayldagi sarlavhalar javobda qaytadi — odam nimani
      //    tuzatishni bilsin.
      error: "Ism ustuni topilmadi",
      headers,
      rows: [],
      duplicates: [],
      invalid: [],
    };
  }

  const rows = [];
  const duplicates = [];
  const invalid = [];
  // Fayl ichidagi takrorni ham ushlaymiz: bitta ro'yxatda bir
  // bola ikki marta yozilgan bo'lishi mumkin.
  const seen = new Set();

  for (let i = 1; i < clean.length && rows.length < MAX_ROWS; i++) {
    const raw = clean[i];
    const rowNo = i + 1; // Excel'dagi qator raqami (1 dan)
    const name = norm(raw[nameIdx]);
    const phone = phoneIdx === -1 ? "" : norm(raw[phoneIdx]);

    if (!name) {
      invalid.push({ row: rowNo, reason: "ism yo'q" });
      continue;
    }

    // ⚠️ `phoneKey` — oxirgi 9 raqam. Xom matnni solishtirsak
    //    `+998 90 123 45 67` va `90 123 45 67` boshqa-boshqa
    //    ko'rinardi va bitta bola ikki marta qo'shilardi
    //    (`utils/phone.js` — loyihadagi umumiy qoida).
    const dupKey = key(name) + "|" + (phoneKey(phone) || "");
    if (seen.has(dupKey)) {
      duplicates.push({ row: rowNo, name, phone, reason: "faylda takror" });
      continue;
    }

    // ⚠️ Bazadagi bilan solishtirish: ism + raqam. Faqat ism
    //    bo'yicha solishtirsak, bir xil ismli ikki bola
    //    (ular bor) ikkinchisi tushmay qolardi.
    const already = existing.some(
      (e) =>
        key(e.name) === key(name) &&
        (phone ? samePhone(e.parentPhone, phone) : !norm(e.parentPhone)),
    );
    if (already) {
      duplicates.push({ row: rowNo, name, phone, reason: "allaqachon bor" });
      continue;
    }

    seen.add(dupKey);
    rows.push({ row: rowNo, name, phone });
  }

  const cut = clean.length - 1 > MAX_ROWS;

  return {
    ok: true,
    headers,
    rows,
    duplicates,
    invalid,
    // Chegaradan oshgani — jim qolmasin
    truncated: cut ? clean.length - 1 - MAX_ROWS : 0,
    hasPhoneColumn: phoneIdx !== -1,
  };
}

/**
 * base64 (yoki xom bayt) faylni jadvalga aylantiradi.
 * Excel ham, CSV ham shu yerdan o'tadi — `xlsx` ikkalasini biladi.
 */
function readFile(base64) {
  const body = String(base64 || "").includes(",")
    ? String(base64).split(",").pop()
    : String(base64 || "");
  if (!body) throw new Error("Fayl bo'sh");

  const buf = Buffer.from(body, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Faylda varaq yo'q");

  // `header: 1` — sarlavhani ham qator sifatida beradi; bizga
  // aynan shu kerak, chunki ustun nomlarini o'zimiz taniymiz.
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
}

module.exports = { parseTable, readFile, MAX_ROWS, NAME_KEYS, PHONE_KEYS };
