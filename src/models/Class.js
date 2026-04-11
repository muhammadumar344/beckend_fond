const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  description: String,
  isActive: { type: Boolean, default: true }, // subscription o'chsa false bo'ladi

  // Plan limitleri
  plan: {
    type: String,
    enum: ['free', 'plus', 'pro'],
    default: 'free',
  },

  // Teacher o'zi belgilaydi — har oy oquvchidan olinadigan summa
  defaultPaymentAmount: {
    type: Number,
    default: 0,
  },

  // defaultPaymentAmount o'rnatilganmi (birinchi login check uchun)
  isAmountConfigured: {
    type: Boolean,
    default: false,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Class', classSchema);