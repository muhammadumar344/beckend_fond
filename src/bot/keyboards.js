// backend/src/bot/keyboards.js

/**
 * Raqam so'rash tugmasi.
 *
 * ⚠️ `request_contact` — bog'lanishning ASOSIY yo'li. Telegram
 *    raqamni O'ZI yuboradi, foydalanuvchi qo'lda terib boshqa
 *    birovning raqamini yozib qo'ya olmaydi. Aynan shu narsa
 *    "men shu bolaning ota-onasiman" degan da'voni isbotga
 *    aylantiradi.
 */
const phoneKeyboard = () => ({
  keyboard: [[{ text: '📱 Raqamimni yuborish', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
})

/** Oddiy klaviaturani yopish */
const removeKeyboard = () => ({ remove_keyboard: true })

/**
 * Mini App'ni ochadigan tugma.
 * @param {string} url  https bo'lishi SHART — Telegram http'ni ochmaydi
 */
const openAppKeyboard = (url, text = '📊 Ochish') => ({
  inline_keyboard: [[{ text, web_app: { url } }]],
})

/**
 * Inline keyboard — sinflar ro'yxati uchun
 * @param {Array} classes - [{_id, name}]
 */
const classesKeyboard = (classes) => ({
  inline_keyboard: classes.map((cls, i) => ([{
    text: `${i + 1}️⃣ ${cls.name}`,
    callback_data: `class_${cls._id}`,
  }])),
})

/**
 * Inline keyboard — o'quvchilar ro'yxati uchun
 * @param {Array} students - [{_id, name, rollNumber}]
 */
const studentsKeyboard = (students) => ({
  inline_keyboard: students.map((s) => ([{
    text: `${s.rollNumber}. ${s.name}`,
    callback_data: `student_${s._id}`,
  }])),
})

/**
 * Tasdiqlash keyboard
 * @param {string} studentId
 */
const confirmKeyboard = (studentId) => ({
  inline_keyboard: [[
    { text: '✅ Ha, tasdiqlash', callback_data: `confirm_${studentId}` },
    { text: '❌ Bekor qilish', callback_data: 'cancel' },
  ]],
})

/**
 * Orqaga qaytish tugmasi
 */
const backKeyboard = () => ({
  inline_keyboard: [[
    { text: '⬅️ Boshidan boshlash', callback_data: 'restart' },
  ]],
})

module.exports = {
  phoneKeyboard,
  removeKeyboard,
  openAppKeyboard,
  classesKeyboard,
  studentsKeyboard,
  confirmKeyboard,
  backKeyboard,
}
