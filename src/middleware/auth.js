// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fond-school-secret-2024';

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token topilmadi' });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,  // 'teacher' yoki 'staff'
      staffRole: decoded.staffRole || null  // ← YANGI: staff uchun permission role
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token yaroqsiz' });
  }
};

module.exports = auth;