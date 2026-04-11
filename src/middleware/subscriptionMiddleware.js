const Subscription = require('../models/Subscription');
const Class = require('../models/Class');

// classId req.params yoki req.body dan olinadi
const subscriptionMiddleware = async (req, res, next) => {
  try {
    // Admin bo'lsa tekshirmasdan o'tkazib yuborish
    if (req.user && req.user.role === 'admin') return next();

    const classId = req.params.classId || req.body.classId || req.body.class;
    if (!classId) return next(); // classId yo'q bo'lsa tekshirma

    const subscription = await Subscription.findOne({ class: classId });

    if (!subscription) {
      return res.status(403).json({
        error: 'subscription_not_found',
        message: 'Subscription topilmadi',
      });
    }

    if (subscription.selfDeactivated) {
      return res.status(403).json({
        error: 'self_deactivated',
        message: 'Sinf o\'chirib tashlangan',
      });
    }

    if (subscription.isExpired() || !subscription.isActive) {
      return res.status(403).json({
        error: 'subscription_expired',
        message: 'Saytdan foydalanish vaqtingiz tugadi. Iltimos to\'lov qiling',
        expiryDate: subscription.expiryDate,
      });
    }

    // Ogohlantirish: 3 kun va undan kam qolsa
    const daysLeft = subscription.daysLeft();
    if (daysLeft <= 3) {
      req.subscriptionWarning = {
        daysLeft,
        message: `Obunangiz ${daysLeft} kundan so'ng tugaydi`,
      };
    }

    req.subscription = subscription;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = subscriptionMiddleware;