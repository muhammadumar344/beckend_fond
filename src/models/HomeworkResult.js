// src/models/HomeworkResult.js
// Har bir o'quvchining bitta uy vazifasi bo'yicha holati.
// Attendance modeliga o'xshash — o'quvchi × topshiriq bo'yicha bitta yozuv.
const mongoose = require("mongoose");

const RESULT_STATUSES = ["pending", "done", "late", "missed"];

const homeworkResultSchema = new mongoose.Schema(
  {
    homework: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Homework",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },

    status: { type: String, enum: RESULT_STATUSES, default: "pending" },

    // Berilgan ochko. 'done' → to'liq, 'late' → yarmi, aks holda 0.
    points: { type: Number, default: 0, min: 0 },

    note: { type: String, default: "" },
    checkedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Bitta o'quvchiga bitta topshiriq bo'yicha faqat bitta yozuv
homeworkResultSchema.index({ homework: 1, student: 1 }, { unique: true });
homeworkResultSchema.index({ director: 1, student: 1 });
homeworkResultSchema.index({ class: 1, status: 1 });

homeworkResultSchema.statics.STATUSES = RESULT_STATUSES;

module.exports =
  mongoose.models.HomeworkResult ||
  mongoose.model("HomeworkResult", homeworkResultSchema);
