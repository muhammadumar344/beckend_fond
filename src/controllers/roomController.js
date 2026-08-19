// src/controllers/roomController.js
// ════════════════════════════════════════════════════════════
// Xonalar (kabinetlar).
//
// ⚠️ O'QISH RUXSATSIZ OCHIQ. Jadval sahifasi xona ro'yxatini
//    o'qiydi, ya'ni jadval tuzadigan har bir xodimga kerak.
//    Yopsak `manageSchedule` huquqi bor xodim xona tanlay
//    olmasdi va hammasi eski matn maydoniga qaytardi.
//    (Backend CLAUDE.md dagi "ataylab ochiq" jadvaliga qarang.)
//
// ⚠️ YOZISH — `manageRooms`. Xonani o'chirish jadvalga tegadi,
//    shuning uchun bu jadval tuzishdan alohida huquq: sinf
//    rahbari dars qo'ya oladi, lekin binoni qayta rejalashtira
//    olmaydi.
// ════════════════════════════════════════════════════════════
const Room = require("../models/Room");
const Schedule = require("../models/Schedule");
const Class = require("../models/Class");
const { audit } = require("../services/audit");
const { resolveContext, requirePermission } = require("../utils/resolveContext");
const {
  roomsAvailability,
  loadDaySchedules,
  roomKeyOf,
  normaliseRoomName,
  DAY_NAMES,
} = require("../utils/roomAvailability");

// Xodim faqat o'z filialining xonalarini ko'radi. Filialsiz
// xonalar (`branch: null`) hammaga ko'rinadi — ular markazning
// umumiy xonalari va ularni yashirish jadval tuzishni buzardi.
function scopeQuery(ctx) {
  const q = { director: ctx.directorId };
  if (ctx.branchFilter) {
    q.$or = [{ branch: ctx.branchFilter }, { branch: null }];
  }
  return q;
}

// GET /api/lc/rooms?includeArchived=true
// Har bir xonada haftada nechta dars borligi ham qaytadi —
// direktor "bu xona bo'sh turibdi" degan xulosani shundan
// chiqaradi.
const list = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const query = scopeQuery(ctx);
    if (req.query.includeArchived !== "true") query.isActive = true;

    const rooms = await Room.find(query)
      .populate("branch", "name color")
      .sort({ name: 1 })
      .lean();

    // Haftalik yuklama: bitta so'rov, keyin xotirada sanaladi
    // (N+1 bo'lmasin — xona soni kam, dars soni ko'p).
    const schedules = await loadDaySchedules(ctx.directorId, [0, 1, 2, 3, 4, 5, 6]);
    const lessonsByKey = new Map();
    for (const s of schedules) {
      const key = roomKeyOf(s);
      if (key) lessonsByKey.set(key, (lessonsByKey.get(key) || 0) + 1);
    }

    res.json({
      success: true,
      rooms: rooms.map((r) => ({
        ...r,
        lessonsPerWeek: lessonsByKey.get(`id:${String(r._id)}`) || 0,
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// POST /api/lc/rooms   { name, capacity?, branch?, note? }
const create = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageRooms");

    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Xona nomi majburiy" });
    }

    // Xodim boshqa filialga xona qo'sha olmaydi. Filiali bor
    // xodim uchun filial avtomatik o'ziniki — tanlash imkoni
    // berilsa, u ataylab bo'lmasa ham chalkashtirib yuborardi.
    const branch = ctx.branchFilter || req.body.branch || null;

    // ⚠️ ARXIVLANGAN BIR XIL NOMLI XONA — qayta faollashadi.
    //    Noyob indeks arxiv holatiga qaramaydi, shuning uchun
    //    "205" ni arxivlab, keyin qaytadan qo'shmoqchi bo'lgan
    //    direktor "allaqachon mavjud" degan xabar olardi va
    //    ekranda hech qanday "205" ko'rinmasdi — chiqib
    //    bo'lmaydigan holat.
    const archived = await Room.findOne({
      director: ctx.directorId,
      branch: branch || null,
      name,
      isActive: false,
    });
    if (archived) {
      archived.isActive = true;
      archived.capacity = Math.max(0, Number(req.body.capacity) || 0);
      archived.note = String(req.body.note || "").trim();
      await archived.save();
      return res.status(201).json({ success: true, room: archived, restored: true });
    }

    const room = await Room.create({
      director: ctx.directorId,
      branch: branch || null,
      name,
      capacity: Math.max(0, Number(req.body.capacity) || 0),
      note: String(req.body.note || "").trim(),
    });

    audit(req, ctx, {
      action: "room.created",
      entity: "Room",
      entityId: room._id,
      entityLabel: room.name,
      changes: [
        { field: "sig'im", from: null, to: room.capacity || null },
      ],
    });

    res.status(201).json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ success: false, error: "Bu nomli xona allaqachon mavjud" });
    }
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// PUT /api/lc/rooms/:id
const update = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageRooms");

    const room = await Room.findOne({ _id: req.params.id, ...scopeQuery(ctx) });
    if (!room) {
      return res.status(404).json({ success: false, error: "Xona topilmadi" });
    }

    const before = { name: room.name, capacity: room.capacity, note: room.note };

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, error: "Xona nomi majburiy" });
      }
      room.name = name;
    }
    if (req.body.capacity !== undefined) {
      room.capacity = Math.max(0, Number(req.body.capacity) || 0);
    }
    if (req.body.note !== undefined) room.note = String(req.body.note).trim();
    if (req.body.isActive !== undefined) room.isActive = Boolean(req.body.isActive);

    await room.save();

    // ⚠️ Nom o'zgarsa jadvaldagi NUSXA ham yangilanadi. Aks holda
    //    direktor xonani "205" dan "Katta zal" ga o'zgartirgach,
    //    jadvalda hamon "205" ko'rinib turardi va u nima
    //    o'zgarganini tushunmasdi.
    if (before.name !== room.name) {
      await Schedule.updateMany({ roomRef: room._id }, { $set: { room: room.name } });
    }

    const changes = [];
    if (before.name !== room.name) {
      changes.push({ field: "nomi", from: before.name, to: room.name });
    }
    if (before.capacity !== room.capacity) {
      changes.push({ field: "sig'im", from: before.capacity, to: room.capacity });
    }
    if (changes.length) {
      audit(req, ctx, {
        action: "room.updated",
        entity: "Room",
        entityId: room._id,
        entityLabel: room.name,
        changes,
      });
    }

    res.json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ success: false, error: "Bu nomli xona allaqachon mavjud" });
    }
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// DELETE /api/lc/rooms/:id — arxivlaydi, o'chirmaydi
//
// ⚠️ Jadvalda darslari bo'lsa `?force=true` talab qilinadi.
//    Direktor xonani o'chirayotganda o'sha xonadagi 12 ta dars
//    haqida BILISHI kerak: ular yo'qolmaydi, lekin endi
//    bandligi tekshirilmaydigan matnga aylanadi.
const remove = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageRooms");

    const room = await Room.findOne({ _id: req.params.id, ...scopeQuery(ctx) });
    if (!room) {
      return res.status(404).json({ success: false, error: "Xona topilmadi" });
    }

    const lessons = await Schedule.countDocuments({
      roomRef: room._id,
      isActive: { $ne: false },
    });

    if (lessons > 0 && req.query.force !== "true") {
      return res.status(409).json({
        success: false,
        error: `Bu xonada ${lessons} ta dars bor`,
        lessons,
      });
    }

    room.isActive = false;
    await room.save();

    audit(req, ctx, {
      action: "room.deleted",
      entity: "Room",
      entityId: room._id,
      entityLabel: room.name,
      changes: lessons ? [{ field: "darslar", from: lessons, to: null }] : [],
    });

    res.json({ success: true, message: "Xona arxivlandi", lessons });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// GET /api/lc/rooms/free?dayOfWeek=&startTime=&endTime=&excludeScheduleId=
//
// ⚠️ ENG MUHIM ENDPOINT. Kassadagi bilan bir xil qoida: farq
//    tugmani bosishdan OLDIN ko'rinadi. Administrator vaqtni
//    kiritishi bilan qaysi xona bo'sh ekanini ko'radi va
//    ziddiyatli xonani umuman tanlamaydi. "Saqlash" ni bosib,
//    409 xatoni o'qib, qaytib tanlash — uch qadam ortiqcha.
const free = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const dayOfWeek = Number(req.query.dayOfWeek);
    const { startTime, endTime } = req.query;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res
        .status(400)
        .json({ success: false, error: "dayOfWeek 0-6 orasida bo'lishi kerak" });
    }
    if (!startTime || !endTime) {
      return res
        .status(400)
        .json({ success: false, error: "startTime va endTime majburiy" });
    }

    const rooms = await Room.find({ ...scopeQuery(ctx), isActive: true })
      .populate("branch", "name color")
      .sort({ name: 1 })
      .lean();

    const withBusy = await roomsAvailability({
      directorId: ctx.directorId,
      rooms,
      dayOfWeek,
      startTime,
      endTime,
      excludeScheduleId: req.query.excludeScheduleId || null,
    });

    res.json({
      success: true,
      dayOfWeek,
      startTime,
      endTime,
      rooms: withBusy,
      freeCount: withBusy.filter((r) => !r.busy).length,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// GET /api/lc/rooms/occupancy
// Haftalik setka: har bir xona, har bir kun, qaysi darslar.
// Direktor "yana xona kerakmi yoki bori yetadimi" degan
// savolga aynan shu yerdan javob topadi.
const occupancy = async (req, res) => {
  try {
    const ctx = await resolveContext(req);

    const rooms = await Room.find({ ...scopeQuery(ctx), isActive: true })
      .populate("branch", "name color")
      .sort({ name: 1 })
      .lean();

    const schedules = await loadDaySchedules(ctx.directorId, [0, 1, 2, 3, 4, 5, 6]);

    const byKey = new Map();
    // Matn xonaning ko'rsatiladigan nomi: kalit soddalashtirilgan
    // ("lab1"), foydalanuvchi esa yozganini ko'rishi kerak ("Lab-1").
    const labelByKey = new Map();

    for (const s of schedules) {
      const key = roomKeyOf(s);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, []);
        labelByKey.set(key, (s.room || "").trim());
      }
      byKey.get(key).push({
        _id: s._id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        groupId: s.class?._id || null,
        groupName: s.class?.name || "",
      });
    }

    // Xonaga bog'lanmagan, faqat matn bilan yozilgan darslar
    // alohida qatorda chiqadi. Yashirsak direktor jadvalda
    // ko'rgan darsni bandlik setkasida topa olmasdi va
    // ma'lumotga ishonchi yo'qolardi.
    const unlinked = [];
    for (const [key, items] of byKey) {
      if (key.startsWith("name:")) {
        unlinked.push({ name: labelByKey.get(key) || key.slice(5), lessons: items });
      }
    }

    res.json({
      success: true,
      days: DAY_NAMES,
      rooms: rooms.map((r) => ({
        ...r,
        lessons: byKey.get(`id:${String(r._id)}`) || [],
      })),
      unlinked,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

// POST /api/lc/rooms/import   { apply?: boolean }
//
// ⚠️ ESKI MATNNI BIR MARTADA HAQIQIY XONAGA AYLANTIRADI.
//    Busiz o'tish davri cho'zilib ketardi: administrator yangi
//    xonalarni tanlaydi, eski darslar esa matn bo'lib qolaveradi
//    va ular orasidagi ziddiyat hech qachon topilmasdi.
//
// ⚠️ Standart holda QURUQ YURISH. `apply: true` bo'lmasa faqat
//    nima bo'lishini ko'rsatadi — direktor 30 ta xona yaratishdan
//    oldin ro'yxatni o'z ko'zi bilan ko'rsin.
const importFromSchedules = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    requirePermission(ctx, "manageRooms");

    const classIds = await Class.find({ teacher: ctx.directorId }).distinct("_id");
    const schedules = await Schedule.find({
      class: { $in: classIds },
      isActive: { $ne: false },
      roomRef: null,
      room: { $nin: ["", null] },
    })
      .select("room")
      .lean();

    // Bir xil nomni bir marta: "205", "205 " va " 205" — bitta xona.
    // Dars id'lari ham shu yerda yig'iladi: halqa ichida qayta
    // so'rov yuborish N+1 bo'lardi.
    const groups = new Map();
    for (const s of schedules) {
      const key = normaliseRoomName(s.room);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { name: s.room.trim(), ids: [] });
      groups.get(key).ids.push(s._id);
    }

    // ⚠️ ARXIVLANGANLAR HAM QIDIRILADI. Noyob indeks
    //    `(director, branch, name)` arxiv holatiga qaramaydi:
    //    "205" arxivda yotgan bo'lsa yangisini yaratib bo'lmaydi
    //    va import 11000 xato bilan yiqilardi. Topilsa — qayta
    //    faollashtiramiz: direktor uni jadvalda ishlatayotgan
    //    ekan, demak xona bor.
    //
    // ⚠️ Faqat XODIM KO'RA OLADIGAN doirada. Boshqa filialdagi
    //    "205" ga bog'lasak, filial rahbari o'zi ko'rmaydigan
    //    xonaga dars qo'yib qo'yardi.
    const existing = await Room.find(scopeQuery(ctx)).select("name isActive").lean();
    const existingKeys = new Map(
      existing.map((r) => [normaliseRoomName(r.name), r]),
    );

    const plan = [...groups.entries()].map(([key, g]) => ({
      name: g.name,
      lessons: g.ids.length,
      // Shu nomli xona allaqachon bo'lsa yangisini yaratmaymiz —
      // faqat darslarni unga bog'laymiz.
      exists: existingKeys.has(key),
    }));

    if (req.body.apply !== true) {
      return res.json({ success: true, dryRun: true, plan });
    }

    let created = 0;
    let linked = 0;
    let restored = 0;

    for (const [key, g] of groups) {
      const found = existingKeys.get(key);
      let roomId;

      if (found) {
        roomId = found._id;
        if (!found.isActive) {
          await Room.updateOne({ _id: roomId }, { $set: { isActive: true } });
          restored += 1;
        }
      } else {
        const room = await Room.create({
          director: ctx.directorId,
          branch: ctx.branchFilter || null,
          name: g.name,
        });
        roomId = room._id;
        existingKeys.set(key, { _id: roomId, isActive: true });
        created += 1;
      }

      // `room` nusxasi ham xona nomiga tenglashadi — shundan
      // keyin jadvalda bitta yozilish qoladi.
      const r = await Schedule.updateMany(
        { _id: { $in: g.ids } },
        { $set: { roomRef: roomId, room: g.name } },
      );
      linked += r.modifiedCount || 0;
    }

    audit(req, ctx, {
      action: "room.created",
      entity: "Room",
      entityLabel: `Jadvaldan import — ${created} ta xona`,
      changes: [
        { field: "yaratilgan xona", from: null, to: created },
        { field: "bog'langan dars", from: null, to: linked },
      ],
    });

    res.json({ success: true, dryRun: false, created, linked, restored, plan });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

module.exports = { list, create, update, remove, free, occupancy, importFromSchedules };
