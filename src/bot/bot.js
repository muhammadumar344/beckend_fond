// src/bot/bot.js — WEBHOOK PATH BUG TUZATILDI + HYBRID MODE + RETRY LOOP FIX
const TelegramBot = require("node-telegram-bot-api");

let bot = null;
let isRestarting = false; // ✅ YANGI: bir vaqtda bir nechta restart bo'lishini oldini olish

// ⚠️ TOKEN FAQAT ENV DAN. Ilgari shu yerda jonli token zaxira qiymat
//    sifatida YOZIB QO'YILGAN edi — ya'ni repozitoriyni ko'ra olgan
//    har kim botni to'liq boshqara olardi: xabar yuborish, o'qish,
//    ota-onalar ro'yxatini olish. Kod tarixida ham qolgan, shuning
//    uchun eski tokenni @BotFather → /revoke bilan BEKOR QILISH shart,
//    bu yerdan o'chirish yetarli emas.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// ✅ XATO TUZATILDI: ":" belgisini "-" ga almashtiramiz
const SAFE_PATH_TOKEN = BOT_TOKEN.replace(/:/g, "-");

const initBot = (app) => {
  if (!BOT_TOKEN) {
    console.warn("⚠️  TELEGRAM_BOT_TOKEN topilmadi");
    return null;
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
    handleContact,
    handleMessage,
    handleCallbackQuery,
  } = require("./handlers");

  console.log("✅ Handlerlari o'rnatilmoqda...");

  // /start command
  bot.onText(/\/start/, (msg) => {
    console.log(`📨 /start keldi — chatId: ${msg.chat.id}, username: ${msg.from.username || "N/A"}`);
    handleStart(bot, msg);
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    console.log(`📨 /help keldi — chatId: ${msg.chat.id}`);
    try {
      await bot.sendMessage(
        msg.chat.id,
        `ℹ️ *Yordam*\n\n` +
          `Bu bot orqali farzandingizning baholari, davomati va ` +
          `to'lovlarini kuzatasiz.\n\n` +
          `📌 *Buyruqlar:*\n` +
          `/start — Bog'lanish yoki ilovani ochish\n` +
          `/help — Yordam\n\n` +
          `🔗 *Bog'lanish ikki yo'l bilan:*\n` +
          `1️⃣ Raqamingizni yuborish — markazdagi ro'yxat bilan ` +
          `solishtiriladi\n` +
          `2️⃣ Markazdan olingan bir martalik kodni yozish\n\n` +
          `❓ Raqamingiz topilmasa — o'quv markaziga murojaat qiling.`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("Help xabar yuborish xatosi:", e.message);
    }
  });

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
  bot.on("polling_error", (err) => {
    console.error("📡 Polling xatosi:", err.message || err);
    if (err?.response?.body?.error_code === 409) {
      console.warn("⚠️  Boshqa polling sessiya bor (boshqa joyda shu bot ishlamoqda).");
      console.warn("⚠️  Agar bu local development bo'lsa — alohida test bot token ishlating!");
      bot.stopPolling();
      setTimeout(() => startPolling(), 3000); // ✅ 2s → 3s (kamroq tezkor retry)
    }
  });

  bot.on("webhook_error", (err) => {
    console.error("🌐 Webhook xatosi:", err.message);
  });

  bot.on("error", (err) => {
    console.error("❌ Bot xatosi:", err.message);
  });

  console.log("✅ Barcha handlerlari o'rnatildi");
};

const getBot = () => bot;

module.exports = { initBot, getBot, BOT_TOKEN };