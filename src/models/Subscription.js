const mongoose = require('mongoose');

// Har bir sinf uchun alohida subscription
const subscriptionSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    unique: true,
  },
  plan: {
    type: String,
    enum: ['free', 'plus', 'pro'],
    default: 'free',
  },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },

  // Admin to'lov qilgach belgilaydi
  paidMonths: { type: Number, default: 1 }, // necha oyga to'langan
  lastPaidAt: { type: Date },

  // Sinf o'zi rad etganmi
  selfDeactivated: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

// Muddati o'tganmi tekshirish
subscriptionSchema.methods.isExpired = function () {
  return new Date() > this.expiryDate;
};

// Necha kun qoldi
subscriptionSchema.methods.daysLeft = function () {
  const diff = this.expiryDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.model('Subscription', subscriptionSchema);