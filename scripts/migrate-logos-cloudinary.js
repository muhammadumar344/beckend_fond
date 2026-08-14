#!/usr/bin/env node
// scripts/migrate-logos-cloudinary.js
// ════════════════════════════════════════════════════════════
// Bazadagi ESKI base64 logotiplarni Cloudinary'ga ko'chiradi.
//
//   node scripts/migrate-logos-cloudinary.js          # quruq yurish
//   node scripts/migrate-logos-cloudinary.js --apply  # rostdan
//
// ⚠️ Bu skript SHART EMAS. Cloudinary yoqilgandan keyin yangi
//    yuklamalar o'zi CDN ga tushadi, eski base64 logotiplar esa
//    <img src="data:..."> bo'lib ishlayveradi. Skript faqat
//    bazani yengillatish uchun.
//
// ⚠️ SERVER.JS NI TALAB QILMAYDI. Faqat mongoose ulanadi —
//    Telegram bot ishga tushmaydi, port band qilinmaydi.
// ════════════════════════════════════════════════════════════

require("dotenv").config();
const mongoose = require("mongoose");
const cfg = require("../src/config/cloudinary");
const cloudinary = require("../src/services/cloudinary");
const Teacher = require("../src/models/Teacher");

const apply = process.argv.includes("--apply");

const kb = (n) => `${Math.round(n / 1024)}KB`;

async function main() {
  if (!cfg.enabled) {
    console.error(
      "❌ Cloudinary sozlanmagan.\n" +
        "   .env ga CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,\n" +
        "   CLOUDINARY_API_SECRET qiymatlarini qo'ying.",
    );
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI yo'q");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Bazaga ulandi\n`);

  // Faqat base64 logotiplar — Cloudinary manzillari tegilmaydi
  const rows = await Teacher.find({ logo: /^data:image\// }).select(
    "_id name institutionName logo logoSize logoPublicId",
  );

  if (!rows.length) {
    console.log("Ko'chiriladigan base64 logotip topilmadi.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${rows.length} ta base64 logotip topildi:\n`);
  let saved = 0;
  let ok = 0;
  let failed = 0;

  for (const t of rows) {
    const before = t.logoSize || Math.round((t.logo.length * 3) / 4);
    const who = t.institutionName || t.name || String(t._id);

    if (!apply) {
      console.log(`   ${who.padEnd(28)} ${kb(before)}`);
      saved += before;
      continue;
    }

    try {
      const up = await cloudinary.uploadImage(t.logo, {
        folder: cfg.folders.logos,
        publicId: `director-${t._id}`,
      });
      t.logo = up.url;
      t.logoSize = up.bytes;
      t.logoPublicId = up.publicId;
      await t.save();
      saved += before - up.bytes;
      ok++;
      console.log(`✅ ${who.padEnd(28)} ${kb(before)} → ${kb(up.bytes)}`);
    } catch (err) {
      failed++;
      console.error(`❌ ${who.padEnd(28)} ${cloudinary.errorText(err)}`);
    }
  }

  console.log("");
  if (apply) {
    console.log(`Ko'chirildi: ${ok}, xato: ${failed}`);
    console.log(`Bazadan bo'shadi: ~${kb(saved)}`);
  } else {
    console.log(`Bazada band: ~${kb(saved)}`);
    console.log("Hech narsa o'zgartirilmadi. Ko'chirish uchun: --apply");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
