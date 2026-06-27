const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    staff: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Staff',
      required: true,
    },
    director: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Teacher',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Branch',
    },
    // Format: "2025-01" (YYYY-MM)
    month: {
      type:     String,
      required: true,
      match:    [/^\d{4}-(0[1-9]|1[0-2])$/, "Month formati: YYYY-MM"],
    },
    amount: {
      type:    Number,
      required: true,
      min:     [0, "Maosh manfiy bo'lishi mumkin emas"],
    },
    isPaid: {
      type:    Boolean,
      default: false,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    note: {
      type:    String,
      default: '',
      trim:    true,
    },
  },
  { timestamps: true }
);

// Bir xodim uchun bir oyda faqat bitta yozuv
salarySchema.index({ staff: 1, month: 1, director: 1 }, { unique: true });
// Tezkor so'rovlar uchun
salarySchema.index({ director: 1, month: 1 });
salarySchema.index({ branch:   1, month: 1 });

module.exports = mongoose.model('Salary', salarySchema);