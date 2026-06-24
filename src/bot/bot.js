// src/bot/bot.js — WEBHOOK PATH BUG TUZATILDI + HYBRID MODE
const TelegramBot = require("node-telegram-bot-api");

let bot = null;
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8551931126:AAFIuDbzMBZqSdiEWY1g8NaDhm0J-6mY4BA";

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
      console.log("🤖 @SchoolfondsBot POLLING MODE DA ISHGA TUSHDI");
      console.log("📍 Bot /start buyrugini kutmoqda...");
    })
    .catch((err) => {
      console.error("⚠️  deleteWebHook xatosi:", err.message);
      console.log("Fallback: To'g'ri polling mode...");
      bot = new TelegramBot(BOT_TOKEN, { polling: true });
      _attachHandlers();
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
          `Bu bot orqali maktab fond to'lovlari haqida eslatma olasiz.\n\n` +
          `📌 *Buyruqlar:*\n` +
          `/start — Ro'yxatdan o'tish\n` +
          `/help — Yordam\n\n` +
          `❓ Muammo bo'lsa o'qituvchingiz bilan bog'laning.`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("Help xabar yuborish xatosi:", e.message);
    }
  });

  // Oddiy xabarlar (text)
  bot.on("message", (msg) => {
    if (msg.text && !msg.text.startsWith("/")) {
      console.log(`💬 Xabar: "${msg.text}" (chatId: ${msg.chat.id})`);
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
      console.warn("⚠️  Boshqa polling sessiya bor — o'chirish...");
      bot.stopPolling();
      setTimeout(() => startPolling(), 2000);
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
