const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token mavjud emas' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded ichida: { id, role: 'teacher' | 'staff' | 'admin' }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token noto'g'ri yoki muddati o'tgan" });
  }
};