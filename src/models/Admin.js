// ============================================================================
// FILE: src/models/Admin.js
// ============================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ism majburiy'],
    trim: true,
    minlength: [3, 'Ism kamida 3 belgidan iborat bo\'lishi kerak'],
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
    minlength: [6, 'Parol kamida 6 belgidan iborat bo\'lishi kerak'],
    select: false,
  },
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'superadmin'],
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

adminSchema.pre('save', async function (next) {
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

adminSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (err) {
    throw new Error('Password tekshirishda xato: ' + err.message);
  }
};

adminSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save();
};

adminSchema.methods.checkOldPassword = async function (oldPassword) {
  try {
    return await bcrypt.compare(oldPassword, this.password);
  } catch (err) {
    throw new Error('Parol tekshirishda xato');
  }
};

adminSchema.post('save', function (err, doc, next) {
  if (err.name === 'MongoServerError' && err.code === 11000) {
    next(new Error('Bu email allaqachon ro\'yxatdan o\'tgan'));
  } else {
    next(err);
  }
});

module.exports = mongoose.model('Admin', adminSchema);