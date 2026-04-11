// ============================================================================
// FILE: src/models/Class.js
// ============================================================================

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Sinf nomi majburiy'],
    trim: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Teacher majburiy'],
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  plan: {
    type: String,
    enum: ['free', 'plus', 'pro'],
    default: 'free',
  },
  defaultPaymentAmount: {
    type: Number,
    default: 0,
  },
  isAmountConfigured: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Class', classSchema);