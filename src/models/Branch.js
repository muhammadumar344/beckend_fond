// src/models/Branch.js
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    name: { type: String, required: true }, // "1-sonli maktab"
    address: { type: String, default: "" }, // "Toshkent, Chilonzor"
    phone: { type: String, default: "" },
    color: { type: String, default: "#4299e1" }, // UI da rang
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    directorIsManager: { type: Boolean, default: false }, // direktor o'zi ham manager bo'lsa
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

branchSchema.index({ teacher: 1, isActive: 1 });
module.exports = mongoose.model("Branch", branchSchema);
