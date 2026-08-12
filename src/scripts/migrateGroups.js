// src/scripts/migrateGroups.js
// ════════════════════════════════════════════════════════════
// LC guruhlarini `Class` dan alohida `Group` kolleksiyasiga ko'chiradi.
//
// ⚠️ SUKUT BO'YICHA HECH NARSA YOZMAYDI.
//
// ISHLATISH:
//   node src/scripts/migrateGroups.js                 → quruq yurish
//   node src/scripts/migrateGroups.js --apply         → haqiqiy ko'chirish
//   node src/scripts/migrateGroups.js --rollback      → orqaga qaytarish
//
// MUHIM: `--apply` dan oldin
//   1. `analyzeGroupSplit.js` ni ishlatib hisobotni ko'ring
//   2. Bazadan nusxa (backup) oling
//   3. `docs/GROUP_MIGRATION.md` dagi kod o'zgarishlarini o'qing —
//      ular shu migratsiya bilan BIR VAQTDA deploy bo'lishi kerak,
//      aks holda ilova LC guruhlarini topa olmay qoladi.
// ════════════════════════════════════════════════════════════
require("dotenv").config();
const mongoose = require("mongoose");

const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Group = require("../models/Group");

const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");

const line = (c = "─") => console.log(c.repeat(58));

// ── Orqaga qaytarish ────────────────────────────────────────
async function rollback() {
  const created = await Group.countDocuments({
    migratedFromClass: { $ne: null },
  });

  line("═");
  console.log("  ORQAGA QAYTARISH");
  line();
  console.log(`  Ko'chirish natijasida yaratilgan Group yozuvi: ${created}`);

  if (!APPLY) {
    console.log(
      "\n  Quruq yurish — hech narsa o'chirilmadi.\n" +
        "  Haqiqatan o'chirish uchun: --rollback --apply\n",
    );
    return;
  }

  const res = await Group.deleteMany({ migratedFromClass: { $ne: null } });
  console.log(`\n  ✅ ${res.deletedCount} ta Group yozuvi o'chirildi.`);
  console.log(
    "  Class kolleksiyasiga tegilmagan edi — ma'lumot to'liq saqlanib qolgan.\n",
  );
}

// ── Ko'chirish ──────────────────────────────────────────────
async function migrate() {
  const lcIds = (
    await Teacher.find({ institutionType: "learning_center" }).select("_id")
  ).map((t) => t._id);

  const lcClasses = await Class.find({ teacher: { $in: lcIds } }).lean();

  line("═");
  console.log(APPLY ? "  KO'CHIRISH (HAQIQIY)" : "  KO'CHIRISH (QURUQ YURISH)");
  line();
  console.log(`  Topilgan LC guruhi: ${lcClasses.length}`);

  if (!lcClasses.length) {
    console.log("\n  Ko'chiriladigan narsa yo'q.\n");
    return;
  }

  // Allaqachon ko'chirilganlarni ikki marta yaratmaymiz
  const existing = new Set(
    (await Group.find().select("migratedFromClass").lean())
      .map((g) => String(g.migratedFromClass))
      .filter(Boolean),
  );

  const toCreate = [];
  const skipped = [];

  for (const c of lcClasses) {
    if (existing.has(String(c._id))) {
      skipped.push(c.name);
      continue;
    }
    toCreate.push({
      // ⚠️ _id AYNAN SAQLANADI — shuning uchun Student.class,
      // Attendance.class va boshqa 9 ta kolleksiyadagi ishoralar
      // o'z-o'zidan to'g'ri qoladi, ularni qayta yozish shart emas.
      _id: c._id,
      director: c.teacher,
      branch: c.branch || null,
      name: c.name,
      monthlyPrice: c.defaultAmount ?? 0,
      subject: c.subject || null,
      assignedTeacher: c.assignedTeacher || null,
      capacity: c.capacity ?? null,
      isActive: true,
      migratedFromClass: c._id,
      createdAt: c.createdAt || new Date(),
    });
  }

  console.log(`  Yaratiladi        : ${toCreate.length}`);
  if (skipped.length) {
    console.log(`  O'tkazib yuboriladi: ${skipped.length} (allaqachon ko'chirilgan)`);
  }

  // Namuna ko'rsatamiz — nima yoziladi
  if (toCreate.length) {
    line();
    console.log("  Namuna (birinchi 3 ta):");
    toCreate.slice(0, 3).forEach((g) => {
      console.log(
        `     • ${g.name} — ${g.monthlyPrice} so'm` +
          (g.capacity ? `, sig'im ${g.capacity}` : "") +
          (g.subject ? ", fan biriktirilgan" : ""),
      );
    });
  }

  if (!APPLY) {
    line("═");
    console.log(
      "\n  Bu QURUQ YURISH edi — bazaga hech narsa yozilmadi.\n" +
        "  Haqiqatan ko'chirish uchun: node src/scripts/migrateGroups.js --apply\n" +
        "  Avval bazadan nusxa olishni unutmang.\n",
    );
    return;
  }

  // ── Haqiqiy yozish ────────────────────────────────────────
  if (!toCreate.length) {
    console.log("\n  Yangi yozuv yo'q.\n");
    return;
  }

  const res = await Group.insertMany(toCreate, { ordered: false });
  line("═");
  console.log(`\n  ✅ ${res.length} ta Group yozuvi yaratildi.`);
  console.log(
    "  Class kolleksiyasiga TEGILMADI — eski ma'lumot joyida turibdi.\n" +
      "  Ilova to'g'ri ishlayotganiga ishonch hosil qilgach, Class'dagi\n" +
      "  LC yozuvlarini qo'lda o'chirishingiz mumkin (shoshilmang).\n",
  );
  console.log("  Orqaga qaytarish: node src/scripts/migrateGroups.js --rollback --apply\n");
}

const run = async () => {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/fond-school",
  );
  console.log(`\n✅ MongoDB ulandi${APPLY ? "" : " (quruq yurish)"}\n`);

  if (ROLLBACK) await rollback();
  else await migrate();

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("\n❌ Xato:", e.message);
  process.exit(1);
});
