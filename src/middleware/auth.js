const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  // allow preflight OPTIONS through
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader) {
    return res.status(401).json({ error: 'Token topilmadi' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: "Token format noto'g'ri" });
  }

   const decoded = jwt.verify(token, JWT_SECRET)
  req.user = {
    id: decoded.id,
    role: decoded.role,           // 'admin' | 'teacher' | 'staff'
    staffRole: decoded.staffRole || null,  // ✅ YANGI: 'branch_manager', 'teacher' va h.k.
  }


  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET || 'changeme';
    const payload = jwt.verify(token, secret);
    // attach user info to request for controllers
    req.user = payload;
    return next();
  } catch (err) {
    console.warn('Auth JWT error:', err.message || err);
    return res.status(401).json({ error: 'Token yaroqsiz' });
  }
};