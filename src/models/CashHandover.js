// src/models/CashHandover.js
// ════════════════════════════════════════════════════════════
// PULNI TOPSHIRISH — kassaning IKKINCHI yarmi.
//
// Birinchi yarim (`CashShift`) bitta savolga javob beradi:
// "qutida qancha bo'lishi kerak edi va qancha bor?". Lekin
// smenani yopish — bu faqat "MEN SANADIM" degani. Undan keyin
// pul jismonan direktorga o'tadi va o'sha o'tish hech qayerda
// yozilmasdi.
//
// Ertasiga direktor "menga 400 000 berilgan" desa,
// administratorda hech qanday dalil yo'q edi. Kassa jurnali
// pulni qutigacha kuzatib borib, eng nozik joyda — qo'ldan
// qo'lga o'tishda — to'xtab qolardi.
//
// ⚠️ IKKI TOMONLAMA TASDIQ. Bir tomonlama yozuv hech narsani
//    isbotlamaydi: "topshirdim" deb yozib qo'yish oson, qabul
//    qiluvchi esa "olmadim" deyishi mumkin. Shuning uchun
//    yozuv `pending` bo'lib turadi va faqat QABUL QILUVCHI uni
//    tasdiqlaydi.
//
// ⚠️ FARQ BO'LSA — IKKALA SON HAM SAQLANADI. Topshiruvchi
//    "500 000" deydi, qabul qiluvchi "480 000" sanaydi. Hech
//    qaysi biri ikkinchisini bosib ketmaydi: `amount` va
//    `confirmedAmount` yonma-yon turadi, holat `disputed`
//    bo'ladi. Hakamlik — odamniki, tizim faqat kim nima
//    deganini saqlaydi (`AuditLog` bilan bir xil falsafa).
//
// ⚠️ TASDIQLANGAN TOPSHIRIQ O'ZGARMAYDI. `CashShift` bilan bir
//    xil sabab: keyin to'g'rilash mumkin bo'lsa, farq chiqqan
//    odam uni o'zi tuzatib qo'yadi va butun ma'no yo'qoladi.
//    Adashib kiritilgan yozuvni faqat TASDIQLANMAGUNICHA va
//    faqat topshiruvchining o'zi bekor qila oladi — o'chirmaydi,
//    `cancelled` qiladi: iz qolsin.
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

// Odam nusxasi — ism va rol saqlanadi, `populate` emas.
// Xodim ishdan ketsa ham o'tgan topshiriqlar egasiz qolmaydi
// (`CashShift.staff` bilan bir xil qolip).
const person = {
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  model: { type: String, enum: ['Teacher', 'Staff'], required: true },
  name: { type: String, default: '' },
  roleName: { type: String, default: '' },
};

const cashHandoverSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },

    from: person, // kim topshirdi
    to: person, // kimga topshirildi

    // Topshiruvchi aytgan summa
    amount: { type: Number, required: true, min: 0 },

    // Qabul qiluvchi sanagan summa. Tasdiqlanmagunicha `null`.
    confirmedAmount: { type: Number, default: null },

    // Qaysi kunlar uchun. Ixtiyoriy, lekin foydali: uch kunlik
    // pul bir marta topshirilishi mumkin va keyin "bu qaysi
    // kunning puli edi?" degan savol chiqadi.
    dates: { type: [String], default: [] }, // "YYYY-MM-DD"

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

    note: { type: String, default: '' },

    // ⚠️ `disputed` — XATO EMAS, HOLAT. Pul topshirilgan, lekin
    //    summalar mos kelmagan. Uni "tasdiqlanmagan" bilan
    //    aralashtirmang: u yerda pul hali yo'lda, bu yerda esa
    //    yetib borgan va kelishmovchilik bor.
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'disputed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Direktor ko'rinishi: oxirgilari birinchi
cashHandoverSchema.index({ director: 1, createdAt: -1 });
// "Menga topshirilishi kutilayotganlar" — qabul qiluvchi uchun
cashHandoverSchema.index({ 'to.id': 1, status: 1 });
// "Men topshirganlarim" va topshirilmagan qoldiqni hisoblash
cashHandoverSchema.index({ 'from.id': 1, status: 1 });

// Yuqoridagi "tasdiqlangan topshiriq o'zgarmaydi" qoidasi —
// kodda emas, modelda. Controllerga tayanib bo'lmaydi: ertaga
// yozilgan yangi controller buni bilmaydi.
//
// ⚠️ `updateOne` va `findOneAndUpdate` BLOKLANMAGAN — tasdiqlash
//    va bekor qilish aynan shular orqali ketadi. Ular
//    servisda `status: 'pending'` sharti bilan chaqiriladi,
//    ya'ni tasdiqlangan yozuvga baribir tegib bo'lmaydi.
//    O'chirish esa umuman mumkin emas.
const blockDelete = function (next) {
  next(new Error("Topshiriq yozuvini o'chirib bo'lmaydi"));
};
for (const op of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
  cashHandoverSchema.pre(op, blockDelete);
}

module.exports = mongoose.model('CashHandover', cashHandoverSchema);
