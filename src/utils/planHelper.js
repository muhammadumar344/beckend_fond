// src/utils/planHelper.js

const PLAN_LIMITS = {
  free:    { classes: 1,  students: 30  },
  pro:     { classes: 3,  students: 60  },
  premium: { classes: 10, students: 999 },
}

const PLAN_PRICES = {
  free:    { monthly: 0     },
  pro:     { monthly: 29000 },
  premium: { monthly: 59000 },
}

const PLAN_FEATURES = {
  free:    { monthly_reminder: false, export: false, multi_lang: false, sms_reminder: false, telegram: false },
  pro:     { monthly_reminder: true,  export: false, multi_lang: false, sms_reminder: false, telegram: true  },
  premium: { monthly_reminder: true,  export: true,  multi_lang: true,  sms_reminder: true,  telegram: true  },
}

/**
 * Teacher ning hozirgi aktiv planida ma'lum funksiya bormi?
 */
const hasFeature = (teacher, feature) => {
  const activePlan = teacher.isPlanActive() ? teacher.plan : 'free'
  return PLAN_FEATURES[activePlan]?.[feature] || false
}

/**
 * Yangi sinf ocha oladimi?
 */
const canOpenNewClass = (teacher, currentClassCount) => {
  const activePlan = teacher.isPlanActive() ? teacher.plan : 'free'
  const limit = PLAN_LIMITS[activePlan]
  return currentClassCount < limit.classes
}

// Tarif kuchi bo'yicha tartib — solishtirish uchun
const PLAN_RANK = { free: 0, pro: 1, premium: 2 }

/**
 * Sinf uchun amalda qo'llanadigan tarif.
 *
 * Ikkita qiymatdan KATTAROG'I olinadi:
 *   1. `classPlan` — sinf yaratilgandagi tarif (eski, yuqoriroq tarifni
 *      saqlab qolish uchun: premiumda ochilgan sinf, keyin free'ga
 *      tushsangiz ham, katta limitini yo'qotmaydi)
 *   2. Direktorning HOZIRGI aktiv tarifi
 *
 * NEGA "kattarog'i"? Avval faqat (1) ishlatilardi va bu ikkita
 * to'lovchi mijozga tegadigan xatoga olib kelgan edi:
 *
 *   • LC guruhlari `plan` maydonini umuman yozmasdi (groupController
 *     uni o'rnatmagan) → sxema `"free"` qo'yardi → Premium hisob ham
 *     guruhiga 30 tadan ortiq o'quvchi qo'sha olmasdi.
 *   • Tarifni KO'TARGAN foydalanuvchi eski sinflarida eski limitda
 *     qolib ketardi — ya'ni to'lagan puli ish bermasdi.
 *
 * Ikkalasi ham migratsiyasiz tuzaladi: eski yozuvdagi `plan` qiymati
 * qanday bo'lishidan qat'i nazar, hozirgi tarif undan past bo'lmaydi.
 *
 * @param {string} classPlan  sinfdagi `plan` (bo'lmasligi mumkin)
 * @param {object} [teacher]  Teacher hujjati (isPlanActive() bilan)
 */
const effectivePlan = (classPlan, teacher) => {
  const snapshot = PLAN_RANK[classPlan] !== undefined ? classPlan : 'free'

  let current = 'free'
  if (teacher && typeof teacher.isPlanActive === 'function') {
    current = teacher.isPlanActive() ? teacher.plan : 'free'
  } else if (teacher && PLAN_RANK[teacher.plan] !== undefined) {
    current = teacher.plan
  }
  if (PLAN_RANK[current] === undefined) current = 'free'

  return PLAN_RANK[current] > PLAN_RANK[snapshot] ? current : snapshot
}

/**
 * Sinfga yangi o'quvchi qo'sha oladimi?
 *
 * @param {string} classPlan            sinfdagi `plan`
 * @param {number} currentStudentCount  hozirgi o'quvchilar soni
 * @param {object} [teacher]            Teacher hujjati — berilsa, hozirgi
 *                                      tarif ham hisobga olinadi
 */
const canAddStudent = (classPlan, currentStudentCount, teacher) => {
  const plan = teacher ? effectivePlan(classPlan, teacher) : classPlan
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free
  return currentStudentCount < limit.students
}

module.exports = { PLAN_LIMITS, PLAN_PRICES, PLAN_FEATURES, PLAN_RANK, hasFeature, canOpenNewClass, canAddStudent, effectivePlan }