// src/models/Homework.js
// Uy vazifasi — ustoz guruhga topshiriq beradi, keyin har bir o'quvchi
// bo'yicha bajarilganini belgilaydi (HomeworkResult).
const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
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

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Grade modelidagi kabi oddiy matn (fan nomi)
    subject: { type: String, default: "" },

    assignedDate: { type: String, required: true }, // "2026-08-13"
    dueDate: { type: String, required: true }, // "2026-08-20"

    // Bajarilganda beriladigan ochko — reyting tizimining asosi
    points: { type: Number, default: 10, min: 0, max: 100 },

    // Kim bergan (Direktorning o'zi bo'lsa null)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
  },
  { timestamps: true },
);

homeworkSchema.index({ director: 1, class: 1, dueDate: -1 });
homeworkSchema.index({ class: 1, assignedDate: -1 });

module.exports =
  mongoose.models.Homework || mongoose.model("Homework", homeworkSchema);
