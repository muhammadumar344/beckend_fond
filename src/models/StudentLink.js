// src/models/StudentLink.js
// ════════════════════════════════════════════════════════════
// Telegram foydalanuvchisini o'quvchiga bog'laydi.
//
// ⚠️ NEGA YANGI MODEL: eski `TelegramParent` hech qanday tekshiruv
//    talab qilmasdi — bot'da o'qituvchi emailini yozib, ro'yxatdan
//    ISTALGAN bolani tanlash mumkin edi. To'lov eslatmasi uchun bu
//    e'tiborsizlik edi; baho va davomat uchun esa begona odam
//    boshqa oilaning ma'lumotini o'qishi degani.
//
//    Shu sababli bog'lanish endi ISBOT talab qiladi:
//      · phone — Telegram'dan kelgan raqam `Student.parentPhone`
//                bilan mos keldi (ota-onalarning ko'pchiligi)
//      · code  — xodim CRM'da chiqargan bir martalik kod
//      · legacy — eski `TelegramParent` yozuvi, ISBOTLANMAGAN
//
// ⚠️ `legacy` faqat TO'LOVni ko'radi. Baho, davomat va uy vazifasi
//    uchun qaytadan tasdiqlash so'raladi. Eski eslatmalar ishlashda
//    davom etadi, lekin yangi maxfiy ma'lumot ochilmaydi.
//    Tekshiruv: utils/tmaAccess.js → canSee()
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const studentLinkSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // Telegram tomonidan imzolangan qiymat — soxtalashtirib bo'lmaydi
    telegramUserId: { type: String, required: true },
    // Xabar yuborish uchun (odatda telegramUserId bilan bir xil)
    telegramChatId: { type: String, default: "" },
    telegramUsername: { type: String, default: "" },

    // Kim: ota-ona yoki o'quvchining o'zi
    kind: {
      type: String,
      enum: ["parent", "student"],
      default: "parent",
    },

    // Qanday isbotlangani — ruxsat darajasi shunga bog'liq
    //
    // ⚠️ `approved` — sinf havolasi orqali kelgan va sinf rahbari
    //    QO'LDA tasdiqlagan bog'lanish. Kod bilan bir darajada:
    //    ikkalasida ham qaror odamniki, farqi shundaki kodni
    //    xodim OLDINDAN beradi, bu yerda esa KEYIN tasdiqlaydi.
    verifiedVia: {
      type: String,
      enum: ["phone", "code", "legacy", "approved"],
      required: true,
    },

    // Solishtirishda ishlatilgan raqam (utils/phone.js kaliti)
    phoneKey: { type: String, default: "" },

    // ⚠️ Ota-onaning Telegram tili. Odatda kerak emas — bot har
    //    xabarda `from.language_code` ni oladi. Lekin TASDIQLASH
    //    xabari CRM'dan yuboriladi: u yerda ota-ona umuman
    //    ishtirok etmaydi, ya'ni tilni so'raydigan joy yo'q.
    //    Saqlamasak, ruscha gapiradigan ota-ona kutgan javobini
    //    o'zbekcha olardi.
    tgLang: { type: String, default: "" },

    // ⚠️ TASDIQ KUTAYOTGAN BOG'LANISH.
    //
    //    Raqami ro'yxatda yo'q ota-ona sinf ro'yxatidan farzandini
    //    tanlaydi — lekin TANLASHNING O'ZI HECH NARSA OCHMAYDI.
    //    Yozuv `isActive: false` bilan yaratiladi va sinf rahbari
    //    tasdiqlagandan keyingina ochiladi.
    //
    // ⚠️ Xavfsizlik ANIQ SHU YERDAN kelib chiqadi: butun kod
    //    allaqachon `isActive: true` bo'yicha filtrlaydi (Mini App
    //    ruxsati, xabar yuborish, ro'yxatlar). Ya'ni yangi joyda
    //    "pending ni ham chiqarib yuborma" deb eslab qolish shart
    //    emas — unutilgani yopiq qoladi.
    //
    //    `status` faqat SINF RAHBARIGA ro'yxat ko'rsatish uchun:
    //    `isActive: false` o'zi "uzilgan" degani ham bo'lishi
    //    mumkin (/reset), ikkalasini ajratish kerak.
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", null],
      default: null,
    },
    // Qaysi sinf havolasi orqali kelgan — tasdiqlash ro'yxati shu
    // bo'yicha guruhlanadi
    requestedClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    isActive: { type: Boolean, default: true },
    // Mini App'ni oxirgi marta qachon ochgan
    lastSeenAt: { type: Date, default: null },
    // Oxirgi marta qachon xabar yuborilgan (cron/reminderCron.js).
    // ⚠️ Bu maydonsiz `updateOne` jimgina hech narsa yozmasdi —
    //    Mongoose sxemada yo'q maydonni xatosiz tashlab yuboradi.
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Bitta Telegram hisobi bitta o'quvchiga bir marta bog'lanadi.
// (Bir ota-onaning bir nechta farzandi bo'lishi mumkin — shuning
// uchun `telegramUserId` yolg'iz o'zi noyob EMAS.)
studentLinkSchema.index(
  { telegramUserId: 1, student: 1 },
  { unique: true },
);
// Mini App ochilganda: "bu odamning bolalari kimlar?"
studentLinkSchema.index({ telegramUserId: 1, isActive: 1 });
// Xabarnoma yuborishda: "bu o'quvchining ota-onalari kimlar?"
studentLinkSchema.index({ student: 1, isActive: 1 });

module.exports =
  mongoose.models.StudentLink ||
  mongoose.model("StudentLink", studentLinkSchema);
