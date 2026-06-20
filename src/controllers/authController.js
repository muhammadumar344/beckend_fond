// src/controllers/authController.js — TO'LIQ (referral qo'shilgan)
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const Admin   = require('../models/Admin')
const Teacher = require('../models/Teacher')

const JWT_SECRET = process.env.JWT_SECRET || 'fond-school-secret-2024'

const generateToken = (id, role) => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '30d' })

const generateReferralCode = (name) => {
  const base   = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${base}-${suffix}`
}

exports.checkSetup = async (req, res) => {
  try {
    const admin = await Admin.findOne()
    res.json({ setupRequired: !admin })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.createAdmin = async (req, res) => {
  try {
    if (await Admin.findOne()) return res.status(400).json({ error: 'Admin allaqachon mavjud' })
    const { name, email, password } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Ism majburiy' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email majburiy' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'Parol kamida 6 belgi' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email noto\'g\'ri' })

    const admin = new Admin({ name: name.trim(), email: email.toLowerCase(), password })
    await admin.save()
    const token = generateToken(admin._id, 'admin')
    res.status(201).json({
      message: 'Admin yaratildi', token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu email band' })
    res.status(500).json({ error: err.message })
  }
}

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })
    const admin = await Admin.findOne({ email }).select('+password')
    if (!admin || !(await admin.comparePassword(password)))
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' })
    const token = generateToken(admin._id, 'admin')
    res.json({ token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email va parol majburiy' })
    const teacher = await Teacher.findOne({ email }).select('+password')
    if (!teacher || !(await teacher.comparePassword(password)))
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' })
    if (!teacher.isActive) return res.status(403).json({ error: 'Akkaunt bloklangan' })
    const token = generateToken(teacher._id, 'teacher')
    res.json({
      token,
      user: {
        id:                  teacher._id,
        name:                teacher.name,
        email:               teacher.email,
        role:                'teacher',
        plan:                teacher.plan,
        planActive:          teacher.isPlanActive(),
        daysLeft:            teacher.daysLeft(),
        onboardingCompleted: teacher.onboardingCompleted,
        institutionType:     teacher.institutionType,
        referralCode:        teacher.referralCode,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}