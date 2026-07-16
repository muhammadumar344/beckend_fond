// src/utils/teacherAvailability.js
// ✅ YANGI — ustozni guruhga tayinlashdan oldin uning band-bandligini
// tekshiradi ("ustoz tayinlaydi ustozning vaqtiga qarab").

const Schedule = require("../models/Schedule");

// "HH:MM" qatorlar zero-padded 24 soatlik formatda bo'lgani uchun
// oddiy string solishtirish orqali ham to'g'ri ishlaydi.
const timesOverlap = (start1, end1, start2, end2) =>
  start1 < end2 && start2 < end1;

/**
 * Berilgan ustoz (Staff._id) tanlangan kun(lar) + vaqt oralig'ida
 * boshqa guruhga band emasligini tekshiradi.
 *
 * @param {Object} params
 * @param {string} params.teacherId - Staff._id (band tekshirilayotgan ustoz)
 * @param {string} params.directorId - Teacher._id (shu muassasa doirasida)
 * @param {number[]} params.daysOfWeek - 0..6 (0=Dushanba ... 6=Yakshanba)
 * @param {string} params.startTime - "18:00"
 * @param {string} params.endTime - "19:30"
 * @param {string} [params.excludeClassId] - tahrirlanayotgan guruhning o'zi
 *   (o'z-o'ziga qarshi "band" deb chiqmasligi uchun)
 * @returns {Promise<Array>} bo'sh massiv = band emas; aks holda ziddiyatlar
 */
async function findTeacherConflicts({
  teacherId,
  directorId,
  daysOfWeek,
  startTime,
  endTime,
  excludeClassId = null,
}) {
  if (!teacherId || !daysOfWeek?.length || !startTime || !endTime) return [];

  const query = {
    teacher: teacherId,
    dayOfWeek: { $in: daysOfWeek },
    isActive: { $ne: false },
  };

  const existing = await Schedule.find(query).populate({
    path: "class",
    select: "name teacher",
  });

  const DAY_NAMES = [
    "Dushanba",
    "Seshanba",
    "Chorshanba",
    "Payshanba",
    "Juma",
    "Shanba",
    "Yakshanba",
  ];

  return existing
    .filter((s) => s.class && String(s.class.teacher) === String(directorId))
    .filter((s) => !excludeClassId || String(s.class._id) !== String(excludeClassId))
    .filter((s) => timesOverlap(startTime, endTime, s.startTime, s.endTime))
    .map((s) => ({
      day: DAY_NAMES[s.dayOfWeek] || s.dayOfWeek,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      groupId: s.class._id,
      groupName: s.class.name,
    }));
}

module.exports = { findTeacherConflicts, timesOverlap };
