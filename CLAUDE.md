# Lumo — Backend (school_fond)

> 👉 **Ish boshlashdan oldin `HANDOFF.md` ni o'qing.** U yerda hozirgi holat
> bor: nima tugadi, nima to'xtab turibdi, keyin nima qilinadi va
> Muhammadumar bergan doimiy qoidalar. Bu fayl esa — doimiy qoidalar:
> arxitektura, tuzoqlar, uslub.


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

### Ruxsatsiz ochiq endpoint'lar — ataylab

`npm run check:perms` (frontend loyihasida) uch qatlamni solishtiradi:
menyu → route `meta.permission` → `requirePermission`.

Xodimga ochiq va `requirePermission` yo'q **9 ta** GET bor. Hammasi
ko'rib chiqilgan va **ataylab shunday** — ularsiz xodim sahifalari
umuman ishlamaydi:

| Endpoint | Nega ochiq |
|---|---|
| `/lc/roles/my`, `/lc/salaries/my` | o'z ma'lumoti |
| `/lc/roles` | StaffManagement uchun (sahifa `manageStaff` bilan yopiq) |
| `/lc/subjects` | davomat/baho/jadval sahifalari o'qiydi |
| `/lc/groups`, `/lc/groups/:id` | ustoz o'z guruhlarini ko'rishi kerak |
| `/teacher/branding` | sidebar muassasa logotipini ko'rsatadi |
| `/teacher/classes`, `/classes/list` | xodim sahifalarining asosi |
| `/lc/rooms`, `/lc/rooms/free`, `/lc/rooms/occupancy` | jadval oynasi xona ro'yxatini va bandligini o'qiydi |

⚠️ Bularni "xavfsizlik uchun" yopmang — xodim paneli ishdan chiqadi.

**Yopilganlari** (2026-08 auditda topilgan): `/lc/dashboard-stats` va
`/lc/reports/export` — ikkalasi ham markazning **daromadi va qarzini**
qaytarardi. Interfeys ularni xodimga ko'rsatmasdi, lekin API ochiq
edi: davomat uchun qo'shilgan ustoz o'z tokeni bilan butun moliyani
ko'ra olardi. Endi `viewPayments` talab qilinadi.

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
| `GET /lc/rooms` | `{ success, rooms }` — har birida `lessonsPerWeek` |
| `GET /lc/rooms/free` | `{ success, rooms, freeCount }` — har birida `busy`, `busyWith` |
| `GET /lc/rooms/occupancy` | `{ success, days, rooms, unlinked }` |

### Xato javoblari — `error` va `message` HAR DOIM teng

Kodda bir xil emas: `staffController`, `roleController`,
`salaryController` va `staffLogin` xatoni `{ message }` da
qaytaradi (81 ta joy), qolgan hamma joy `{ error }` da. Frontend
esa 92 ta joyda faqat `.error` o'qiydi.

Natijada rol yaratishda *"Bu nomli rol allaqachon mavjud"* o'rniga
umumiy *"Xatolik yuz berdi"* chiqardi — sabab yetib bormasdi.

81 ta call site'ni tahrirlash o'rniga `middleware/lang.js` chiqishda
tenglashtiradi: **4xx/5xx** javobida biri bo'lsa ikkinchisi ham
qo'yiladi.

```js
res.status(400).json({ message: "Rol nomi majburiy" })
// → { message: "Rol nomi majburiy", error: "Rol nomi majburiy" }
```

⚠️ **Faqat 4xx/5xx da.** Muvaffaqiyatli javobdagi `message` — bu
"Saqlandi" kabi matn; uni `error` ga ko'chirish frontend'ga "xato
bo'ldi" deb ko'rsatardi.

Yangi kod yozayotganda **`{ success: false, error }`** shaklini
ishlating — tenglashtirish eski kod uchun, yangi qarz uchun emas.

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

## Xona (kabinet) — bitta xona, ikkita maydon

`Schedule` da xona **ikki joyda** yozilgan va bu ataylab:

| Maydon | Nima |
|---|---|
| `roomRef` | haqiqiy `Room` hujjati — **bandlik shu bo'yicha** tekshiriladi |
| `room` | nom **nusxasi** — ko'rsatish uchun |

Ikki sabab: bazada allaqachon matn bilan yozilgan darslar bor
(migratsiya kerak emas), va xona arxivlansa ham jadvalda nomi
ko'rinib turadi (`AuditLog` aktyor ismi bilan bir xil qoida).

⚠️ **Ziddiyat KALIT bo'yicha topiladi**, maydon bo'yicha emas:
`roomRef` bo'lsa `id:<oid>`, bo'lmasa nomning soddalashtirilgan
shakli (`utils/roomAvailability.js` → `roomKeyOf`). Ya'ni
"Lab-1", "lab 1" va "LAB - 1" — bitta xona. Lekin "205" va
"205-xona" — ikkita. Shuning uchun `POST /lc/rooms/import` bor:
eski matnlarni bir marta haqiqiy xonaga aylantirib, noaniqlikni
butunlay yopadi.

⚠️ **`force` va `forceRoom` — IKKI XIL bayroq.** Birinchisi ustoz
ziddiyatini, ikkinchisi xona ziddiyatini o'tkazadi. Bittaga
birlashtirmang: katta xonaga ataylab ikki guruh qo'ygan odam
o'zi bilmagan holda ustozni ham ikki joyga yozib yuborardi.

⚠️ **Sig'im to'sib qo'ymaydi** — javobda `warning` bo'lib
qaytadi. 12 kishilik xonaga 14 bola sig'adi (stul qo'yiladi);
bloklasak administrator xona tanlashni umuman tashlab qo'yardi
va biz bandlik tekshiruvidan ayrilardik.

⚠️ **Xona o'chirilmaydi, arxivlanadi.** Noyob indeks
(`director + branch + name`) arxiv holatiga qaramaydi, shuning
uchun `create` va `import` arxivdagi bir xil nomli xonani topsa
uni **qayta faollashtiradi** — aks holda "allaqachon mavjud"
deb rad etilardi va ekranda hech qanday o'sha xona ko'rinmasdi.

## To'lov tizimlari — o'chiq turibdi

Payme va Click kodi yozilgan, lekin **kalitlar yo'q → 503**.
Merchant olingach `config/payments.js` dagi env o'zgaruvchilarini
qo'ying, kod o'zgarmaydi. Batafsil: **`docs/PAYMENTS.md`**.

⚠️ Jonli sinalmagan — sandbox tekshiruv ro'yxati o'sha hujjatda.

⚠️ Payme summani **tiyinda**, Click **so'mda** yuboradi.

## Logotiplar — Cloudinary (o'chiq turibdi)

Kalit yo'q → logotip avvalgidek **base64 bo'lib bazaga** yoziladi.
Ya'ni o'chiq holat ham to'liq ishlaydi, 503 qaytarmaydi (to'lovdan
farqi shu — yarim sozlangan rasm zarar keltirmaydi).

`Teacher.logo` **ikki xil** qiymat tutadi va ikkalasi ham
`<img src>` ga tushadi:

| | Qiymat |
|---|---|
| Yangi (CDN yoqiq) | `https://res.cloudinary.com/...` |
| Eski / CDN o'chiq | `data:image/png;base64,...` |

Shuning uchun yoqishda **migratsiya shart emas**. Ixtiyoriy:
`node scripts/migrate-logos-cloudinary.js --apply`

Batafsil: **`docs/CLOUDINARY.md`**

⚠️ Cheklovni frontend **o'zi hisoblamaydi** — `GET /teacher/branding`
javobidagi `logoMaxBytes` ni ishlatadi (CDN yoqiq: 3MB, o'chiq: 300KB).

## Hisobni o'chirish — 30 kunlik muhlat

Direktor `POST /teacher/account/delete` (parol + `O'CHIRISH` so'zi)
yuborganda ma'lumot **darhol yo'qolmaydi**:

```
so'rov ──▶ deletionScheduledFor = +30 kun ──▶ login YOPIQ
                                              (direktor ham, xodimlar ham)
                     │
      30 kun ichida  ├──▶ POST /auth/restore-account ──▶ tiklandi
                     │
      muhlat o'tgach └──▶ cron/accountCleanupCron.js ──▶ butunlay o'chdi
```

⚠️ **`isActive` GA TEGILMAYDI.** U admin blokirovkasi uchun. Ikkalasini
bitta maydonga yig'sak, admin bloklagan direktor "tiklash" tugmasi
bilan o'zini ochib olardi.

⚠️ Login'da tekshirish **yetarli emas edi**: allaqachon berilgan token
muddati tugagunicha ishlayverardi. Shuning uchun `utils/resolveContext.js`
xodim yo'lida direktorning holatini ham o'qiydi.

⚠️ **Yangi model qo'shsangiz `utils/accountPurge.js` ro'yxatiga ham
qo'shing** — aks holda o'chirilgan direktorning hujjatlari bazada
egasiz qoladi. `test/accountPurge.test.js` buni ushlaydi (modellar
papkasini o'zi skanerlaydi).

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

## Telegram Mini App (ota-ona / o'quvchi)

Direktor CRM'idan **butunlay alohida** bo'lim: `/api/tma/*`,
o'z middleware'i, o'z controlleri.

⚠️ **Bu ikkalasini aralashtirmang.** `middleware/auth.js` (direktor
tokeni) `/api/tma/*` ga ulanmasin, `tmaAuth` boshqa router'da
ishlatilmasin. Aralashsa ota-ona hisobi bilan markaz moliyasiga
yo'l ochiladi.

### Kim kimligini isbotlash

| Qatlam | Fayl | Nima qiladi |
|---|---|---|
| Imzo | `services/telegramAuth.js` | `initData` HMAC tekshiruvi |
| Bog'lanish | `models/StudentLink.js` | Telegram hisobi ↔ o'quvchi |
| Ruxsat | `utils/tmaAccess.js` | Qaysi bo'lim ochiq |

Bog'lanish uch xil isbotlanadi:

- **`phone`** — bot'da yuborilgan raqam `Student.parentPhone` bilan
  mos keldi (asosiy yo'l, ota-onalarning ko'pchiligi)
- **`code`** — xodim CRM'da chiqargan bir martalik kod
- **`legacy`** — eski `TelegramParent` yozuvi, **isbotsiz**

⚠️ **`legacy` faqat to'lovni ko'radi.** Eski bot'da o'qituvchi
emailini bilgan har kim ro'yxatdan istalgan bolani tanlab
"ota-onasi" bo'lib qo'ya olardi. O'sha yozuvlarga baho ochib
berish — yillik maxfiy ma'lumotni tarqatish bo'lardi. To'lov
eslatmasi esa avvaldan ishlab turgan, uni to'xtatsak haqiqiy
ota-onalarni jazolagan bo'lardik.

⚠️ `utils/tmaAccess.js` ga **yangi bo'lim qo'shishni unutmang**.
Noma'lum bo'lim standart holda **yopiq** — ya'ni unutilgani
ochilib qolmaydi, lekin ishlamaydi ham.

⚠️ Raqamlarni **hech qachon to'g'ridan-to'g'ri solishtirmang**.
Bazada `+998 90 …`, `90 …`, `901234567` — hammasi bor.
`utils/phone.js` oxirgi 9 raqam bo'yicha solishtiradi.

⚠️ Kontakt kelganda `contact.user_id === msg.from.id` tekshiruvi
**shart**. Telegram'da birovning kontaktini yuborish mumkin —
tekshirmasak, qo'shnisining raqamini yuborib uning bolasini
ko'rish mumkin bo'lardi.

### Xabarnomalar

`services/notify.js` — davomat, baho va yozilish hodisalari.

⚠️ **"Keldi" haqida xabar yuborilmaydi.** Har kuni "farzandingiz
darsga keldi" — shovqin: ota-ona bir hafta o'qiydi, keyin botni
o'chiradi va rostdan muhim xabarni ham ko'rmaydi.

⚠️ Faqat **o'zgargan** yozuvlar xabar beradi. `findOneAndUpdate`
`new: false` bilan avvalgi hujjatni qaytaradi — ustoz ro'yxatni
ikki marta saqlasa ota-ona takror xabar olmaydi.

⚠️ `inBackground()` bilan chaqiring. 30 ta Telegram xabari ~10
soniya olishi mumkin; ustoz shuncha "Saqlanmoqda…" ni kuzatib
turmasin. Xato ham yutiladi — Telegram javob bermagani
davomatning saqlanishiga to'sqinlik qilmasin.

### Qo'shimcha mashg'ulot (support booking)

⚠️ **HAR BIR MARKAZDA BO'LMAYDI.** `Teacher.supportEnabled`
standart holda **`false`**. O'chiq bo'lsa:

- CRM'da menyu ko'rinadi, lekin sahifa "yoqish" taklifini beradi
- Mini App'da "Yozilish" tabi **umuman chiqmaydi**
- API `middleware/support.js` bilan 403 qaytaradi

Interfeysni yashirish yetarli emas — so'rovni qo'lda yuborish
mumkin. Sozlama endpoint'larining o'zi `requireSupport` dan
**o'tmaydi**, aks holda o'chirilgan xizmatni qayta yoqib
bo'lmasdi.

### Kelganini tasdiqlash — QR

```
o'quvchi keladi
   → ustoz kartochkasini bosadi → ekranda QR (har 10s yangilanadi)
   → o'quvchi Mini App'dan skanerlaydi → `done` + `attendedAt`
   → skanerlamasa, vaqt tugagach cron → `no_show` + 3 kun blok
```

⚠️ **BEKOR QILISH YO'Q.** O'quvchi yozildimi — keladi. Erkin
bekor qilish bo'lsa, joy band bo'lib turib oxirgi daqiqada
bo'shatilardi va o'sha vaqtga boshqa hech kim ulgurmasdi.
Ustoz esa bekor qila oladi (kasal bo'lishi mumkin) va bunda
o'quvchi **jazolanmaydi**.

⚠️ **QR har 10 soniyada yangilanadi.** Aks holda QR ning surati
yetarli bo'lardi — o'quvchi kelmasdan, do'stidan rasm so'rab
"keldim" qilib qo'yardi. Bitta oyna orqaga qabul qilinadi
(skanerlash paytida almashib qolsa), ikkitasi — yo'q.

⚠️ **Kod bazaga yozilmaydi** — `bookingId + vaqt oynasi` dan
HMAC bilan hisoblanadi (`services/supportQr.js`). Saqlash,
tozalash va eskirgan yozuv muammosi umuman yo'q.

⚠️ Telefoni o'chgan o'quvchi uchun ustozda **qo'lda belgilash**
tugmasi bor — zaxira yo'l, odatdagisi QR.

| Fayl | Vazifasi |
|---|---|
| `models/SupportSlot.js` | Ustozning takrorlanuvchi qabul vaqti |
| `models/SupportBooking.js` | Haqiqiy yozuv |
| `utils/supportSlots.js` | Bo'sh vaqtlarni **hisoblash** |
| `services/supportBooking.js` | Yozilish qoidalari (CRM va ilova uchun bitta) |

Bo'sh vaqtlar **saqlanmaydi**, har safar hisoblanadi:
qabul oynasi − dars jadvali − band vaqtlar − o'tgan vaqt.
Jadval o'zgarganda oldindan yozib qo'yilgan "bo'sh vaqtlar"
yolg'on bo'lib qolardi.

⚠️ **HAFTA KUNI IKKI XIL SANALADI.** Loyihada `0 = Dushanba`,
JS `getDay()` da `0 = Yakshanba`. O'girish faqat
`projectDayOfWeek()` da. Aralashtirsangiz bo'sh vaqtlar bir kun
surilib ketadi va buni faqat ustoz kelmagan o'quvchini kutib
turganda bilinadi. `test/supportSlots.test.js` qulflab turibdi.

⚠️ Yozishdan oldin bo'shlik **qayta tekshiriladi**, ustiga noyob
indeks bor (`teacher + date + startTime`). Tekshiruv bilan yozuv
orasida tirqish bor — ikki kishi bir vaqtda bosgan holatni faqat
indeks yopadi.

### Yoqish

`TMA_URL` (yoki `FRONTEND_URL`) + `/tma.html`. Frontend'da bu
alohida Vite kirish nuqtasi — router/Pinia/i18n **yo'q**, jami
~96 KB. CRM 260 KB, uni Telegram ichida ochish mumkin emas.

`TMA_URL` ikkala shaklni ham qabul qiladi: `https://saytim.uz`
yoki `https://saytim.uz/tma.html`.

## Xavfsizlik

Uchta qatlam, uchtasi ham `middleware/` da:

| Fayl | Nima qiladi |
|---|---|
| `security.js` | Xavfsizlik sarlavhalari (nosniff, DENY, HSTS…) |
| `rateLimit.js` | So'rov cheklagichi — parol terib topishga qarshi |
| `auth.js` | Token + **seans hali haqiqiymi** tekshiruvi |

### Seans bekor qilish — eng muhim tuzatish

Ilgari `auth.js` faqat `jwt.verify` qilardi. Ya'ni token berilgach
**30 kun** hech narsa uni to'xtata olmasdi:

- admin direktorni bloklaydi → u ishlayveradi
- direktor hisobni o'chiradi → tokeni ishlayveradi
- parol o'g'irlanadi, egasi parolni almashtiradi → o'g'ri ichkarida

Endi `auth.js` hisob holatini o'qiydi va **30 soniya keshlaydi**.
Odatiy so'rovga yuk tushmaydi, bloklangan foydalanuvchi esa eng
ko'pi bilan 30 soniyada uchib chiqadi.

⚠️ `passwordChangedAt` ni **qo'lda yozmang**. Uni `pre('save')` hook
o'zi qo'yadi — parol qaysi yo'l bilan o'zgarmasin (o'zi, admin,
"parolni unutdim") o'sha yagona joydan o'tadi.

⚠️ Vaqt 2 soniya orqaga suriladi: JWT dagi `iat` soniyada yoziladi,
aks holda parol almashtirgan odam o'z tokeni bilan darhol chiqib
ketardi.

### So'rov cheklagichi

Parol tekshiriladigan **har bir** manzil cheklangan. Ikki xil
kalit bilan:

- **IP bo'yicha** — 15 daqiqada 20 urinish
- **Email bo'yicha** — 15 daqiqada 10 urinish

Ikkinchisi shart: hujumchi IP almashtirib bitta hisobga hujum
qilsa, IP cheklovi uni to'xtatmaydi.

⚠️ `server.js` da `trust proxy` **shart**. Render orqasida `req.ip`
proksining manzilini ko'rsatadi — bu sozlamasiz bitta foydalanuvchi
hammani bloklab qo'yardi.

⚠️ Cheklagich **xotirada**. Bitta instansiya uchun to'g'ri. Render'da
instansiya ko'paytirilsa Redis kerak bo'ladi.

### Tiklash tokeni

Bazada **hash** bo'lib yotadi (`sha256`), xatga ochiq token ketadi.
Baza nusxasi chiqib ketsa ham tokenlar foydasiz.

⚠️ Bu o'zgarish eski, ishlatilmagan tiklash havolalarini kuchsiz
qildi — foydalanuvchi qaytadan so'rasa bo'ldi.

### Tekshirilgan va joyida

- **IDOR** — hamma joyda `findOne({ _id, teacher: ctx.directorId })`
  qolipi. Boshqa markazning ma'lumotiga ID bilan kirib bo'lmaydi.
- **Mass assignment** — hech qayerda `...req.body` model ichiga
  to'g'ridan-to'g'ri tushmaydi.
- **Foydalanuvchi sanash** — login va parol tiklash bir xil javob
  beradi, email bor-yo'qligi bilinmaydi.
- **XSS** — Vue o'zi ekranlaydi; yagona `v-html` i18n matni ustida.

## Cron

`server.js` **bazaga ulangandan keyin** ishga tushiradi:

| Fayl | Vaqt | Vazifasi |
|---|---|---|
| `cron/reminderCron.js` | 1-sana 09:00 | Ota-onalarga Telegram eslatma |
| `cron/accountCleanupCron.js` | har kuni 03:30 | Muhlati o'tgan hisoblarni o'chirish |
| `cron/supportCron.js` | har 5 daqiqa | Kelmagan o'quvchini belgilash + 3 kun blok |

⚠️ `startReminderCron` yozilgan edi, lekin **hech qayerdan
chaqirilmagan** — ya'ni Pro/Premium da sotilayotgan "oylik eslatma"
xususiyati hech qachon ishlamagan. 2026-08-14 da ulandi. Yangi cron
qo'shsangiz `server.js` dagi shu blokka qo'shishni unutmang.

## Ma'lum texnik qarzlar

- `markPayment` (teacherController) eksport qilingan, lekin hech qaysi route'ga
  ulanmagan — o'lik kod.
- Frontend `lc/StaffManagement.vue` rol yaratishda `viewGroups`, `manageHomework`,
  `sendSMS`, `viewOwnSalary` kabi ruxsatlarni taklif qiladi, lekin backend
  **faqat `manage*` guruhini** tekshiradi. Ro'yxatni moslashtirish kerak.
- README.md eskirgan (loyihaning eng birinchi versiyasini tasvirlaydi).
