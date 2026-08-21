// src/utils/planHelper.js
// ════════════════════════════════════════════════════════════
// Tariflar IKKI REJIM UCHUN ALOHIDA.
//
// Fond va LC — butunlay boshqa mijozlar:
//   • Fond — bitta sinf rahbari, oyiga ~15 000 so'm yig'adi.
//     Pul kichik, narxga juda sezgir.
//   • LC — biznes. Xodimlari, filiallari, oylik aylanmasi bor.
//     To'lash qobiliyati bir necha barobar yuqori.
//
// Bitta narx jadvali ikkalasiga ham to'g'ri kelmaydi: LC uchun
// arzon, Fond uchun qimmat bo'lib qoladi.
//
// ⚠️ TILLAR (uz/ru/en) BARCHA TARIFDA BEPUL. Ilgari `multi_lang`
//    faqat Premium'da edi — bu noto'g'ri edi: ruszabon direktor
//    mahsulotni umuman sinab ko'ra olmasdi. Til — kirish to'sig'i
//    emas, kirish yo'li.
// ════════════════════════════════════════════════════════════

const SCHOOL = "school";
const LC = "learning_center";

// ── Limitlar ──────────────────────────────────────────────────
// ⚠️ FOND FILIALLARI (1 / 3 / 10) — bu jadvaldagi eski qiymat
//    emas, ISHLAB TURGAN xatti-harakat. `branchController` o'z
//    jadvalini tutardi (`free: 1, pro: 3, premium: 10`) va
//    filial chegarasi amalda o'shandan o'qilardi; shu yerdagi
//    `0 / 0 / 5` hech qachon qo'llanmagan.
//
//    Ikkita jadval birlashtirilganda ishlab turgani olindi:
//    aks holda bugun filiali bor Fond direktori ertaga yangi
//    filial ocholmay qolardi — va buni hech kim ogohlantirmagan
//    bo'lardi. Chegarani pasaytirish — mahsulot qarori, kod
//    tozalashning yon ta'siri emas. Qaror qilinsa, o'zgartirish
//    endi FAQAT shu yerda.
const PLAN_LIMITS = {
  [SCHOOL]: {
    free: { classes: 1, students: 30, staff: 0, branches: 1 },
    pro: { classes: 3, students: 60, staff: 0, branches: 3 },
    premium: { classes: 10, students: 999, staff: 0, branches: 10 },
  },
  [LC]: {
    // LC'da "classes" = guruhlar
    free: { classes: 2, students: 30, staff: 1, branches: 1, leads: 20 },
    pro: { classes: 15, students: 300, staff: 10, branches: 3, leads: 9999 },
    premium: {
      classes: 9999,
      students: 9999,
      staff: 9999,
      branches: 9999,
      leads: 9999,
    },
  },
};

// ── Narxlar (so'm/oy) ─────────────────────────────────────────
const PLAN_PRICES = {
  [SCHOOL]: {
    free: { monthly: 0 },
    pro: { monthly: 29000 },
    premium: { monthly: 59000 },
  },
  [LC]: {
    free: { monthly: 0 },
    pro: { monthly: 199000 },
    premium: { monthly: 449000 },
  },
};

// ── Funksiyalar ───────────────────────────────────────────────
// `multi_lang` hamma joyda true — yuqoridagi izohga qarang.
const PLAN_FEATURES = {
  [SCHOOL]: {
    free: {
      multi_lang: true,
      monthly_reminder: false,
      telegram: false,
      export: false,
      import: false,
      sms_reminder: false,
      branches: false,
    },
    pro: {
      multi_lang: true,
      monthly_reminder: true,
      telegram: true,
      export: false,
      import: false,
      sms_reminder: false,
      branches: false,
    },
    premium: {
      multi_lang: true,
      monthly_reminder: true,
      telegram: true,
      export: true,
      import: true,
      sms_reminder: true,
      branches: true,
    },
  },
  [LC]: {
    free: {
      multi_lang: true,
      monthly_reminder: false,
      telegram: false,
      export: false,
      import: false,
      sms_reminder: false,
      branches: false,
      homework: false,
      salaries: false,
      roles: false,
      branch_stats: false,
      reports: false,
      white_label: false,
    },
    pro: {
      multi_lang: true,
      monthly_reminder: true,
      telegram: true,
      export: true,
      import: true,
      sms_reminder: false,
      branches: true,
      homework: true,
      salaries: true,
      roles: true,
      branch_stats: false,
      reports: true,
      white_label: false,
    },
    premium: {
      multi_lang: true,
      monthly_reminder: true,
      telegram: true,
      export: true,
      import: true,
      sms_reminder: true,
      branches: true,
      homework: true,
      salaries: true,
      roles: true,
      branch_stats: true,
      reports: true,
      white_label: true,
    },
  },
};

const PLAN_RANK = { free: 0, pro: 1, premium: 2 };

/** institutionType ni normallashtiradi — noma'lum qiymat Fond deb olinadi */
const modeOf = (t) => (t === LC || t?.institutionType === LC ? LC : SCHOOL);

/** Tarif nomini tekshiradi */
const planOf = (p) => (PLAN_RANK[p] !== undefined ? p : "free");

/**
 * Rejimga mos limitlar.
 * @param {string} plan
 * @param {string|object} mode  institutionType yoki Teacher hujjati
 */
const limitsFor = (plan, mode) =>
  PLAN_LIMITS[modeOf(mode)][planOf(plan)] || PLAN_LIMITS[SCHOOL].free;

/** Rejimga mos narx */
const priceFor = (plan, mode) =>
  PLAN_PRICES[modeOf(mode)][planOf(plan)] || PLAN_PRICES[SCHOOL].free;

/** Rejimga mos funksiyalar to'plami */
const featuresFor = (plan, mode) =>
  PLAN_FEATURES[modeOf(mode)][planOf(plan)] || PLAN_FEATURES[SCHOOL].free;

/** Teacher hujjatidan hozirgi AKTIV tarifni oladi */
const activePlanOf = (teacher) => {
  if (!teacher) return "free";
  if (typeof teacher.isPlanActive === "function") {
    return teacher.isPlanActive() ? planOf(teacher.plan) : "free";
  }
  return planOf(teacher.plan);
};

/**
 * Teacher ning hozirgi aktiv tarifida ma'lum funksiya bormi?
 * Rejim `teacher.institutionType` dan olinadi.
 */
const hasFeature = (teacher, feature) => {
  const f = featuresFor(activePlanOf(teacher), teacher);
  return f?.[feature] || false;
};

/** Yangi sinf/guruh ocha oladimi? */
const canOpenNewClass = (teacher, currentClassCount) => {
  const limit = limitsFor(activePlanOf(teacher), teacher);
  return currentClassCount < limit.classes;
};

/**
 * Sinf uchun amalda qo'llanadigan tarif.
 *
 * Ikkita qiymatdan KATTAROG'I olinadi:
 *   1. `classPlan` — sinf yaratilgandagi tarif (eski, yuqoriroq
 *      tarifni saqlab qolish uchun)
 *   2. Direktorning HOZIRGI aktiv tarifi
 *
 * NEGA "kattarog'i" — batafsil tarix uchun CLAUDE.md ga qarang:
 * LC guruhlari `plan` ni yozmasdi (Premium ham 30 tada qolardi) va
 * tarifni ko'targan foydalanuvchi eski sinflarida yutmasdi.
 */
const effectivePlan = (classPlan, teacher) => {
  const snapshot = planOf(classPlan);
  const current = activePlanOf(teacher);
  return PLAN_RANK[current] > PLAN_RANK[snapshot] ? current : snapshot;
};

/**
 * Sinfga yangi o'quvchi qo'sha oladimi?
 *
 * @param {string} classPlan            sinfdagi `plan`
 * @param {number} currentStudentCount  hozirgi o'quvchilar soni
 * @param {object} [teacher]            berilsa hozirgi tarif ham hisobga olinadi
 */
const canAddStudent = (classPlan, currentStudentCount, teacher) => {
  const plan = teacher ? effectivePlan(classPlan, teacher) : planOf(classPlan);
  const limit = limitsFor(plan, teacher);
  return currentStudentCount < limit.students;
};

/** Xodim qo'sha oladimi (faqat LC) */
const canAddStaff = (teacher, currentStaffCount) => {
  const limit = limitsFor(activePlanOf(teacher), teacher);
  return currentStaffCount < (limit.staff || 0);
};

/** Filial ocha oladimi */
const canOpenBranch = (teacher, currentBranchCount) => {
  const limit = limitsFor(activePlanOf(teacher), teacher);
  return currentBranchCount < (limit.branches || 0);
};

module.exports = {
  SCHOOL,
  LC,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_FEATURES,
  PLAN_RANK,
  modeOf,
  limitsFor,
  priceFor,
  featuresFor,
  activePlanOf,
  hasFeature,
  canOpenNewClass,
  canAddStudent,
  canAddStaff,
  canOpenBranch,
  effectivePlan,
};
