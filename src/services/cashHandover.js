// src/services/cashHandover.js
// ════════════════════════════════════════════════════════════
// Pulni topshirish qoidalari. Model izohini ham o'qing —
// ikki tomonlama tasdiq nega kerakligi o'sha yerda.
// ════════════════════════════════════════════════════════════
const CashShift = require('../models/CashShift');
const CashHandover = require('../models/CashHandover');
const Staff = require('../models/Staff');

// Pul hali topshiruvchida hisoblanadigan holatlar.
// `cancelled` bu yerda YO'Q — bekor qilingan topshiriq
// qoldiqni qaytaradi, aks holda adashib bosilgan tugma
// pulni tizimdan butunlay yo'qotib yuborardi.
const OPEN_STATUSES = ['pending', 'confirmed', 'disputed'];

/**
 * Odamning ustida turgan, hali topshirilmagan naqd pul.
 *
 * ⚠️ FAQAT YOPILGAN SMENALAR hisoblanadi. Yopilmagan kunning
 *    summasi hali ma'lum emas — uni topshirishga qo'shsak,
 *    tizim o'ylab topilgan raqamni "qarz" deb ko'rsatardi.
 *    Ya'ni tartib majburiy: avval kunni yop, keyin topshir.
 *
 * ⚠️ `countedCash` olinadi, `expected.cash` emas. Odamning
 *    qo'lida SANALGAN pul bor; kamomad chiqqan bo'lsa u
 *    yo'q pulni topshira olmaydi.
 *
 * ⚠️ FARQ BO'LGANDA `confirmedAmount` AYIRILADI. Qabul
 *    qiluvchi 480 000 sanagan bo'lsa, topshiruvchining
 *    "500 000" degani qoldiqni yopmaydi: 20 000 uning
 *    ustida qolib turadi va ko'rinib turadi.
 */
async function owedBy(directorId, staffId) {
  const [shifts, handovers] = await Promise.all([
    CashShift.find({
      director: directorId,
      'staff.id': staffId,
    })
      .select('date countedCash')
      .lean(),
    CashHandover.find({
      director: directorId,
      'from.id': staffId,
      status: { $in: OPEN_STATUSES },
    })
      .select('amount confirmedAmount status dates')
      .lean(),
  ]);

  const collected = shifts.reduce((s, x) => s + (x.countedCash || 0), 0);
  const handed = handovers.reduce(
    (s, h) => s + (h.confirmedAmount ?? h.amount ?? 0),
    0
  );

  // Qaysi kunlar allaqachon topshiriqqa kiritilgan
  const usedDates = new Set(handovers.flatMap((h) => h.dates || []));

  return {
    collected,
    handed,
    owed: collected - handed,
    // Topshirilmagan kunlar — interfeys shularni tanlab beradi
    openDates: shifts
      .filter((s) => !usedDates.has(s.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, amount: s.countedCash })),
  };
}

/** Odamning nomi va roli — nusxa qilib saqlash uchun */
function selfPerson(ctx) {
  return {
    id: ctx.isDirector ? ctx.directorId : ctx.staffId,
    model: ctx.isDirector ? 'Teacher' : 'Staff',
    name: ctx.isDirector ? 'Direktor' : ctx.staffName || '',
    roleName: ctx.isDirector ? 'Direktor' : ctx.staffRole?.name || 'Xodim',
  };
}

/**
 * Topshiriq yaratadi. Holat — `pending`, ya'ni pul yo'lda.
 *
 * ⚠️ O'ZINGGA O'ZING TOPSHIRIB BO'LMAYDI. Aks holda yozuvning
 *    butun ma'nosi yo'qoladi: "topshirdim va o'zim qabul
 *    qildim" hech narsani isbotlamaydi.
 */
async function create(ctx, { toId, amount, dates, note }) {
  const sum = Number(amount);
  if (!Number.isFinite(sum) || sum <= 0) {
    const err = new Error("Topshiriladigan summa noto'g'ri");
    err.status = 400;
    throw err;
  }

  const from = selfPerson(ctx);
  if (String(toId) === String(from.id)) {
    const err = new Error("O'zingizga o'zingiz topshira olmaysiz");
    err.status = 400;
    throw err;
  }

  const to = await resolveReceiver(ctx, toId);

  const { owed } = await owedBy(ctx.directorId, from.id);
  if (sum > owed) {
    const err = new Error(
      `Sizda topshirilmagan ${owed} so'm bor, undan ko'pini topshirib bo'lmaydi`
    );
    err.status = 400;
    throw err;
  }

  return CashHandover.create({
    director: ctx.directorId,
    from,
    to,
    amount: sum,
    dates: Array.isArray(dates) ? dates.filter(Boolean).map(String) : [],
    branch: ctx.branchFilter || undefined,
    note: note || '',
  });
}

/**
 * Qabul qiluvchi kim bo'la oladi.
 *
 * ⚠️ DIREKTOR HAR DOIM, xodim esa faqat `viewCash` huquqi
 *    bilan. Sabab: `viewCash` — boshqalarning kassasini
 *    ko'rish, ya'ni nazorat huquqi. Pulni qabul qilish ham
 *    aynan shu: filial rahbari administratordan oladi va
 *    keyin direktorga topshiradi.
 */
async function resolveReceiver(ctx, toId) {
  const Teacher = require('../models/Teacher');

  if (String(toId) === String(ctx.directorId)) {
    const dir = await Teacher.findById(ctx.directorId).select('name').lean();
    return {
      id: ctx.directorId,
      model: 'Teacher',
      name: dir?.name || 'Direktor',
      roleName: 'Direktor',
    };
  }

  const staff = await Staff.findOne({
    _id: toId,
    director: ctx.directorId,
    isActive: true,
  })
    .populate('role', 'name permissions')
    .lean();

  if (!staff) {
    const err = new Error('Qabul qiluvchi topilmadi');
    err.status = 404;
    throw err;
  }
  if (!(staff.role?.permissions || []).includes('viewCash')) {
    const err = new Error("Bu xodim pul qabul qila olmaydi");
    err.status = 400;
    throw err;
  }

  return {
    id: staff._id,
    model: 'Staff',
    name: staff.name || '',
    roleName: staff.role?.name || 'Xodim',
  };
}

/**
 * Qabul qilishni tasdiqlaydi.
 *
 * ⚠️ FAQAT KIMGA TOPSHIRILGAN BO'LSA — O'SHA ODAM. Direktor
 *    ham boshqa birovga topshirilgan pulni "oldim" deb yoza
 *    olmaydi: imzo boshqa odamniki bo'lsa, imzoning ma'nosi
 *    qolmaydi.
 *
 * ⚠️ SANALGAN SUMMA MAJBURIY. "Tasdiqlash" tugmasini
 *    o'ylamasdan bosish oson; summani yozish esa qo'lidagi
 *    pulni sanashga majbur qiladi — butun ish shuning uchun
 *    qilinyapti.
 */
async function confirm(ctx, { id, countedAmount, note }) {
  const me = selfPerson(ctx);

  const doc = await CashHandover.findOne({
    _id: id,
    director: ctx.directorId,
  });
  if (!doc) {
    const err = new Error('Topshiriq topilmadi');
    err.status = 404;
    throw err;
  }
  if (String(doc.to.id) !== String(me.id)) {
    const err = new Error("Bu topshiriq sizga emas");
    err.status = 403;
    throw err;
  }
  if (doc.status !== 'pending') {
    const err = new Error('Bu topshiriq allaqachon yakunlangan');
    err.status = 409;
    throw err;
  }

  const counted = Number(countedAmount);
  if (!Number.isFinite(counted) || counted < 0) {
    const err = new Error("Sanalgan summa noto'g'ri");
    err.status = 400;
    throw err;
  }

  // ⚠️ Ikkala son ham qoladi. Farq bo'lsa `disputed` —
  //    yozuv "yopilgan" bo'lmaydi va direktor uni ko'radi.
  const updated = await CashHandover.findOneAndUpdate(
    { _id: doc._id, status: 'pending' },
    {
      $set: {
        confirmedAmount: counted,
        status: counted === doc.amount ? 'confirmed' : 'disputed',
        confirmedAt: new Date(),
        ...(note ? { note: `${doc.note}${doc.note ? ' | ' : ''}${note}` } : {}),
      },
    },
    { new: true }
  );

  if (!updated) {
    // Ikki kishi bir vaqtda bosgan — shartli yangilash ushladi
    const err = new Error('Bu topshiriq allaqachon yakunlangan');
    err.status = 409;
    throw err;
  }
  return updated;
}

/**
 * Topshiruvchi o'z yozuvini bekor qiladi (adashib kiritgan).
 *
 * ⚠️ FAQAT TASDIQLANMAGANINI va faqat O'ZINIKINI. Tasdiqlangan
 *    yozuvni bekor qilish mumkin bo'lsa, kelishmovchilikni
 *    yo'q qilib yuborish oson bo'lardi.
 */
async function cancel(ctx, id) {
  const me = selfPerson(ctx);

  const updated = await CashHandover.findOneAndUpdate(
    {
      _id: id,
      director: ctx.directorId,
      'from.id': me.id,
      status: 'pending',
    },
    { $set: { status: 'cancelled', cancelledAt: new Date() } },
    { new: true }
  );

  if (!updated) {
    const err = new Error(
      "Topshiriq topilmadi yoki uni bekor qilib bo'lmaydi"
    );
    err.status = 404;
    throw err;
  }
  return updated;
}

module.exports = { owedBy, create, confirm, cancel, selfPerson, OPEN_STATUSES };
