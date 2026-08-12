// src/models/Lead.js
// Lid — hali o'quvchi bo'lmagan, lekin qiziqish bildirgan mijoz.
// Voronka: yangi → bog'lanildi → sinov darsi → yozildi / yo'qotildi
const mongoose = require("mongoose");

const LEAD_STATUSES = ["new", "contacted", "trial", "won", "lost"];

const LEAD_SOURCES = [
  "instagram",
  "telegram",
  "referral", // tanish tavsiyasi
  "walk_in", // o'zi kelgan
  "call", // qo'ng'iroq qilgan
  "banner",
  "other",
];

const leadSchema = new mongoose.Schema(
  {
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
    phone: { type: String, required: true, trim: true },

    source: { type: String, enum: LEAD_SOURCES, default: "other" },
    status: { type: String, enum: LEAD_STATUSES, default: "new" },

    // Qaysi fanga qiziqyapti
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },

    note: { type: String, default: "" },

    // Sinov darsi sanasi (status === 'trial' bo'lganda ma'noli)
    trialDate: { type: Date, default: null },

    // Kim mas'ul (odatda administratsiya xodimi)
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    // 'won' bo'lganda yaratilgan o'quvchi
    convertedStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },

    lostReason: { type: String, default: "" },
    lastContactedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leadSchema.index({ director: 1, status: 1 });
leadSchema.index({ director: 1, branch: 1 });
leadSchema.index({ director: 1, phone: 1 });

leadSchema.statics.STATUSES = LEAD_STATUSES;
leadSchema.statics.SOURCES = LEAD_SOURCES;

module.exports = mongoose.models.Lead || mongoose.model("Lead", leadSchema);
