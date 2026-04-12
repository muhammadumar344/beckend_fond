// backend/src/middleware/roles.js
module.exports = (role) => (req, res, next) => {
  if (req.user.role !== role) {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  next();
};