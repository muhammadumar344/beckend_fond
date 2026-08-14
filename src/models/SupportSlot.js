// src/models/SupportSlot.js
// ════════════════════════════════════════════════════════════
// Ustozning QABUL VAQTI — takrorlanuvchi oyna.
//
// Masalan: "Aziz ustoz har seshanba 15:00–17:00 da qo'shimcha
// mashg'ulot o'tkazadi, har biri 30 daqiqa."
//
// ⚠️ BU YERDA BAND VAQTLAR SAQLANMAYDI. Bo'sh vaqtlar har safar
//    HISOBLANADI (utils/supportSlots.js): qabul oynasidan dars
//    jadvali va band qilinganlar ayriladi.
//
//    Sabab: jadval o'zgarganda (ustozga yangi guruh qo'shildi)
//    oldindan yozib qo'yilgan "bo'sh vaqtlar" yolg'on bo'lib
//    qolardi va o'quvchi ustoz dars o'tayotgan paytga yozilib
//    olardi. Ikkita manba bir-biriga zid bo'lgandan ko'ra,
//    bitta manbadan hisoblagan yaxshi.
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const supportSlotSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    // Ustoz — Staff hujjati (Teacher emas: Teacher bu direktor)
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    // ⚠️ 0 = DUSHANBA, 6 = Yakshanba — loyihadagi `Schedule` bilan
    //    bir xil. JS dagi `Date.getDay()` boshqacha (0 = Yakshanba),
    //    o'girish utils/supportSlots.js da.
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },

    startTime: { type: String, required: true }, // "15:00"
    endTime: { type: String, required: true }, // "17:00"

    // Bitta uchrashuv necha daqiqa
    slotMinutes: { type: Number, default: 30, min: 10, max: 180 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supportSlotSchema.index({ teacher: 1, dayOfWeek: 1, isActive: 1 });
supportSlotSchema.index({ director: 1, isActive: 1 });

module.exports =
  mongoose.models.SupportSlot ||
  mongoose.model("SupportSlot", supportSlotSchema);
