const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { onlyTeacher, allowTeacherOrStaff } = require("../middleware/roles");
const { requireLCMode } = require("../middleware/mode"); // ✅ YANGI

const roleCtrl = require("../controllers/roleController");
const staffCtrl = require("../controllers/staffController");
const salaryCtrl = require("../controllers/salaryController");
const subjectCtrl = require("../controllers/subjectController"); // ✅ YANGI
const groupCtrl = require("../controllers/groupController"); // ✅ YANGI
const leadCtrl = require("../controllers/leadController"); // ✅ YANGI — CRM
const hwCtrl = require("../controllers/homeworkController"); // ✅ YANGI — uy vazifasi

// ✅ TUZATILDI — /api/lc/* butunlay O'quv markazi (LC) rejimiga qulflandi.
// Avval bu yerda hech qanday mode tekshiruvi yo'q edi.
router.use(auth, requireLCMode);

// ─── ROLES ───────────────────────────────────────────────────────────────────
router.get("/roles/my", allowTeacherOrStaff, roleCtrl.getMyRole);
router.get("/roles", allowTeacherOrStaff, roleCtrl.getRoles);
router.post("/roles", onlyTeacher, roleCtrl.createRole);
router.put("/roles/:id", onlyTeacher, roleCtrl.updateRole);
router.delete("/roles/:id", onlyTeacher, roleCtrl.deleteRole);

// ─── STAFF ───────────────────────────────────────────────────────────────────
router.get("/staff", allowTeacherOrStaff, staffCtrl.getStaff);
router.post("/staff", allowTeacherOrStaff, staffCtrl.createStaff);
router.put("/staff/:id", allowTeacherOrStaff, staffCtrl.updateStaff);
router.put("/staff/:id/toggle", allowTeacherOrStaff, staffCtrl.toggleStaff);
router.put(
  "/staff/:id/reset-password",
  onlyTeacher,
  staffCtrl.resetStaffPassword,
);

// ─── SALARIES ────────────────────────────────────────────────────────────────
router.get("/salaries/my", allowTeacherOrStaff, salaryCtrl.getMySalaryHistory);
router.get(
  "/salaries/summary",
  allowTeacherOrStaff,
  salaryCtrl.getSalarySummary,
);
router.get("/salaries", allowTeacherOrStaff, salaryCtrl.getSalaries);
router.post("/salaries", allowTeacherOrStaff, salaryCtrl.setSalary);
router.put("/salaries/:id/pay", allowTeacherOrStaff, salaryCtrl.markSalaryPaid);
router.delete("/salaries/:id", allowTeacherOrStaff, salaryCtrl.deleteSalary);
// ⚠️ Hisob-kitob FAQAT TAKLIF qaytaradi — `Salary` yozuvini
//    odam `POST /salaries` bilan tasdiqlab yaratadi.
router.get("/salaries/computed", allowTeacherOrStaff, salaryCtrl.getComputed);
router.put("/staff/:staffId/salary-rule", allowTeacherOrStaff, salaryCtrl.setSalaryRule);

// ─── SUBJECTS (Fanlar) — ✅ YANGI ────────────────────────────────────────────
// GET — Director + barcha Staff ko'radi (guruh yaratishda dropdown uchun)
router.get("/subjects", allowTeacherOrStaff, subjectCtrl.getSubjects);
// POST/PUT/DELETE — ichkarida requirePermission(ctx, 'manageSubjects') tekshiradi
router.post("/subjects", allowTeacherOrStaff, subjectCtrl.createSubject);
router.put("/subjects/:id", allowTeacherOrStaff, subjectCtrl.updateSubject);
router.delete("/subjects/:id", allowTeacherOrStaff, subjectCtrl.deleteSubject);

// ─── GROUPS (Guruhlar) — ✅ YANGI ────────────────────────────────────────────
// ✅ Fond'ning /teacher/classes'idan ENDI mustaqil — LC o'z API'siga ega.
// Ichkarida (bugungacha) Class kolleksiyasi ishlatiladi, lekin bu shunchaki
// ichki tafsilot — tashqi contract endi to'liq "Group" shaklida.
router.get(
  "/groups/available-teachers",
  allowTeacherOrStaff,
  groupCtrl.getAvailableTeachers,
);
router.post(
  "/groups/check-availability",
  allowTeacherOrStaff,
  groupCtrl.checkAvailability,
);
router.get("/groups", allowTeacherOrStaff, groupCtrl.getGroups);
router.post("/groups", allowTeacherOrStaff, groupCtrl.createGroup);
router.get("/groups/:groupId", allowTeacherOrStaff, groupCtrl.getGroupById);
router.put("/groups/:groupId", allowTeacherOrStaff, groupCtrl.updateGroup);
router.delete("/groups/:groupId", allowTeacherOrStaff, groupCtrl.deleteGroup);

// ─── LEADS (CRM voronkasi) — ✅ YANGI ────────────────────────────────────────
// Ruxsat ichkarida: o'qish uchun viewLeads|manageLeads, yozish uchun manageLeads
router.get("/leads", allowTeacherOrStaff, leadCtrl.getLeads);
router.post("/leads", allowTeacherOrStaff, leadCtrl.createLead);
router.post("/leads/:leadId/convert", allowTeacherOrStaff, leadCtrl.convertLead);
router.put("/leads/:leadId", allowTeacherOrStaff, leadCtrl.updateLead);
router.delete("/leads/:leadId", allowTeacherOrStaff, leadCtrl.deleteLead);

// ─── GURUHGA YOZISH (bitta o'quvchi — bir nechta guruh) ─────────────────────
// Ruxsat ichkarida: manageStudents. Asosiy guruh (Student.class) bu
// yerda o'zgarmaydi — batafsil models/Enrollment.js
const enrollCtrl = require("../controllers/enrollmentController");
router.get(
  "/students/:studentId/groups",
  allowTeacherOrStaff,
  enrollCtrl.getStudentGroups,
);
router.post("/enrollments", allowTeacherOrStaff, enrollCtrl.enroll);
router.put(
  "/enrollments/:studentId/:classId",
  allowTeacherOrStaff,
  enrollCtrl.updateEnrollment,
);
router.delete(
  "/enrollments/:studentId/:classId",
  allowTeacherOrStaff,
  enrollCtrl.unenroll,
);

// ─── FILIALLAR STATISTIKASI — ✅ YANGI ───────────────────────────────────────
// Filiallarni yaratish/tahrirlash /teacher/branches'da qoladi (Direktor).
// Bu yerda faqat LC uchun kengaytirilgan statistika.
const branchCtrl = require("../controllers/branchController");
router.get("/branches/stats", allowTeacherOrStaff, branchCtrl.getBranchStats);

// ─── UY VAZIFALARI — ✅ YANGI ────────────────────────────────────────────────
// Ruxsat ichkarida: o'qish uchun viewHomework|manageHomework, yozish uchun
// manageHomework. /leaderboard :homeworkId dan OLDIN turishi shart.
router.get("/homework/leaderboard", allowTeacherOrStaff, hwCtrl.getLeaderboard);
router.post(
  "/homework/notify-parents",
  allowTeacherOrStaff,
  hwCtrl.notifyParents,
);
router.get("/homework", allowTeacherOrStaff, hwCtrl.getHomeworks);
router.post("/homework", allowTeacherOrStaff, hwCtrl.createHomework);
router.get(
  "/homework/:homeworkId/results",
  allowTeacherOrStaff,
  hwCtrl.getHomeworkResults,
);
router.post(
  "/homework/:homeworkId/results",
  allowTeacherOrStaff,
  hwCtrl.saveHomeworkResults,
);
router.put("/homework/:homeworkId", allowTeacherOrStaff, hwCtrl.updateHomework);
router.delete("/homework/:homeworkId", allowTeacherOrStaff, hwCtrl.deleteHomework);

// ─── DASHBOARD & HISOBOTLAR — ✅ YANGI ───────────────────────────────────────
router.get("/dashboard-stats", allowTeacherOrStaff, groupCtrl.getDashboardStats);
router.get("/reports/summary", allowTeacherOrStaff, groupCtrl.getReportSummary);
router.get("/reports/export", allowTeacherOrStaff, groupCtrl.exportGroupsReport);


// ─── QO'SHIMCHA MASHG'ULOT (support booking) ─────────────────────────────────
// Ustoz qabul vaqtini belgilaydi, o'quvchi Mini App'dan yoziladi.
// O'quvchi tomoni: routes/tma.js
const supportCtrl = require("../controllers/supportController");
const requireSupport = require("../middleware/support");

// ⚠️ Sozlama endpoint'lari `requireSupport` DAN O'TMAYDI — aks
//    holda o'chirilgan xizmatni qayta yoqib bo'lmasdi.
router.get("/support/settings", allowTeacherOrStaff, supportCtrl.getSettings);
// ⚠️ `onlyTeacher` EMAS: filial boshqaruvchisi ham sozlaydi.
//    Aniq tekshiruv controller ichida (`canManageSupport`) —
//    u yerda `manageStaff` ruxsati talab qilinadi.
router.put("/support/settings", allowTeacherOrStaff, supportCtrl.updateSettings);

// Ustozning kuni va tarixi
router.get("/support/today", allowTeacherOrStaff, requireSupport, supportCtrl.getToday);
router.get("/support/stats", allowTeacherOrStaff, requireSupport, supportCtrl.getStats);

// ⚠️ `/support/slots` YO'Q. Support ustozining "qabul vaqti"
//    degan tushuncha olib tashlandi: qabul markazning ish vaqti
//    davomida har doim ochiq, faqat band qilingan 30 daqiqa
//    bandligicha qoladi. Ish vaqti — `/support/settings` ichida.

router.get("/support/free", allowTeacherOrStaff, requireSupport, supportCtrl.getFree);
router.get("/support/bookings", allowTeacherOrStaff, requireSupport, supportCtrl.getBookings);
router.post("/support/bookings", allowTeacherOrStaff, requireSupport, supportCtrl.createBooking);
router.put("/support/bookings/:bookingId", allowTeacherOrStaff, requireSupport, supportCtrl.updateBooking);
router.get("/support/bookings/:bookingId/qr", allowTeacherOrStaff, requireSupport, supportCtrl.getQr);

// ─── XODIM DAVOMATI ─────────────────────────────────────────────────────────
//
// ⚠️ Egasi — filial boshqaruvchisi (`manageStaff`). Sozlamalar
//    esa `enabled` bayrog'idan qat'i nazar ochiq: o'chirilgan
//    xususiyatni qayta yoqish yo'li yopilib qolmasin.
const staffAttCtrl = require("../controllers/staffAttendanceController");

router.get("/staff-attendance/settings", allowTeacherOrStaff, staffAttCtrl.getSettings);
router.put("/staff-attendance/settings", allowTeacherOrStaff, staffAttCtrl.updateSettings);
router.get("/staff-attendance/day", allowTeacherOrStaff, staffAttCtrl.getDay);
router.post("/staff-attendance/mark", allowTeacherOrStaff, staffAttCtrl.mark);
router.get("/staff-attendance/month", allowTeacherOrStaff, staffAttCtrl.getMonth);

// ─── OTA-ONA TO'LOVLARI ─────────────────────────────────────────────────────
//
// ⚠️ "TO'LADIM" ROUTE'LARI BU YERDAN KO'CHIRILDI → routes/teacher.js.
//    Sabab: butun `/api/lc/*` `requireLCMode` bilan qulflangan, ya'ni
//    Fond direktori ularga 403 olardi. Natijasi jim edi — Fond
//    ota-onasi ilovada karta raqamini umuman ko'rmasdi (`payTo`
//    bo'sh → tugma chiqmaydi), agar qandaydir yo'l bilan da'vo
//    yuborsa ham u bazada yotardi va o'qituvchi UNI HECH QACHON
//    KO'RMASDI. Oqim ikkala rejim uchun ham bir xil, controller
//    ichida rejimga bog'liq hech narsa yo'q.

// ─── KETISH ARAFASIDAGI O'QUVCHILAR ─────────────────────────────────────────
//
// Markaz o'quvchini yo'qotganini u ketgandan KEYIN biladi —
// navbatdagi to'lov kelmaganda. Belgilar esa oldin ko'rinadi va
// allaqachon bazamizda: bola ketishdan oldin kelmay qo'yadi.
const churnCtrl = require("../controllers/churnController");

router.get("/at-risk", allowTeacherOrStaff, churnCtrl.list);
router.post("/at-risk/:studentId/contacted", allowTeacherOrStaff, churnCtrl.markContacted);

// ─── O'QUVCHI KARTOCHKASI VA QIDIRUV ────────────────────────────────────────
//
// Administrator bitta bola haqida bilish uchun besh sahifani
// aylanib chiqardi. Endi bitta sahifa va istalgan joydan
// qidirish mumkin.
const cardCtrl = require("../controllers/studentCardController");

router.get("/search", allowTeacherOrStaff, cardCtrl.search);
router.get("/student/:studentId/card", allowTeacherOrStaff, cardCtrl.card);

// ─── O'ZGARISHLAR TARIXI ────────────────────────────────────────────────────
//
// To'lovni KIM "to'landi" qilgani hech qayerda yozilmasdi.
// Administrator summani o'zgartirsa yoki o'quvchini o'chirsa,
// iz qolmasdi va direktor "men to'ladim" bilan "to'lamagan"
// orasida hakamlik qila olmasdi.
//
// ⚠️ FAQAT O'QISH. Bu yerga hech qachon POST/PUT/DELETE
//    qo'shmang — o'zgartirib bo'ladigan jurnal hech narsani
//    isbotlamaydi.
const auditCtrl = require("../controllers/auditController");

router.get("/audit", allowTeacherOrStaff, auditCtrl.list);
router.get("/audit/actors", allowTeacherOrStaff, auditCtrl.actors);

// ─── KASSA (kunlik smena) ───────────────────────────────────────────────────
//
// Administrator kun bo'yi naqd pul oladi va kechqurun direktorga
// topshiradi — bugungacha buni daftarga yozib hisoblardi.
//
// ⚠️ `/cash/my` va `/cash/close` — O'Z smenasi, `managePayments`.
//    `/cash/shifts`, `/cash/open`, `/cash/day` — BOSHQALARNIKI,
//    `viewCash`. Ikkalasini bitta huquq ostiga birlashtirmang:
//    pul oladigan odam o'z hisobini yopishi kerak, boshqalarni
//    nazorat qilishi esa shart emas.
const cashCtrl = require("../controllers/cashController");

router.get("/cash/my", allowTeacherOrStaff, cashCtrl.mine);
router.post("/cash/close", allowTeacherOrStaff, cashCtrl.closeShift);
router.get("/cash/shifts", allowTeacherOrStaff, cashCtrl.shifts);
router.get("/cash/open", allowTeacherOrStaff, cashCtrl.openDays);
router.get("/cash/day", allowTeacherOrStaff, cashCtrl.day);

// ─── PULNI TOPSHIRISH ───────────────────────────────────────
//
// Smenani yopish — bu faqat "men sanadim" degani. Undan keyin
// pul jismonan direktorga o'tadi va o'sha o'tish hech qayerda
// yozilmasdi: ertasiga direktor "menga 400 000 berilgan" desa,
// administratorda dalil yo'q edi.
//
// ⚠️ TOPSHIRISH `managePayments`, QABUL QILISH `viewCash`.
//    Birlashtirmang — o'shanda administrator o'ziga o'zi
//    topshirib qo'ya olardi va yozuvning ma'nosi qolmasdi.
//
// ⚠️ `/handover/mine` va `/handover/inbox` — `/handover/:id`
//    dan OLDIN. Aks holda Express "mine" ni id deb o'qiydi.
router.get("/cash/handover/mine", allowTeacherOrStaff, cashCtrl.myHandovers);
router.get("/cash/handover/inbox", allowTeacherOrStaff, cashCtrl.inbox);
router.get("/cash/receivers", allowTeacherOrStaff, cashCtrl.receivers);
router.get("/cash/handover", allowTeacherOrStaff, cashCtrl.listHandovers);
router.post("/cash/handover", allowTeacherOrStaff, cashCtrl.createHandover);
router.post(
  "/cash/handover/:id/confirm",
  allowTeacherOrStaff,
  cashCtrl.confirmHandover,
);
router.post(
  "/cash/handover/:id/cancel",
  allowTeacherOrStaff,
  cashCtrl.cancelHandover,
);

// ─── XONALAR (kabinetlar) ───────────────────────────────────────────────────
//
// Ilgari xona `Schedule.room` da oddiy matn edi: ustoz bandligi
// tekshirilardi, xona bandligi esa yo'q. Ikki guruhni bir vaqtda
// bitta xonaga qo'yish mumkin edi va buni faqat eshik oldida
// bilishardi.
//
// ⚠️ O'QISH RUXSATSIZ (`list`, `free`, `occupancy`). Jadval
//    sahifasi xona ro'yxatini o'qiydi — yopsak jadval tuzadigan
//    xodim xona tanlay olmasdi. YOZISH esa `manageRooms`:
//    xonani o'chirish jadvalga tegadi.
//
// ⚠️ `/rooms/free` — `/rooms/:id` dan OLDIN turishi shart, aks
//    holda Express "free" ni id deb o'qiydi.
const roomCtrl = require("../controllers/roomController");

router.get("/rooms", allowTeacherOrStaff, roomCtrl.list);
router.get("/rooms/free", allowTeacherOrStaff, roomCtrl.free);
router.get("/rooms/occupancy", allowTeacherOrStaff, roomCtrl.occupancy);
router.post("/rooms", allowTeacherOrStaff, roomCtrl.create);
router.post("/rooms/import", allowTeacherOrStaff, roomCtrl.importFromSchedules);
router.put("/rooms/:id", allowTeacherOrStaff, roomCtrl.update);
router.delete("/rooms/:id", allowTeacherOrStaff, roomCtrl.remove);

// ─── BO'SH VAQT QIDIRGICHI ──────────────────────────────────────────────────
//
// "Yangi guruhni qachon ochsam bo'ladi?" Ilgari jarayon teskari
// edi: administrator vaqtni taxmin qiladi, tizim "band" deydi,
// u yana taxmin qiladi — ota-ona esa telefonda kutib turadi.
//
// ⚠️ `manageSchedule` TALAB QILINADI. Bu o'qish so'rovi, lekin
//    javobda butun markazning ustozlari, xonalari va ular
//    qachon bandligi bor. Ochiq qoldirsak davomat uchun
//    qo'shilgan ustoz markazning butun ish tartibini yig'ib
//    olardi.
const slotCtrl = require("../controllers/slotController");

router.get("/schedule/free-slots", allowTeacherOrStaff, slotCtrl.freeSlots);

module.exports = router;
