// src/controllers/authController.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs"); // ✅ TO'G'RI JOY — fayl boshida
const Admin = require("../models/Admin");
const Teacher = require("../models/Teacher");
const Staff = require("../models/Staff"); // ✅ TO'G'RI JOY — fayl boshida

const JWT_SECRET = process.env.JWT_SECRET || "fond-school-secret-2024";

const generateToken = (id, role) =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "30d" });

const generateReferralCode = (name) => {
  const base = name.trim().toLowerCase().replace(/\s+/g, "").slice(0, 6);
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${base}-${suffix}`;
};

// ══ SETUP ════════════════════════════════════════════════════════════════════
exports.checkSetup = async (req, res) => {
  try {
    const admin = await Admin.findOne();
    res.json({ setupRequired: !admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ══ ADMIN ═════════════════════════════════════════════════════════════════════
exports.createAdmin = async (req, res) => {
  try {
    if (await Admin.findOne())
      return res.status(400).json({ error: "Admin allaqachon mavjud" });
    const { name, email, password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Ism majburiy" });
    if (!email?.trim())
      return res.status(400).json({ error: "Email majburiy" });
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Parol kamida 6 belgi" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Email noto'g'ri" });

    const admin = new Admin({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
    });
    await admin.save();
    const token = generateToken(admin._id, "admin");
    res.status(201).json({
      message: "Admin yaratildi",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
      },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Bu email band" });
    res.status(500).json({ error: err.message });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email va parol majburiy" });
    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin || !(await admin.comparePassword(password)))
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    const token = generateToken(admin._id, "admin");
    res.json({
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ══ TEACHER (DIRECTOR) ════════════════════════════════════════════════════════
exports.teacherLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email va parol majburiy" });
    const teacher = await Teacher.findOne({ email }).select("+password");
    if (!teacher || !(await teacher.comparePassword(password)))
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    if (!teacher.isActive)
      return res.status(403).json({ error: "Akkaunt bloklangan" });
    const token = generateToken(teacher._id, "teacher");
    res.json({
      token,
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: "teacher",
        plan: teacher.plan,
        planActive: teacher.isPlanActive(),
        daysLeft: teacher.daysLeft(),
        onboardingCompleted: teacher.onboardingCompleted,
        institutionType: teacher.institutionType,
        referralCode: teacher.referralCode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ══ STAFF (XODIM) ═════════════════════════════════════════════════════════════
exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email va parol majburiy" });
    }

    const staff = await Staff.findOne({ email: email.toLowerCase() })
      .populate("role", "name slug permissions color")
      .populate("branch", "name");

    if (!staff) {
      return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
    }

    if (!staff.isActive) {
      return res.status(403).json({
        message: "Hisobingiz bloklangan. Direktor bilan bog'laning.",
      });
    }

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
    }

    const token = generateToken(staff._id, "staff");

    res.json({
      token,
      user: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: "staff",
        staffRole: staff.role, // { name, slug, permissions, color }
        branch: staff.branch, // { _id, name }
        position: staff.position,
        emailVerified: staff.emailVerified,
        isActive: staff.isActive,
      },
    });
  } catch (err) {
    console.error("[staffLogin]", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
};
