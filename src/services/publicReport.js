// src/services/publicReport.js
// ════════════════════════════════════════════════════════════
// OTA-ONALAR UCHUN OCHIQ HISOBOT — sof hisob.
//
// Sinf fondining butun muammosi texnik emas, IJTIMOIY: pul
// ota-onalarniki, uni sinf rahbari yig'adi, va yil oxirida
// "pulimiz qayerga ketdi?" degan gap chiqadi. Sinf rahbarining
// eng katta qo'rquvi — tezlik emas, o'g'ri deb qaralish.
//
// Shu sabab bu yerda hisob EMAS, ISHONCH quriladi.
//
// ⚠️ ISM YO'Q. Na to'laganlar, na to'lamaganlar. Qarzdorlar
//    ro'yxatini ochiq havolaga qo'yish — bolani butun sinf
//    oldida sharmanda qilish. Ota-onaga o'z qarzini ko'rsatish
//    kerak bo'lsa, buning yo'li allaqachon bor: Telegram
//    ilovasi, u yerda kim kimligi ISBOTLANGAN.
//
// ⚠️ SANOQ ko'rsatiladi ("30 tadan 22 tasi to'ladi"), chunki u
//    hech kimni ko'rsatmaydi, lekin "yig'ildi" degan raqamni
//    tushunarli qiladi.
//
// ⚠️ SOF FUNKSIYA — bazaga tegmaydi, shuning uchun test bilan
//    qulflanadi (`test/publicReport.test.js`). Bu yerdagi
//    formula noto'g'ri bo'lsa, xato eng ko'rinadigan joyda —
//    30 ta ota-onaning telefonida — chiqadi.
// ════════════════════════════════════════════════════════════

/**
 * Ochiq hisobot ma'lumotini yig'adi.
 *
 * @param {object} a
 * @param {object}   a.cls        sinf ({ name, initialBalance })
 * @param {string}   a.centerName muassasa nomi (bo'sh bo'lishi mumkin)
 * @param {Array}    a.payments   [{ amount, status }]
 * @param {Array}    a.expenses   [{ reason, amount, spentDate, receipt }]
 * @param {number}   a.month
 * @param {number}   a.year
 */
function buildPublicReport({
  cls = {},
  centerName = "",
  payments = [],
  expenses = [],
  month,
  year,
}) {
  const paid = payments.filter((p) => p.status === "paid");

  const collected = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const spent = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ⚠️ `initialBalance` — saytdan OLDINGI pul. Uni qo'shmasak
  //    qoldiq haqiqatdan kam chiqardi va ota-ona "pul kamayib
  //    qolibdi" deb o'ylardi.
  const carried = Number(cls.initialBalance) || 0;

  return {
    className: cls.name || "",
    centerName: centerName || "",
    month,
    year,

    // ⚠️ Faqat SANOQ — ism emas.
    paidCount: paid.length,
    totalCount: payments.length,

    carried,
    collected,
    spent,
    // Qoldiq MANFIY bo'lishi mumkin (o'tgan oydan qarzga
    // xarajat qilingan) — nolga qirqmaymiz, aks holda son
    // yolg'on bo'lardi.
    balance: carried + collected - spent,

    // ⚠️ Xarajat ro'yxati TO'LIQ. Sanoq bilan cheklash bu
    //    yerda ma'nosiz: aynan shu ro'yxat uchun havola
    //    ochiladi. Uzun bo'lsa ota-ona pastga suradi.
    expenses: expenses
      .slice()
      .sort((a, b) => new Date(b.spentDate || 0) - new Date(a.spentDate || 0))
      .map((e) => ({
        reason: e.reason || "",
        amount: Number(e.amount) || 0,
        date: e.spentDate || e.createdAt || null,
        // Chek surati — bor bo'lsa. Ota-ona bosib kattalashtiradi.
        receipt: e.receipt || "",
      })),
  };
}

module.exports = { buildPublicReport };
