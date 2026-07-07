const mongoose = require('mongoose')

// Fanlar — LC darajasida (filialga bog'liq emas, butun muassasa uchun umumiy)
const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // masalan: "Rus tili", "IT / Coding", "Ingliz tili"
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    color: {
      type: String,
      default: '#4299e1', // UI'da chip/badge rangi
    },
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

// Bir director ichida fan nomi takrorlanmasin
subjectSchema.index({ director: 1, name: 1 }, { unique: true })

module.exports = mongoose.models.Subject || mongoose.model('Subject', subjectSchema)