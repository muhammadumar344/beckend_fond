// src/models/ScheduleException.js
// ════════════════════════════════════════════════════════════
// DARS BO'LMAYDI — jadvalning bitta kunga tegishli istisnosi.
//
// NEGA KERAK: `Schedule` — HAFTALIK takrorlanuvchi yozuv. U
// "seshanba kuni 18:00 da dars bor" deydi va boshqa hech narsa
// deya olmaydi. Haqiqiy markazda esa:
//
//   • 21-mart Navro'z — butun markazda dars yo'q
//   • ustoz kasal — bugungi uchta darsi bo'lmaydi
//   • dars shanbaga ko'chirildi — o'tkazib yuborilgani qoplanadi
//
// Shu paytgacha CRM bularning hech birini bilmasdi va YOLG'ON
// gapirardi: jadvalda dars turadi, ota-ona bolasini olib keladi,
// eshik yopiq. Administrator esa yigirmata ota-onaga qo'lda
// qo'ng'iroq qilardi.
//
// ⚠️ JADVALNING O'ZI O'ZGARMAYDI. Bayram uchun darsni o'chirib,
//    ertasiga qayta yaratish — eng oson yo'l va eng yomoni:
//    o'sha guruhning butun tarixi (kim qachon dars o'tgan)
//    yo'qoladi, `Schedule._id` ga bog'langan hamma narsa uziladi.
//    Istisno — ALOHIDA yozuv: dars joyida qoladi, faqat o'sha
//    kuni "bo'lmaydi" deb belgilanadi.
//
// ⚠️ `date` — DARS BO'LISHI KERAK BO'LGAN kun. Ko'chirilganda
//    yangi kun `newDate` da turadi. Ikkalasi ham saqlanadi:
//    "qaysi dars ko'chdi" degan savolga faqat shu ikkilik javob
//    beradi. Bittasini yozib qo'ysak, o'tkazib yuborilgan kun
//    tarixdan butunlay yo'qolardi.
//
// ⚠️ `newRoom` — nom NUSXASI (`Schedule.room` bilan bir xil
//    sabab): xona arxivlansa ham ko'chirilgan dars qayerda
//    o'tgani ko'rinib tursin.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const scheduleExceptionSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },
    // Guruh — ota-onaga xabar va ro'yxat uchun. `schedule.class`
    // dan olinadi, lekin bu yerda ham turadi: istisnolar ro'yxati
    // har safar jadvalni populate qilmasin.
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    // Dars bo'lishi kerak bo'lgan kun — "YYYY-MM-DD"
    date: {
      type: String,
      required: true,
      match: [DATE_RE, "Sana YYYY-MM-DD ko'rinishida bo'lsin"],
    },

    type: {
      type: String,
      enum: ["cancelled", "moved"],
      required: true,
    },

    // ⚠️ Sabab MAJBURIY EMAS, lekin standarti "other" emas
    //    `holiday`: bayram uchun ommaviy bekor qilish shu qiymat
    //    bilan yoziladi va keyin bitta tugma bilan qaytariladi.
    reason: {
      type: String,
      enum: ["holiday", "teacher", "room", "other"],
      default: "other",
    },
    note: { type: String, default: "", trim: true, maxlength: 300 },

    // ── Faqat `moved` uchun ──────────────────────────────────
    //
    // ⚠️ SHARTLI MAJBURIY. Yangi sanasiz "ko'chirildi" yozuvi
    //    darsni eski kunidan olib tashlardi va yangi kunida
    //    hech qachon ko'rsatmasdi — dars butunlay yo'qolardi.
    //    Tekshiruv sxemada, `pre` hook'da emas: hook
    //    `validateSync()` da ishlamaydi, ya'ni test uni
    //    ushlay olmasdi.
    newDate: {
      type: String,
      default: "",
      required: [
        function () {
          return this.type === "moved";
        },
        "Ko'chirilgan dars uchun yangi sana majburiy",
      ],
      validate: {
        validator: (v) => !v || DATE_RE.test(v),
        message: "Sana YYYY-MM-DD ko'rinishida bo'lsin",
      },
    },
    newStartTime: {
      type: String,
      default: "",
      required: [
        function () {
          return this.type === "moved";
        },
        "Ko'chirilgan dars uchun yangi vaqt majburiy",
      ],
    },
    newEndTime: {
      type: String,
      default: "",
      required: [
        function () {
          return this.type === "moved";
        },
        "Ko'chirilgan dars uchun yangi vaqt majburiy",
      ],
    },
    newRoomRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    newRoom: { type: String, default: "" }, // nom nusxasi

    // Kim belgiladi — ism NUSXASI bilan (AuditLog qoidasi:
    // xodim ishdan bo'shasa ham kim qilgani ko'rinib tursin)
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, default: "" },

    // Ota-onalarga Telegram xabari ketdimi
    notifiedAt: { type: Date, default: null },
    notifiedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ⚠️ NOYOB INDEKS SHART. Bir dars uchun bir kunda ikkita istisno
//    bo'lsa ("bekor qilindi" va "ko'chirildi") tizim qaysi
//    biriga ishonishni bilmasdi. Ikki xodim bir vaqtda bosgan
//    holatni faqat indeks yopadi.
scheduleExceptionSchema.index({ schedule: 1, date: 1 }, { unique: true });
// Kunlik ko'rinish: "bugun qaysi darslar bekor qilingan"
scheduleExceptionSchema.index({ director: 1, date: 1 });
// Ko'chirilgan darslar o'sha YANGI kunda chiqishi kerak
scheduleExceptionSchema.index({ director: 1, newDate: 1 });

module.exports =
  mongoose.models.ScheduleException ||
  mongoose.model("ScheduleException", scheduleExceptionSchema);
