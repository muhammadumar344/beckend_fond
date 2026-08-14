// src/cron/supportCron.js
// ════════════════════════════════════════════════════════════
// Kelmagan o'quvchilarni belgilaydi va bloklaydi.
//
// Mashg'ulot vaqti tugadi, lekin o'quvchi QR ni skanerlamadi
// degani — u kelmagan. Bunda:
//   1. yozuv `no_show` bo'ladi
//   2. o'quvchi 3 kunga bloklanadi
//   3. ota-ona/o'quvchiga xabar ketadi
//
// ⚠️ NEGA JAZO KERAK: yozuvni bekor qilib bo'lmaydi. Agar
//    kelmaslikning hech qanday oqibati bo'lmasa, o'quvchi joyni
//    band qilib qo'yib kelmayveradi — ustoz bo'sh o'tiradi,
//    boshqa bola esa yozila olmaydi.
//
// ⚠️ HAR 5 DAQIQADA ishlaydi, kuniga bir marta emas. Sabab:
//    o'quvchi "kelmadingiz" xabarini ertasi kuni emas, o'sha
//    kuni olishi kerak — aks holda u bloklanganini bilmay,
//    ertasiga yozilmoqchi bo'lib xafa bo'ladi.
//
// ⚠️ Kechikkani zarar qilmaydi: shart "tugash vaqti o'tgan va
//    hali belgilanmagan", ya'ni server uzilib qolsa ham
//    keyingi ishga tushishida hammasi bir yo'la bajariladi.
// ════════════════════════════════════════════════════════════

const cron = require("node-cron");
const SupportBooking = require("../models/SupportBooking");
const Student = require("../models/Student");
const { blockUntil, BLOCK_DAYS, ACTIVE } = require("../services/supportBooking");
const { notifyNoShow, inBackground } = require("../services/notify");

/** Toshkent vaqtida bugungi sana */
function todayStr() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const closeMoment = (b) =>
  new Date(`${b.date}T${b.endTime}:00+05:00`).getTime();

const markNoShows = async () => {
  try {
    // Bugungi va o'tgan kunlardagi hali faol yozuvlar
    const candidates = await SupportBooking.find({
      status: { $in: ACTIVE },
      attendedAt: null,
      date: { $lte: todayStr() },
    }).select("student date endTime director status");

    if (!candidates.length) return;

    const now = Date.now();
    const due = candidates.filter((b) => closeMoment(b) <= now);
    if (!due.length) return;

    const until = blockUntil();
    let marked = 0;

    for (const b of due) {
      try {
        b.status = "no_show";
        await b.save();

        // ⚠️ Blok faqat UZAYTIRILADI, qisqartirilmaydi: ketma-ket
        //    ikki marta kelmagan o'quvchining muddati birinchisiga
        //    qaytib qolmasin.
        await Student.updateOne(
          {
            _id: b.student,
            $or: [
              { supportBlockedUntil: null },
              { supportBlockedUntil: { $lt: until } },
            ],
          },
          { $set: { supportBlockedUntil: until } },
        );

        inBackground(notifyNoShow, {
          directorId: b.director,
          bookingId: b._id,
          blockDays: BLOCK_DAYS,
        });
        marked++;
      } catch (err) {
        console.error(`[support] ${b._id} belgilanmadi:`, err.message);
      }
    }

    if (marked) {
      console.log(`🚫 Qo'shimcha mashg'ulot: ${marked} ta "kelmadi" belgilandi`);
    }
  } catch (err) {
    console.error("markNoShows xatosi:", err);
  }
};

const startSupportCron = () => {
  cron.schedule("*/5 * * * *", markNoShows, { timezone: "Asia/Tashkent" });
  console.log("⏰ Qo'shimcha mashg'ulot cron ishga tushdi (har 5 daqiqa)");
};

module.exports = { startSupportCron, markNoShows, todayStr, closeMoment };
