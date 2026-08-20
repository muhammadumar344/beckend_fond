// src/models/CashShift.js
// ════════════════════════════════════════════════════════════
// KUNLIK KASSA — "smena yopish".
//
// Administrator kun bo'yi naqd pul oladi va kechqurun direktorga
// topshiradi. Hozirgacha buni daftarga yozib hisoblardi.
//
// ⚠️ "SMENA OCHISH" TUGMASI YO'Q — VA ATAYLAB YO'Q.
//    Odatdagi kassa tizimlarida smena ochiladi va yopiladi.
//    O'quv markazida bu ishlamaydi: ertalab soat 9 da hech kim
//    "smenani ochish"ni bosmaydi, keyin esa kun bo'yi olingan pul
//    hech qaysi smenaga tegishli bo'lmay qoladi va hisob jimgina
//    noto'g'ri chiqadi. Noto'g'ri hisob — hisob yo'qligidan
//    battar.
//
//    Shuning uchun smena = ODAM + KUN. U o'z-o'zidan mavjud,
//    yopilishi kerak, xolos. Yopilmagan kun ham ko'rinib turadi —
//    direktor uchun aynan o'sha muhim ma'lumot.
//
// ⚠️ KUN CHEGARASI TOSHKENT BO'YICHA. Render UTC da ishlaydi;
//    server sanasiga tayansak, kechqurun soat 19:00 dan keyingi
//    har bir to'lov ertangi smenaga tushib ketardi.
//
// ⚠️ YOPILGAN SMENA O'ZGARMAYDI. Sanalgan pulni keyin
//    to'g'rilash mumkin bo'lsa, kamomad chiqqan odam uni
//    o'zi tuzatib qo'yadi va butun ma'no yo'qoladi. Xato
//    bo'lsa — direktor jurnaldan ko'radi va o'zi hal qiladi.
// ════════════════════════════════════════════════════════════
const mongoose = require('mongoose');

const cashShiftSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },

    // Smena egasi. Ism va rol NUSXA qilib saqlanadi — xodim
    // ishdan ketsa ham o'tgan smenalar egasiz qolmaydi.
    staff: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      model: { type: String, enum: ['Teacher', 'Staff'], required: true },
      name: { type: String, default: '' },
      roleName: { type: String, default: '' },
    },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

    // "YYYY-MM-DD", Toshkent bo'yicha. Matn sifatida saqlanadi:
    // `Date` bo'lsa mintaqa yana aralashardi, matn esa bir xil
    // kun uchun har doim bir xil kalit beradi.
    date: { type: String, required: true },

    // Tizim hisoblagani — to'lovlardan va naqd xarajatlardan
    //
    // ⚠️ `cash` — QUTIDA QOLISHI KERAK BO'LGAN pul
    //    (`cashIn − expenses`), ya'ni sanaladigan son. Nomi
    //    o'zgarmadi, chunki `difference` avvaldan shundan
    //    hisoblanadi.
    //
    // ⚠️ ESKI YOZUVLARDA `cashIn` va `expenses` YO'Q. O'sha
    //    paytda xarajat kassaga umuman tegmasdi, ya'ni ularda
    //    `cash` sof tushum edi. Yozuvlar o'zgarmas — orqaga
    //    qaytib to'ldirmaymiz. Interfeys yo'q maydonni 0 deb
    //    ko'rsatadi va bu to'g'ri: o'sha kunlarda kassadan
    //    xarajat qilinmagan deb HISOBLANGAN.
    expected: {
      cashIn: { type: Number, default: 0 }, // naqd tushum
      expenses: { type: Number, default: 0 }, // naqd chiqim
      expenseCount: { type: Number, default: 0 },
      cash: { type: Number, default: 0 }, // kutilgan qoldiq
      card: { type: Number, default: 0 },
      transfer: { type: Number, default: 0 },
      total: { type: Number, default: 0 }, // to'lovlar yig'indisi
      count: { type: Number, default: 0 },
    },

    // Odam sanagani
    countedCash: { type: Number, required: true, min: 0 },

    // countedCash − expected.cash. Manfiy = kamomad, musbat = ortiqcha.
    // Hisoblab saqlanadi, chunki keyin `expected` qayta hisoblansa
    // (masalan to'lov o'chirilsa) o'sha kungi haqiqiy farq
    // o'zgarib ketmasligi kerak.
    difference: { type: Number, default: 0 },

    note: { type: String, default: '' },

    closedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Bir odam bir kunni ikki marta yopa olmaydi. Bu shart faqat
// interfeysda bo'lsa yetarli emas — ikki marta bosilgan tugma
// ham, qo'lda yuborilgan so'rov ham ikkinchi yozuv yaratardi.
cashShiftSchema.index({ director: 1, 'staff.id': 1, date: 1 }, { unique: true });
// Direktor ko'rinishi: oxirgi smenalar birinchi
cashShiftSchema.index({ director: 1, date: -1 });

// Yuqoridagi "yopilgan smena o'zgarmaydi" qoidasi — kodda emas,
// modelda. Controllerga tayanib bo'lmaydi: ertaga yozilgan yangi
// controller buni bilmaydi.
const blockWrite = function (next) {
  next(new Error("Yopilgan smenani o'zgartirib yoki o'chirib bo'lmaydi"));
};
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  cashShiftSchema.pre(op, blockWrite);
}

module.exports = mongoose.model('CashShift', cashShiftSchema);
