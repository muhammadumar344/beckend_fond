// src/middleware/mode.js
// ✅ YANGI — Fond (school) va Learning Center (learning_center) rejimlarini
// backend darajasida ajratadi. auth middleware'dan KEYIN ishlatiladi.
//
// requireSchoolMode — faqat institutionType === 'school' bo'lgan muassasa
// requireLCMode     — faqat institutionType === 'learning_center' bo'lgan muassasa
//
// Staff uchun direktorining institutionType'i tekshiriladi (Staff o'zi
// institutionType saqlamaydi — u har doim o'z direktoriga bog'liq).

const Teacher = require('../models/Teacher');
const Staff = require('../models/Staff');

const requireMode = (expectedType) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Avtorizatsiya talab etiladi' });
    }

    let directorId;
    if (req.user.role === 'teacher') {
      directorId = req.user.id;
    } else if (req.user.role === 'staff') {
      const staff = await Staff.findById(req.user.id).select('director');
      if (!staff) {
        return res.status(404).json({ success: false, error: 'Xodim topilmadi' });
      }
      directorId = staff.director;
    } else {
      // admin va boshqalar — bu bo'lim ularga tegishli emas
      return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
    }

    const teacher = await Teacher.findById(directorId).select('institutionType');
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Muassasa topilmadi' });
    }

    if (teacher.institutionType !== expectedType) {
      const label = expectedType === 'learning_center' ? "O'quv markazi" : 'Fond';
      return res.status(403).json({
        success: false,
        error: `Bu bo'lim faqat "${label}" rejimidagi hisoblar uchun`,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  requireMode,
  requireSchoolMode: requireMode('school'),
  requireLCMode: requireMode('learning_center'),
};
