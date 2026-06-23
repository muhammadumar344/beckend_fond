// src/bot/bot.js — TUZATILGAN (webhook path dagi ":" muammosi)
const TelegramBot = require("node-telegram-bot-api");

let bot = null;
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8551931126:AAFIuDbzMBZqSdiEWY1g8NaDhm0J-6mY4BA";

// ✅ XATO TUZATILDI: ":" belgisini "-" ga almashtiramiz,
// chunki Express ":" ni route parametri deb talqin qiladi
// va webhook so'rovni noto'g'ri qabul qiladi.
const SAFE_PATH_TOKEN = BOT_TOKEN.replace(/:/g, "-");

const initBot = (app) => {
  if (!BOT_TOKEN) {
    console.warn("⚠️  TELEGRAM_BOT_TOKEN topilmadi");
    return null;
  }

  try {
    const isProduction = process.env.NODE_ENV === "production";
    const webhookUrl = process.env.WEBHOOK_URL;

    if (isProduction && webhookUrl && app) {
      // ── PRODUCTION: Webhook mode ────────────────────────────
      bot = new TelegramBot(BOT_TOKEN, { webHook: { port: false } });

      // ✅ Xavfsiz yo'l — ":" belgisisiz
      const path = `/bot-webhook-${SAFE_PATH_TOKEN}`;
      const fullUrl = `${webhookUrl}${path}`;

      app.post(path, (req, res) => {
        try {
          bot.processUpdate(req.body);
        } catch (e) {
          console.error("processUpdate xatosi:", e.message);
        }
        // Har doim darhol 200 qaytarish — Telegram qayta urinishini oldini oladi
        res.sendStatus(200);
      });

      bot
        .setWebHook(fullUrl)
        .then(() => console.log(`✅ Webhook o'rnatildi: ${fullUrl}`))
        .catch((err) =>
          console.error("Webhook o'rnatish xatosi:", err.message),
        );

      _attachHandlers();
      console.log("🤖 @SchoolfondsBot ishga tushdi (webhook)");
      return bot;
    } else {
      // ── DEVELOPMENT: Polling mode ───────────────────────────
      bot = new TelegramBot(BOT_TOKEN, { polling: false });
      bot
        .deleteWebHook()
        .then(() => {
          bot = new TelegramBot(BOT_TOKEN, {
            polling: {
              interval: 300,
              autoStart: true,
              params: { timeout: 10 },
            },
          });
          _attachHandlers();
          console.log("🤖 @SchoolfondsBot polling mode da ishga tushdi");
        })
        .catch(() => {
          bot = new TelegramBot(BOT_TOKEN, { polling: true });
          _attachHandlers();
          console.log("🤖 @SchoolfondsBot ishga tushdi");
        });
      return bot;
    }
  } catch (err) {
    console.error("Bot ishga tushishda xato:", err.message);
    return null;
  }
};

const _attachHandlers = () => {
  if (!bot) return;

  const {
    handleStart,
    handleMessage,
    handleCallbackQuery,
  } = require("./handlers");

  bot.onText(/\/start/, (msg) => {
    console.log(`📨 /start — chatId: ${msg.chat.id}`);
    handleStart(bot, msg);
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `ℹ️ *Yordam*\n\n` +
        `Bu bot orqali maktab fond to'lovlari haqida eslatma olasiz.\n\n` +
        `📌 *Buyruqlar:*\n` +
        `/start — Ro'yxatdan o'tish\n` +
        `/help — Yordam\n\n` +
        `❓ Muammo bo'lsa o'qituvchingiz bilan bog'laning.`,
      { parse_mode: "Markdown" },
    );
  });

  bot.on("message", (msg) => {
    if (msg.text && !msg.text.startsWith("/")) {
      handleMessage(bot, msg);
    }
  });

  bot.on("callback_query", (query) => {
    handleCallbackQuery(bot, query);
  });

  bot.on("polling_error", (err) => {
    if (err?.response?.body?.error_code === 409) {
      console.warn("⚠️  Boshqa polling sessiya bor, bu o'chirildi");
      bot.stopPolling();
    } else {
      console.error("Polling xatosi:", err.message);
    }
  });

  bot.on("webhook_error", (err) => {
    console.error("Webhook xatosi:", err.message);
  });

  bot.on("error", (err) => {
    console.error("Bot xatosi:", err.message);
  });
};

const getBot = () => bot;

module.exports = { initBot, getBot, BOT_TOKEN };
