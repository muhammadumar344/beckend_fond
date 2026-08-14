// src/bot/handlers.js
// ════════════════════════════════════════════════════════════
// Bot orqali BOG'LANISH — ota-ona/o'quvchini Telegram hisobiga
// biriktirish. Ko'rish esa Mini App'da (routes/tma.js).
//
// ⚠️ ESKI OQIM XAVFLI EDI VA OLIB TASHLANDI. U shunday ishlardi:
//    o'qituvchining emailini yozasan → sinfni tanlaysan →
//    ro'yxatdan ISTALGAN bolani bosasan → "ota-onasi" bo'lasan.
//    Hech qanday isbot yo'q edi. To'lov eslatmasi uchun bu
//    e'tiborsizlik edi; baho va davomat uchun — begona odam
//    boshqa oilaning ma'lumotini o'qishi.
//
// YANGI OQIM:
//    /start → raqamni yuborish tugmasi → Telegram raqamni O'ZI
//    yuboradi → bazadagi `Student.parentPhone` bilan solishtiriladi.
//    Mos kelmasa — markazdan olingan bir martalik kod.
//
//    Raqam Telegram tomonidan tasdiqlangan, foydalanuvchi uni
//    qo'lda o'zgartira olmaydi. Isbot shu yerda.
// ════════════════════════════════════════════════════════════

const Student = require('../models/Student')
const Class = require('../models/Class')
const StudentLink = require('../models/StudentLink')
const InviteCode = require('../models/InviteCode')
const { phoneKey } = require('../utils/phone')
const {
  phoneKeyboard,
  removeKeyboard,
  openAppKeyboard,
} = require('./keyboards')

const MD = { parse_mode: 'Markdown' }

/**
 * Mini App manzili.
 *
 * `TMA_URL` ni IKKI xil yozish mumkin va ikkalasi ham ishlaydi:
 *   https://schoolfonds.uz            → /tma.html qo'shiladi
 *   https://schoolfonds.uz/tma.html   → shundayligicha qoladi
 *
 * ⚠️ Nomi "URL" bo'lgani uchun odam to'liq manzilni yozishi tabiiy.
 *    Qo'shib yuborsak `/tma.html/tma.html` chiqib, tugma ochilmay
 *    qolardi va sababini topish qiyin bo'lardi.
 *
 * Bo'sh qolsa `FRONTEND_URL` dan olinadi (u vergul bilan bir necha
 * manzil tutishi mumkin — birinchisi olinadi).
 *
 * ⚠️ https SHART: Telegram http manzilni umuman ochmaydi.
 *    Sozlanmagan bo'lsa tugma ko'rsatilmaydi — buzuq tugmadan
 *    ko'ra tugmasiz xabar yaxshiroq.
 */
function appUrl() {
  const raw = (
    process.env.TMA_URL ||
    (process.env.FRONTEND_URL || '').split(',')[0] ||
    ''
  ).trim()

  if (!raw.startsWith('https://')) return ''

  const base = raw.replace(/\/+$/, '')
  return base.endsWith('.html') ? base : `${base}/tma.html`
}

/** Bog'langandan keyingi xabar — Mini App tugmasi bilan */
async function sendLinked(bot, chatId, names) {
  const url = appUrl()
  const list = names.map((n) => `• *${n}*`).join('\n')

  await bot.sendMessage(
    chatId,
    `✅ *Bog'landingiz!*\n\n${list}\n\n` +
      `Endi baho, davomat va to'lovlarni ko'rishingiz mumkin.`,
    url
      ? { ...MD, reply_markup: openAppKeyboard(url) }
      : { ...MD, reply_markup: removeKeyboard() },
  )
}

// ── /start ────────────────────────────────────────────────────
const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id

  try {
    // Allaqachon bog'langan bo'lsa qaytadan so'ramaymiz
    const existing = await StudentLink.find({
      telegramUserId: String(msg.from.id),
      isActive: true,
    })
      .populate('student', 'name')
      .lean()

    if (existing.length) {
      await sendLinked(
        bot,
        chatId,
        existing.map((l) => l.student?.name || '—'),
      )
      return
    }

    await bot.sendMessage(
      chatId,
      `👋 *Assalomu alaykum!*\n\n` +
        `Bu bot orqali farzandingizning *baholari*, *davomati* va ` +
        `*to'lovlari*ni kuzatasiz.\n\n` +
        `▶️ Boshlash uchun pastdagi tugma bilan *raqamingizni yuboring*. ` +
        `Raqam o'quv markazidagi ro'yxat bilan solishtiriladi.\n\n` +
        `_Agar raqamingiz topilmasa, markazdan bir martalik kod so'rang ` +
        `va shu yerga yozing._`,
      { ...MD, reply_markup: phoneKeyboard() },
    )
  } catch (err) {
    console.error('handleStart xatosi:', err.message)
  }
}

// ── Raqam kelganda ────────────────────────────────────────────
const handleContact = async (bot, msg) => {
  const chatId = msg.chat.id
  const contact = msg.contact

  try {
    // ⚠️ Boshqa odamning kontaktini yuborish mumkin. Telegram
    //    faqat O'Z raqamida `user_id` ni to'ldiradi va u
    //    yuboruvchiga teng bo'ladi. Tekshirmasak, birov
    //    qo'shnisining raqamini yuborib uning bolasini ko'rardi.
    if (!contact?.phone_number || String(contact.user_id) !== String(msg.from.id)) {
      await bot.sendMessage(
        chatId,
        `⚠️ Iltimos, *o'zingizning* raqamingizni yuboring — pastdagi tugma orqali.`,
        { ...MD, reply_markup: phoneKeyboard() },
      )
      return
    }

    const key = phoneKey(contact.phone_number)
    if (!key) {
      await bot.sendMessage(chatId, `⚠️ Raqamni o'qib bo'lmadi.`)
      return
    }

    // Bazadagi raqamlar turli ko'rinishda yozilgan bo'lishi mumkin
    // (`+998 90 …`, `90 …`), shuning uchun oxirgi 9 raqam bo'yicha
    // solishtiramiz — utils/phone.js dagi izoh.
    const candidates = await Student.find({
      parentPhone: { $regex: `${key}$` },
      isActive: { $ne: false },
    })
      .select('name class parentPhone')
      .lean()

    const matched = candidates.filter((s) => phoneKey(s.parentPhone) === key)

    if (!matched.length) {
      await bot.sendMessage(
        chatId,
        `🔍 *${contact.phone_number}* raqami ro'yxatdan topilmadi.\n\n` +
          `Ikki yo'l bor:\n` +
          `1️⃣ O'quv markazidan *bir martalik kod* so'rang va shu yerga yozing\n` +
          `2️⃣ Markazga murojaat qilib, raqamingizni yangilashni so'rang`,
        { ...MD, reply_markup: removeKeyboard() },
      )
      return
    }

    // Sinf orqali direktorni topamiz
    const classIds = [...new Set(matched.map((s) => String(s.class)))]
    const classes = await Class.find({ _id: { $in: classIds } })
      .select('teacher')
      .lean()
    const directorOf = new Map(
      classes.map((c) => [String(c._id), String(c.teacher)]),
    )

    const names = []
    for (const s of matched) {
      const director = directorOf.get(String(s.class))
      if (!director) continue

      // ⚠️ Bir nechta farzand bo'lsa hammasi bog'lanadi — raqam
      //    bitta, ya'ni ota-ona ham o'sha. Tanlashni so'rash
      //    ortiqcha qadam bo'lardi.
      await StudentLink.updateOne(
        { telegramUserId: String(msg.from.id), student: s._id },
        {
          $set: {
            director,
            telegramChatId: String(chatId),
            telegramUsername: msg.from.username || '',
            kind: 'parent',
            verifiedVia: 'phone',
            phoneKey: key,
            isActive: true,
          },
        },
        { upsert: true },
      )
      names.push(s.name)
    }

    if (!names.length) {
      await bot.sendMessage(chatId, `⚠️ Bog'lashda xatolik. Markazga murojaat qiling.`)
      return
    }

    console.log(`[bot] raqam orqali bog'landi: ${msg.from.id} → ${names.join(', ')}`)
    await sendLinked(bot, chatId, names)
  } catch (err) {
    console.error('handleContact xatosi:', err.message)
    await bot.sendMessage(chatId, `❌ Xatolik yuz berdi. /start bosib qayta urining.`)
  }
}

// ── Matn xabarlar — taklif kodi ───────────────────────────────
const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id
  const text = msg.text?.trim()
  if (!text) return

  const code = InviteCode.normalizeCode(text)

  // Kodga o'xshamasa — yo'riqnomani eslatamiz
  if (code.length < 6 || code.length > 16) {
    await bot.sendMessage(
      chatId,
      `Boshlash uchun /start bosing va raqamingizni yuboring.\n\n` +
        `Agar sizda *bir martalik kod* bo'lsa, uni shu yerga yozing.`,
      MD,
    )
    return
  }

  try {
    const invite = await InviteCode.findOne({ code })

    // Yo'q / ishlatilgan / eskirgan — bir xil javob (kod terib
    // topishga urinayotgan odam farqni bilmasin)
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      await bot.sendMessage(chatId, `❌ Kod noto'g'ri yoki muddati o'tgan.`)
      return
    }

    const student = await Student.findById(invite.student).select('name').lean()
    if (!student) {
      await bot.sendMessage(chatId, `❌ Kod noto'g'ri yoki muddati o'tgan.`)
      return
    }

    await StudentLink.updateOne(
      { telegramUserId: String(msg.from.id), student: invite.student },
      {
        $set: {
          director: invite.director,
          telegramChatId: String(chatId),
          telegramUsername: msg.from.username || '',
          kind: invite.kind,
          verifiedVia: 'code',
          isActive: true,
        },
      },
      { upsert: true },
    )

    invite.usedAt = new Date()
    invite.usedByTelegramId = String(msg.from.id)
    await invite.save()

    console.log(`[bot] kod orqali bog'landi: ${msg.from.id} → ${student.name}`)
    await sendLinked(bot, chatId, [student.name])
  } catch (err) {
    console.error('Kod tekshirish xatosi:', err.message)
    await bot.sendMessage(chatId, `❌ Xatolik yuz berdi. Qayta urinib ko'ring.`)
  }
}

// ── Inline tugmalar ───────────────────────────────────────────
// Eski oqim olib tashlangani uchun hozircha faqat "qaytadan".
const handleCallbackQuery = async (bot, query) => {
  try {
    await bot.answerCallbackQuery(query.id)
  } catch (_) {}

  if (query.data === 'restart' || query.data === 'cancel') {
    await handleStart(bot, { chat: query.message.chat, from: query.from })
  }
}

module.exports = {
  handleStart,
  handleContact,
  handleMessage,
  handleCallbackQuery,
  appUrl,
}
