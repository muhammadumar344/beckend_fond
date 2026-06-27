/**
 * roles('teacher')     — faqat Teacher (Director) o'ta oladi
 * roles('admin')       — faqat Admin o'ta oladi
 * onlyTeacher          — roles('teacher') qisqartmasi
 * allowTeacherOrStaff  — Teacher yoki Staff o'ta oladi
 */

const roles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Avtorizatsiya talab etiladi' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Ruxsat yo'q" });
  }
  next();
};

const allowTeacherOrStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Avtorizatsiya talab etiladi' });
  }
  if (req.user.role !== 'teacher' && req.user.role !== 'staff') {
    return res.status(403).json({ message: "Ruxsat yo'q" });
  }
  next();
};

const onlyTeacher = roles('teacher');
const onlyAdmin   = roles('admin');

module.exports = { roles, allowTeacherOrStaff, onlyTeacher, onlyAdmin };