// src/middleware/security.js
// ════════════════════════════════════════════════════════════
// Xavfsizlik sarlavhalari.
//
// NEGA `helmet` emas: helmet ~15 ta sarlavha qo'yadi, bizga
// beshtasi kerak. API JSON qaytaradi, HTML emas — shuning uchun
// CSP kabi murakkab siyosatlar bu yerda ma'nosiz (ular frontend
// tomonida, Netlify sarlavhalarida bo'lishi kerak).
//
// Har bir sarlavha nima qilishi izohda — keyinchalik "bu nima
// edi?" degan savol tug'ilmasin.
// ════════════════════════════════════════════════════════════

function securityHeaders(req, res, next) {
  // Brauzer fayl turini O'ZI taxmin qilmasin. Bo'lmasa yuklangan
  // rasm ba'zan HTML deb talqin qilinib, skript ishga tushishi mumkin.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Sahifani boshqa saytning <iframe> iga joylashni taqiqlaydi
  // (clickjacking: ko'rinmas ramka ustidan tugma bostirish).
  res.setHeader("X-Frame-Options", "DENY");

  // Boshqa saytga o'tganda to'liq manzil yuborilmasin — manzilda
  // token yoki id bo'lishi mumkin.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // API ga kamera/mikrofon/joylashuv umuman kerak emas.
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  // ⚠️ Faqat HTTPS da. Localhost'da qo'ysak brauzer keshlab qoladi
  //    va keyin http://localhost umuman ochilmay qo'yadi.
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains", // 180 kun
    );
  }

  next();
}

module.exports = { securityHeaders };
