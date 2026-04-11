// ============================================================================
// FILE: src/middleware/authMiddleware.js
// ============================================================================

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token topilmadi' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token muddati o\'tgan' });
    }
    return res.status(401).json({ error: 'Token yaroqsiz' });
  }
};

module.exports = authMiddleware;