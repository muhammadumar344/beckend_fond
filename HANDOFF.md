# HANDOFF — ishni qayerdan davom ettirish kerak

> **Bu fayl ikkala repoda bir xil.** Birini o'zgartirsangiz, ikkinchisini ham
> yangilang:
> - `Desktop/school_fond/HANDOFF.md` (backend)
> - `Desktop/font_front/font/HANDOFF.md` (frontend)
>
> Oxirgi yangilanish: **2026-08-20** (Landing tarjimasi tugagach,
> ikkala repo push qilingan)
>
> `CLAUDE.md` — loyihaning **doimiy** qoidalari (arxitektura, tuzoqlar, uslub).
> `HANDOFF.md` — **shu paytdagi holat**: nima tugadi, nima to'xtab turibdi,
> keyin nima qilinadi. Ish tugagach shu faylni yangilang, `CLAUDE.md` ni emas.

---

## 1. Loyiha bir qarashda

**Lumo** — O'zbekiston uchun SaaS, ikki rejimda ishlaydi:

| Rejim | Kim uchun | Asosiy vazifa |
|---|---|---|
| **Fond** | Maktab sinf rahbari | Sinf fondi pulini yig'ish va hisobi |
| **LC** | O'quv markazi | To'liq CRM — raqobatchi `modme.uz` |

Ikkita alohida repo:

| | Yo'l | Remote |
|---|---|---|
| Backend | `C:\Users\Lenovo\Desktop\school_fond` | `github.com/muhammadumar344/beckend_fond` |
| Frontend | `C:\Users\Lenovo\Desktop\font_front\font` | `github.com/muhammadumar344/Fond_front` |

Backend: Node + Express + MongoDB (Mongoose 7), 30 ta model.
Frontend: Vue 3 `<script setup>` + Vite + Pinia + vue-router + vue-i18n (uz/ru/en).

Ishlab turgan manzillar: sayt `schoolfonds.uz`, API `beckend-fond.onrender.com/api`.

---

## 2. Muhammadumar bergan doimiy qoidalar

Bular har bir sessiyada kuchda. **O'qimasdan ish boshlamang.**

1. **G'oya bo'lsa — so'ramasdan qo'shing.** Agar foydali bo'lsa, ruxsat
   so'rab kutmang; qo'shib bo'lgach ogohlantiring.
2. **Mayda ishlarni bajarmang.** Rang, matn, bitta tarjima — bu ish emas.
   Har safar rollar bo'yicha o'ylang: *"Agar men o'quv markaz direktori
   bo'lsam / support ustoz / administrator / asosiy ustoz bo'lsam — menga
   nima kerak bo'lardi?"* Keyin: *"Muhammadumar bo'lsam, Lumo'ga nima
   qo'shardim?"* Shundan keyin ishni boshlang.
3. **`.env` ni o'zi to'ldiradi.** Hech qachon uning kalitlari, tokenlari,
   parollari bilan ishlamang va ularni so'ramang.
4. **Haqiqiy production yozuvlarini yaratmang** (test o'quvchi, test to'lov
   — bazaga emas).
5. **Til:** oddiy, og'zaki o'zbekcha. Qisqa bandlar. Uzun tushuntirish
   yoqmaydi. Kod izohlari ham o'zbekcha va **nima uchun** shundayligini
   yozadi, nima qilishini emas.
6. **Artifact yaratmang** — ishni to'g'ridan-to'g'ri kodda qiling.

---

## 3. Hozirgi holat

### Oxirgi tugagan ish — "Landing tarjimasi"

Ichkaridagi hamma narsa allaqachon uz/ru/en edi, **sotuv sahifasi esa
faqat o'zbekcha**. Ruscha gapiradigan direktor landing'ni tushunmasa,
tizimga UMUMAN kirmaydi — ichkarisi qanchalik tarjima qilinganining
ahamiyati qolmaydi.

`Landing.vue` dagi **42 ta** qattiq matn → **0**. ~120 ta kalit × 3 til.

⚠️ **Ma'lumot massivlari `computed` qilindi**, oddiy `const` emas.
Til almashtirilganda ular qayta hisoblanishi kerak; `const` bo'lsa
sahifa eski tilda qotib qolardi.

⚠️ **`plan.price !== 'Bepul'` solishtiruvi olib tashlandi.**
Narx tarjima qilingandan keyin ruscha sahifada "/oy" bepul tarifda
ham chiqib ketardi. O'rniga `isFree` bayrog'i.

#### Uchta bug — faqat SAHIFANI OCHIB topildi

Build ham, `npm run check` ham uchalasini o'tkazib yubordi:

1. **vue-i18n `@` ni "linked message" deb o'qiydi.** Xabar ichidagi
   `@SchoolfondsBot` butun sahifani yiqitgan
   (`Invalid linked format`). `{'@'}` escape'i ham yordam bermadi —
   yechim **parametr**: `$t('lp_tgDesc', { bot: '@SchoolfondsBot' })`.
   Parametr kompilyatsiyadan keyin qo'yiladi.
2. **`$t('login')` — kalit umuman yo'q edi.** Ekranda "login" deb
   kichik harfda chiqib turgan. `npm run verify` buni ushlaydi,
   lekin u **`npm run check` ichida emas edi** — endi qo'shildi.
3. **Nav havolalari ruschada ikki qatorga tushardi.** Ruscha va
   inglizcha so'zlar o'zbekchadan uzun. Sotuv sahifasida sinib
   turgan menyu mahsulotni tayyor emasdek ko'rsatadi.

⚠️ Saboq: **build va statik tekshiruvlar yetarli emas.** Uchala
bug ham `npm run dev` da sahifani ochib, uch tilni almashtirib
ko'rilgandagina chiqdi.

### Undan oldingi ish — "Ruxsatlar auditi"

Direktor xodimga huquq beradi — va hech narsa o'zgarmaydi. Interfeys
ro'yxati, backend tekshiruvi va menyu bir-biriga mos emas edi.

**Uch xil nomuvofiqlik topildi:**

1. **Sakkizta huquq taklif qilinardi, lekin hech qayerda
   TEKSHIRILMASDI** — `sendSMS`, `sendTelegram`, `exportData`,
   `viewAttendance`, `viewGroups`, `viewSchedule`, `viewOwnSalary`,
   `viewAllStats`. Direktor "SMS yuborish" ni belgilaydi va u hech
   narsa ochmaydi. Olib tashlandi.
2. **`manageSubjects` va `manageRooms` tekshirilardi, lekin
   interfeysda YO'Q edi** — ya'ni ularni berib bo'lmasdi. `Fanlar`
   sahifasi standart Branch Manager rolidan boshqa hech kimga
   ochilmasdi. (`manageRooms` — men qoldirgan teshik.)
3. **`viewGrades` va `viewStaff` taklif qilinardi-yu ishlamasdi** —
   endi haqiqiy "faqat ko'rish" darajasi.

**Yana bir qatlam:** `viewHomework` va `viewLeads` backendda ishlab
turardi, lekin **menyu va route hamon `manage*` talab qilardi** —
ya'ni o'sha huquqli xodim sahifaga umuman kira olmasdi. Yolg'on bir
qavat yuqorida edi.

**Backend:**
- `utils/resolveContext.js` → `requireAnyPermission`. Naqsh ilgari
  `homeworkController` va `leadController` ichida qo'lda takrorlangan
  edi — uchinchi marta yozish o'rniga umumiy qilindi.
- Baho **o'qish** endpointlarida ruxsat tekshiruvi UMUMAN yo'q edi:
  davomat uchun qo'shilgan ustoz butun markazning barcha baholarini
  o'qiy olardi. Endi `viewGrades` yoki `manageGrades`.
- `staffController.getStaff` — `viewStaff` ham yetadi.
- `Role.js` enum 32 dan **24 ga** tushdi + `pre('validate')` eskirgan
  qiymatlarni jimgina tashlaydi.
- 6 ta yangi test, jumladan **enum'dagi har bir huquq backendda
  ishlatilishini** tekshiradigani.

**Frontend:**
- Router guard massiv `meta.permission` ni qabul qiladi (bittasi
  yetarli), menyu `anyPerm` ishlatadi.
- `Grades`, `Team`, `Homework`, `Leads` sahifalarida `canManage` —
  tahrirlash tugmalari yashiriladi. Leads'da **sudrab ko'chirish**
  ham yopiladi: karta sudralib keyin 403 qaytsa, odam voronkani
  buzdim deb o'ylab qoladi.
- `StaffManagement.vue` katalogi backend enum bilan **24 = 24** mos.
- `check-perms.cjs` massiv va `anyPerm` ni solishtiradi — ataylab
  nomuvofiqlik kiritib sinaldi, ushlaydi.

**Yo'lda topilgan bug:** `Schedule.vue` dagi bo'sh vaqt qidirgichi
ustozlar ro'yxatini `getStaff` orqali olardi — u `manageStaff`
talab qiladi va jadval tuzadigan administratorda u yo'q. Ro'yxat
jimgina bo'sh qolardi. `getAvailableTeachers` ga o'tkazildi.

### Undan ham oldingi ish — "Lid → guruh oqimi va xona teshigi"

Ikki qismli ish: biri — avvalgi sessiyada **qoldirilgan teshik**,
ikkinchisi — rejadagi oqim.

#### 1. Xona tekshiruvi guruh yaratishda ham bor

⚠️ **Bu men qoldirgan teshik edi.** `groupController.createGroup`
jadval yozuvlarini **o'zi yasaydi**, ya'ni `scheduleController` ni
chetlab o'tadi. Xona tekshiruvi faqat o'sha ikkinchi joyda bo'lgani
uchun, guruh orqali yaratilgan dars butun xona tizimidan tashqarida
qolardi: ikki guruh bir xonaga tushib, buni hech kim ko'rmasdi.

Endi `createGroup` ham `roomId` qabul qiladi, ziddiyatni tekshiradi
(409 + `forceRoom`) va sig'im ogohlantirishini qaytaradi.

⚠️ **Yangi joyda `Schedule` yaratsangiz xona tekshiruvini ham
qo'shing** — backend `CLAUDE.md` ga yozib qo'yildi.

#### 2. Lid → guruh → jadval bitta oynada

Ilgari: mos guruh bo'lmasa administrator `Guruhlar` sahifasiga o'tib,
guruh yaratib, jadval qo'shib, keyin `Lidlar` ga **qaytib** kelishi
kerak edi. To'rtta sahifa — va yo'lda lid ma'lumoti yo'qolardi.

Endi konvertatsiya oynasida ikkita tanlov: **mavjud guruh** yoki
**yangi guruh**. Yangisida guruh nomi, fan, narx, ustoz, kunlar,
vaqt va xona bir joyda. **Fan lidan o'zi ko'chadi** — aynan shu
ma'lumot sahifalar orasida yo'qolardi.

**Ikkita ataylab qilingan qaror:**

1. **Backendda birlashtirmadik.** Frontend avval `createGroup`,
   keyin `convertLead` chaqiradi. Guruh yaratish mantig'i (tarif
   limiti, ustoz bandligi, xona ziddiyati) `createGroup` da va uni
   ikkinchi joyda takrorlash o'sha qoidalarni ikkiga bo'lib
   yubororardi.
2. **Yarim yo'lda uzilsa guruh QOLADI** va ro'yxatda ko'rinadi —
   administrator qaytadan urinib uni tanlaydi. Yo'qolgan guruhdan
   ko'ra ko'rinib turgan ortiqcha guruh yaxshiroq.

Yo'lda `Leads.vue` dagi qattiq yozilgan matnlar 9 tadan **7 taga**
tushdi (konvertatsiya oynasi tarjima qilindi).

### Eskiroq — kunlik kassa xabari

Kassa zanjiri to'liq edi, lekin direktor uni **ko'rish uchun saytga
kirishi** kerak edi — va u har kuni kirmaydi. Uch kundan keyin kirsa,
uch kunlik yopilmagan smena chiqadi va endi hech kim eslay olmaydi.

⚠️ **Yo'lda ma'lum bo'ldi: bot ilgari faqat ota-ona uchun edi.**
Direktorga tizimdan xabar yuborishning umuman yo'li yo'q edi. Ya'ni
avval **kanalning o'zini** qurish kerak bo'ldi — va u bitta funksiya
uchun emas: keyingi xabarlar (ketish arafasidagi o'quvchi,
tasdiqlanmagan to'lov) ham shu yerdan ketadi.

**Backend:**
- `Teacher.telegram` — `chatId`, hash bo'lib yotgan bir martalik
  `linkTokenHash`, muddat. `Teacher.cashReport.mode`.
- `src/services/directorTelegram.js` — token yaratish/ishlatish/uzish.
- `src/bot/handlers.js` — `/start dir_<token>` **ota-ona oqimidan
  oldin** ushlanadi.
- `src/services/cashReport.js` — **sof** `buildReport()` + `collect()`.
- `src/cron/cashReportCron.js` — 21:00 Toshkent, `server.js` ga ulandi.
- `/teacher/telegram/director` (GET/POST/DELETE) va `.../mode`.
- 25 ta yangi test.

**Frontend:**
- `Cash.vue` — direktorga "Kunlik xabar" kartochkasi: ulash, rejim
  tanlash, uzish.
- ~17 ta i18n kalit × 3 til.

**Uchta ataylab qilingan qaror:**

1. **Standart `problems` — har kuni emas.** Har kuni "hammasi joyida"
   yozsak, direktor bir haftada xabarni o'qimay qo'yadi va rostdan
   muhim kunini ham ko'rmaydi. Bu — `notify.js` dagi "farzandingiz
   darsga keldi" xabari bilan **aynan bir xil xato**, u yerda bir
   marta o'rganilgan. `daily` — xohlagan direktor uchun.
2. **Direktor oqimi ota-onanikidan butunlay alohida.** `handleStart`
   da direktor tokeni birinchi tekshiriladi. Aralashsa markaz
   xabarlari begona odamga ketardi.
3. **Token hash, bir martalik, 15 daqiqalik.** Telegram havolasi
   yozishmada qolib ketadi; muddatsiz token o'sha yozishmani ko'rgan
   har kimga markaz xabarlarini ochib berardi.

⚠️ Telegram **403** = direktor botni bloklagan. Bu xato emas, holat:
ulanish tozalanadi, aks holda har kuni log'ga bir xil xato yozilardi.

### Eskiroq — pulni topshirish

Kassaning **ikkinchi yarmi**. Birinchi yarim (`CashShift`) bitta
savolga javob berardi: "qutida qancha bo'lishi kerak edi va qancha
bor?". Lekin smenani yopish — bu faqat **"men sanadim"** degani.
Undan keyin pul jismonan direktorga o'tadi va o'sha o'tish hech
qayerda yozilmasdi: ertasiga direktor "menga 400 000 berilgan" desa,
administratorda dalil yo'q edi.

**Backend:**
- `src/models/CashHandover.js` — o'chirish bloklangan, holatlar
  `pending` / `confirmed` / `disputed` / `cancelled`.
- `src/services/cashHandover.js` — `owedBy`, `create`, `confirm`,
  `cancel`.
- `cashController` + `/lc/cash/handover{,/mine,/inbox,/:id/confirm,/:id/cancel}`,
  `/lc/cash/receivers`.
- `accountPurge.js` ga qo'shildi (`IMMUTABLE` to'plamiga ham).
- 17 ta yangi test.

**Frontend:**
- `Cash.vue` — "Sizga topshirilgan pul" (eng tepada), "Mening
  ustimdagi pul", topshirish va qabul qilish oynalari.
- ~28 ta i18n kalit × 3 til, audit jurnaliga `cash.handover_*`.

**To'rtta ataylab qilingan qaror:**

1. **Ikki tomonlama tasdiq.** Bir tomonlama yozuv hech narsani
   isbotlamaydi: "topshirdim" deb yozib qo'yish oson. Yozuv
   `pending` bo'lib turadi va faqat **qabul qiluvchi** uni
   tasdiqlaydi — direktor ham boshqa birovga topshirilgan pulni
   "oldim" deb yoza olmaydi.
2. **Farq bo'lsa ikkala son ham qoladi.** Topshiruvchi "500 000"
   deydi, qabul qiluvchi "480 000" sanaydi → `disputed`, ikkalasi
   yonma-yon. Hakamlik odamniki.
3. **Sanalgan summa majburiy, "ha" tugmasi emas.** Tugmani
   o'ylamasdan bosish oson; summani yozish esa qo'ldagi pulni
   sanashga majbur qiladi — butun ish shuning uchun qilinyapti.
   Shu sababli maydon oldindan **to'ldirilmaydi**.
4. **Bekor qilingan topshiriq qoldiqni qaytaradi.** Aks holda
   adashib bosilgan tugma pulni tizimdan butunlay yo'qotib
   yubororardi. O'chirish emas, `cancelled` — iz qoladi.

⚠️ **Faqat yopilgan smenalar topshirishga kiradi** va `countedCash`
olinadi, `expected.cash` emas: odamning qo'lida sanalgan pul bor.
Tartib majburiy — avval kunni yop, keyin topshir.

### Eskiroq — xarajat kassaga ulandi

**Funksiya emas, TUZATISH — va ayblov darajasidagi tuzatish.**

`Expense` kassa bilan hech qanday bog'liq emas edi. Administrator kun
bo'yi naqd yig'adi, tushdan keyin qutidan 200 000 so'm olib marker
sotib oladi, xarajatni kiritadi. Kechqurun smenani yopadi — tizim
**"kamomad 200 000"** deb yozadi. Halol ishlagan odam har safar
o'g'ri bo'lib chiqardi, direktor esa jurnalda haqiqiy kamomadni
soxtasidan ajrata olmasdi.

**Backend:**
- `Expense` ga `paidFrom`, `spentDate`, `paidBy` qo'shildi.
- `services/cashShift.js` da **sof** `foldTotals()` — formula test
  bilan qulflangan.
- `CashShift.expected` ga `cashIn`, `expenses`, `expenseCount`.
- `shiftView` xarajatlar **ro'yxatini** ham qaytaradi.
- `expense.created` / `expense.deleted` audit jurnaliga tushadi.
- 12 ta yangi test.

**Frontend:**
- `Expenses.vue` — manba tanlagichi, xarajat sanasi, jadvalda manba
  va kim olgani.
- `Cash.vue` — chiqim alohida kartochka, hisob ochiq (`500 000 −
  200 000`), xarajatlar ro'yxati.
- Route `/staff/expenses` + menyu (`manageExpenses`).

**Yo'lda yopilgan qarz:** `manageExpenses` huquqi interfeysda
**taklif qilinardi**, lekin backend'da hech qayerda tekshirilmasdi va
xodimga sahifa ham yo'q edi. Direktor buxgalteriga "Xarajat kiritish"
huquqini beradi — buxgalter hech narsa ko'rmaydi. Endi uchala qatlam
mos (`npm run check:perms` — 18 ta havola, 0 nomuvofiq).

**Uchta ataylab qilingan qaror:**

1. **`paidFrom` standart holda BO'SH.** Eski xarajatlarda maydon yo'q;
   ularni "naqd" deb hisoblasak o'tmishni qayta yozgan bo'lardik va
   kutilmagan kamomad/ortiqcha yasardik. Bo'sh = kassaga tegmaydi.
   Interfeysdagi standart tanlov `cash` — u **aniq qiymat** yozadi,
   bu boshqa narsa.
2. **`spentDate` — `createdAt` emas.** Xarajat ertasiga kiritilishi
   mumkin. `createdAt` ga tayansak, o'sha pul bugungi kassadan chiqib,
   kechagi kunda tushunarsiz kamomad qolardi.
3. **Tushum va chiqim alohida ko'rinadi.** "50 000 kam" bilan
   "50 000 chiqim qilingan" butunlay boshqa gap. Faqat yakuniy sonni
   ko'rsatsak, smenani yopayotgan odam qutidagi pul nega kamligini
   tushunmasdi.

⚠️ **Naqd xarajatni o'chirish kassadagi kutilgan summani KO'TARADI** —
ya'ni kechagi kamomadni yashirishning eng oson yo'li shu. Shuning
uchun `expense.deleted` jurnalda **qizil** (`DANGER`) ro'yxatda.

### Eskiroq — bo'sh vaqt qidirgichi

**"Yangi guruhni qachon ochsam bo'ladi?"** Jarayon teskari edi:
administrator vaqtni **taxmin qiladi**, tizim "ustoz band" yoki "xona
band" deydi, u yana taxmin qiladi. Ota-ona telefonda kutib turadi va
beshinchi urinishda "keyin qo'ng'iroq qilaman" deb qo'yiladi — lid
aynan shu daqiqada sovib ketadi.

Bu yerda **yangi ma'lumot yo'q**. Uchala cheklov allaqachon kodda
bor edi, ular hech qachon kesishtirilmagan.

**Backend** (commit `a0a9776`):
- `src/utils/slotFinder.js` — **sof modul**, bazaga tegmaydi.
- `src/controllers/slotController.js` + `GET /lc/schedule/free-slots`.
- 22 ta yangi test.

**Frontend** (commit `a9ec8bf`):
- `src/components/FreeSlotFinder.vue` — jadval sahifasidan ochiladi.
- ~25 ta i18n kalit × 3 til.

**Uchta ataylab qilingan qaror:**

1. **"Topilmadi" javob emas.** Hech nima chiqmasa `blocked` qaytadi:
   qaysi oynada nima to'sqinlik qilgani ("payshanba 18:00 da ustoz
   bor, xona yo'q"). Quruq "topilmadi" dan keyin administrator nima
   qilishini bilmaydi.
2. **Topilgan vaqt BOSILADI** — dars qo'shish oynasi o'sha kun, vaqt
   va xona bilan to'ldirilib ochiladi. Faqat ko'rsatsak, administrator
   raqamlarni qo'lda ko'chirib yozardi va aynan shu yerda xato
   qilardi.
3. **Ish vaqti `Teacher.supportHours` dan OLINMAYDI.** U — qo'shimcha
   mashg'ulot qabul vaqti, boshqa narsa. Direktor qabulni 14:00–16:00
   qilib qo'ysa, guruh jadvali ham o'shanga qisilib qolardi. Qidiruv
   oynasini administrator o'zi beradi.

⚠️ **Xonaga bog'lanmagan darslar natijani to'liq emas qiladi** —
javobda `unlinkedLessons` bo'lib qaytadi va interfeys `Xonalar`
sahifasiga yo'naltiradi (import). Buni yashirmang.

### Eskiroq — xona boshqaruvi

Rollar bo'yicha o'ylashning **uchinchi** katta funksiyasi va avvalgi
HANDOFF'da ⭐ bilan tavsiya qilingani. `Schedule.room` oddiy **matn
maydoni** edi: ustoz bandligi tekshirilardi, **xona bandligi — yo'q**.
Ya'ni ikki guruhni bir vaqtda bitta xonaga qo'yish mumkin edi va bu
faqat dars boshlanganda, eshik oldida ikkita ustoz va yigirmata bola
turganda bilinardi.

Matnning ikkinchi kasali: bir xil xona har xil yozilardi — "205",
"205-xona", "Lab-1", "lab 1". Tizim ularni boshqa-boshqa xona deb
bilardi, ya'ni ziddiyatni topa olmasdi ham.

**Backend:**
- `src/models/Room.js` — nom, sig'im, filial, izoh. Noyob indeks
  `(director, branch, name)`. Xona **o'chirilmaydi, arxivlanadi**.
- `src/utils/roomAvailability.js` — `roomKeyOf`, `pickRoomConflicts`
  (sof funksiyalar), `findRoomConflicts`, `roomsAvailability`.
- `src/controllers/roomController.js` + `/lc/rooms{,/free,/occupancy,/import}`.
- `Schedule` ga `roomRef` qo'shildi, `room` matni **nom nusxasi** bo'lib
  qoldi. Migratsiya kerak emas.
- `scheduleController` — xona ziddiyati (409 + `forceRoom`) va sig'im
  ogohlantirishi (`warning`).
- Yangi ruxsat: `manageRooms` (standart rollardan faqat Branch Manager'da).
- 15 ta yangi test.

**Frontend:**
- `src/views/lc/Rooms.vue` — xonalar ro'yxati, haftalik bandlik setkasi,
  jadvaldan import.
- `Schedule.vue` — matn maydoni o'rniga xona tanlagichi; har bir xona
  yonida **bo'sh/band** yozuvi.
- Route `/lc/rooms` va `/staff/rooms`, menyu, ~40 ta i18n kalit × 3 til,
  audit jurnaliga `room.*` amallari.

**To'rtta ataylab qilingan qaror** — o'zgartirishdan oldin o'ylang:

1. **Band xonalar ro'yxatdan olib tashlanmaydi.** Administrator "205
   yo'q" degan xulosa chiqarmasligi kerak — u "205 band, Ingliz A2
   o'tirgan" ni ko'rsin. Aks holda sababini bilmay direktorni bezovta
   qiladi.
2. **Ziddiyat tugmani bosishdan OLDIN ko'rinadi** (kassadagi farq bilan
   bir xil qoida). Band xona tanlansa tugma matni "Baribir qo'shish" ga
   o'zgaradi — odam nima qilayotganini bilib bossin.
3. **Sig'im to'sib qo'ymaydi**, ogohlantiradi. 12 kishilik xonaga 14
   bola sig'adi. Bloklasak administrator xona tanlashni umuman tashlab
   qo'yardi va biz eng muhimidan — bandlik tekshiruvidan — ayrilardik.
4. **`force` va `forceRoom` — ikki xil bayroq.** Bittaga birlashtirsak,
   xona ziddiyatini ataylab o'tkazgan odam o'zi bilmagan holda **ustoz**
   ziddiyatini ham o'tkazib yuborardi.

⚠️ **Eski matn xonalar uchun `POST /lc/rooms/import` bor.** Busiz o'tish
davri cho'zilardi: yangi darslar xonaga bog'lanadi, eskilari matn bo'lib
qolaveradi va ular orasidagi ziddiyat hech qachon topilmasdi. Import
avval **ko'rsatadi**, keyin yozadi (`apply: true`).

### Eskiroq ishlar — kassa va o'zgarishlar tarixi

Administrator kun bo'yi naqd pul oladi va kechqurun direktorga
topshiradi — 29 ta modelning hech birida smena tushunchasi yo'q edi.

**Backend** (commit `6137bcf`): `CashShift.js` (o'zgarmas),
`services/cashShift.js`, `cashController.js` + `/lc/cash/*`,
`MonthlyPayment` ga `paymentMethod` va `receivedBy`, ruxsat `viewCash`.
**Frontend** (commit `314ea98`): `views/lc/Cash.vue`, route `/lc/cash` va
`/staff/cash`.

**Uchta ataylab qilingan qaror:** "smena ochish" tugmasi yo'q (smena =
ODAM + KUN); farq tugmani bosishdan OLDIN ko'rinadi; to'lov belgilashda
oyna chiqmaydi (usul sahifa tepasida bir marta tanlanadi).

### Undan oldingi ish — "O'zgarishlar tarixi" (audit log)

Direktor "to'lovni kim o'zgartirdi?" degan savolga javob berolmasdi.

**Backend** (commit `10d27a1`): `AuditLog.js` — **o'zgarmas** (oltita
yozish amali bloklangan), TTL 365 kun. `services/audit.js` —
**`await` qilinmaydi va hech qachon `throw` qilmaydi**. Ruxsat
`viewAudit`. **Frontend** (commit `42df853`): `views/lc/AuditLog.vue`.

**Ataylab qilingan qaror:** `viewAudit` standart rollarda **yo'q**.
O'z izini ko'ra oladigan administrator uchun jurnal nazorat emas,
**ogohlantirishga** aylanadi.

### Tekshiruvlar — hammasi yashil

```
backend :  npm test              →  380/380
backend :  npm run check:messages →  yangi xabarlar ru/en bilan
frontend:  npm run build         →  ✓
frontend:  npm run check         →  check:api, check:perms, check:css, check:i18n — 0 xato
```

---

## 4. 🔴 TO'XTAB TURGAN ISHLAR — Muhammadumar qilishi kerak

### 4.1 Push — ✅ YECHILDI (2026-08-20)

**Ikkala repo ham to'liq push qilingan, qarz yo'q.**

Bu bo'lim oylab "SSH kalit paroli" deb turdi va yechim sifatida
`ssh-add` ko'rsatardi. **Diagnoz noto'g'ri edi.** Ikkala remote
ham **HTTPS**, SSH kaliti ularga umuman tegmaydi:

```
origin  https://github.com/muhammadumar344/beckend_fond.git
origin  https://github.com/muhammadumar344/Fond_front.git
```

Haqiqiy sabab: Git Credential Manager o'rnatilgan, lekin GitHub
hisobi saqlanmagan edi. Muhammadumar bir marta oddiy terminaldan
push qildi → brauzerda kirdi → token Windows Credential
Manager'ga saqlandi. **Shundan keyin agent ham push qila oladi**
va qildi ham.

⚠️ Agar kelajakda yana so'ray boshlasa — bu SSH emas, token
eskirgan. Tekshirish (hisobga kirmasdan):

```powershell
cmdkey /list | Select-String github
```

Yozuv yo'qolgan bo'lsa, yana bir marta qo'lda `git push` —
brauzer ochiladi va token qaytadan saqlanadi.

### 4.2 Qolganlari

- **Render → Environment:** `TELEGRAM_BOT_TOKEN` (almashtirilgan — eskisi
  ochiq qolgan edi), `NODE_ENV=production`, Cloudinary kalitlari.
- **MongoDB Atlas → `teachers`:** `notgmail@mail.ru` test yozuvini o'chirish.
- **Domen:** `lumocrm.uz` sotib olingach →
  `node scripts/set-domain.cjs lumocrm.uz --apply` (frontend repoda).
- **Deploy'dan keyin:** har bir markazda `Xonalar` sahifasini ochib
  "Jadvaldan xona yaratish" ni bosish kerak — eski matn xonalar shundan
  keyin bandlik tekshiruviga tushadi. Bu bir martalik ish.

---

## 5. Keyin nima qilinadi

Rollar bo'yicha o'ylash davom etadi. Kassa zanjiri va lid→guruh
oqimi tugadi.

### A. Qolgan tarjimalar

Landing tugadi. Qolgani — ichki sahifalar, ahamiyati kamroq:

```
tma/App.vue          32     Profile.vue          17
Onboarding.vue       20     ResetPassword.vue    13
StaffManagement.vue  20     VerifyEmail.vue      10
```

⚠️ **`tma/App.vue` (32 ta) qolganlaridan muhimroq** — uni
ota-onalar ko'radi, xodim emas. Ruscha gapiradigan ota-ona
farzandining bahosini tushunmasa, markazga qo'ng'iroq qiladi.

Backend'da ham **26 ta** tarjimasiz xabar (`npm run check:messages`).

### B. Guruh/sinf ajratish (reja 1.2)

LC guruhlari hali `Class` da yashaydi. Skript va hujjat **tayyor**,
ishga tushirilmagan: `src/scripts/migrateGroups.js`,
`docs/GROUP_MIGRATION.md`. Asosiy qiyinchilik — 13 joydagi
`populate("class")`.

⚠️ Bazadan nusxa olmasdan tegmang.

### Ataylab keyinga qoldirilgan (mayda ish deb hisoblangan)

`Reports.vue` (10), `Leads.vue` (7), `StaffManagement.vue` (20) da
tarjima qilinmagan matnlar. `Schedule.vue` dagi `validate()` ichida ham
uchta qattiq yozilgan matn bor. `npm run check:i18n` ularni ogohlantirish
sifatida ko'rsatadi, build'ni to'xtatmaydi. Katta funksiya orasida
o'z-o'zidan tuzatilsa — yaxshi; alohida ish sifatida qilinmasin.

---

## 6. Qonga singgan tuzoqlar

Bular allaqachon bir marta bug chiqargan. Takrorlamang.

1. **Qator oxiri (CRLF/LF) — repo ARALASH.** Frontendda `core.autocrlf`
   **o'chiq**, va fayllar bir xil emas: `router/index.js` va
   `navigation.js` — CRLF, `i18n/locales/*.js` va `views/lc/*.vue` — LF.
   Tahrirlash vositasi faylni ikkinchi shaklga o'tkazib yuborsa, 20
   qatorlik tuzatish 2000 qatorlik diff bo'lib ko'rinadi va haqiqiy
   o'zgarish ko'milib ketadi.

   ⚠️ `grep -c $'\r'` bilan tekshirmang — Git Bash'da u **har bir
   qatorni** sanaydi va "hammasi CRLF" deb yolg'on javob beradi.
   To'g'risi:

   ```bash
   python -c "b=open('FAYL','rb').read(); print('CRLF',b.count(b'\r\n'),'LF',b.count(b'\n')-b.count(b'\r\n'))"
   ```

   Commit'dan oldin **doim** `git diff --stat`. Raqam kutilganidan
   o'nlab marta katta bo'lsa — sabab shu.

2. **`sed -i` shu tuzoqning eng tez yo'li.** `.vue` fayllarga
   ishlatmang, `Edit` ishlating. Nom almashtirganda ehtiyot bo'ling:
   bir marta `lcApi.` → `lcAPI.` almashtiruvi **import yo'lini** ham
   (`services/lcApi.js` → `lcAPI.js`) o'zgartirib qo'ygan. Windows'da
   hech narsa sezilmaydi, Netlify'da build yiqiladi (`i18n` tuzog'ining
   aynan o'zi).

3. **`aggregate()` Mongoose sxemasidan o'tmaydi.** Matn ID avtomatik
   `ObjectId` ga aylanmaydi — `$match` **jimgina bo'sh** qaytaradi, xato
   bermaydi. Qo'lda cast qiling. `Model.collection.*` ham shunday.

4. **Vue `scoped` CSS bolaning faqat ILDIZ elementiga tegadi.** Ichkariga
   yozgan uslubingiz ishlamaydi. Bir marta production'da QR kod oq fonsiz
   chizilib, skaner o'qiy olmagan.

5. **`require('./src/server.js')` — bu tekshiruv emas, deploy.** Fayl
   oxirida `app.listen()`, `mongoose.connect()`, `initBot()` bor va import
   paytida darhol ishlaydi. Bir marta shunday qilinib, production bot
   ikkinchi nusxa polling'ga kirgan va Telegram `409 Conflict` bergan.
   Tekshiruvga faqat `routes/`, `controllers/`, `models/`, `utils/`,
   `services/` ni qo'shing.

6. **`AuditLog` va `CashShift` `deleteMany` ni bloklaydi.** Shuning uchun
   `accountPurge.js` da **faqat o'sha bitta joyda** drayver darajasidagi
   `Model.collection.deleteMany()` ishlatiladi (`IMMUTABLE` to'plami).
   Ro'yxatga yangi nom qo'shishdan oldin o'ylang: chetlab o'tish faqat
   o'zgarmas modellar uchun, faqat shu yerda.

7. **Yangi menyu havolasi = 3 ta joy.** `src/config/navigation.js`,
   `router/index.js` dagi route, `TITLES` yozuvi. `npm run check:perms`
   buni nazorat qiladi.

8. **Yangi model qo'shsangiz `accountPurge.js` ga ham qo'shing.** Aks holda
   hisob o'chirilganda bazada egasiz o'quvchi ismlari va telefon raqamlari
   qolib ketadi. `npm test` buni tekshiradi. `AuditLog` va `CashShift`
   o'zgarmas, shuning uchun u yerda drayver darajasida o'chiriladi —
   `IMMUTABLE` to'plamiga qarang.

9. **Yangi xabar yozsangiz `utils/messages.js` ga ham qo'shing.** Aks
   holda ruscha va inglizcha interfeysda o'sha xabar **jimgina**
   o'zbekcha chiqaveradi — xato bermaydi. `npm run check:messages`
   aynan shuni topadi.

---

## 7. Har o'zgarishdan keyin

```bash
# backend
cd /c/Users/Lenovo/Desktop/school_fond
npm test
npm run check:messages

# frontend
cd /c/Users/Lenovo/Desktop/font_front/font
npm run build
npm run check          # api + perms + css + i18n
git diff --stat        # CRLF tuzog'i uchun
```

Commit xabari — **o'zbekcha**, nima o'zgargani emas, **nima uchun**
o'zgargani. Namuna: `O'zgarishlar tarixi: kim to'lovni o'zgartirdi`.
