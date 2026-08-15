// src/bot/commands.js
// ════════════════════════════════════════════════════════════
// Ma'lumot buyruqlari — /grades, /attendance, /payments,
// /homework, /support.
//
// NEGA KERAK: ota-onaning katta qismi Mini App'ni ochmaydi.
// Telegram allaqachon ochiq turibdi, xabar ko'rinib turibdi.
// "/tolov" yozib bir soniyada javob olish — ilovaga kirib, tab
// tanlab, yuklanishini kutishdan tez. Ilova batafsil ko'rish
// uchun, bot esa "tez savol — tez javob" uchun.
//
// ⚠️ RUXSAT HAR BIR BOG'LANISH UCHUN ALOHIDA TEKSHIRILADI
//    (`canSee`). Isbotlanmagan (`legacy`) bog'lanish faqat
//    to'lovni ko'radi — bot orqali baho so'rab, Mini App'dagi
//    tekshiruvni aylanib o'tish yo'li ochilib qolmasin.
//
// ⚠️ Bir nechta farzand bo'lsa HAMMASI bitta xabarda chiqadi.
//    "Qaysi farzand?" deb so'rash — ortiqcha qadam; ota-ona
//    ikkalasini ham ko'rmoqchi.
// ════════════════════════════════════════════════════════════

const StudentLink = require("../models/StudentLink");
const Teacher = require("../models/Teacher");
const { canSee } = require("../utils/tmaAccess");
const digest = require("../services/studentDigest");
const { t, langOf } = require("./texts");

const MD = { parse_mode: "Markdown" };

const MONTHS = {
  uz: ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"],
  ru: ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"],
};

/** 1234567 → "1 234 567" */
const money = (n) =>
  String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** `2026-08-15` yoki Date → "15 avgust" */
function shortDate(d, lang) {
  const s = typeof d === "string" ? d : new Date(d).toISOString().slice(0, 10);
  const [, m, day] = s.split("-");
  const name = (MONTHS[lang] || MONTHS.uz)[Number(m) - 1] || "";
  return `${Number(day)} ${name}`;
}

// ── Bo'lim formatlari ───────────────────────────────────────
// Har biri o'quvchi bo'yicha bitta blok qaytaradi. Bo'sh
// bo'lsa — qisqa izoh (bo'sh joy qoldirmaymiz, aks holda
// ota-ona "yuklanmadimi?" deb o'ylaydi).

const RENDER = {
  async grades(studentId, lang) {
    const g = await digest.grades(studentId);
    if (!g.count) return `_${t(lang, "cmdNoGrades")}_`;

    const lines = [`${t(lang, "cmdAvg")}: *${g.overall}%* · ${t(lang, "cmdOfN", g.count)}`];

    // Eng past ikkita fan — ota-ona avval shuni qidiradi
    const weak = g.subjects.slice(0, 2);
    if (weak.length && g.subjects.length > 1) {
      lines.push(
        `${t(lang, "cmdWeakest")}: ` +
          weak.map((s) => `${s.subject} ${s.average}%`).join(", "),
      );
    }

    lines.push(
      `${t(lang, "cmdRecent")}: ` +
        g.recent
          .slice(0, 3)
          .map((r) => `${r.subject} ${r.score}/${r.max}`)
          .join(", "),
    );
    return lines.join("\n");
  },

  async attendance(studentId, lang) {
    const a = await digest.attendance(studentId);
    if (!a.total) return `_${t(lang, "cmdNoAttendance")}_`;

    const parts = [`✅ ${a.present} ${t(lang, "cmdAttPresent")}`];
    if (a.late) parts.push(`⏰ ${a.late} ${t(lang, "cmdAttLate")}`);
    if (a.absent) parts.push(`❗️ ${a.absent} ${t(lang, "cmdAttAbsent")}`);
    if (a.excused) parts.push(`📄 ${a.excused} ${t(lang, "cmdAttExcused")}`);

    return (
      (a.percent === null ? "" : `*${a.percent}%*\n`) + parts.join(" · ")
    );
  },

  async payments(studentId, lang) {
    const p = await digest.payments(studentId);
    if (!p.debt) return `_${t(lang, "cmdNoDebt")}_`;

    const months = p.unpaid
      .map((u) => `${(MONTHS[lang] || MONTHS.uz)[u.month - 1]} ${u.year}`)
      .join(", ");
    return (
      `${t(lang, "cmdDebt")}: *${money(p.debt)} ${t(lang, "cmdSum")}*\n` +
      `${months}`
    );
  },

  async homework(studentId, lang) {
    const h = await digest.homework(studentId);
    if (!h.pendingCount) return `_${t(lang, "cmdNoHomework")}_`;

    const head =
      `*${t(lang, "cmdHwPending", h.pendingCount)}*` +
      (h.overdueCount ? ` · ${h.overdueCount} ${t(lang, "cmdOverdue")}` : "");

    const list = h.pending
      .slice(0, 4)
      .map(
        (x) =>
          `• ${x.title}` +
          (x.subject ? ` (${x.subject})` : "") +
          ` — ${t(lang, "cmdDue")} ${shortDate(x.dueDate, lang)}` +
          (x.overdue ? " ⚠️" : ""),
      )
      .join("\n");

    return `${head}\n${list}`;
  },

  async support(studentId, lang) {
    const b = await digest.bookings(studentId);
    if (!b.upcoming.length && !b.recent.length) {
      return `_${t(lang, "cmdNoSupport")}_`;
    }

    if (b.upcoming.length) {
      const n = b.upcoming[0];
      return (
        `${t(lang, "cmdSupNext")}: *${shortDate(n.date, lang)}, ` +
        `${n.startTime}–${n.endTime}*` +
        (n.teacherName ? `\n👨‍🏫 ${n.teacherName}` : "") +
        (n.topic ? `\n📝 ${n.topic}` : "") +
        `\n\n_${t(lang, "cmdSupScan")}_`
      );
    }

    const r = b.recent[0];
    return `${shortDate(r.date, lang)}, ${r.startTime}–${r.endTime}`;
  },
};

const TITLE = {
  grades: "cmdGrades",
  attendance: "cmdAttendance",
  payments: "cmdPayments",
  homework: "cmdHomework",
  support: "cmdSupport",
};

/**
 * `canSee` bo'lim nomlari `RENDER` kalitlari bilan bir xil emas:
 * qo'shimcha mashg'ulot ruxsati "booking" deb yuritiladi.
 */
const ACCESS_SECTION = { support: "booking" };

/**
 * Buyruqni bajaradi.
 * @param {string} section  RENDER kalitlaridan biri
 */
async function handleDigest(bot, msg, section) {
  const chatId = msg.chat.id;
  const lang = langOf(msg.from);

  try {
    const links = await StudentLink.find({
      telegramUserId: String(msg.from.id),
      isActive: true,
    })
      .populate("student", "name")
      .lean();

    if (!links.length) {
      await bot.sendMessage(chatId, t(lang, "cmdNotLinked"));
      return;
    }

    const need = ACCESS_SECTION[section] || section;
    const allowed = links.filter((l) => l.student && canSee(l, need));

    if (!allowed.length) {
      await bot.sendMessage(chatId, t(lang, "cmdNoAccess"));
      return;
    }

    // ⚠️ Qo'shimcha mashg'ulot har markazda yo'q. Yoqilmagan
    //    bo'lsa "yozuv yo'q" deb aldash o'rniga sababini aytamiz —
    //    aks holda ota-ona ustozdan so'rab yuradi.
    if (section === "support") {
      const ids = [...new Set(allowed.map((l) => String(l.director)))];
      const on = await Teacher.countDocuments({
        _id: { $in: ids },
        supportEnabled: true,
      });
      if (!on) {
        await bot.sendMessage(chatId, t(lang, "cmdSupOff"));
        return;
      }
    }

    const blocks = [];
    for (const l of allowed) {
      const body = await RENDER[section](l.student._id, lang);
      blocks.push(`👤 *${l.student.name}*\n${body}`);
    }

    await bot.sendMessage(
      chatId,
      `${t(lang, TITLE[section])}\n\n${blocks.join("\n\n")}\n${t(lang, "cmdMore")}`,
      MD,
    );
  } catch (err) {
    console.error(`[bot] /${section} xatosi:`, err.message);
    await bot.sendMessage(chatId, t(lang, "genericError"));
  }
}

module.exports = { handleDigest, RENDER, shortDate, money };
