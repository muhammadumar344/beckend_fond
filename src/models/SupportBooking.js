// src/models/SupportBooking.js
// ════════════════════════════════════════════════════════════
// Qo'shimcha mashg'ulotga yozilish.
//
// O'quvchi mavzuni tushunmasa, ustozning bo'sh vaqtiga yoziladi.
// Bo'sh vaqtlar qayerdan olinishi: utils/supportSlots.js
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const supportBookingSchema = new mongoose.Schema(
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
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    date: { type: String, required: true }, // "2026-08-20"
    startTime: { type: String, required: true }, // "15:30"
    endTime: { type: String, required: true }, // "16:00"

    // O'quvchi nima bo'yicha yordam so'rayotgani
    topic: { type: String, default: "", maxlength: 200 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "done", "cancelled", "no_show"],
      default: "pending",
    },

    // Ustoz/xodim izohi
    note: { type: String, default: "", maxlength: 300 },

    // Kim yozdi: ota-ona/o'quvchi ilovadan yoki xodim CRM'dan
    createdVia: {
      type: String,
      enum: ["app", "crm"],
      default: "app",
    },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" }, // "app" | "crm"
  },
  { timestamps: true },
);

// ⚠️ Bitta ustozning bitta vaqtiga IKKI KISHI yozilmasin.
//    Bo'sh vaqtlarni hisoblash ham buni tekshiradi, lekin ikki
//    kishi bir vaqtda bosgan holatda faqat shu indeks qutqaradi
//    (tekshiruv va yozuv orasidagi tirqish).
//
//    `partialFilterExpression` — bekor qilingan yozuv o'sha vaqtni
//    band qilib turmasin.
supportBookingSchema.index(
  { teacher: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "confirmed", "done"] },
    },
  },
);

// Ustozning kunlik ro'yxati va o'quvchi tarixi
supportBookingSchema.index({ teacher: 1, date: 1 });
supportBookingSchema.index({ student: 1, date: -1 });
supportBookingSchema.index({ director: 1, status: 1, date: -1 });

module.exports =
  mongoose.models.SupportBooking ||
  mongoose.model("SupportBooking", supportBookingSchema);
