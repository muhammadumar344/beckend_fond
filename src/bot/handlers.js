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
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const StudentLink = require('../models/StudentLink')
const TelegramParent = require('../models/TelegramParent')
const InviteCode = require('../models/InviteCode')
const { phoneKey } = require('../utils/phone')
const { hit } = require('../middleware/rateLimit')
const { t, langOf } = require('./texts')
const {
  phoneKeyboard,
  removeKeyboard,
  mainKeyboard,
  rosterKeyboard,
  confirmResetKeyboard,
} = require('./keyboards')

const MD = { parse_mode: 'Markdown' }

// Taklif kodini terib topishga qarshi.
//
// ⚠️ ILGARI BOT TOMONIDA UMUMAN YO'Q EDI. Mini App'da soatiga 10
//    ta urinish chegarasi turardi (routes/tma.js), botda esa
//    cheksiz — ya'ni himoyani chetlab o'tish yo'li ochiq edi.
//    Kod bilan bolaning baholari ochiladi, demak u parolga teng.
const CODE_WINDOW_MS = 60 * 60 * 1000
const CODE_MAX = 10

// ── SINF HAVOLASI ─────────────────────────────────────────────
//
// Sinf rahbari CRM'da havola oladi va sinf guruhiga tashlaydi
// (QR ham shu havolaning surati). Ota-ona bosadi →
// `t.me/bot?start=cls_<token>` → bot QAYSI SINF ekanini biladi.
//
// ⚠️ HAVOLANING O'ZI HECH NARSA OCHMAYDI. Guruhga tashlangan
//    havola tarqaydi; agar u bilan ro'yxatdan istalgan bolani
//    tanlab "ota-onasi" bo'lib qo'yish mumkin bo'lsa, guruhga
//    kirgan har kim istalgan bolaning baholarini ochardi —
//    eski botdagi aynan o'sha teshik (CLAUDE.md → `legacy`).
//
//    Shuning uchun tartib: RAQAM BIRINCHI. Mos kelsa darrov
//    ulanadi; kelmasa ro'yxatdan tanlaydi va bu TASDIQ
//    KUTADIGAN so'rov bo'lib qoladi.
//
// ⚠️ Tanlangan sinf XOTIRADA saqlanadi, bazada emas: bu bir
//    necha daqiqalik holat va uni saqlash o'sib boradigan,
//    tozalanishi kerak bo'ladigan yana bitta kolleksiya degani.
//    Server qayta ko'tarilsa holat yo'qoladi va oqim ESKI yo'lga
//    tushadi (raqam butun baza bo'ylab qidiriladi) — ya'ni
//    ishlamay qolmaydi, faqat ro'yxat taklif qilinmaydi.
const CLASS_TTL_MS = 30 * 60 * 1000
const classOfChat = new Map()

const rememberClass = (chatId, classId) => {
  classOfChat.set(String(chatId), { id: String(classId), at: Date.now() })
  // Eskirganlarini shu yerda tozalaymiz — alohida timer kerak emas
  // (bir nechta ota-ona uchun Map hech qachon katta bo'lmaydi).
  for (const [k, v] of classOfChat) {
    if (Date.now() - v.at > CLASS_TTL_MS) classOfChat.delete(k)
  }
}

const classOf = (chatId) => {
  const v = classOfChat.get(String(chatId))
  if (!v) return null
  if (Date.now() - v.at > CLASS_TTL_MS) {
    classOfChat.delete(String(chatId))
    return null
  }
  return v.id
}

/**
 * Markdown uchun xavfli belgilarni yumshatish.
 *
 * ⚠️ Ism yoki sinf nomida `_` bo'lsa (`Nodira_A`, `9_A`) Telegram
 *    xabarni UMUMAN yubormaydi — 400 qaytaradi va ota-ona hech
 *    narsa ko'rmaydi. Xato loglarda qoladi, oqim esa jimgina
 *    to'xtaydi. Shuning uchun har bir DINAMIK qiymat shu yerdan
 *    o'tadi.
 */
const md = (v) => String(v || '').replace(/([*_`\[\]])/g, ' ')

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

/**
 * Muassasa turiga qarab matn.
 *
 * ⚠️ Bitta bot IKKI XIL mahsulotga xizmat qiladi: maktab sinf
 *    fondi va o'quv markazi. Ota-ona o'z muassasasini tanimasa
 *    ("nega menga baho haqida yozyapti, biz faqat pul yig'amiz-ku")
 *    botga ishonchi yo'qoladi. Shuning uchun matn har doim
 *    o'quvchining markazidan kelib chiqadi.
 */
const afterKey = (type) =>
  type === 'learning_center' ? 'linkedAfterLC' : 'linkedAfterFond'

/** Bog'langan foydalanuvchiga ko'rsatiladigan asosiy ekran */
async function sendLinked(bot, chatId, lang, names, type, { fresh } = {}) {
  const url = appUrl()
  const list = names.map((n) => `• *${n}*`).join('\n')

  await bot.sendMessage(
    chatId,
    `${t(lang, fresh ? 'linkedTitle' : 'linkedAlready')}\n\n` +
      `${list}\n\n${t(lang, afterKey(type))}` +
      (url ? t(lang, 'openHint') : ''),
    { ...MD, reply_markup: mainKeyboard(lang, url) },
  )
}

/** Bog'lanish orqali muassasa turini aniqlaydi */
async function typeOfDirector(directorId) {
  if (!directorId) return null
  const t = await Teacher.findById(directorId).select('institutionType').lean()
  return t?.institutionType || null
}

/** Shu Telegram hisobiga bog'langan faol yozuvlar */
const activeLinks = (userId) =>
  StudentLink.find({ telegramUserId: String(userId), isActive: true })
    .populate('student', 'name')
    .lean()

/** Boshlang'ich ekran — raqam so'raladi */
async function askPhone(bot, chatId, lang, prefix = '') {
  await bot.sendMessage(chatId, prefix + t(lang, 'welcome'), {
    ...MD,
    reply_markup: phoneKeyboard(lang),
  })
}

// ── Direktorni ulash ──────────────────────────────────────────
//
// ⚠️ ALOHIDA OQIM. Ota-ona telefon raqami bilan isbotlanadi;
//    direktor esa CRM'da tugmani bosgan bo'ladi va bir martalik
//    token bilan keladi. Isbot shu tokenda: uni faqat o'z
//    hisobiga kirgan direktor ola oladi.
//
// ⚠️ Xato token uchun SABAB AYTILADI ("muddati o'tgan"), lekin
//    hech qanday ma'lumot berilmaydi. Tokenni taxmin qilib
//    ko'rayotgan odam qaysi markaz borligini ham bilmasin.
const handleDirectorLink = async (bot, msg, token) => {
  const chatId = msg.chat.id

  try {
    const { consumeLinkToken } = require('../services/directorTelegram')
    const director = await consumeLinkToken(token, {
      chatId,
      username: msg.from?.username || '',
    })

    if (!director) {
      await bot.sendMessage(
        chatId,
        "Havola eskirgan yoki allaqachon ishlatilgan.\n\n" +
          "Lumo'ga kiring → Kassa sahifasi → \"Telegram'ga ulash\" tugmasini qayta bosing.",
      )
      return
    }

    await bot.sendMessage(
      chatId,
      `✅ *${director.name || 'Markaz'}* ulandi.\n\n` +
        "Endi kunlik kassa xabarini shu yerda olasiz.\n\n" +
        "Sozlamani Kassa sahifasidan o'zgartirishingiz mumkin: " +
        "faqat muammo bo'lganda, har kuni yoki umuman yubormaslik.",
      { parse_mode: 'Markdown' },
    )
  } catch (err) {
    console.error('handleDirectorLink xatosi:', err.message)
    try {
      await bot.sendMessage(chatId, 'Xatolik yuz berdi. Birozdan keyin urinib ko\'ring.')
    } catch {}
  }
}

// ── Sinf havolasi orqali kelgan odam ──────────────────────────
async function handleClassLink(bot, msg, token) {
  const chatId = msg.chat.id
  const lang = langOf(msg.from)

  // ⚠️ Arxivlangan sinf ochilmaydi: o'quv yili yopilgach havola
  //    ham o'lishi kerak (ochiq hisobot havolasi bilan bir xil
  //    qoida — `publicReportController`).
  const cls = await Class.findOne({ parentToken: token, archivedAt: null })
    .select('name teacher')
    .lean()

  if (!cls) {
    await bot.sendMessage(chatId, t(lang, 'clsNotFound'), MD)
    return
  }

  // Bloklangan yoki o'chirilayotgan markazning havolasi ham
  // ishlamasin — aks holda hisob yopilgandan keyin ham yangi
  // ota-onalar ulanaverardi.
  const dir = await Teacher.findById(cls.teacher)
    .select('name isActive deletionScheduledFor')
    .lean()
  if (!dir || dir.isActive === false || dir.deletionScheduledFor) {
    await bot.sendMessage(chatId, t(lang, 'clsNotFound'), MD)
    return
  }

  rememberClass(chatId, cls._id)

  await bot.sendMessage(
    chatId,
    t(lang, 'clsWelcome', md(cls.name), md(dir.name)),
    { ...MD, reply_markup: phoneKeyboard(lang) },
  )
}

/** Raqam topilmaganda — sinf ro'yxati */
async function sendRoster(bot, chatId, lang, classId, phone) {
  // ⚠️ Token QAYTA o'qiladi: ota-ona havolani bosgandan keyin
  //    sinf rahbari uni bekor qilgan bo'lishi mumkin.
  const cls = await Class.findOne({ _id: classId, archivedAt: null })
    .select('name parentToken')
    .lean()
  if (!cls || !cls.parentToken) {
    await bot.sendMessage(chatId, t(lang, 'clsNotFound'), MD)
    return
  }

  const students = await Student.find({
    class: classId,
    isActive: { $ne: false },
  })
    .select('name')
    .sort({ rollNumber: 1 })
    .limit(120)
    .lean()

  if (!students.length) {
    await bot.sendMessage(chatId, t(lang, 'clsPickEmpty'), MD)
    return
  }

  // Raqam klaviaturasi endi xalaqit beradi — ro'yxat inline
  // tugmalarda, pastda esa "raqam yuborish" turib qolardi.
  await bot.sendMessage(chatId, t(lang, 'clsPickTitle', md(cls.name), md(phone)), {
    ...MD,
    reply_markup: removeKeyboard(),
  })
  await bot.sendMessage(chatId, '👇', {
    reply_markup: rosterKeyboard(students),
  })
}

/** Ro'yxatdan bola tanlandi → TASDIQ KUTADIGAN so'rov */
async function handlePick(bot, query, studentId) {
  const chatId = query.message?.chat?.id
  const lang = langOf(query.from)
  if (!chatId || !/^[a-f0-9]{24}$/i.test(studentId)) return

  const student = await Student.findOne({
    _id: studentId,
    isActive: { $ne: false },
  })
    .select('name class')
    .lean()
  if (!student) {
    await bot.sendMessage(chatId, t(lang, 'clsNotFound'), MD)
    return
  }

  // ⚠️ TOKEN SHU YERDA HAM TEKSHIRILADI. Tugma yozishmada qolib
  //    ketadi va oylardan keyin ham bosilishi mumkin; havola
  //    bekor qilingan bo'lsa eski tugma ham o'lishi kerak.
  //    Ya'ni "bekor qilish" rostdan bekor qiladi.
  const cls = await Class.findOne({ _id: student.class, archivedAt: null })
    .select('name teacher parentToken')
    .lean()
  if (!cls || !cls.parentToken) {
    await bot.sendMessage(chatId, t(lang, 'clsNotFound'), MD)
    return
  }

  const existing = await StudentLink.findOne({
    telegramUserId: String(query.from.id),
    student: student._id,
  }).lean()

  if (existing?.isActive) {
    const type = await typeOfDirector(cls.teacher)
    await sendLinked(bot, chatId, lang, [student.name], type)
    return
  }
  if (existing?.status === 'pending') {
    await bot.sendMessage(chatId, t(lang, 'clsAlreadyPending', md(student.name)), MD)
    return
  }

  // ⚠️ `isActive: false` — ATAYLAB. Butun kod shu maydon bo'yicha
  //    filtrlaydi (Mini App ruxsati, xabar yuborish, ro'yxatlar),
  //    ya'ni tasdiqlanmagan so'rov hech qayerga chiqmaydi va buni
  //    har bir yangi joyda alohida eslab qolish shart emas.
  await StudentLink.updateOne(
    { telegramUserId: String(query.from.id), student: student._id },
    {
      $set: {
        director: cls.teacher,
        telegramChatId: String(chatId),
        telegramUsername: query.from.username || '',
        kind: 'parent',
        verifiedVia: 'approved',
        status: 'pending',
        requestedClass: cls._id,
        // Tasdiqlash xabari CRM'dan keladi — u yerda til
        // noma'lum, shuning uchun shu yerda saqlab qo'yamiz.
        tgLang: lang,
        isActive: false,
      },
    },
    { upsert: true },
  )

  console.log(`[bot] tasdiq kutmoqda: ${query.from.id} → ${student._id}`)
  await bot.sendMessage(chatId, t(lang, 'clsPending', md(student.name)), MD)
}

// ── /start ────────────────────────────────────────────────────
//
// ⚠️ /start HECH QACHON BOSHI BERK KO'CHA BO'LMASLIGI KERAK.
//    Ilgari bog'langan odam /start bossa qisqa "siz bog'langansiz"
//    xabarini olardi, xolos — orqaga yo'l yo'q edi. Raqamini
//    almashtirgan yoki noto'g'ri bolaga ulanib qolgan ota-ona
//    o'zi hech narsa qila olmasdi, faqat markazga qo'ng'iroq
//    qilardi. Endi har safar to'liq menyu keladi va "Qayta
//    bog'lanish" tugmasi doim ko'rinib turadi.
const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id
  const lang = langOf(msg.from)

  try {
    // ⚠️ DIREKTOR ULANISHI — ota-ona oqimidan OLDIN tekshiriladi.
    //    Havola `t.me/bot?start=dir_<token>` ko'rinishida keladi.
    //    Bu butunlay boshqa oqim: raqam ham, o'quvchi ham
    //    ishtirok etmaydi. Ikkalasini aralashtirmang — direktor
    //    tokeni ota-ona bog'lanishiga tushib qolsa, markaz
    //    xabarlari begona odamga ketardi.
    const payload = String(msg.text || '').split(/\s+/)[1] || ''
    if (payload.startsWith('dir_')) {
      await handleDirectorLink(bot, msg, payload.slice(4))
      return
    }

    // ⚠️ Sinf havolasi BOG'LANGANLIK TEKSHIRUVIDAN OLDIN turadi.
    //    Ikkinchi farzandi boshqa sinfda o'qiydigan ota-ona
    //    yangi havolani bosadi — agar bu yerda "siz allaqachon
    //    bog'langansiz" deb to'xtatsak, ikkinchi bolani umuman
    //    qo'sha olmasdi.
    if (payload.startsWith('cls_')) {
      await handleClassLink(bot, msg, payload.slice(4))
      return
    }

    const existing = await activeLinks(msg.from.id)

    if (existing.length) {
      const type = await typeOfDirector(existing[0].director)
      await sendLinked(
        bot,
        chatId,
        lang,
        existing.map((l) => l.student?.name || '—'),
        type,
      )
      return
    }

    // ⚠️ Bu yerda muassasa turi HALI NOMA'LUM — foydalanuvchi
    //    bog'lanmagan. Shuning uchun matn NEYTRAL.
    await askPhone(bot, chatId, lang)
  } catch (err) {
    console.error('handleStart xatosi:', err.message)
  }
}

// ── /help ─────────────────────────────────────────────────────
const handleHelp = async (bot, chatId, lang) => {
  try {
    await bot.sendMessage(chatId, t(lang, 'help'), MD)
  } catch (e) {
    console.error('Help xabar yuborish xatosi:', e.message)
  }
}

// ── /reset — bog'lanishni uzish ───────────────────────────────
//
// ⚠️ TASDIQ SO'RALADI. Uzish o'zi zararsiz ko'rinadi, lekin
//    KODLA bog'langan odam uchun qaytish yo'li yo'q: uning
//    raqami ro'yxatda bo'lmagani uchun kod berilgan edi, ya'ni
//    markazdan YANGI kod so'rashi kerak bo'ladi. Bir bosishda
//    shunday holatga tushib qolmasin.
const handleReset = async (bot, msg) => {
  const chatId = msg.chat.id
  const lang = langOf(msg.from)

  try {
    const existing = await activeLinks(msg.from.id)
    if (!existing.length) {
      // ⚠️ Bog'lanish ko'rinmasa ham TOZALAB o'tamiz: eski
      //    `TelegramParent` yozuvi qolgan bo'lishi mumkin va u
      //    ko'rinmasdan turib eslatma yuboraverardi. Tasdiq
      //    so'ralmaydi — yo'qotadigan narsa yo'q.
      await doReset(bot, chatId, msg.from, 'resetNothing')
      return
    }

    await bot.sendMessage(chatId, t(lang, 'resetAsk'), {
      ...MD,
      reply_markup: confirmResetKeyboard(lang),
    })
  } catch (err) {
    console.error('handleReset xatosi:', err.message)
  }
}

/** Tasdiqdan keyin — hamma bog'lanishni o'chirib, boshidan */
async function doReset(bot, chatId, from, textKey = 'resetDone') {
  const lang = langOf(from)

  // ⚠️ O'CHIRILMAYDI, faqat `isActive: false`. Sabab: yozuv
  //    tarixni saqlaydi va noyob indeks (telegramUserId+student)
  //    tufayli qaytadan bog'langanda o'sha yozuv tiklanadi —
  //    ikkinchi nusxa yaratilmaydi.
  //
  // ⚠️ ESKI `TelegramParent` YOZUVI HAM O'CHIRILADI. Xabar
  //    yuboruvchi kod ikkala jadvaldan ro'yxat oladi
  //    (utils/notifyTargets.js). Faqat `StudentLink` ni
  //    o'chirsak, "bog'lanishni uzdim" degan odam to'lov
  //    eslatmalarini olishda davom etardi va bot buzuq
  //    ko'rinardi.
  const chatIds = [String(from.id), String(chatId)]
  const [links, legacy] = await Promise.all([
    StudentLink.updateMany(
      { telegramUserId: String(from.id), isActive: true },
      { $set: { isActive: false } },
    ),
    TelegramParent.updateMany(
      { telegramChatId: { $in: chatIds }, isActive: true },
      { $set: { isActive: false } },
    ),
  ])
  console.log(
    `[bot] bog'lanish uzildi: ${from.id} — ${links.modifiedCount} link, ${legacy.modifiedCount} eski`,
  )

  await askPhone(bot, chatId, lang, `${t(lang, textKey)}\n\n`)
}

// ── Raqam kelganda ────────────────────────────────────────────
const handleContact = async (bot, msg) => {
  const chatId = msg.chat.id
  const contact = msg.contact
  const lang = langOf(msg.from)

  try {
    // ⚠️ Boshqa odamning kontaktini yuborish mumkin. Telegram
    //    faqat O'Z raqamida `user_id` ni to'ldiradi va u
    //    yuboruvchiga teng bo'ladi. Tekshirmasak, birov
    //    qo'shnisining raqamini yuborib uning bolasini ko'rardi.
    if (!contact?.phone_number || String(contact.user_id) !== String(msg.from.id)) {
      await bot.sendMessage(chatId, t(lang, 'notMyContact'), {
        ...MD,
        reply_markup: phoneKeyboard(lang),
      })
      return
    }

    const key = phoneKey(contact.phone_number)
    if (!key) {
      await bot.sendMessage(chatId, t(lang, 'phoneUnreadable'), {
        ...MD,
        reply_markup: phoneKeyboard(lang),
      })
      return
    }

    // Bazadagi raqamlar turli ko'rinishda yozilgan bo'lishi mumkin
    // (`+998 90 …`, `90 …`), shuning uchun oxirgi 9 raqam bo'yicha
    // solishtiramiz — utils/phone.js dagi izoh.
    // ⚠️ Sinf havolasi orqali kelgan bo'lsa QIDIRUV O'SHA SINF
    //    BILAN CHEKLANADI. Sabab: bitta raqam ikki markazda
    //    bo'lishi mumkin (aka-uka boshqa maktabda), va havolani
    //    bosgan odam aynan shu sinfga ulanmoqchi. Cheklamasak,
    //    u tanlamagan sinfga ham jimgina ulanib qolardi.
    const linkClassId = classOf(chatId)

    const candidates = await Student.find({
      parentPhone: { $regex: `${key}$` },
      isActive: { $ne: false },
      ...(linkClassId ? { class: linkClassId } : {}),
    })
      .select('name class parentPhone')
      .lean()

    const matched = candidates.filter((s) => phoneKey(s.parentPhone) === key)

    if (!matched.length) {
      // Sinf ma'lum bo'lsa — boshi berk ko'cha emas: ro'yxatdan
      // tanlaydi va sinf rahbari tasdiqlaydi.
      if (linkClassId) {
        await sendRoster(bot, chatId, lang, linkClassId, contact.phone_number)
        return
      }

      // ⚠️ Klaviatura QOLDIRILADI: raqamini yangilatgan ota-ona
      //    darrov qayta urinib ko'rishi kerak, /start yozishga
      //    majbur bo'lmasin.
      await bot.sendMessage(
        chatId,
        t(lang, 'phoneNotFound', contact.phone_number),
        { ...MD, reply_markup: phoneKeyboard(lang) },
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
      await bot.sendMessage(chatId, t(lang, 'linkFailed'), MD)
      return
    }

    console.log(`[bot] raqam orqali bog'landi: ${msg.from.id} → ${names.length} ta`)

    // Raqam klaviaturasi endi keraksiz — yopamiz, keyin menyu
    await bot.sendMessage(chatId, '✅', { reply_markup: removeKeyboard() })

    const type = await typeOfDirector(directorOf.get(String(matched[0].class)))
    await sendLinked(bot, chatId, lang, names, type, { fresh: true })
  } catch (err) {
    console.error('handleContact xatosi:', err.message)
    await bot.sendMessage(chatId, t(lang, 'genericError'))
  }
}

// ── Matn xabarlar — taklif kodi ───────────────────────────────
const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id
  const lang = langOf(msg.from)
  const text = msg.text?.trim()
  if (!text) return

  const code = InviteCode.normalizeCode(text)

  // Kodga o'xshamasa — yo'riqnomani eslatamiz.
  // ⚠️ Cheklovdan OLDIN turadi: "salom" deb yozgan odam
  //    urinish sanagichini bo'shatib yubormasin.
  if (code.length < 6 || code.length > 16) {
    await bot.sendMessage(chatId, t(lang, 'codeHint'), MD)
    return
  }

  const gate = hit('bot-code', String(msg.from.id), {
    windowMs: CODE_WINDOW_MS,
    max: CODE_MAX,
  })
  if (!gate.ok) {
    await bot.sendMessage(
      chatId,
      t(lang, 'codeTooMany', Math.ceil(gate.retryAfterSec / 60)),
      MD,
    )
    return
  }

  try {
    const invite = await InviteCode.findOne({ code })

    // Yo'q / ishlatilgan / eskirgan — bir xil javob (kod terib
    // topishga urinayotgan odam farqni bilmasin)
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      await bot.sendMessage(chatId, t(lang, 'codeBad'))
      return
    }

    const student = await Student.findById(invite.student).select('name').lean()
    if (!student) {
      await bot.sendMessage(chatId, t(lang, 'codeBad'))
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

    console.log(`[bot] kod orqali bog'landi: ${msg.from.id}`)

    await bot.sendMessage(chatId, '✅', { reply_markup: removeKeyboard() })

    const type = await typeOfDirector(invite.director)
    await sendLinked(bot, chatId, lang, [student.name], type, { fresh: true })
  } catch (err) {
    console.error('Kod tekshirish xatosi:', err.message)
    await bot.sendMessage(chatId, t(lang, 'genericError'))
  }
}

// ── Inline tugmalar ───────────────────────────────────────────
const handleCallbackQuery = async (bot, query) => {
  const chatId = query.message?.chat?.id
  const lang = langOf(query.from)

  // ⚠️ Avval javob beramiz: aks holda Telegram tugmada aylanma
  //    ko'rsatib turadi va foydalanuvchi qayta-qayta bosadi.
  try {
    await bot.answerCallbackQuery(query.id)
  } catch (_) {}

  if (!chatId) return

  try {
    // ⚠️ Ro'yxatdan tanlash `switch` dan OLDIN: `query.data` da
    //    o'quvchi ID'si bor, ya'ni aniq mos kelmaydi.
    if (String(query.data || '').startsWith('pick_')) {
      // Tugmalarni olib tashlaymiz — ikkinchi bolani ham tanlab
      // yubormasin (bir necha farzandi bo'lsa qayta havola bosadi)
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: query.message.message_id },
        )
      } catch (_) {}
      await handlePick(bot, query, query.data.slice(5))
      return
    }

    switch (query.data) {
      case 'help':
        await handleHelp(bot, chatId, lang)
        break

      case 'relink':
        await handleReset(bot, { chat: query.message.chat, from: query.from })
        break

      case 'relink_yes':
        // Tasdiq tugmalarini olib tashlaymiz — ikkinchi marta
        // bosib bo'lmasin
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id },
          )
        } catch (_) {}
        await doReset(bot, chatId, query.from)
        break

      case 'relink_no':
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id },
          )
        } catch (_) {}
        await bot.sendMessage(chatId, t(lang, 'resetCancel'))
        break

      // Eski oqimdan qolgan tugmalar
      case 'restart':
      case 'cancel':
        await handleStart(bot, { chat: query.message.chat, from: query.from })
        break
    }
  } catch (err) {
    console.error('handleCallbackQuery xatosi:', err.message)
  }
}

module.exports = {
  handleStart,
  handleHelp,
  handleReset,
  handleContact,
  handleMessage,
  handleCallbackQuery,
  appUrl,
}
