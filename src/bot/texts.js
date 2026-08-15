// src/bot/texts.js
// ════════════════════════════════════════════════════════════
// Bot matnlari — o'zbekcha va ruscha.
//
// NEGA RUSCHA QO'SHILDI: CRM'da uch til bor, bot esa faqat
// o'zbekcha gapirardi. Toshkent va Samarqanddagi o'quv
// markazlarining ota-onalarining sezilarli qismi rus tilida
// o'qiydi. Telegram har xabarda `from.language_code` beradi —
// ya'ni bizga hech narsa so'ramasdan to'g'ri tilni tanlash
// mumkin. So'ramaslik muhim: bog'lanishdan oldingi har bir
// ortiqcha qadam odamni yo'qotadi.
//
// ⚠️ Sozlama saqlanmaydi (bazada "til" maydoni yo'q). Sabab:
//    Telegram tilni o'zi biladi va foydalanuvchi telefon tilini
//    o'zgartirsa bot ham o'ziga o'zi moslashadi. Yana bitta
//    saqlanadigan, eskirib qoladigan maydon yaratmadik.
// ════════════════════════════════════════════════════════════

const UZ = {
  // ── Bog'lanish ────────────────────────────────────────────
  welcome:
    "👋 *Assalomu alaykum!*\n\n" +
    "Bu bot orqali farzandingiz haqidagi ma'lumotlarni kuzatasiz — " +
    "baholar, davomat, uy vazifasi va to'lovlar.\n\n" +
    "▶️ Boshlash uchun pastdagi tugma bilan *raqamingizni yuboring*. " +
    "Raqam o'quv markazidagi ro'yxat bilan solishtiriladi.\n\n" +
    "_Raqamingiz topilmasa — markazdan bir martalik kod so'rang va " +
    "shu yerga yozing._",

  linkedTitle: "✅ *Bog'landingiz!*",
  linkedAlready: "✅ *Siz allaqachon bog'langansiz*",
  linkedAfterLC: "Baho, davomat va to'lovlarni ilovada ko'rasiz.",
  linkedAfterFond: "To'lovlarni ilovada ko'rasiz va oylik eslatma olasiz.",
  openHint: "\n\n_Ilova pastdagi tugmada, yoki chapdagi ☰ menyuda._",

  notMyContact:
    "⚠️ Iltimos, *o'zingizning* raqamingizni yuboring — pastdagi tugma orqali.",
  phoneUnreadable: "⚠️ Raqamni o'qib bo'lmadi. Qaytadan urinib ko'ring.",
  phoneNotFound: (phone) =>
    `🔍 *${phone}* raqami ro'yxatdan topilmadi.\n\n` +
    "Ikki yo'l bor:\n" +
    "1️⃣ O'quv markazidan *bir martalik kod* so'rang va shu yerga yozing\n" +
    "2️⃣ Markazga murojaat qilib, raqamingizni yangilashni so'rang",
  linkFailed: "⚠️ Bog'lashda xatolik. O'quv markaziga murojaat qiling.",

  // ── Kod ───────────────────────────────────────────────────
  codeBad: "❌ Kod noto'g'ri yoki muddati o'tgan.",
  codeHint:
    "Boshlash uchun /start bosing va raqamingizni yuboring.\n\n" +
    "Agar sizda *bir martalik kod* bo'lsa, uni shu yerga yozing.",
  codeTooMany: (min) =>
    `🚫 Juda ko'p urinish. *${min} daqiqa*dan keyin qayta urinib ko'ring.`,

  // ── Qayta bog'lanish ──────────────────────────────────────
  resetAsk:
    "🔄 *Qayta bog'lanish*\n\n" +
    "Hozirgi bog'lanish uziladi va hammasi boshidan boshlanadi.\n\n" +
    "⚠️ Qaytadan bog'lanish uchun raqamingiz o'quv markazi ro'yxatida " +
    "bo'lishi kerak. Kod bilan bog'langan bo'lsangiz — markazdan " +
    "*yangi kod* so'rashingizga to'g'ri keladi.\n\n" +
    "Davom etamizmi?",
  resetDone: "🔄 Bog'lanish uzildi. Boshidan boshlaymiz.",
  resetNothing: "Hozircha bog'lanish yo'q — boshidan boshlaymiz.",
  resetCancel: "Bekor qilindi. Hammasi avvalgidek.",

  // ── Yordam ────────────────────────────────────────────────
  help:
    "ℹ️ *Yordam*\n\n" +
    "📌 *Buyruqlar:*\n" +
    "/start — Boshlash yoki ilovani ochish\n" +
    "/reset — Bog'lanishni uzib, boshidan boshlash\n" +
    "/help — Shu yordam\n\n" +
    "🔗 *Bog'lanish ikki yo'l bilan:*\n" +
    "1️⃣ Raqamingizni yuborish — markazdagi ro'yxat bilan solishtiriladi\n" +
    "2️⃣ Markazdan olingan bir martalik kodni yozish\n\n" +
    "❓ *Ilova ochilmayaptimi?* Telegram'ni eng oxirgi versiyaga " +
    "yangilang.\n\n" +
    "❓ *Raqamim topilmadi* — o'quv markaziga murojaat qiling, " +
    "ro'yxatdagi raqamni yangilashsin.",

  genericError: "❌ Xatolik yuz berdi. /start bosib qayta urining.",

  // ── Tugmalar ──────────────────────────────────────────────
  btnPhone: "📱 Raqamimni yuborish",
  btnOpen: "📊 Ilovani ochish",
  btnRelink: "🔄 Qayta bog'lanish",
  btnHelp: "ℹ️ Yordam",
  btnYes: "✅ Ha, uzilsin",
  btnNo: "◀️ Yo'q",
};

const RU = {
  welcome:
    "👋 *Здравствуйте!*\n\n" +
    "Через этого бота вы следите за успеваемостью ребёнка — " +
    "оценки, посещаемость, домашние задания и оплаты.\n\n" +
    "▶️ Чтобы начать, отправьте *свой номер* кнопкой ниже. " +
    "Номер сверяется со списком учебного центра.\n\n" +
    "_Если номер не найдётся — попросите в центре одноразовый код " +
    "и напишите его сюда._",

  linkedTitle: "✅ *Готово, вы подключены!*",
  linkedAlready: "✅ *Вы уже подключены*",
  linkedAfterLC: "Оценки, посещаемость и оплаты — в приложении.",
  linkedAfterFond: "Оплаты видны в приложении, напоминания придут сюда.",
  openHint: "\n\n_Приложение — кнопка ниже или меню ☰ слева._",

  notMyContact:
    "⚠️ Пожалуйста, отправьте *свой собственный* номер — кнопкой ниже.",
  phoneUnreadable: "⚠️ Не удалось прочитать номер. Попробуйте ещё раз.",
  phoneNotFound: (phone) =>
    `🔍 Номер *${phone}* не найден в списке.\n\n` +
    "Есть два пути:\n" +
    "1️⃣ Попросите в центре *одноразовый код* и напишите его сюда\n" +
    "2️⃣ Обратитесь в центр, чтобы обновили ваш номер",
  linkFailed: "⚠️ Ошибка при подключении. Обратитесь в учебный центр.",

  codeBad: "❌ Код неверный или просрочен.",
  codeHint:
    "Нажмите /start и отправьте свой номер.\n\n" +
    "Если у вас есть *одноразовый код* — напишите его сюда.",
  codeTooMany: (min) =>
    `🚫 Слишком много попыток. Повторите через *${min} мин*.`,

  resetAsk:
    "🔄 *Подключиться заново*\n\n" +
    "Текущее подключение будет разорвано, и всё начнётся сначала.\n\n" +
    "⚠️ Чтобы подключиться снова, ваш номер должен быть в списке " +
    "центра. Если вы подключались по коду — придётся попросить " +
    "*новый код*.\n\n" +
    "Продолжаем?",
  resetDone: "🔄 Подключение разорвано. Начинаем сначала.",
  resetNothing: "Подключения пока нет — начинаем сначала.",
  resetCancel: "Отменено. Всё осталось как было.",

  help:
    "ℹ️ *Помощь*\n\n" +
    "📌 *Команды:*\n" +
    "/start — Начать или открыть приложение\n" +
    "/reset — Разорвать подключение и начать сначала\n" +
    "/help — Эта справка\n\n" +
    "🔗 *Подключиться можно двумя способами:*\n" +
    "1️⃣ Отправить свой номер — сверяется со списком центра\n" +
    "2️⃣ Ввести одноразовый код, полученный в центре\n\n" +
    "❓ *Приложение не открывается?* Обновите Telegram до последней " +
    "версии.\n\n" +
    "❓ *Номер не найден* — обратитесь в учебный центр, чтобы " +
    "обновили номер в списке.",

  genericError: "❌ Произошла ошибка. Нажмите /start и попробуйте снова.",

  btnPhone: "📱 Отправить номер",
  btnOpen: "📊 Открыть приложение",
  btnRelink: "🔄 Подключиться заново",
  btnHelp: "ℹ️ Помощь",
  btnYes: "✅ Да, разорвать",
  btnNo: "◀️ Нет",
};

const PACKS = { uz: UZ, ru: RU };

/**
 * Telegram bergan til kodidan bizdagi tilga.
 * `ru`, `ru-RU`, `be`, `kk` → ruscha (mintaqada ruscha tushunarli).
 * Qolgani — o'zbekcha.
 */
function langOf(from) {
  const code = String(from?.language_code || "").toLowerCase();
  return /^(ru|be|kk|ky|uk)/.test(code) ? "ru" : "uz";
}

/**
 * @param {string} lang  "uz" | "ru"
 * @param {string} key
 * @param {...any} args  Matn funksiya bo'lsa unga uzatiladi
 */
function t(lang, key, ...args) {
  const pack = PACKS[lang] || UZ;
  const v = pack[key] !== undefined ? pack[key] : UZ[key];
  return typeof v === "function" ? v(...args) : v;
}

module.exports = { t, langOf, PACKS };
