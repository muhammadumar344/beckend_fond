// src/models/Group.js
// ════════════════════════════════════════════════════════════
// ⚠️ HALI ISHLATILMAYDI. Bu — LC "guruh"ini Fond "sinf"idan
// ajratish uchun tayyorlangan model (reja 1.2).
//
// Hozircha LC guruhlari `Class` kolleksiyasida saqlanadi.
// Ko'chirish `src/scripts/migrateGroups.js` orqali bajariladi,
// lekin AVVAL `analyzeGroupSplit.js` ni ishlatib hisobotni
// ko'rib chiqing va `docs/GROUP_MIGRATION.md` ni o'qing.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    // Class'dagi `teacher` shu yerda `director` deb ataladi —
    // LC'da guruhni "o'qituvchi" emas, muassasa egasi ochadi.
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    name: { type: String, required: true, trim: true },

    // Class'dagi `defaultAmount` — LC'da bu oylik kurs narxi
    monthlyPrice: { type: Number, required: true, min: 0 },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    // Guruhga tayinlangan ustoz (Staff, Direktorning o'zi emas)
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    capacity: { type: Number, default: null, min: 1 },

    isActive: { type: Boolean, default: true },

    // Ko'chirishdan keyin izlash uchun — asl Class._id.
    // _id o'zgarmagani uchun odatda teng bo'ladi, lekin tekshirish
    // va orqaga qaytarish uchun aniq saqlanadi.
    migratedFromClass: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

groupSchema.index({ director: 1, branch: 1 });
groupSchema.index({ director: 1, isActive: 1 });

module.exports = mongoose.models.Group || mongoose.model("Group", groupSchema);
