// src/controllers/supportController.js
// ════════════════════════════════════════════════════════════
// Qo'shimcha mashg'ulot — CRM tomoni.
//
// Ustoz/xodim shu yerdan qabul vaqtini belgilaydi va kelgan
// yozuvlarni tasdiqlaydi. O'quvchi tomoni — tmaController.js
// ════════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const SupportBooking = require("../models/SupportBooking");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Class = require("../models/Class");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const { freeSlots, toMin, normalizeHours } = require("../utils/supportSlots");
const { notifyBooking, inBackground } = require("../services/notify");
const { currentToken, WINDOW_SEC } = require("../services/supportQr");
const svc = require("../services/supportBooking");
const {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  qrWindow,
  todayInTashkent,
  addDays,
} = require("../utils/supportWindow");

const DAY_NAMES = [
  "Dushanba", "Seshanba", "Chorshanba",
  "Payshanba", "Juma", "Shanba", "Yakshanba",
];

const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));

/**
 * Kim support sozlamasini o'zgartira oladi.
 *
 * ⚠️ Direktordan tashqari FILIAL BOSHQARUVCHISI ham. "Support
 *    ishchisi bormi va u qachon ishlaydi" — kadr masalasi, uni
 *    kunda hal qiladigan odam filialda o'tiradi. Direktorni har
 *    safar bezovta qilish oqim sekinlashtiradi va oxir-oqibat
 *    hech kim sozlamaydi.
 *
 * ⚠️ Oddiy ustozda bu ruxsat YO'Q — aks holda support ustozining
 *    o'zi ish vaqtini qisqartirib, o'zini yozilishdan yashira
 *    olardi. Aynan shu narsa eski "qabul vaqti" modelining
 *    kamchiligi edi.
 */
const canManageSupport = (ctx) =>
  Boolean(ctx.isDirector || ctx.permissions?.includes("manageStaff"));

// ══ MARKAZ SOZLAMASI ════════════════════════════════════════
// ⚠️ Bu ikkalasi `requireSupport` dan O'TMAYDI — o'chirilgan
//    xizmatni qayta yoqish uchun yo'l ochiq qolishi kerak.

// GET /api/lc/support/settings
exports.getSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const director = await Teacher.findById(ctx.directorId)
      .select("supportEnabled supportHours")
      .lean();

    // ⚠️ Support ustozlari ro'yxati ham qaytariladi. Sabab:
    //    xizmatni yoqish YETARLI EMAS — o'quvchiga ro'yxat
    //    rolga qarab tuziladi, ya'ni "Support Teacher" rolidagi
    //    xodim bo'lmasa o'quvchi bo'sh ekran ko'radi. Direktor
    //    buni sozlamalar sahifasidayoq bilsin, o'quvchi
    //    shikoyat qilgandan keyin emas.
    const { listSupportStaff } = require("../services/supportStaff");
    const staff = await listSupportStaff({
      directorId: ctx.directorId,
      branchId: ctx.branchFilter || null,
    });

    res.json({
      success: true,
      enabled: Boolean(director?.supportEnabled),
      // ⚠️ Filial boshqaruvchisi ham tahrirlay oladi. Sabab:
      //    "support ishchisi bormi va u qachon ishlaydi" — bu
      //    KADR masalasi, direktor har safar aralashib o'tirmasin.
      //    Shu sababli `manageStaff` ruxsati tanlandi: filial
      //    boshqaruvchisida bor, oddiy ustozda yo'q.
      canEdit: canManageSupport(ctx),
      staff,
      // ⚠️ Eski hujjatlarda `supportHours` umuman bo'lmasligi
      //    mumkin — Mongoose standart qiymatni O'QISHDA qo'shmaydi.
      //    `normalizeHours` bo'sh maydonlarni to'ldiradi.
      hours: normalizeHours(director?.supportHours),
      dayNames: DAY_NAMES,
      // Interfeys "ertadan 7 kungacha" deb yozib qo'yishi uchun
      window: {
        minDaysAhead: MIN_DAYS_AHEAD,
        maxDaysAhead: MAX_DAYS_AHEAD,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// PUT /api/lc/support/settings  { enabled, hours }
exports.updateSettings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    // ⚠️ Route darajasidagi ruxsat yetarli emas: `allowTeacherOrStaff`
    //    har qanday xodimni o'tkazadi. Aynan kim o'zgartira olishi
    //    shu yerda hal qilinadi.
    if (!canManageSupport(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Bu sozlamani direktor yoki filial boshqaruvchisi o'zgartiradi",
      });
    }

    const director = await Teacher.findById(ctx.directorId);
    if (!director) {
      return res.status(404).json({ success: false, error: "Teacher topilmadi" });
    }

    if (req.body?.enabled !== undefined) {
      director.supportEnabled = Boolean(req.body.enabled);
    }

    // ── Ish vaqti ────────────────────────────────────────────
    // ⚠️ Bu MARKAZ sozlamasi, ustozniki emas. Support ustozi
    //    qachon qabul qilishini tanlamaydi — ish vaqti davomida
    //    qabul har doim ochiq.
    if (req.body?.hours) {
      const h = req.body.hours;
      const cur = normalizeHours(director.supportHours);

      const start = h.start ?? cur.start;
      const end = h.end ?? cur.end;
      const slotMinutes = Number(h.slotMinutes ?? cur.slotMinutes);
      const days = Array.isArray(h.days) ? h.days.map(Number) : cur.days;

      if (!isTime(start) || !isTime(end)) {
        return res.status(400).json({
          success: false,
          error: "Vaqt HH:MM formatida bo'lsin",
        });
      }
      if (toMin(end) <= toMin(start)) {
        return res.status(400).json({
          success: false,
          error: "Tugash vaqti boshlanishdan keyin bo'lsin",
        });
      }
      if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 120) {
        return res.status(400).json({
          success: false,
          error: "Uchrashuv davomiyligi 10–120 daqiqa oralig'ida",
        });
      }
      if (toMin(end) - toMin(start) < slotMinutes) {
        return res.status(400).json({
          success: false,
          error: "Ish vaqti bitta uchrashuvga ham yetmaydi",
        });
      }
      if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return res.status(400).json({
          success: false,
          error: "Kamida bitta ish kuni tanlansin",
        });
      }

      director.supportHours = {
        start,
        end,
        slotMinutes,
        days: [...new Set(days)].sort((a, b) => a - b),
      };
    }

    await director.save();

    // ⚠️ O'chirilganda mavjud yozuvlar TEGILMAYDI. Ular tarixda
    //    qoladi va o'quvchilar allaqachon kelishga rozi bo'lgan.
    //    Yangi yozilish esa `requireSupport` bilan to'siladi.
    //
    // ⚠️ Ish vaqti QISQARTIRILGANDA ham mavjud yozuvlar qoladi.
    //    Ular o'quvchi bilan kelishilgan va bekor qilinsa,
    //    o'quvchi sababini bilmay qolardi. Xodim kerak bo'lsa
    //    yozuvlar ro'yxatidan qo'lda bekor qiladi.
    res.json({
      success: true,
      enabled: director.supportEnabled,
      hours: normalizeHours(director.supportHours),
      message: "Saqlandi",
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ══ QABUL VAQTLARI YO'Q ═════════════════════════════════════
//
// ⚠️ `getSlots` / `createSlot` / `deleteSlot` OLIB TASHLANDI va
//    `SupportSlot` modeli ham o'chirildi.
//
//    Sabab: support ustozi — shu ish uchun alohida olingan odam.
//    U qachon qabul qilishini TANLAMAYDI: markazning ish vaqti
//    davomida qabul har doim ochiq, faqat boshqa o'quvchi band
//    qilgan 30 daqiqa bandligicha qoladi.
//
//    Eski modelda ustoz qabul vaqti belgilamasa — o'quvchi uni
//    umuman ko'rmasdi. Ya'ni ishga olingan odam hech narsa
//    qilmasdan o'zini ro'yxatdan yashirib qo'ya olardi.
//
//    Ish vaqti endi markaz darajasida: `Teacher.supportHours`
//    (yuqoridagi `updateSettings`).

// ══ YOZUVLAR ════════════════════════════════════════════════

// GET /api/lc/support/bookings?date=&status=
exports.getBookings = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const query = { director: ctx.directorId };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;
    if (!ctx.isDirector && !ctx.permissions?.includes("manageGroups")) {
      query.teacher = ctx.staffId;
    }
    if (req.query.date) query.date = req.query.date;
    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const bookings = await SupportBooking.find(query)
      .populate("student", "name")
      .populate("teacher", "name")
      .sort({ date: -1, startTime: 1 })
      .limit(200)
      .lean();

    res.json({ success: true, bookings });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// PUT /api/lc/support/bookings/:bookingId
// Body: { status, note }
exports.updateBooking = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { status, note } = req.body;

    const allowed = ["confirmed", "cancelled", "done", "no_show"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Holat noto'g'ri" });
    }

    const booking = await SupportBooking.findOne({
      _id: req.params.bookingId,
      director: ctx.directorId, // ⚠️ boshqa markazning yozuviga tegmasin
    });
    if (!booking) {
      return res.status(404).json({ success: false, error: "Yozuv topilmadi" });
    }
    if (String(booking.teacher) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }

    const before = booking.status;

    // ⚠️ BEKOR QILISH QOIDASI SERVISDA. Bu yerda u qo'lda
    //    takrorlangan edi va bitta shartni yo'qotgan: servis
    //    faqat FAOL yozuvni (`pending`/`confirmed`) bekor
    //    qiladi, bu yer esa istalganini. Ya'ni o'quvchi kelib,
    //    QR skanerlab `done` bo'lgan yozuvni ham "bekor qilindi"
    //    ga o'tkazish mumkin edi — kelgani haqidagi yozuv
    //    yo'qolardi.
    if (status === "cancelled") {
      const r = await svc.cancelBooking({ bookingId: booking._id, by: "crm" });
      if (!r.ok) {
        return res.status(r.status || 400).json({ success: false, error: r.error });
      }
      if (note !== undefined) {
        r.booking.note = String(note).slice(0, 300);
        await r.booking.save();
      }
      // ⚠️ Ota-onaga xabar — faqat holat HAQIQATAN o'zgargan bo'lsa
      if (before !== "cancelled") {
        inBackground(notifyBooking, {
          directorId: ctx.directorId,
          bookingId: booking._id,
          status: "cancelled",
        });
      }
      return res.json({ success: true, booking: r.booking });
    }

    if (status) booking.status = status;
    if (note !== undefined) booking.note = String(note).slice(0, 300);
    await booking.save();

    // Holat o'zgargandagina xabar — izoh tahriri uchun emas.
    // (`cancelled` yuqorida, servis yo'lida hal qilinadi.)
    if (status && status !== before && status === "confirmed") {
      inBackground(notifyBooking, {
        directorId: ctx.directorId,
        bookingId: booking._id,
        status,
      });
    }

    res.json({ success: true, booking });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ── GET /api/lc/support/bookings/:bookingId/qr ──────────────
// Ustoz o'quvchi kartochkasini bosganda ochiladigan QR.
// Interfeys buni har ~10 soniyada qayta so'raydi.
exports.getQr = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const booking = await SupportBooking.findOne({
      _id: req.params.bookingId,
      director: ctx.directorId,
    });
    if (!booking) {
      return res.status(404).json({ success: false, error: "Yozuv topilmadi" });
    }
    if (String(booking.teacher) !== String(ctx.staffId)) {
      requirePermission(ctx, "manageGroups");
    }
    if (booking.attendedAt) {
      return res.json({
        success: true,
        alreadyAttended: true,
        attendedAt: booking.attendedAt,
      });
    }
    if (!["pending", "confirmed"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, error: "Bu yozuv uchun QR berilmaydi" });
    }

    // ⚠️ MASHG'ULOT BOSHLANMAGUNCHA QR YO'Q. Aks holda o'quvchi
    //    ertalab kirib, kechqurungi mashg'ulotini "keldim" qilib
    //    ketardi — QR ning butun ma'nosi aynan o'sha 30 daqiqada,
    //    aynan o'sha xonada bo'lishida.
    //
    //    Xato emas, 200 qaytariladi: interfeys sanoqni ko'rsatsin
    //    ("13:00 da ochiladi"), qizil xato chiqarmasin.
    const w = qrWindow(booking);
    if (!w.open) {
      return res.json({
        success: true,
        notYet: !w.expired,
        expired: w.expired,
        opensAt: new Date(w.opensAt).toISOString(),
        closesAt: new Date(w.closesAt).toISOString(),
        secondsUntilOpen: w.secondsUntilOpen,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }

    const t = currentToken(String(booking._id));
    res.json({
      success: true,
      payload: t.payload,
      expiresIn: t.expiresIn,
      windowSec: WINDOW_SEC,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// GET /api/lc/support/free?teacherId=&date=
// Xodim CRM'dan o'quvchi nomidan yozib qo'yishi uchun
exports.getFree = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const { teacherId, date } = req.query;
    if (!teacherId || !date) {
      return res.status(400).json({ success: false, error: "teacherId va date majburiy" });
    }

    const slots = await freeSlots({
      directorId: ctx.directorId,
      teacherId,
      date,
    });
    res.json({ success: true, date, slots });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// POST /api/lc/support/bookings — xodim o'quvchi nomidan yozadi
exports.createBooking = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageStudents");

    const { studentId, teacherId, date, startTime, topic } = req.body;
    if (!studentId || !teacherId || !date || !startTime) {
      return res.status(400).json({
        success: false,
        error: "studentId, teacherId, date, startTime majburiy",
      });
    }

    const student = await Student.findById(studentId).select("name");
    if (!student) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    }

    // Yozilish qoidalari servisda — CRM va Mini App uchun bitta
    const result = await svc.bookSlot({
      directorId: ctx.directorId,
      studentId,
      teacherId,
      date,
      startTime,
      topic,
      via: "crm",
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    // Xodim yozganda darhol tasdiqlangan hisoblanadi
    result.booking.status = "confirmed";
    await result.booking.save();

    res.status(201).json({ success: true, booking: result.booking });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ══ USTOZ KUNI ══════════════════════════════════════════════

// GET /api/lc/support/today
//
// Support ustozining bosh ekrani: bugun kim keladi va nima
// so'raydi.
//
// ⚠️ ERTANGI KUN HAM QAYTARILADI va bu ataylab. O'quvchi kamida
//    bir kun oldin yoziladi va MAVZUNI yozib qoldiradi — butun
//    g'oyaning ma'nosi ustoz shunga TAYYORLANISHIDA. Tayyorlanish
//    esa kechqurun bo'ladi, ertalab emas. Faqat bugungi ro'yxatni
//    ko'rsatsak, ustoz mavzuni o'quvchi eshikdan kirganda o'qirdi.
exports.getToday = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const today = todayInTashkent();
    const tomorrow = addDays(today, 1);

    const query = {
      director: ctx.directorId,
      date: { $in: [today, tomorrow] },
      // Bekor qilinganlar ro'yxatni chalg'itadi
      status: { $in: ["pending", "confirmed", "done", "no_show"] },
    };
    if (ctx.branchFilter) query.branch = ctx.branchFilter;

    // ⚠️ Xodim O'Z ro'yxatini ko'radi. Boshqalarnikini ko'rish
    //    uchun `manageGroups` kerak — aks holda har bir ustoz
    //    hammaning kunini ko'rardi.
    if (!ctx.isDirector && !ctx.permissions?.includes("manageGroups")) {
      query.teacher = ctx.staffId;
    }

    const rows = await SupportBooking.find(query)
      .populate("student", "name class")
      .populate("teacher", "name")
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Guruh nomlari — ustoz "qaysi guruhdan" ekanini bilsin
    const classIds = [
      ...new Set(rows.map((r) => r.student?.class).filter(Boolean).map(String)),
    ];
    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } }).select("name").lean()
      : [];
    const className = new Map(classes.map((c) => [String(c._id), c.name]));

    const shape = (b) => {
      const w = qrWindow(b);
      return {
        id: b._id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        topic: b.topic || "",
        note: b.note || "",
        attendedAt: b.attendedAt || null,
        studentName: b.student?.name || "—",
        className: className.get(String(b.student?.class)) || "",
        teacherName: b.teacher?.name || "",
        // Interfeys QR tugmasini shu asosda yoqadi/o'chiradi
        qr: {
          open: w.open,
          expired: w.expired,
          secondsUntilOpen: w.secondsUntilOpen,
        },
      };
    };

    const all = rows.map(shape);
    const todayRows = all.filter((r) => r.date === today);

    res.json({
      success: true,
      today,
      tomorrow,
      bookings: todayRows,
      tomorrowBookings: all.filter((r) => r.date === tomorrow),
      summary: {
        total: todayRows.length,
        waiting: todayRows.filter((r) =>
          ["pending", "confirmed"].includes(r.status),
        ).length,
        done: todayRows.filter((r) => r.status === "done").length,
        noShow: todayRows.filter((r) => r.status === "no_show").length,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// ══ TARIX / STATISTIKA ══════════════════════════════════════

// GET /api/lc/support/stats?teacherId=&months=6
//
// "Bu oy nechta o'quvchiga yordam berdim?" — hafta va oy kesimida.
//
// ⚠️ ALOHIDA JADVALGA YOZILMAYDI. Raqamlar har safar yozuvlardan
//    hisoblanadi. Sabab: sanagichni alohida saqlasak, yozuv qo'lda
//    tuzatilganda (xodim "kelmadi" ni "bo'ldi" ga o'zgartirsa)
//    sanagich eskirib qolardi va ikkita raqam bir-biriga zid
//    bo'lardi. Yozuvlarning o'zi — tarix.
//
// ⚠️ "Nechta o'quvchi" va "nechta mashg'ulot" BOSHQA-BOSHQA raqam:
//    bitta o'quvchi oyiga to'rt marta kelishi mumkin. Ikkalasi ham
//    qaytariladi — direktorga birinchisi, ustozga ikkinchisi
//    qiziq bo'ladi.
exports.getStats = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const today = todayInTashkent();
    const from = addDays(today, -Math.round(months * 30.5));

    const match = { director: ctx.directorId, date: { $gte: from } };
    if (ctx.branchFilter) match.branch = ctx.branchFilter;

    // Xodim o'z raqamlarini ko'radi; boshqalarniki uchun ruxsat kerak
    if (!ctx.isDirector && !ctx.permissions?.includes("manageGroups")) {
      match.teacher = ctx.staffId;
    } else if (req.query.teacherId) {
      match.teacher = new mongoose.Types.ObjectId(String(req.query.teacherId));
    }

    // ⚠️ Bitta so'rov, ikkita kesim. Har bir guruh uchun noyob
    //    o'quvchilar to'plami ham yig'iladi — keyin JS da
    //    birlashtiriladi (holat bo'yicha ajratilgani uchun).
    const group = (id) => [
      { $match: match },
      { $addFields: { _d: { $dateFromString: { dateString: "$date" } } } },
      {
        $group: {
          _id: { ...id, status: "$status" },
          n: { $sum: 1 },
          students: { $addToSet: "$student" },
        },
      },
    ];

    const [byMonth, byWeek] = await Promise.all([
      SupportBooking.aggregate(
        group({ y: { $year: "$_d" }, m: { $month: "$_d" } }),
      ),
      SupportBooking.aggregate(
        group({ y: { $isoWeekYear: "$_d" }, w: { $isoWeek: "$_d" } }),
      ),
    ]);

    /** Holat bo'yicha bo'lingan qatorlarni bitta davrga yig'adi */
    const fold = (rows, keyOf, labelOf) => {
      const out = new Map();
      for (const r of rows) {
        const key = keyOf(r._id);
        if (!out.has(key)) {
          out.set(key, {
            key,
            label: labelOf(r._id),
            total: 0,
            done: 0,
            noShow: 0,
            cancelled: 0,
            _students: new Set(),
          });
        }
        const b = out.get(key);
        b.total += r.n;
        if (r._id.status === "done") {
          b.done += r.n;
          // "Nechta o'quvchiga yordam berdi" — faqat kelganlar
          for (const s of r.students) b._students.add(String(s));
        }
        if (r._id.status === "no_show") b.noShow += r.n;
        if (r._id.status === "cancelled") b.cancelled += r.n;
      }
      return [...out.values()]
        .map(({ _students, ...b }) => ({ ...b, students: _students.size }))
        .sort((a, b) => a.key.localeCompare(b.key));
    };

    const pad = (n) => String(n).padStart(2, "0");
    const monthly = fold(
      byMonth,
      (id) => `${id.y}-${pad(id.m)}`,
      (id) => `${MONTH_NAMES[id.m - 1]} ${id.y}`,
    );
    const weekly = fold(
      byWeek,
      (id) => `${id.y}-W${pad(id.w)}`,
      (id) => `${id.w}-hafta`,
    );

    res.json({
      success: true,
      monthly,
      // Oxirgi 8 hafta yetarli — undan naryog'i oylik kesimda ko'rinadi
      weekly: weekly.slice(-8),
      thisMonth: monthly[monthly.length - 1] || null,
      thisWeek: weekly[weekly.length - 1] || null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};
