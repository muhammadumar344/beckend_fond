// ============================================================================
// FILE: src/models/Teacher.js
// ============================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ism majburiy'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email majburiy'],
    unique: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email to\'g\'ri formatda emas'],
  },
  password: {
    type: String,
    required: [true, 'Parol majburiy'],
    select: false,
  },
  phone: String,
  createdByAdmin: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

teacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

teacherSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (err) {
    throw new Error('Password tekshirishda xato');
  }
};

teacherSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save();
};

teacherSchema.post('save', function (err, doc, next) {
  if (err.name === 'MongoServerError' && err.code === 11000) {
    next(new Error('Bu email allaqachon ro\'yxatdan o\'tgan'));
  } else {
    next(err);
  }
});

module.exports = mongoose.model('Teacher', teacherSchema);