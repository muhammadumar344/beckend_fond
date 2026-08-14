// src/services/cloudinary.js
// ════════════════════════════════════════════════════════════
// Cloudinary bilan ishlash: yuklash va o'chirish.
// Sozlama va yoqish yo'riqnomasi: config/cloudinary.js
//
// IMZO QOIDASI (Cloudinary hujjatidan):
//   Yuboriladigan parametrlar ichidan `file`, `api_key`,
//   `cloud_name`, `resource_type` va `signature` CHIQARIB
//   TASHLANADI. Qolganlari alifbo tartibida `k=v&k=v` qilib
//   ulanadi, oxiriga api_secret qo'shiladi va sha1 olinadi.
//
//   ⚠️ Imzolangan qiymat AYNAN yuborilgan qiymat bo'lishi shart.
//      Shuning uchun quyida bitta `signed` obyekt tuziladi va
//      u ham imzolanadi, ham yuboriladi — ikki joyda alohida
//      yozilmaydi (bir joyda o'zgartirib, ikkinchisini unutish
//      "Invalid Signature" xatosining eng keng tarqalgan sababi).
// ════════════════════════════════════════════════════════════

const crypto = require("crypto");
const axios = require("axios");
const cfg = require("../config/cloudinary");

/** Cloudinary imzosi — yuqoridagi qoidaga qarang */
function sign(params) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(toSign + cfg.apiSecret)
    .digest("hex");
}

/** `signed` + ochiq maydonlar → form-urlencoded tana */
function body(signed, extra = {}) {
  return new URLSearchParams({
    ...signed,
    ...extra,
    api_key: cfg.apiKey,
    signature: sign(signed),
  }).toString();
}

const POST = {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  maxBodyLength: Infinity, // data URI katta bo'lishi mumkin
  maxContentLength: Infinity,
  timeout: 20000,
};

/**
 * Yetkazish manzili — saqlangan URL ga `f_auto,q_auto` qo'shadi.
 * Brauzer WebP/AVIF ni qo'llasa Cloudinary o'sha formatda beradi,
 * sifatni ham o'zi tanlaydi. Rasm bir marta yuklanadi, keyin CDN dan.
 */
function deliveryUrl(secureUrl) {
  return String(secureUrl || "").replace(
    "/image/upload/",
    "/image/upload/f_auto,q_auto/",
  );
}

/**
 * Rasmni yuklash.
 * @param {string} dataUri  `data:image/png;base64,...`
 * @param {object} opts     { folder, publicId, maxSide }
 * @returns {Promise<{url,publicId,bytes,width,height,format}>}
 */
async function uploadImage(dataUri, opts = {}) {
  if (!cfg.enabled) {
    throw Object.assign(new Error("Cloudinary sozlanmagan"), { status: 503 });
  }

  const maxSide = opts.maxSide || 512;
  const signed = {
    folder: opts.folder || cfg.folder,
    timestamp: Math.floor(Date.now() / 1000),
    // Kiruvchi transformatsiya: bazaga KATTALIGICHA emas, cheklangan
    // holda yoziladi. `c_limit` — faqat kattasini kichraytiradi,
    // kichigini cho'zmaydi. Ya'ni 2000px logotip 512px bo'lib tushadi.
    transformation: `c_limit,w_${maxSide},h_${maxSide},q_auto`,
    overwrite: "true",
    invalidate: "true",
  };
  if (opts.publicId) signed.public_id = opts.publicId;

  const { data } = await axios.post(
    `${cfg.apiBase}/image/upload`,
    body(signed, { file: dataUri }),
    POST,
  );

  return {
    url: deliveryUrl(data.secure_url),
    publicId: data.public_id,
    bytes: data.bytes || 0,
    width: data.width || 0,
    height: data.height || 0,
    format: data.format || "",
  };
}

/**
 * Rasmni o'chirish.
 * ⚠️ Hech qachon otmaydi. Eski rasmni tozalash — asosiy amal emas:
 *    yangi logotip saqlandi-yu, eskisini o'chirish tarmoq xatosiga
 *    uchradi degani foydalanuvchiga xato ko'rsatish sababi emas.
 * @returns {Promise<boolean>} rostdan o'chirildimi
 */
async function destroyImage(publicId) {
  if (!cfg.enabled || !publicId) return false;
  try {
    const signed = {
      invalidate: "true",
      public_id: publicId,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const { data } = await axios.post(
      `${cfg.apiBase}/image/destroy`,
      body(signed),
      POST,
    );
    return data.result === "ok";
  } catch (err) {
    console.error(
      "Cloudinary destroy xatosi:",
      publicId,
      err.response?.data || err.message,
    );
    return false;
  }
}

/** Xato matnini Cloudinary javobidan chiroyli chiqarish */
function errorText(err) {
  return err.response?.data?.error?.message || err.message || "Noma'lum xato";
}

module.exports = {
  enabled: () => cfg.enabled,
  uploadImage,
  destroyImage,
  deliveryUrl,
  errorText,
  sign, // test uchun
};
