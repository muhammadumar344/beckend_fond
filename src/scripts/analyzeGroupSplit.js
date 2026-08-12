// src/scripts/analyzeGroupSplit.js
// ════════════════════════════════════════════════════════════
// FAQAT O'QIYDI — hech narsa yozmaydi, o'chirmaydi, o'zgartirmaydi.
//
// Reja 1.2 (LC guruhini Fond sinfidan ajratish) qanchalik katta
// ish ekanini va bazada muammoli yozuv bor-yo'qligini ko'rsatadi.
//
// ISHLATISH:
//   node src/scripts/analyzeGroupSplit.js
//
// Natijani ko'rib chiqing, keyin docs/GROUP_MIGRATION.md ni o'qing.
// ════════════════════════════════════════════════════════════
require("dotenv").config();
const mongoose = require("mongoose");

const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Schedule = require("../models/Schedule");
const MonthlyPayment = require("../models/MonthlyPayment");
const Expense = require("../models/Expense");
const Homework = require("../models/Homework");
const HomeworkResult = require("../models/HomeworkResult");
const TelegramParent = require("../models/TelegramParent");

const line = (c = "─") => console.log(c.repeat(58));
const num = (n) => String(n).padStart(7);

const run = async () => {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/fond-school",
  );
  console.log("\n✅ MongoDB ulandi (faqat o'qish rejimida)\n");

  // ── 1. Muassasalar ────────────────────────────────────────
  const lcDirectors = await Teacher.find({
    institutionType: "learning_center",
  }).select("_id name email");
  const fondDirectors = await Teacher.find({
    institutionType: { $ne: "learning_center" },
  }).select("_id");

  const lcIds = lcDirectors.map((t) => t._id);
  const fondIds = fondDirectors.map((t) => t._id);

  line("═");
  console.log("  MUASSASALAR");
  line();
  console.log(`  O'quv markazi (LC) : ${num(lcDirectors.length)}`);
  console.log(`  Maktab fondi       : ${num(fondDirectors.length)}`);

  // ── 2. Sinf/guruh yozuvlari ───────────────────────────────
  const lcClasses = await Class.find({ teacher: { $in: lcIds } });
  const fondClasses = await Class.countDocuments({ teacher: { $in: fondIds } });
  const orphanClasses = await Class.countDocuments({
    teacher: { $nin: [...lcIds, ...fondIds] },
  });

  line("═");
  console.log("  CLASS KOLLEKSIYASI");
  line();
  console.log(`  LC guruhlari (ko'chiriladi) : ${num(lcClasses.length)}`);
  console.log(`  Fond sinflari (qoladi)      : ${num(fondClasses)}`);
  if (orphanClasses > 0) {
    console.log(`  ⚠ Egasiz sinflar            : ${num(orphanClasses)}`);
  }

  const lcClassIds = lcClasses.map((c) => c._id);

  // ── 3. Bog'liq yozuvlar ───────────────────────────────────
  const deps = [
    ["Student", Student, "class"],
    ["Attendance", Attendance, "class"],
    ["Grade", Grade, "class"],
    ["Schedule", Schedule, "class"],
    ["MonthlyPayment", MonthlyPayment, "class"],
    ["Expense", Expense, "class"],
    ["Homework", Homework, "class"],
    ["HomeworkResult", HomeworkResult, "class"],
    ["TelegramParent", TelegramParent, "classId"],
  ];

  line("═");
  console.log("  LC GURUHLARIGA BOG'LIQ YOZUVLAR");
  line();

  let totalDeps = 0;
  for (const [label, Model, field] of deps) {
    const count = await Model.countDocuments({ [field]: { $in: lcClassIds } });
    totalDeps += count;
    console.log(`  ${label.padEnd(26)}: ${num(count)}`);
  }
  console.log(`  ${"JAMI".padEnd(26)}: ${num(totalDeps)}`);

  // ── 4. Muammoli yozuvlar ──────────────────────────────────
  line("═");
  console.log("  TEKSHIRUVLAR");
  line();

  const problems = [];

  // 4a. Fond sinfida LC maydonlari to'ldirilganmi?
  const fondWithLcFields = await Class.countDocuments({
    teacher: { $in: fondIds },
    $or: [
      { subject: { $ne: null } },
      { assignedTeacher: { $ne: null } },
      { capacity: { $ne: null } },
    ],
  });
  if (fondWithLcFields > 0) {
    problems.push(
      `Fond sinflarida LC maydonlari to'ldirilgan: ${fondWithLcFields} ta`,
    );
  }

  // 4b. LC guruhida Fond maydoni ishlatilganmi?
  const lcWithFondFields = await Class.countDocuments({
    teacher: { $in: lcIds },
    initialBalance: { $gt: 0 },
  });
  if (lcWithFondFields > 0) {
    problems.push(
      `LC guruhlarida initialBalance (Fond maydoni) ishlatilgan: ${lcWithFondFields} ta`,
    );
  }

  // 4c. Yetim bog'liq yozuvlar — mavjud bo'lmagan sinfga ishora
  const allClassIds = (await Class.find().select("_id")).map((c) =>
    String(c._id),
  );
  const allSet = new Set(allClassIds);
  let orphanDeps = 0;
  for (const [label, Model, field] of deps) {
    const rows = await Model.find({ [field]: { $ne: null } })
      .select(field)
      .lean();
    const bad = rows.filter((r) => r[field] && !allSet.has(String(r[field])));
    if (bad.length) {
      orphanDeps += bad.length;
      problems.push(`${label}: ${bad.length} ta yozuv yo'q sinfga ishora qiladi`);
    }
  }

  // 4d. Nomi bo'sh yoki narxi yo'q guruhlar
  const badLcClasses = lcClasses.filter(
    (c) => !c.name?.trim() || c.defaultAmount == null,
  );
  if (badLcClasses.length) {
    problems.push(
      `LC guruhlarida nom yoki narx yo'q: ${badLcClasses.length} ta`,
    );
  }

  if (problems.length === 0) {
    console.log("  ✅ Muammo topilmadi — ma'lumot ko'chirishga tayyor");
  } else {
    console.log("  ⚠ Quyidagilarni ko'chirishdan OLDIN hal qiling:\n");
    problems.forEach((p) => console.log(`     • ${p}`));
  }

  // ── 5. Xulosa ─────────────────────────────────────────────
  line("═");
  console.log("  KO'CHIRISH HAJMI");
  line();
  console.log(`  Yaratiladigan Group yozuvi  : ${num(lcClasses.length)}`);
  console.log(`  Tegilmaydigan bog'liq yozuv : ${num(totalDeps)}`);
  console.log(
    `  (_id o'zgarmaydi — shuning uchun bog'liq yozuvlarni
     qayta yozish SHART EMAS)`,
  );

  if (lcClasses.length === 0) {
    console.log("\n  ℹ️  Ko'chiriladigan LC guruhi yo'q — migratsiya kerak emas.");
  }

  line("═");
  console.log(
    "\n  Keyingi qadam: docs/GROUP_MIGRATION.md — u yerda kod\n" +
      "  o'zgarishlari va tartib yozilgan. Skript o'zi hech narsani\n" +
      "  o'zgartirmadi.\n",
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("\n❌ Xato:", e.message);
  process.exit(1);
});
