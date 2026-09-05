// src/bot/bot.js — WEBHOOK PATH BUG TUZATILDI + HYBRID MODE + RETRY LOOP FIX
const TelegramBot = require("node-telegram-bot-api");

let bot = null;
let isRestarting = false; // ✅ YANGI: bir vaqtda bir nechta restart bo'lishini oldini olish

// 409 (boshqa nusxa polling qilyapti) necha marta ketma-ket keldi.
// Deploy paytida eski instansiya bir necha o'n soniya tirik qoladi —
// shuning uchun darrov taslim bo'lmaymiz, lekin cheksiz ham urinmaymiz.
let conflictCount = 0;
let lastConflictAt = 0;
const MAX_CONFLICT_RETRY = 10; // ~30 soniya (3s × 10)
const CONFLICT_FORGET_MS = 5 * 60 * 1000; // 5 daqiqa jim tursa — unutamiz

// Buyruqlar ro'yxati jarayon davomida bir marta yuboriladi
let commandsSent = false;

// ⚠️ TOKEN FAQAT ENV DAN. Ilgari shu yerda jonli token zaxira qiymat
//    sifatida YOZIB QO'YILGAN edi — ya'ni repozitoriyni ko'ra olgan
//    har kim botni to'liq boshqara olardi: xabar yuborish, o'qish,
//    ota-onalar ro'yxatini olish. Kod tarixida ham qolgan, shuning
//    uchun eski tokenni @BotFather → /revoke bilan BEKOR QILISH shart,
//    bu yerdan o'chirish yetarli emas.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// ✅ XATO TUZATILDI: ":" belgisini "-" ga almashtiramiz
const SAFE_PATH_TOKEN = BOT_TOKEN.replace(/:/g, "-");

/**
 * Token haqiqiyligini ishga tushishdan OLDIN tekshiradi.
 *
 * ⚠️ Bunisiz yaroqsiz token faqat polling boshlangach bilinardi va
 *    o'shanda ham "401 Unauthorized" oqimi ichida ko'milib ketardi.
 *    Endi deploy logining boshida bitta aniq qator turadi.
 *
 * Tarmoq ishlamasa `null` qaytaradi — bu holda bot baribir ishga
 * tushaveradi (tarmoq tiklanishi mumkin, token esa aybdor emas).
 */
const checkToken = (token) =>
  new Promise((resolve) => {
    const req = require("https").get(
      `https://api.telegram.org/bot${token}/getMe`,
      { timeout: 8000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(body);
            resolve(j.ok ? { ok: true, username: j.result.username } : { ok: false, reason: j.description });
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });

const initBot = async (app) => {
  if (!BOT_TOKEN) {
    console.warn("⚠️  TELEGRAM_BOT_TOKEN topilmadi — bot ishga tushmaydi");
    return null;
  }

  const check = await checkToken(BOT_TOKEN);
  if (check && !check.ok) {
    console.error(
      "\n❌ TELEGRAM TOKENI YAROQSIZ — bot ishga tushirilmaydi.\n" +
        `   Telegram javobi: ${check.reason}\n` +
        "   Render → Environment → TELEGRAM_BOT_TOKEN ni yangilang.\n",
    );
    return null;
  }
  if (check?.ok) {
    console.log(`✅ Bot tokeni to'g'ri — @${check.username}`);
  }

  try {
    const isProduction = process.env.NODE_ENV === "production";
    const webhookUrl = process.env.WEBHOOK_URL;
    const usePolling = process.env.BOT_POLLING === "true"; // ← ENV VARIABLE

    if (isProduction && webhookUrl && !usePolling && app) {
      // ── PRODUCTION: Webhook mode ────────────────────────────
      console.log("🌐 Webhook mode bilan ishlanmoqda...");
      bot = new TelegramBot(BOT_TOKEN, { webHook: { port: false } });

      const path = `/bot-webhook-${SAFE_PATH_TOKEN}`;
      const fullUrl = `${webhookUrl}${path}`;

      app.post(path, (req, res) => {
        try {
          bot.processUpdate(req.body);
        } catch (e) {
          console.error("processUpdate xatosi:", e.message);
        }
        res.sendStatus(200);
      });

      bot
        .setWebHook(fullUrl)
        .then(() => {
          console.log(`✅ Webhook o'rnatildi: ${fullUrl}`);
          _attachHandlers();
          console.log("🤖 @SchoolfondsBot webhook mode da ISHGA TUSHDI");
        })
        .catch((err) => {
          console.error("❌ Webhook o'rnatish xatosi:", err.message);
          console.log("⚠️  Polling mode ga o'tmoqda...");
          startPolling();
        });

      return bot;
    } else {
      // ── DEVELOPMENT / LOCAL: Polling mode ───────────────────────────
      console.log("📡 Polling mode bilan ishlanmoqda...");
      startPolling();
      return bot;
    }
  } catch (err) {
    console.error("❌ Bot ishga tushishda xato:", err.message);
    return null;
  }
};

const startPolling = () => {
  // ✅ YANGI: agar allaqachon restart jarayonida bo'lsak, qayta boshlamaymiz
  if (isRestarting) {
    console.log("⏭️  Restart allaqachon jarayonda, o'tkazib yuborildi");
    return;
  }
  isRestarting = true;

  // ✅ Eski bot bo'lsa, listenerlarni tozalaymiz (xotira tirqishi oldini olish)
  if (bot) {
    bot.removeAllListeners();
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: false });

  bot
    .deleteWebHook()
    .then(() => {
      console.log("✅ Webhook o'chirildi, polling boshlanmoqda...");
      bot = new TelegramBot(BOT_TOKEN, {
        polling: {
          interval: 1000, // 1 sekunda
          autoStart: true,
          params: { timeout: 10 },
        },
      });
      _attachHandlers();
      isRestarting = false; // ✅ Muvaffaqiyatli tugadi
      console.log("🤖 @SchoolfondsBot POLLING MODE DA ISHGA TUSHDI");
      console.log("📍 Bot /start buyrugini kutmoqda...");
    })
    .catch((err) => {
      console.error("⚠️  deleteWebHook xatosi:", err.message);
      console.log("Fallback: To'g'ri polling mode...");
      bot = new TelegramBot(BOT_TOKEN, { polling: true });
      _attachHandlers();
      isRestarting = false;
      console.log("🤖 @SchoolfondsBot FALLBACK POLLING MODE DA");
    });
};

const _attachHandlers = () => {
  if (!bot) {
    console.error("❌ Bot null, handler qo'sha olamadim");
    return;
  }

  const {
    handleStart,
    handleHelp,
    handleReset,
    handleContact,
    handleMessage,
    handleCallbackQuery,
  } = require("./handlers");
  const { langOf } = require("./texts");

  console.log("✅ Handlerlari o'rnatilmoqda...");

  // ⚠️ `^` MUHIM. Ilgari shablon `/\/start/` edi va u matnning
  //    ISTALGAN joyidan mos kelardi: "kecha /start bosdim, ishlamadi"
  //    deb yozgan odamga bot boshlang'ich ekranni qaytarardi.
  bot.onText(/^\/start(?:@\w+)?(?:\s|$)/, (msg) => {
    console.log(`📨 /start — chatId: ${msg.chat.id}`);
    handleStart(bot, msg);
  });

  bot.onText(/^\/help(?:@\w+)?(?:\s|$)/, (msg) => {
    handleHelp(bot, msg.chat.id, langOf(msg.from));
  });

  // ⚠️ YANGI. Ilgari bog'langan odam uchun orqaga yo'l umuman
  //    yo'q edi — /start faqat "siz bog'langansiz" deb qaytarardi.
  bot.onText(/^\/reset(?:@\w+)?(?:\s|$)/, (msg) => {
    console.log(`📨 /reset — chatId: ${msg.chat.id}`);
    handleReset(bot, msg);
  });

  // ── Ma'lumot buyruqlari ───────────────────────────────────
  // ⚠️ Har biriga O'ZBEKCHA taxallus ham bor. Buyruqning asosiy
  //    nomi inglizcha, chunki Telegram bitta bot uchun bitta
  //    nom saqlaydi — tarjima faqat IZOHIGA tegishli. Menyudan
  //    bosadigan odam farqni sezmaydi, qo'lda yozadigan odam
  //    esa o'zbekchasini yozishi tabiiy. Ikkalasi ham ishlasin.
  const { handleDigest } = require("./commands");
  const DIGEST = [
    ["grades", "baholar", "baho"],
    ["attendance", "davomat"],
    ["payments", "tolov", "tolovlar"],
    ["homework", "vazifa", "uyvazifasi"],
    ["support", "mashgulot", "qoshimcha"],
  ];
  for (const [section, ...aliases] of DIGEST) {
    const names = [section, ...aliases].join("|");
    bot.onText(new RegExp(`^\\/(?:${names})(?:@\\w+)?(?:\\s|$)`), (msg) => {
      handleDigest(bot, msg, section);
    });
  }

  // ⚠️ Raqam MATNDAN OLDIN tekshiriladi: kontakt xabarida `text`
  //    bo'lmaydi, lekin tartib chalkashsa oson yo'qolib qoladi.
  bot.on("contact", (msg) => {
    console.log(`📱 Raqam keldi — chatId: ${msg.chat.id}`);
    handleContact(bot, msg);
  });

  // Oddiy xabarlar (text) — taklif kodi shu yerdan o'tadi
  bot.on("message", (msg) => {
    if (msg.contact) return; // yuqoridagi handler ushlaydi
    if (msg.text && !msg.text.startsWith("/")) {
      handleMessage(bot, msg);
    }
  });

  // Tugma click'lari
  bot.on("callback_query", (query) => {
    console.log(`🔘 Callback: ${query.data} (chatId: ${query.message.chat.id})`);
    handleCallbackQuery(bot, query);
  });

  // Xatolar
  let lastPollingError = 0;

  bot.on("polling_error", (err) => {
    const code = err?.response?.body?.error_code;

    // ⚠️ 401 = token YAROQSIZ (revoke qilingan yoki xato ko'chirilgan).
    //    Bu O'TKINCHI xato EMAS — qayta urinish hech qachon yordam
    //    bermaydi. Ilgari kutubxona uni sekundiga bir marta qayta
    //    urinib, logni "401 Unauthorized" bilan to'ldirib tashlardi
    //    va haqiqiy sabab o'sha oqim ichida ko'rinmay ketardi.
    if (code === 401) {
      bot.stopPolling();
      console.error(
        "\n❌ TELEGRAM TOKENI YAROQSIZ (401).\n" +
          "   Bot to'xtatildi — qayta urinishning foydasi yo'q.\n" +
          "   Sabab: token @BotFather da /revoke qilingan yoki\n" +
          "   muhitga xato ko'chirilgan.\n" +
          "   Yechim: Render → Environment → TELEGRAM_BOT_TOKEN ni\n" +
          "   yangilang va qayta deploy qiling.\n" +
          "   Tekshirish: https://api.telegram.org/bot<TOKEN>/getMe\n",
      );
      return;
    }

    // ⚠️ 409 = shu tokenni BOSHQA jarayon ham polling qilyapti.
    //
    //    Ilgari bu yerda cheksiz halqa bor edi: har 3 soniyada
    //    qayta urinish → `_attachHandlers()` → Telegram'ga yana
    //    ikkita `setMyCommands`. Jonli logda bu har ~13 soniyada
    //    to'liq "ishga tushdi" bloki bo'lib takrorlanardi va
    //    tashqaridan SERVER QAYTA ISHGA TUSHAYOTGANDEK ko'rinardi.
    //    Ya'ni haqiqiy sabab (ikkinchi nusxa) log ichida ko'milib
    //    ketardi.
    //
    //    Endi: deploy paytidagi qoplanish (~30s) uchun bir necha
    //    marta urinamiz, keyin 401 bilan bir xil qoida — to'xtaymiz
    //    va SABABNI aytamiz. Qayta urinishning foydasi yo'q:
    //    ikkinchi nusxa o'zi yopilmaguncha 409 ketavermaydi.
    if (code === 409) {
      // ⚠️ Hisoblagich polling BOSHLANGANDA nolga tushirilmaydi va
      //    bu ataylab: 409 aynan polling boshlangandan KEYIN keladi,
      //    ya'ni u yerda nollasak sanoq hech qachon oshmasdi va
      //    halqa yana cheksiz bo'lardi.
      //
      //    O'rniga VAQT bo'yicha unutamiz: bot bir necha daqiqa
      //    tinch ishlagan bo'lsa, keyingi 409 — yangi hodisa
      //    (masalan ertangi deploy), eskisining davomi emas.
      const now = Date.now();
      if (now - lastConflictAt > CONFLICT_FORGET_MS) conflictCount = 0;
      lastConflictAt = now;

      conflictCount += 1;
      bot.stopPolling();

      if (conflictCount > MAX_CONFLICT_RETRY) {
        console.error(
          "\n❌ BOT TO'XTATILDI — shu tokenni boshqa jarayon polling qilyapti (409).\n" +
            `   ${MAX_CONFLICT_RETRY} marta urinildi, har safar o'sha xato.\n` +
            "   Qayta urinishning foydasi yo'q: ikkinchi nusxa yopilmaguncha\n" +
            "   Telegram bizga yangilanish bermaydi.\n\n" +
            "   Sabablari (ehtimollik bo'yicha):\n" +
            "   1. Server LOKAL ko'tarilgan va o'sha .env dagi PRODUCTION\n" +
            "      tokenni ishlatyapti → lokalda alohida test bot oching\n" +
            "      (@BotFather → /newbot) va uni .env ga qo'ying.\n" +
            "   2. Render'da eski instansiya hali o'chmagan → Manual\n" +
            "      Deploy → 'Clear build cache & deploy'.\n\n" +
            "   Kim polling qilayotganini ko'rish:\n" +
            "   https://api.telegram.org/bot<TOKEN>/getWebhookInfo\n\n" +
            "   ⚠️ CRM va API ISHLAYVERADI — faqat Telegram bot jim.\n",
        );
        return;
      }

      console.warn(
        `⚠️  Boshqa polling sessiya bor (409) — urinish ${conflictCount}/${MAX_CONFLICT_RETRY}.`,
      );
      setTimeout(() => startPolling(), 3000);
      return;
    }

    // Qolgan xatolar (tarmoq uzilishi va h.k.) — o'tkinchi bo'lishi
    // mumkin, lekin logni bosib ketmasin: 30 soniyada bir marta
    const now = Date.now();
    if (now - lastPollingError > 30000) {
      lastPollingError = now;
      console.error("📡 Polling xatosi:", err.message || err);
    }
  });

  bot.on("webhook_error", (err) => {
    console.error("🌐 Webhook xatosi:", err.message);
  });

  bot.on("error", (err) => {
    console.error("❌ Bot xatosi:", err.message);
  });

  // ⚠️ Buyruqlar ro'yxati Telegram'ning "/" menyusida ko'rinadi.
  //    Ilgari sozlanmagan edi — foydalanuvchi /reset borligini
  //    bilishning imkoni yo'q edi, chunki uni hech qayerda
  //    ko'rsatmasdik. Bu bir marta yuboriladi va Telegram'da
  //    saqlanib qoladi.
  //
  // ⚠️ Tartib MUHIM: menyuda shu ketma-ketlikda chiqadi. Eng
  //    ko'p so'raladigani yuqorida — /reset esa pastda, chunki
  //    u kamdan-kam kerak bo'ladi va tasodifan bosilmasin.
  const commands = {
    uz: [
      { command: "start", description: "Boshlash / ilovani ochish" },
      { command: "grades", description: "Baholar" },
      { command: "attendance", description: "Davomat (shu oy)" },
      { command: "homework", description: "Uy vazifasi" },
      { command: "payments", description: "To'lovlar va qarz" },
      { command: "support", description: "Qo'shimcha mashg'ulot" },
      { command: "help", description: "Yordam" },
      { command: "reset", description: "Bog'lanishni uzib, boshidan" },
    ],
    ru: [
      { command: "start", description: "Начать / открыть приложение" },
      { command: "grades", description: "Оценки" },
      { command: "attendance", description: "Посещаемость (этот месяц)" },
      { command: "homework", description: "Домашние задания" },
      { command: "payments", description: "Оплаты и задолженность" },
      { command: "support", description: "Дополнительное занятие" },
      { command: "help", description: "Помощь" },
      { command: "reset", description: "Отключиться и начать сначала" },
    ],
  };
  // ⚠️ JARAYON UCHUN BIR MARTA. Ro'yxat Telegram tomonida
  //    saqlanadi va o'zgarmaydi, `_attachHandlers()` esa har bir
  //    qayta ulanishda chaqiriladi — ya'ni busiz har 13 soniyada
  //    ikkita foydasiz API chaqiruvi ketardi (Telegram
  //    `setMyCommands` ni cheklaydi ham).
  if (!commandsSent) {
    commandsSent = true;
    bot
      .setMyCommands(commands.uz)
      .then(() => bot.setMyCommands(commands.ru, { language_code: "ru" }))
      .then(() => console.log("✅ Buyruqlar ro'yxati o'rnatildi (uz, ru)"))
      .catch((e) => {
        commandsSent = false; // yiqildi — keyingi ulanishda qayta urinsin
        console.warn("⚠️  setMyCommands:", e.message);
      });
  }

  console.log("✅ Barcha handlerlari o'rnatildi");
};

const getBot = () => bot;

module.exports = { initBot, getBot, BOT_TOKEN };