// src/controllers/adminController.js
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const Student = require('../models/Student')
const Admin = require('../models/Admin')
const MonthlyPayment = require('../models/MonthlyPayment')
const StudentLink = require('../models/StudentLink')
const {
  SCHOOL,
  LC,
  limitsFor,
  priceFor,
  featuresFor,
} = require('../utils/planHelper')
const crypto = require('crypto')
// ✅ XATO TUZATILDI: 'referalController' import o'chirildi
// (fayl nomi noto'g'ri yozilgan edi, va bu yerda ishlatilmaydi —
//  applyReferralBonus faqat paymentRequestController.js da kerak)

const generateReferralCode = (name) => {
  const base   = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${base}-${suffix}`
}

// ✅ createAdmin bu yerda YO'Q — u authController.js da (POST /api/auth/setup)

// Admin dashboard
// ⚠️ ILGARI BU YERDA N+1 BOR EDI va u jimgina o'sib borardi:
//    har bir markaz uchun to'rtta alohida so'rov yuborilardi
//    (`Class.distinct`, `Student.count`, `TelegramParent.count`,
//    `MonthlyPayment.find`). Yuzta markazda — 400 dan ortiq
//    so'rov. Eng yomoni oxirgisi: u markazning BARCHA to'lov
//    hujjatlarini xotiraga yuklab, keyin JS'da yig'ardi.
//    Yillar o'tgan markazda bu o'n minglab hujjat degani —
//    Render'ning bepul tarifida sahifa avval sekinlashadi,
//    keyin umuman ochilmay qoladi.
//
//    Endi to'rtta `aggregate` butun ro'yxat uchun BIR MARTA
//    ishlaydi va natija `Map` orqali biriktiriladi.
const buildCounts = async () => {
  const [classRows, telegramRows, fundRows] = await Promise.all([
    // Markaz → guruhlar va ulardagi o'quvchilar
    Class.aggregate([
      { $lookup: { from: "students", localField: "_id", foreignField: "class", as: "st" } },
      {
        $group: {
          _id: "$teacher",
          classCount: { $sum: 1 },
          studentCount: { $sum: { $size: "$st" } },
        },
      },
    ]),
    // Markaz → Telegram'ga ulangan qabul qiluvchilar.
    //
    // ⚠️ IKKALA MANBA. Bu yer faqat eski `TelegramParent` ni
    //    sanardi va yangi markazlarda son deyarli har doim NOL
    //    bo'lib chiqardi — Mini App orqali bog'langan ota-onalar
    //    `StudentLink` da yotadi. Platforma egasi shu songa
    //    qarab "botni hech kim ishlatmayapti" degan xulosa
    //    chiqarardi.
    //
    // ⚠️ `$unionWith` + ikki bosqichli `$group` — bir odam
    //    ikkala jadvalda ham bo'lishi mumkin (eski ro'yxatda
    //    edi, keyin raqamini tasdiqladi). Oddiy qo'shish uni
    //    ikki marta sanardi.
    StudentLink.aggregate([
      { $match: { isActive: true } },
      {
        $project: {
          director: 1,
          student: 1,
          // Eski yozuvlarda `telegramChatId` bo'sh matn bo'lishi
          // mumkin; Telegram'da shaxsiy chat id foydalanuvchi
          // id siga teng
          chat: {
            $cond: [
              { $in: ["$telegramChatId", [null, ""]] },
              "$telegramUserId",
              "$telegramChatId",
            ],
          },
        },
      },
      {
        $unionWith: {
          coll: "telegramparents",
          pipeline: [
            { $match: { isActive: true } },
            {
              $project: {
                director: "$teacherId",
                student: "$studentId",
                chat: "$telegramChatId",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: { d: "$director", c: "$chat", s: "$student" },
        },
      },
      { $group: { _id: "$_id.d", n: { $sum: 1 } } },
    ]),
    // Yig'ilgan pul — bazada yig'iladi, xotiraga tortilmaydi
    MonthlyPayment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$teacher", total: { $sum: "$amount" } } },
    ]),
  ]);

  const byId = (rows, pick) => {
    const m = new Map();
    for (const r of rows) m.set(String(r._id), pick(r));
    return m;
  };

  return {
    classes: byId(classRows, (r) => r.classCount),
    students: byId(classRows, (r) => r.studentCount),
    telegram: byId(telegramRows, (r) => r.n),
    fund: byId(fundRows, (r) => r.total),
  };
};

// Obuna tugashiga shuncha kun qolganda "e'tibor talab qiladi"
const EXPIRING_DAYS = 7;
// Shuncha kun kirmagan markaz — ketish arafasida
const IDLE_DAYS = 14;

exports.getDashboard = async (req, res) => {
  try {
    const [totalTeachers, totalClasses, totalStudents, teachers, counts] =
      await Promise.all([
        Teacher.countDocuments(),
        Class.countDocuments(),
        Student.countDocuments(),
        Teacher.find().select("-password").sort({ createdAt: -1 }),
        buildCounts(),
      ]);

    // ⚠️ Umumiy son ALOHIDA so'rov emas — markazlar bo'yicha
    //    sanoq allaqachon takrorlardan tozalangan. Ikkinchi
    //    so'rov boshqa qoida bilan sanab, ikkita raqam bir-biriga
    //    to'g'ri kelmay qolardi.
    let totalTelegramParents = 0;
    for (const n of counts.telegram.values()) totalTelegramParents += n;

    const teachersWithStats = teachers.map((t) => {
      const id = String(t._id);
      return {
        ...t.toObject(),
        classCount: counts.classes.get(id) || 0,
        studentCount: counts.students.get(id) || 0,
        telegramCount: counts.telegram.get(id) || 0,
        totalFund: counts.fund.get(id) || 0,
        planActive: t.isPlanActive(),
        daysLeft: t.daysLeft(),
        activePlan: t.activePlan(),
      };
    });

    // ── E'TIBOR TALAB QILADI ──
    //
    // ⚠️ Lumo direktorlarga "qaysi o'quvchi ketish arafasida" deb
    //    aytadi. Platforma egasiga esa aynan shu savol bir qavat
    //    yuqorida turadi: qaysi MARKAZ ketyapti? Ikkalasi ham
    //    bitta narsaga tayanadi — belgi ketishdan oldin
    //    ko'rinadi va bitta qo'ng'iroq qarorni qaytarishi mumkin.
    const now = Date.now();
    const days = (d) => Math.ceil((new Date(d) - now) / 86400000);

    const paying = teachersWithStats.filter(
      (t) => t.plan !== "free" && t.isActive !== false && !t.deletionScheduledFor,
    );

    const expiringSoon = paying
      .filter((t) => t.planActive && t.planExpiresAt && days(t.planExpiresAt) <= EXPIRING_DAYS)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        phone: t.phone,
        plan: t.plan,
        daysLeft: Math.max(0, days(t.planExpiresAt)),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const justExpired = paying
      .filter((t) => !t.planActive)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        phone: t.phone,
        plan: t.plan,
        expiredDaysAgo: t.planExpiresAt ? Math.abs(days(t.planExpiresAt)) : null,
      }));

    // ⚠️ `lastLoginAt` YO'Q bo'lgan hisob bu ro'yxatga TUSHMAYDI.
    //    Maydon yaqinda qo'shildi; eski hisoblarda u bo'sh va
    //    ularni "hech qachon kirmagan" deb ko'rsatish yolg'on
    //    bo'lardi (sxemadagi standart qiymat mavjud hujjatlarga
    //    tushmaydi — CLAUDE.md dagi tuzoq).
    const idle = teachersWithStats
      .filter(
        (t) =>
          t.isActive !== false &&
          !t.deletionScheduledFor &&
          t.lastLoginAt &&
          Math.abs(days(t.lastLoginAt)) >= IDLE_DAYS,
      )
      .map((t) => ({
        _id: t._id,
        name: t.name,
        phone: t.phone,
        plan: t.plan,
        idleDays: Math.abs(days(t.lastLoginAt)),
        studentCount: t.studentCount,
      }))
      .sort((a, b) => b.idleDays - a.idleDays)
      .slice(0, 20);

    res.json({
      summary: { totalTeachers, totalClasses, totalStudents, totalTelegramParents },
      teachers: teachersWithStats,
      attention: {
        expiringSoon,
        justExpired,
        idle,
        rules: { expiringDays: EXPIRING_DAYS, idleDays: IDLE_DAYS },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Ism, email va parol majburiy' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email noto\'g\'ri formatda' })
    if (password.length < 6)
      return res.status(400).json({ error: 'Parol kamida 6 belgi' })
    if (await Teacher.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'Bu email allaqachon band' })

    // ✅ Referral kod tekshirish
    let referredBy = null
    if (referralCode) {
      const referrer = await Teacher.findOne({ referralCode: referralCode.toUpperCase() })
      if (referrer) referredBy = referrer._id
    }

    const teacher = new Teacher({
      name:          name.trim(),
      email:         email.toLowerCase(),
      password,
      phone:         phone || '',
      registeredDate: new Date(),
      referredBy,
      referralCode:  generateReferralCode(name),
    })
    await teacher.save()

    res.status(201).json({
      message: 'Teacher muvaffaqiyatli qo\'shildi',
      teacher: {
        id:           teacher._id,
        name:         teacher.name,
        email:        teacher.email,
        phone:        teacher.phone,
        plan:         teacher.plan,
        referralCode: teacher.referralCode,
        referredBy:   referredBy ? 'Ha' : 'Yo\'q',
        registeredDate: teacher.registeredDate,
      },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu email allaqachon band' })
    res.status(500).json({ error: err.message })
  }
}

// Parol yangilash
exports.updateTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Parol kamita 6 ta belgidan iborat bo'lsin" })
    }

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    teacher.password = newPassword
    await teacher.save()

    res.json({ message: 'Parol muvaffaqiyatli yangilandi' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Plan o'rnatish
exports.updateTeacherPlan = async (req, res) => {
  try {
    const { teacherId } = req.params
    const { plan, months = 1 } = req.body

    if (!['free', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "Plan: free, pro yoki premium bo'lishi kerak" })
    }

    const teacher = await Teacher.findById(teacherId)
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    if (plan === 'free') {
      teacher.plan = 'free'
      teacher.planExpiresAt = null
    } else {
      const base = teacher.isPlanActive() && teacher.plan === plan
        ? teacher.planExpiresAt
        : new Date()

      const newExpiry = new Date(base)
      newExpiry.setMonth(newExpiry.getMonth() + Number(months))

      teacher.plan = plan
      teacher.planExpiresAt = newExpiry
    }

    const planRank = { free: 0, pro: 1, premium: 2 }
    if (planRank[plan] > planRank[teacher.highestPlanEver || 'free']) {
      teacher.highestPlanEver = plan
    }

    await teacher.save()
    await Class.updateMany({ teacher: teacherId }, { plan })

    res.json({
      message: `Plan yangilandi: ${plan}, ${months} oy`,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        plan: teacher.plan,
        planExpiresAt: teacher.planExpiresAt,
        daysLeft: teacher.daysLeft(),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Teacher bloklash
exports.deactivateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params
    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { isActive: false },
      { new: true }
    )
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    res.json({
      message: 'Teacher muvaffaqiyatli bloklandi',
      teacher: { id: teacher._id, name: teacher.name, isActive: teacher.isActive },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Teacher faollashtirish
exports.activateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params
    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { isActive: true },
      { new: true }
    )
    if (!teacher) return res.status(404).json({ error: 'Teacher topilmadi' })

    res.json({ message: 'Teacher faollandi', teacher })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Tarif narxlari — REJIM bo'yicha ──────────────────────────
// Fond va LC narxlari boshqa: `?mode=learning_center` bilan LC
// jadvali qaytadi, aks holda Fond.
//
// ⚠️ Ro'yxat QO'LDA yozilmaydi — planHelper'dan yig'iladi. Ilgari
//    qattiq yozilgan edi va tarif o'zgarganda bu yer eskirib
//    qolardi (narx bir joyda, ro'yxat boshqa joyda).
exports.getPlanPrices = async (req, res) => {
  const mode = req.query.mode === LC ? LC : SCHOOL

  const LABELS = {
    multi_lang:       'Uch til (uz/ru/en)',
    monthly_reminder: 'Oylik eslatma',
    telegram:         'Telegram bot',
    export:           'Excel / Word export',
    import:           'Excel import',
    sms_reminder:     'SMS eslatma',
    branches:         'Filiallar',
    homework:         'Uy vazifasi va reyting',
    salaries:         'Maosh boshqaruvi',
    roles:            'Rollar va huquqlar',
    branch_stats:     'Filial statistikasi',
    reports:          'Hisobotlar va grafiklar',
    white_label:      "O'z logotipi (white-label)",
  }

  const NAMES = { free: 'Free', pro: 'Pro', premium: 'Premium' }
  // 999+ — amalda cheksiz. "Cheksiz ta o'quvchi" g'aliz, shuning
  // uchun sanoq so'zi ("ta") faqat aniq raqamda qo'yiladi.
  const count = (n, unit) => (n >= 999 ? 'Cheksiz ' + unit : n + ' ta ' + unit)

  const plans = ['free', 'pro', 'premium'].map((id) => {
    const limits = limitsFor(id, mode)
    const feats  = featuresFor(id, mode)

    const included = []
    const notIncluded = []
    for (const [key, label] of Object.entries(LABELS)) {
      if (!(key in feats)) continue
      if (feats[key]) included.push(label)
      else notIncluded.push(label)
    }

    const size = [
      count(limits.classes, mode === LC ? 'guruh' : 'sinf'),
      count(limits.students, "o'quvchi"),
    ]
    if (mode === LC && limits.staff) size.push(count(limits.staff, 'xodim'))

    return {
      id,
      name:     NAMES[id],
      price:    priceFor(id, mode).monthly,
      classes:  limits.classes,
      students: limits.students,
      staff:    limits.staff,
      branches: limits.branches,
      features: [...size, ...included],
      notIncluded,
    }
  })

  res.json({ mode, plans })
}

