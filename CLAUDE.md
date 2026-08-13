# Lumo — Backend (school_fond)

Node.js / Express / MongoDB (Mongoose 7). Frontend alohida repoda:
`Desktop/font_front/font` (Vue 3 + Vite).

Ishlab turgan manzillar: sayt `schoolfonds.uz`, API `beckend-fond.onrender.com/api`
(Render bepul tarif — uxlab qoladi, shuning uchun frontend har 10 daqiqada ping yuboradi).

## Ishga tushirish

```bash
npm install
npm run dev     # nodemon
npm start       # production
```

`.env`: `MONGODB_URI`, `PORT`, `JWT_SECRET`, Telegram bot tokeni.

> ⚠️ Serverni lokalda ko'tarish `.env`dagi **ishlab turgan** bazaga ulanadi va
> Telegram botning ikkinchi nusxasini polling'ga qo'shadi — bu production botni
> buzadi. Sintaksis tekshirish uchun `node --check <fayl>` yoki route
> modullarini `require()` qilish kifoya.
>
> 🚨 **`require('./src/server.js')` ham serverni KO'TARADI.** Faylning
> oxirida `app.listen()`, `mongoose.connect()` va `initBot()` bor —
> ular import paytida darhol ishga tushadi. Bu tekshiruv emas, deploy.
>
> Bir marta shunday bo'lgan: "modullar yuklanadimi" degan tekshiruvga
> `server.js` qo'shilgan → production bazaga ulanib, bot ikkinchi
> nusxasi polling'ga kirgan va Telegram `409 Conflict` bera boshlagan
> (`terminated by other getUpdates request`). Ishlab turgan bot ~2 daqiqa
> xabarlarni uzuq-yuluq qabul qilgan.
>
> **Tekshiruv ro'yxatiga `server.js` ni QO'SHMANG** — faqat
> `routes/*`, `controllers/*`, `models/*`, `utils/*`, `services/*`.
> Ular sof modullar, yon ta'siri yo'q.

## Testlar

```bash
npm test
```

Node'ning o'rnatilgan `node:test` yugurtgichi — **qo'shimcha paket yo'q,
bazaga ulanmaydi**. Faqat sof mantiq sinovdan o'tadi:

- `test/planHelper.test.js` — tarif limitlari va funksiyalar
- `test/permissions.test.js` — `requirePermission` xatti-harakati
- `test/schedule.test.js` — dars vaqtlari kesishuvi
- `test/lang.test.js` — til aniqlash, tarjima, lug'at butunligi
- `test/group.test.js` — `Group` alias'lari va `Class` bilan moslik
- `test/enrollment.test.js` — guruh ro'yxatini birlashtirish (takror sanash)
- `test/payments.test.js` — Payme/Click imzo va kalitsiz holat

Yangi sof funksiya yozsangiz shu yerga test qo'shing. Bazaga tegadigan
oqimlar (controller'lar) hozircha qo'lda sinaladi — staging muhit
paydo bo'lgach `mongodb-memory-server` bilan kengaytirish mumkin.

> ⚠️ `node --test test/` Windows'da ishlamaydi (`test` ni fayl deb
> qidiradi). `package.json` dagi glob shaklini o'zgartirmang.

## Ikki rejim

Hisob ro'yxatdan o'tishda **yoki Fond, yoki LC** rejimini tanlaydi
(`Teacher.institutionType`: `school` | `learning_center`). Keyin o'zgartirib
bo'lmaydi — ataylab shunday.

- **Fond** — maktab sinfi uchun oylik pul yig'ish (oddiy: sinflar, o'quvchilar,
  oylik to'lov, xarajat).
- **LC** — to'liq o'quv markazi: guruhlar, davomat, baholar, jadval, fanlar,
  xodimlar, maosh, filiallar.

`middleware/mode.js` → `requireLCMode` butun `/api/lc/*` ni LC rejimiga qulflaydi.

## Rollar va ruxsatlar

| Rol | Kim |
|---|---|
| `teacher` | **Direktor** — muassasa egasi. Hamma narsaga ruxsati bor. |
| `staff` | Xodim — ruxsatlari `Role.permissions` massivida. |
| `admin` | Platforma administratori (`/api/admin/*`). |

Standart rollar `controllers/roleController.js` ichida (`defaults`):
`branch_manager`, `administration`, `teacher_staff`, `support_teacher`.

### resolveContext — MUHIM

`utils/resolveContext.js` barcha LC controllerlarida ishlatiladi va
`{ directorId, branchFilter, isDirector, permissions, staffId, staffRole }`
qaytaradi.

- `branchFilter` — **string** (yoki `null`). Controllerlar uni
  `String(cls.branch) !== ctx.branchFilter` ko'rinishida solishtiradi, shuning
  uchun ObjectId emas, aynan string bo'lishi shart.
- `directorId` — Direktor uchun **string** (JWT'dan), xodim uchun **ObjectId**
  (`.lean()`dan). Oddiy `find()`da Mongoose ikkalasini ham cast qiladi, lekin
  **`aggregate()` cast qilmaydi** — u yerda qo'lda `ObjectId`ga o'girish kerak
  (`salaryController.js` dagi `toObjectId()` ga qarang).

### requirePermission — MUHIM

```js
requirePermission(ctx, "manageAttendance");   // ✅ to'g'ri
if (!requirePermission(ctx, "...")) { ... }   // ❌ NOTO'G'RI
```

Ruxsat bo'lsa **hech narsa qaytarmaydi** (`undefined`), bo'lmasa `err.status=403`
bilan **throw qiladi**. Shuning uchun `!requirePermission(...)` har doim `true`
bo'lib chiqadi va hammani bloklaydi. Direktor uchun har doim o'tadi.

Shu sabab har bir `catch` bloki `res.status(err.status || 500)` yozishi shart —
aks holda 403 xatolar 500 bo'lib chiqadi.

### Filial cheklovi

```js
if (ctx.branchFilter && cls.branch && String(cls.branch) !== ctx.branchFilter) {
  return res.status(403).json({ success: false, error: "Ruxsat yo'q" });
}
```

`cls.branch &&` qismi shart: filialga biriktirilmagan guruh (`branch: null`)
bo'lsa, solishtiradigan narsa yo'q — bloklamaslik kerak.

## Tuzilma

```
src/
  server.js
  bot/          Telegram bot
  controllers/  16 ta controller
  cron/         rejalashtirilgan vazifalar
  middleware/   auth.js (JWT), roles.js, mode.js
  models/       Mongoose sxemalar
  routes/       auth.js, teacher.js, lc.js, admin.js
  services/
  utils/        resolveContext.js, planHelper.js, teacherAvailability.js
```

### Route fayllari

- `routes/teacher.js` → `/api/teacher/*` — Fond **va** LC uchun umumiy asos
  (sinflar/guruhlar, o'quvchilar, to'lovlar, xarajat, jadval, davomat, baholar).
  Ichida `Class` modeli "guruh" sifatida ham ishlatiladi.
- `routes/lc.js` → `/api/lc/*` — faqat LC (rollar, xodimlar, maosh, fanlar,
  guruhlar, dashboard).

`onlyTeacher` faqat Direktorni o'tkazadi; `allowTeacherOrStaff` ikkalasini —
bu holda **ruxsatni controller ichida** `requirePermission` bilan tekshirish shart.

## Javob shakllari — ehtiyot bo'ling

Backend bir xil emas. Frontend `.data.X` yozishdan oldin controller'dagi
haqiqiy `res.json(...)` ni tekshiring:

| Endpoint | Qaytaradi |
|---|---|
| `GET /lc/staff` | `{ success, staff }` |
| `GET /lc/roles` | `{ success, roles }` |
| `GET /lc/salaries` | `{ salaries, stats }` — `success` **yo'q** |
| `GET /lc/salaries/my` | `{ salaries, stats }` |
| `GET /teacher/classes/list` | `{ success, classes }` |
| `GET /teacher/payments` | `{ success, payments, classStats, summary }` |
| `GET /lc/leads` | `{ success, leads, stats }` |
| `GET /lc/reports/summary` | `{ success, period, summary, groups, trend }` |
| `GET /lc/homework` | `{ success, homeworks }` — har birida `stats` |
| `GET /lc/homework/:id/results` | `{ success, homework, students }` |
| `GET /lc/homework/leaderboard` | `{ success, leaderboard, summary }` |
| `GET /lc/branches/stats` | `{ success, period, branches, unassigned, totals }` |
| `GET /lc/dashboard-stats` | `{ success, stats }` — ichida `revenueTrend`, `attendanceTrend`, `debt`, `leads` |

Xato javoblari ham bir xil emas: `staffController`/`salaryController`/
`roleController` → `{ message }`, qolganlari → `{ success: false, error }`.

## Uy vazifasi va reyting (ochko)

`Homework` — topshiriq, `HomeworkResult` — har bir o'quvchining holati
(`pending` / `done` / `late` / `missed`) va olgan ochkosi.

- Vazifa yaratilganda guruhdagi **har bir o'quvchiga** `pending` yozuvi
  avtomatik ochiladi — ustoz keyin faqat belgilaydi.
- Ochko: `done` → to'liq, `late` → **yarmi**, qolgani 0
  (`pointsFor()` — homeworkController).
- **Reyting shu ochkolardan yig'iladi** (`GET /lc/homework/leaderboard`).
  Boshqa reyting manbai yo'q — ota-onaga Telegram orqali yuborish shu
  yerdan olinadi.
- Vazifa o'chirilganda bog'liq `HomeworkResult` yozuvlari ham o'chadi.
- `POST /lc/homework/notify-parents` — reytingni Telegram'ga ulangan
  ota-onalarga yuboradi (`sendHomeworkReport`). Ulanmagan o'quvchilar
  `skipped` sifatida qaytadi, xato tashlamaydi.
- Reyting hisobi `computeLeaderboard()` da — `getLeaderboard` va
  `notifyParents` ikkovi ham shuni chaqiradi, formulani ikki joyda
  o'zgartirish kerak emas.

## Filiallar

Ikkita alohida endpoint — chalkashtirmang:

- `GET /teacher/branches` (`getBranches`) — **Fond** uchun. Filial yaratish,
  tahrirlash, o'chirish ham shu yerda (`onlyTeacher`).
- `GET /lc/branches/stats` (`getBranchStats`) — **LC** uchun kengaytirilgan
  statistika: guruh/o'quvchi/xodim soni, davomat foizi, to'ldirilish,
  faol lidlar, oylik moliya. Ruxsat: `viewBranchStats`.

`fillRate` va `attendanceRate` **null** bo'lishi mumkin — sig'im
belgilanmagan yoki davomat olinmagan bo'lsa. Frontend'da 0% deb
ko'rsatmang, "belgilanmagan" deb yozing.

## Indekslar

Barcha modellarda indeks bor (jami 35 ta). Eng muhimlari:

| Kolleksiya | Indeks | Nima uchun |
|---|---|---|
| `Student` | `{ class, rollNumber }` | Loyihadagi eng ko'p so'rov (17 joy) — filtr va sort birga |
| `MonthlyPayment` | `{ class, month, year }` | To'lovlar, hisobot, dashboard, filial statistikasi |
| `Class` | `{ teacher, branch }` | Har bir so'rov direktor + filial bo'yicha cheklanadi |
| `Expense` | `{ class, month, year }` | Xarajatlar davr bo'yicha |
| `TelegramParent` | `{ studentId, isActive }` | To'lov va reyting xabarlari |

Yangi so'rov naqshi qo'shsangiz mos indeks borligini tekshiring —
`Attendance`, `Grade`, `HomeworkResult` tez o'sadigan kolleksiyalar.

## Guruh/sinf ajratish (reja 1.2) — tayyorgarlik

LC guruhlari hali `Class` da saqlanadi. Ajratish uchun **tayyorlangan,
lekin ishga tushirilmagan**:

- `models/Group.js` — yangi model (hech qayerda import qilinmagan)
- `scripts/analyzeGroupSplit.js` — **faqat o'qiydi**, hisobot beradi
- `scripts/migrateGroups.js` — sukut bo'yicha quruq yurish;
  yozish uchun `--apply`, orqaga qaytarish uchun `--rollback --apply`
- `docs/GROUP_MIGRATION.md` — uch xil yondashuv, tavsiya va tartib

Asosiy g'oya: `Group` yozuvlari **aynan o'sha `_id`** bilan yaratiladi,
shuning uchun `Class` ga ishora qiluvchi 9 ta kolleksiyani qayta yozish
kerak emas. Asosiy qiyinchilik — 13 joydagi `populate("class")`;
batafsili hujjatda.

⚠️ Skriptlarni ishga tushirishdan oldin bazadan nusxa oling.

## Group va Class — bitta kolleksiya, ikkita model

LC guruhlari `Group` modeli orqali o'qiladi, lekin u **`classes`
kolleksiyasiga** bog'langan — `Class` bilan aynan bir xil hujjatlar.
Ma'lumot ko'chirilmagan (reja 1.2, A varianti).

```js
mongoose.model("Group", groupSchema, "classes")  // ← 3-argument
```

**Aralashib ketmaydi**, chunki har bir so'rov `teacher: ctx.directorId`
bilan cheklanadi va direktor faqat bitta rejimda bo'ladi.

`Group` sxemasida `initialBalance` / `initialBalanceNote` **ataylab
yo'q** — LC kodi Fond maydonlariga teg olmaydi.

### ⚠️ Alias tuzog'i

`director` → `teacher`, `monthlyPrice` → `defaultAmount`.

| Ishlaydi | Ishlamaydi |
|---|---|
| `doc.monthlyPrice` | `.sort({ monthlyPrice: 1 })` |
| `new Group({ director })` | `.select("director")` |
| `Group.find({ director })` * | `updateOne({}, { monthlyPrice: 5 })` ← yangi maydon yozadi |
| | `aggregate([...])` |

\* faqat sxemadagi `pre` hook tufayli. Hook bo'lmasa `find()` **xato
bermaydi** — jimgina bo'sh massiv qaytaradi.

Shu sabab `groupController` so'rov filtrlarida **haqiqiy nomlarni**
ishlatadi: kod hook'siz ham to'g'ri, hook esa kelajakdagi xatoni
ushlaydi. Sort/select/update-payload/aggregate da har doim `teacher`
va `defaultAmount` yozing.

## Guruh ro'yxati — `Student.find({ class })` YETARLI EMAS

Bitta o'quvchi bir nechta guruhda o'qishi mumkin (reja 1.3).
U guruhga ikki xil yo'l bilan tegishli bo'ladi:

| Manba | Nima |
|---|---|
| `Student.class` | asosiy guruh — eski kodning tayanchi, 23 joyda |
| `Enrollment` | qo'shimcha guruhlar |

Shuning uchun ro'yxat **har doim** `utils/enrollment.js` orqali:

```js
getGroupStudents(classId)      // ro'yxat (rollNumber bo'yicha)
countGroupStudents(classId)    // BITTA guruh soni
countUniqueStudents(classIds)  // KO'P guruh — noyob o'quvchilar
buildGroupStudentMap(classIds) // N+1 oldini olish
```

⚠️ **`countGroupStudents` ni yig'MANG.** Ikki guruhda o'qiydigan
bola ikki marta sanaladi. Filial/markaz umumiy soni uchun
`countUniqueStudents`.

⚠️ Asosiy guruh uchun `Enrollment` yozuvi **yaratilmaydi** — aks
holda takror bo'lardi. `enrollmentController` faqat qo'shimcha
guruhlar bilan ishlaydi va `Student.class` ga hech qachon tegmaydi.

**Migratsiya kerak emas:** mavjud o'quvchilar avtomatik "asosiy
guruhda" hisoblanadi.

## To'lov tizimlari — o'chiq turibdi

Payme va Click kodi yozilgan, lekin **kalitlar yo'q → 503**.
Merchant olingach `config/payments.js` dagi env o'zgaruvchilarini
qo'ying, kod o'zgarmaydi. Batafsil: **`docs/PAYMENTS.md`**.

⚠️ Jonli sinalmagan — sandbox tekshiruv ro'yxati o'sha hujjatda.

⚠️ Payme summani **tiyinda**, Click **so'mda** yuboradi.

## Tarif limitlari — `effectivePlan`

`Class.plan` — sinf ochilgandagi tarifning nusxasi. O'quvchi limiti
endi **undan va direktorning hozirgi tarifidan kattarog'i** bo'yicha
hisoblanadi:

```js
canAddStudent(cls.plan, count, directorDoc)   // ✅ teacher bering
canAddStudent(cls.plan, count)                // eski xatti-harakat
```

Bu ikkita to'lovchi mijozga tegadigan xatoni tuzatdi:

1. `groupController.createGroup` `plan` ni **umuman yozmasdi** →
   sxema `"free"` qo'yardi → Premium LC hisobi ham guruhiga 30 tadan
   ortiq o'quvchi qo'sha olmasdi. (Fond tomonida yozilardi.)
2. Tarifni **ko'targan** foydalanuvchi eski sinflarida eski limitda
   qolardi — to'lagan puli ish bermasdi.

Eski, yuqoriroq tarif saqlanadi (premiumda ochilgan sinf, free'ga
tushsangiz ham katta limitini yo'qotmaydi).

## Xabarlar tili (ru / en)

Controller'larda xabarlar **o'zbekcha yozilgan va shundayligicha qoladi**.
Tarjima javob yuborilayotgan payt bitta joyda amalga oshadi:

```
so'rov ──▶ middleware/lang.js ──▶ route ──▶ res.json({ error: "Sinf topilmadi" })
                 │                                        │
                 │ tilni aniqlaydi                        │ o'ralgan res.json
                 └────────── utils/messages.js ◀──────────┘
                                                    "Класс не найден"
```

**Nega bunday?** Kodda 338 ta joyda xabar yozilgan. Har birini `t("kalit")`
ga almashtirish — ishlab turgan saytda 338 ta tahrir demakdir. Javobni
chiqishda ushlash bitta nuqta, bitta xavf.

- **Til**: `?lang=` → `X-Lang` sarlavhasi → `Accept-Language` → `uz`
- **Tarjima qilinadi**: faqat yuqori darajadagi `error` va `message`
  maydonlari. Ma'lumot, ismlar, ID'lar daxlsiz.
- **Topilmasa** — matn o'zgarmaydi (o'zbekcha chiqadi, bo'sh emas).
- **O'zbekchada** `res.json` umuman o'ralmaydi — ortiqcha yuk yo'q.
- **Shablonli xabarlar** (`` `${n} ta davomat saqlandi` ``) tarjima
  qilinmaydi — 21 ta shunday xabar bor, ular o'zbekcha qoladi.

```bash
npm run check:messages   # tarjimasiz qolgan xabarlarni ko'rsatadi
```

⚠️ Kodda xabar matnini o'zgartirsangiz `utils/messages.js` dagi kalitni
ham yangilang. Aks holda o'sha xabar **jimgina** o'zbekcha chiqaveradi —
xato bermaydi. `check:messages` aynan shuni topadi.

⚠️ `X-Lang` `server.js` dagi CORS `allowedHeaders` ro'yxatida bo'lishi
shart. Bo'lmasa brauzer sarlavhani umuman yubormaydi va hamma narsa
o'zbekcha chiqaveradi.

## Ma'lum texnik qarzlar

- `markPayment` (teacherController) eksport qilingan, lekin hech qaysi route'ga
  ulanmagan — o'lik kod.
- Frontend `lc/StaffManagement.vue` rol yaratishda `viewGroups`, `manageHomework`,
  `sendSMS`, `viewOwnSalary` kabi ruxsatlarni taklif qiladi, lekin backend
  **faqat `manage*` guruhini** tekshiradi. Ro'yxatni moslashtirish kerak.
- README.md eskirgan (loyihaning eng birinchi versiyasini tasvirlaydi).
