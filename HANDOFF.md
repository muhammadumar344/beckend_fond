# HANDOFF — ishni qayerdan davom ettirish kerak

> **Bu fayl ikkala repoda bir xil.** Birini o'zgartirsangiz, ikkinchisini ham
> yangilang:
> - `Desktop/school_fond/HANDOFF.md` (backend)
> - `Desktop/font_front/font/HANDOFF.md` (frontend)
>
> Oxirgi yangilanish: **2026-09-04** (ikkala PR `main` ga qo'shildi va
> jonli saytga chiqdi; Fond rejimi tozalandi: jadval ustunlari, pul
> bo'linishi, to'lov usullari va qidiruv)
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
7. **Tarjimaga ortiqcha vaqt sarflamang** (2026-08-20 da aytilgan).
   Frontend allaqachon to'liq uch tilda va `npm run check` uni
   qulflab turibdi — qarz qaytib to'planmaydi. E'tibor
   **funksiya, yangilik, qulaylik, sozlama va dizaynga** qaratilsin.
   Qolgan tarjimalar (backend xabarlari) katta ish orasida
   o'z-o'zidan tuzatilsa — yaxshi; alohida ish sifatida emas.

---

## 3. Hozirgi holat

### Oxirgi tugagan ish — "Ota-onani botga ulash + responsive" (2026-09-05)

Branch: `claude/handoff-tasks-review-x4cfch` (ikkala repoda),
**hali `main` ga qo'shilmagan.** Unda beshta ish bor: to'rttasi
avvalgi roundlardan (§ pastda), beshinchisi shu kungi.

**1. Ota-onani botga ulash — HAVOLA + QR.**

Muhammadumar aytdi: "qr code bazi paytlari muammo tugdiradi shu
uchun biz link yaratib berishimiz kerak". Sinf rahbari Sinflar
sahifasida Telegram tugmasini bosadi va bitta havola oladi:

```
havola/QR → /start cls_<token> → bot QAYSI SINF ekanini biladi
   ├─ raqam sinf ro'yxatida bor  → DARROV ulanadi
   └─ raqam topilmadi            → sinf ro'yxati ko'rsatiladi
                                   → bolani tanlaydi
                                   → status: pending, isActive: false
                                   → sinf rahbari tasdiqlaydi
```

⚠️ **Havolaning O'ZI hech narsa ochmaydi va bu qaror ataylab.**
Havola sinf guruhiga tashlanadi, ya'ni tarqaydi. Agar u bilan
ro'yxatdan istalgan bolani tanlab "ota-onasi" bo'lib qo'yish
mumkin bo'lsa, guruhga kirgan har kim begona bolaning
baholarini ochardi — eski botdagi aynan o'sha teshik
(CLAUDE.md → `legacy`). Shuning uchun tartib: **raqam
birinchi**, ro'yxat esa faqat tasdiq kutadigan so'rov yaratadi.

⚠️ Tasdiqlanmagan yozuv `isActive: false` bo'lib turadi — butun
kod allaqachon shu maydon bo'yicha filtrlaydi (Mini App
ruxsati, xabar yuborish, ro'yxatlar), ya'ni har bir yangi joyda
"pending ni chiqarma" deb eslab qolish shart emas.

⚠️ Token tugma bosilganda QAYTA tekshiriladi: tugma yozishmada
qolib ketadi, havola bekor qilinsa eski tugma ham o'lishi kerak.

⚠️ Modal ochilganda **GET** yuboriladi, POST emas — POST token
yasaydi, ya'ni "havolani ko'rmoqchi" bo'lgan har bosish devorga
chop etilgan QR ni o'ldirardi.

⚠️ Tasdiq ro'yxati **Sinflar sahifasining o'zida**, alohida menyu
qilinmadi: so'rov kuniga bir-ikkita keladi va savol aynan shu
yerda tug'iladi. Menyuda yana bitta qator bo'lsa, direktor unga
oyda bir marta kirardi va ota-onalar kutib qolardi.

Yangi: `Class.parentToken`, `StudentLink.status/requestedClass/
tgLang`, `verifiedVia: "approved"` (kod bilan bir daraja),
3 ta endpoint, `components/ParentLinkModal.vue`,
`test/parentLink.test.js` (14 ta).

**2. Tezkor qidiruvdan o'quvchining qatoriga.**

"tezkor qidruvda oquvchi chiqanda ustiga bossa … osha bolani
topib berishi kerak … va belgilayman". Ilgari natijaga
bosilganda faqat sinf sahifasi ochilardi va administrator 30
qator ichidan bolani yana ko'z bilan qidirardi. Endi
`?student=` bilan boradi: to'lovlar tabi ochiladi, qator
ajratib ko'rsatiladi (4 soniya) va o'sha yerda belgilanadi.
Varaqa hali yaratilmagan bo'lsa o'quvchilar ro'yxatiga
qaytadi — bo'sh ekran "topilmadi" bo'lib ko'rinmasin.

**3. Telefonda qidiruv ochilganda sidebar yopiladi.** Tugma
drawer ichida turadi, oyna esa ustiga ochilardi.

**4. Qirqilgan jadvallar.**

Uchta jadval o'ragichida `overflow: hidden` turardi va o'ngdagi
ustunlar UMUMAN ko'rinmasdi, surish ham mumkin emasdi:
`admin/Teachers` (Tarif, Amal), `lc/Grades` (oyning ikkinchi
yarmi — 31 ta kun ustuni har qanday ekranda kengroq),
`lc/Attendance`. Payments / Expenses / ClassDetail da surish
faqat ≤768px da ochilardi — endi har doim.

⚠️ **`grid-template-columns` dagi `1fr` ustuni o'z matnidan tor
bo'lolmaydi.** Uzun ismli o'quvchi `lc/Students` qatorini 130px
ga kengaytirib, qator o'z fonidan chiqib ketardi — sarlavha
bilan ustunlar bir-biriga to'g'ri kelmasdi. Yechim
`minmax(0, 1fr)`. Xuddi shu xato `staff/Dashboard` tezkor
havolalarida ham bor edi.

O'lchov usuli: `dist/_tbl.html` — sahifani kerakli kenglikdagi
iframe'da ochib, `scrollWidth > clientWidth` bo'lgan va
surilmaydigan elementlarni sanaydi. 430px va 360px da Fond,
LC, xodim va admin panelining hamma sahifasi tekshirildi.

⚠️ Bitta "xato" ataylab qoldirildi: `lc/Dashboard` dagi
`.sc-link { margin-right: -0.45rem }` — u kartochkaning
padding'i ichiga tushadi, sahifa surilmaydi.

**5. `{{ }}` ichidagi matn ikki tekshiruv orasidan o'tib ketardi.**

`check:i18n` shablonni qaraydi, lekin `{{ ... }}` ni TOZALAB
boshlaydi; `check:uztext` esa faqat `<script>` ni. Ya'ni
`{{ mode === 'chart' ? 'Jadval' : 'Grafik' }}` ikkalasidan ham
o'tardi — va **33 ta matn** aynan shunday to'plangan edi:
Profil, Kirish, Ro'yxatdan o'tish, admin paneli, xodim
maoshlari, rol shablonlari. Ruscha interfeysdagi odam ularni
o'zbekcha ko'rardi.

`check:uztext` ga ikkinchi bo'lim qo'shildi: `{{ }}` ichidagi
**chiqish holatidagi** satr (`? '…' : '…'`, `|| '…'`).
`$t(...)` ichidagi kalitlar va mahsulot nomlari chetlab
o'tiladi — soxta xato beradigan guardrail'ga hech kim
qaramaydi.

`check:i18n` ning bitta so'z qoidasi ham tuzatildi: oxiridagi
tinish belgisi olib tashlanadi, aks holda
`<span>Yuklanmoqda...</span>` undan o'tib ketardi. Yana 6 ta
matn topildi — jumladan xodim yaratilganda chiqadigan
"Parol:" (ikki joyda).

---

### Undan oldingi ish — "Fond rejimi tozalandi + DEPLOY" (2026-09-04)

**Ikkala PR `main` ga qo'shildi** (frontend #1, backend #1) — ya'ni
72 ta commit jonli saytga chiqdi: Netlify `schoolfonds.uz` ni,
Render `beckend-fond.onrender.com` ni qayta yig'di. Ilgari
faqat ikkita mayda tuzatish qo'lda ko'chirilgandi.

Shu roundda qilingan to'rt ish:

**1. Fond rejimida jadval buglari.** Muhammadumar aytdi:
"table lar malumotlarni toliq chiqazmayabti". Brauzerda 1440px
va 430px da surat olib qaraldi va uch xil xato topildi:

- **Pul ikkiga bo'linardi.** "1 200 000 so'm" tor kartochkada
  "1 200" / "000 so'm" bo'lib ketardi, Hisobotlar sahifasida
  esa TO'RTGA: "1"/"200"/"000"/"so'm". `grid` ustunni qat'iy
  teng bo'lib beradi va ichidagi raqamga qaramaydi. Endi
  `flex` + `min-width: min(100%, max-content)` — kartochka
  raqam qanchalik uzun bo'lsa shunchalik joy oladi — va
  summada `white-space: nowrap`. Kenglikni oshirish yechim
  emas edi: maktabda 12 000 000 ham bo'ladi.
  Sahifalar: `teacher/Dashboard.vue`, `teacher/Reports.vue`.
- **Jadval ustunlari mos kelmasdi.** Har sinf uchun ALOHIDA
  jadval chiziladi va brauzer har birining ustunini o'z
  ichidagi matnga qarab o'lchardi — ikkita jadval ustma-ust
  turib "Sana" biriga chapda, ikkinchisida o'rtada tushardi.
  `table-layout: fixed` + **foizli** kenglik (px emas: kichik
  ekranda shrift kichrayadi, qat'iy px esa o'sha-o'sha qolib
  ismga joy qoldirmasdi).
- Yo'l-yo'lakay: sana "02.09.202"/"6" bo'lib, "AMALLAR"
  sarlavhasi "AMA"/"LLAR" bo'lib, "Berildi" tugmasi qalamdan
  pastga tushib ketardi; Dashboard'da uzun sinf nomi
  "6 ta o'quvchi" belgisini kartochkadan surib chiqarardi.

**2. Fond rejimidan to'lov usullari olib tashlandi.**
"fond qanday tarzda tolanganini ahamiyati yoq". Naqd/karta/
o'tkazma tanlagichi endi faqat LC'da. Sabab kodda ham bor:
Fondda `CashShift` yo'q, ya'ni javob hech qayerda
ishlatilmasdi — har bir to'lovda ortiqcha qadam edi.

**3. Fond rejimida qidiruv ishlaydi** (ism / familiya / telefon).
Telefon uchun alohida naqsh kerak bo'ldi: bazada raqam
`+998 90 123 45 67`, direktor esa `901234567` deb yozadi —
oddiy naqsh probellar sabab MOS KELMASDI va qidiruv jimgina
"topilmadi" deb turardi. `utils/phone.js` → `phoneSearchRegex()`
oxirgi 9 raqamni olib, orasiga ixtiyoriy belgiga ruxsat beradi.
`test/phone.test.js` — 10 ta test, biri controller haqiqatan
chaqirayotganini tekshiradi.

**4. LC atamalari Fond rejimidan chiqarildi.** "Hamma
**guruh**ga yaratish", "**Markaz** xarajatlarini", Sinflar
sahifasi ostidagi "Xush kelibsiz" (bu umuman sarlavha osti
emas edi). Endi rejimga qarab: sinf / markaz. Yangi kalitlar
uchala tilda.

#### ⚠️ Audit qurolidagi jim teshik — 500px

Headless Chrome oynani **500px dan torroq QILMAYDI**. Ya'ni
`--window-size=430` bergan barcha oldingi "mobil" auditlar
aslida 500px da o'lchagan va **480px hamda 360px media
so'rovlari umuman sinalmagan**. Surat 430px chiqadi (kesilgan
ko'rinish), shuning uchun buni sezish qiyin.

Endi tekshiruv `dist/_mob.html` orqali: sahifa kerakli
kenglikdagi `iframe` ichida ochiladi va media so'rovlar
to'g'ri ishlaydi. Keyingi safar mobil ko'rinishni shu bilan
qarang.

---

### Undan oldingi ish — "Uchinchi Telegram xabari" (2026-08-29)

§5 da "uchinchisi uchun tayyor o'rin bor" deb yozilgan edi.
To'ldirildi: **oy boshidagi "varaqa yaratilmagan" xabari**.

**Nega aynan bu.** Rollar bo'yicha o'ylaganda eng qimmat
ko'rinmas yo'qotish shu: oylik to'lov varaqasi QO'LDA
yaratiladi va administrator bitta guruhni unutsa — o'sha oy
o'sha guruhdan pul **umuman so'ralmaydi**. Ota-onaga eslatma
ham ketmaydi, chunki `reminderCron` faqat MAVJUD varaqa
bo'yicha yuboradi. Na xato, na belgi; oy oxirida faqat "nega
tushum kam?" qoladi.

`GET /teacher/health` buni allaqachon ko'rsatardi — lekin u
SAHIFADA yotibdi va direktor har kuni saytga kirmaydi. Ketish
arafasidagi o'quvchilar bilan aynan bir xil muammo, aynan
o'sha yechim.

| | |
|---|---|
| Cron | `cron/billingAlertCron.js` — 2-sana 09:00 Toshkent |
| Matn | `services/billingAlert.js` → sof `buildAlert()` |
| Test | `test/billingAlert.test.js` — 16 ta |
| Sozlama | `teacher/Payments.vue` (`/teacher/payments` va `/lc/payments`) |

⚠️ **2-sana, 1-sana emas.** 1-sanada hali hech bir guruhda
varaqa yo'q — xabar butun ro'yxatni sanab shovqinga aylanardi.
1-sana varaqa yaratiladigan kun; 2-sanada varaqasiz qolgan
guruh — haqiqiy unutish, va oyning qolgan 28 kuni pulni
yig'ishga yetadi.

⚠️ **Ikkala rejim uchun ham.** Ketish xabari faqat LC'da
ma'noli edi (sinf rahbari bolalarni har kuni ko'radi), varaqani
unutish esa Fond'da ham xuddi shunday ko'rinmas.

**Xabarda summa bor** — "3 ta guruh" ni o'qigan odam ertaga
qilaman deydi, "7 500 000 so'm so'ralmayapti" ni o'qigan odam
hozir qiladi.

**To'rtta buzib sinash o'tkazildi** va bittasi SOXTA YASHIL
chiqdi: `startBillingAlertCron()` ni izohga olganda test
o'tib ketaverdi — naqsh izohdagi qatorga ham tushardi. Endi
test izohlarni oldindan olib tashlaydi (`markPayment` testidagi
`bodyOf` bilan bir xil sabab).

⚠️ **Yo'lda topilgan xato:** `check:messages` markPayment
ishidan beri **qizil turgan edi** ("Summa 0 dan kichik
bo'lmasligi kerak" tarjimasiz qolgan) va men uni "yashil" deb
aytgandim — faqat `tail` ni ko'rgan ekanman. Tuzatildi.

**Ochiq savol (yangi):** `billing.js` ham, bu xabar ham
o'quvchini `Student.class` bo'yicha sanaydi, ya'ni `Enrollment`
orqali qo'shimcha guruhda o'qiydigan bolaga **varaqa
yaratilmaydi**. Ikkalasi bir xil bo'lgani uchun xabar rost
gapiradi, lekin savol ochiq: qo'shimcha guruh uchun pul
olinishi kerakmi? Bu **mahsulot qarori** — javob "ha" bo'lsa
`services/billing.js` `utils/enrollment.js` ga o'tishi kerak.

---

### Undan oldingi ish — "Qolgan sahifalarni brauzerda tekshirish" (2026-08-29)

Muhammadumar: *"qolgan sahifalarni brauzerda ochib tekshir"*.

Barcha 60 dan ortiq marshrut **haqiqiy brauzerda** (headless
Chromium) to'rt rol ostida ochildi — Fond direktori, LC
direktori, xodim, admin — ish stoli (1440px) va telefon (430px)
kengligida. Soxta API bilan, production bazaga tegmasdan.

⚠️ **`npm run check` yashil bo'lsa ham topilmaydigan xatolar
chiqdi.** Hammasi bir turdan: kod to'g'ri, brauzer boshqacha
o'ylaydi.

**Eng kattasi — `Intl` va o'zbek tili**

Chromium'da `uz-UZ` lug'ati **umuman yo'q** (o'lchandi). Intl
bunday holatda xato bermaydi, jimgina `en-US` ga tushadi:

| Kod | Kutilgan | Haqiqatda chiqqan |
|---|---|---|
| `Intl.NumberFormat('uz-UZ')` | `1 200 000` | `1,200,000` |
| `{ style:'currency', currency:'UZS' }` | `1 200 000 so'm` | `UZS 1,200,000` |
| `toLocaleDateString('uz-UZ')` | `29.08.2026` | `2026-08-29` |

Ya'ni direktor o'z pulini xorijiy valyuta kabi ko'rardi. 24 ta
joyda shunday edi. Endi yagona manba: `utils/money.js` →
`groupDigits()` (Intl'siz, sof funksiya) va `i18n/months.js` →
`formatShortDate` / `formatDateTime`.

⚠️ CLAUDE.md da sana bo'limida "raqamli format xavfsiz" deb
yozilgan edi — **noto'g'ri**, tuzatildi.

**Boshqa topilganlar**

| Sahifa | Nima edi |
|---|---|
| `/lc` | `undefined%` — `=== null` `undefined` ni ushlamaydi |
| `/staff` | `NaN yanvar` — `formatDayMonth` to'liq ISO vaqtda buzilardi |
| `/lc/leads` | Kanban butun sahifani gorizontal siljitardi (1508 > 1440) |
| `/teacher/payments`, `/teacher/expenses` | Sarlavha ostida "Xush kelibsiz" turardi |
| `/staff/team` | "{filial} xodimlari" — tarjimasiz qolgan |
| `/teacher/reports` | 430px da kartochka matni kesilardi |
| Menyu | "Qo'shimcha mashg'ulot" sidebar'ga sig'masdi |

**Bosiladigan nishonlar** — 21×21 dan 18×18 gacha bo'lgan
tugmalar 32px ga kengaytirildi (ko'rinishi o'zgarmadi, faqat
bosiladigan maydon): lid kartochkasi, uy vazifasi, jadval,
to'lov tuzatish qalami, parolni ko'rsatish ko'zi, auth
sahifalaridagi matn havolalari, landing menyusi va futeri.

**Yangi guardrail**

| Buyruq | Nimani ushlaydi |
|---|---|
| `verify` §14 | `Intl`/`toLocale*` ga til kodi berilgan har qanday joy |

Buzib sinaldi: `.vue` va `.js` faylga bittadan qo'yildi —
ikkalasi ham ushlandi, qaytarilgach yashil.

⚠️ **Landing'dagi `@fondschool_uz`, `demo@fondschool.uz` va
`@SchoolfondsBot` ATAYLAB tegilmadi** — bular jonli
Telegram/Instagram hisoblari va ishlayotgan bot. Nomini
o'zgartirish havolalarni buzadi. Yangi hisoblar ochilsa
alohida qaror bilan almashtiriladi.

---

### Undan oldingi ish — "To'lov summasini tuzatish" (2026-08-29)

Muhammadumar: *"o'zing qaror qabul qilaver sayt yaxshi chiqsa
boldi"* — shu sababli HANDOFF §4.2 da turgan qaror bajarildi.

**Muammo**: varaqa guruhning `defaultAmount` idan kelar va keyin
HECH QACHON o'zgarmasdi. Ya'ni **chegirma, qisman to'lov va
aka-uka uchun boshqa narx** — hech biri kiritilmasdi, noto'g'ri
yozilgan summani ham tuzatib bo'lmasdi. Yagona yo'l varaqani
o'chirib qayta yaratish edi va u bilan birga **to'lov tarixi ham
yo'qolardi**.

**Nega ochish xavf qo'shmaydi**: bir xil huquqli odam
(`managePayments`) allaqachon o'chirib qayta yarata olardi.
Farqi shundaki, endi o'zgarish jurnalga tushadi
(`payment.amount_changed`) — kim, qachon, nimadan nimaga.

⚠️ **Ulashdan oldin ikkita teshik yopildi.** `markPayment`
uzoq vaqt route'ga ulanmay turgani uchun ular ko'rinmasdi:

1. **Filial cheklovi yo'q edi** — bitta filialga biriktirilgan
   administrator boshqa filial to'lovini o'zgartira olardi
   (`updatePaymentStatus` da bu tekshiruv bor edi).
2. **Summa tekshirilmasdi** — manfiy son ham, matn ham bazaga
   tushardi va hisobotlar jimgina buzilardi.

`test/markPayment.test.js` — sakkizta test. Uchtasi ataylab
buzib sinaldi: har birida test yiqildi, qaytarilgach o'tdi.

⚠️ Birinchi urinishda test **soxta yashil** bo'lgan edi: u
`ctx.branchFilter` so'zini qidirardi, u esa tanada ikki marta
uchraydi (shart va solishtirish). Endi butun himoya shakli
tekshiriladi.

**Uchta yangi guardrail**

| Buyruq | Nimani ushlaydi |
|---|---|
| `verify` §11 | Noma'lum slot nomi — Vue uni jimgina tashlab yuboradi va tugmalar chizilmaydi |
| `verify` §12 | Bitta faylda aralash qator oxiri (12 ta fayl topildi va tuzatildi) |
| `check:api` §3 | Jurnal amali tarjimasiz qolgan bo'lsa |

**Yo'lda topilgan ikkita jim xato**

- Men modalda `<template #footer>` deb yozdim, `AppModal` da esa
  slot `actions` deb ataladi. **Vue noma'lum slotni jimgina
  tashlab yuboradi**: oyna ochiladi, "Saqlash" va "Bekor"
  tugmalari esa umuman chizilmaydi. Xato yo'q, konsol toza.
  → `verify` §11.
- Jurnalda uchta amal tarjimasiz edi (`class.updated`,
  `student.updated`, `student.imported`) — direktor inglizcha
  kod so'zini ko'rardi. → `check:api` §3.

⚠️ **Ikkalasi ham "buzilmagan, shunchaki noto'g'ri" turdagi
xato** — aynan shu sababli oylab turishi mumkin edi.

---

### Undan oldingi ish — "Ertalab boshqacha ko'rinsin" (2026-08-29)

Muhammadumar: *"landing page dan tortib 404gacha… sayt iloji
boricha tshunarli va qulay bolsin… ertalab turganimda men
boshqacha dizaynda korishim kerak"*.

**Ko'rinishda nima o'zgardi**

| Ilgari | Endi |
|---|---|
| Faol menyu havolasi shaffof ko'k tus — hover'dan farq qilmasdi | To'ldirilgan gradient + oq matn. 14 ta o'xshash qatordan qaysi biri ochiq ekani bir qarashda ko'rinadi |
| Yon menyu kontentdan OCHROQ (ko'z avval unga tushardi) | Yon menyu to'qroq, asosiy maydon ochroq |
| Bitta sahifada ikkita "asosiy" tugma ikki xil rangda (`.btn-primary` to'q ko'k gradient, `AppButton` ochiq ko'k) | Bittasi — ochiq ko'k + qorong'i matn |
| Sahifalarning yarmida `max-width` bor, `margin: auto` yo'q → keng monitorda kontent chap chetga siqilgan | Kenglik va markazlash `App.vue` da, bitta joyda |
| 246 ta qattiq yozilgan HEX rang (Material palitrasi ham bor edi) | Tokenlar |
| 395 ta qo'lda yozilgan burchak radiusi, bir ekranda 11 xil yumaloqlik | `--r-*` tokenlari |
| Xodim panelida 8 ta rang, yarmi bir-biridan farq qilmasdi | 4 ta, ma'no bo'yicha |
| `.stat-card` QATOR edi — beshta sahifaning hech biri qator shaklida yozilmagan | Ustun (`:has(.sc-ico)` bo'lsa qator) |
| 404 — to'q sariq (ilovada "diqqat" rangi) | Ko'k, va qaysi manzil topilmagani yozilgan |

**Muhammadumar aytgan aniq xatolar — hammasi tuzatildi**

- Davomatda belgilangani bilinmasdi → to'ldirilgan tugma
- O'tib ketgan darslar panelda turardi → yo'qoladi
- Ctrl+K qidiruv Fond rejimida umuman ishlamasdi (`/lc/search`
  → 403) → `/teacher/search`
- "Mening maoshim" chap tarafga siqilib qolgan → 7 ta sahifa
  markazlashtirildi, keyin qoida `App.vue` ga ko'chirildi
- Sahifaga qaytganda bazaga qayta so'rov ketardi → 60 soniyalik
  GET keshi (`services/api.js`), `npm run check:cache` qulflaydi

**Yo'lda topilgan jim xatolar**

1. **Oy nomlari 20 ta faylda o'zbekcha qotirilgan edi.** Ruscha
   interfeysdagi direktor to'lovlar, maoshlar, davomat va
   hisobotlarda baribir "Yanvar 2026" ni ko'rardi.
   → `src/i18n/months.js`, uch tilda.
2. **`views/teacher/Reports.vue` yozilgan-u ulanmagan edi** —
   to'liq ishlaydigan sahifa, lekin hech qaysi route unga olib
   bormasdi. Ya'ni Fond direktorida hisobot sahifasi umuman
   yo'q edi.
3. **Onboarding'da eski brend nomi** — ro'yxatdan o'tgan direktor
   ko'radigan BIRINCHI ekranda hamon `FondSchool` turardi
   (`set-brand` so'zbelgi naqshini `Lu<strong>mo</strong>` deb
   qidiradi, u yerda bo'linish boshqa joyda edi).
4. **Xarajatlar sahifasida yillar qo'lda yozilgan:**
   `[2024, 2025, 2026, 2027]` — 2028-yilda joriy yil ro'yxatda
   bo'lmasdi.
5. **162 ta tarjimasiz matn** — 54 tasi shablonda (bitta so'zli:
   "Saqlash", "Bekor", "Kirish", "Maoshlar"), 108 tasi
   `<script>` ichida (xato xabarlari, brauzer yorlig'i
   sarlavhasi, lid holatlari, pul birligi).
6. **Xodim panelida sana modul yuklanganda bir marta olinardi** —
   kechqurun ochilgan sahifa ertalab kechagi kunni ko'rsatardi.
7. **Yon menyudagi rol yozuvi tarjimasiz** — Fond direktori o'z
   ismi ostida inglizcha `teacher` so'zini ko'rardi.

**🔴 Eng jiddiy topilma — brauzerda tekshirganda chiqdi**

`Landing.vue` va `Onboarding.vue` scoped uslubida shunday
yozilgandi:

```css
@import url('https://fonts.googleapis.com/css2?family=Sora…')
```

Vite uni marshrut CSS faylining BOSHIGA chiqaradi, brauzer esa
o'sha `<link rel="stylesheet">` yuklanmaguncha marshrutni
**umuman ko'rsatmaydi**. Ya'ni `fonts.googleapis.com` sekin
bo'lsa yoki bloklansa — sotuv sahifasi ham, ro'yxatdan o'tgandan
keyingi BIRINCHI ekran ham **oq** chiqadi. Xato yo'q, konsol
toza.

Bu ehtimol emas: sinovda aynan shunday bo'ldi
(`<div id="app"><!----></div>`). Endi shrift sahifa
chiqqandan keyin yuklanadi (`src/utils/loadFont.js`).

⚠️ **Xulosa:** `@import url(https://…)` ni sahifa uslubiga
hech qachon yozmang. Har qanday tashqi CSS shu tarzda butun
sahifani bo'g'ib qo'yadi.

**Brauzerda ko'rib tekshirilganda chiqqanlari**

Bu safar sahifalar haqiqiy brauzerda ochib ko'rildi (build →
preview → surat). Faqat shu yo'l bilan topiladigan uchta narsa:

1. **Server javob bermaganda sahifa BO'SH qolardi.** Xato
   ingichka qizil chiziq bilan ko'rsatilar, qolgan joy bo'sh
   edi. Render bepul tarifda uxlab qoladi — ertalab birinchi
   kirgan direktor deyarli har kuni shu holatga tushadi.
   → `ui/AppError.vue`: "Qayta urinish" tugmasi va halol izoh.

2. **LC panelida `Promise.allSettled` hamma xatoni yutardi** —
   server javob bermasa "0 o'quvchi, 0 guruh, 0 so'm" chiqardi
   va direktor ma'lumoti yo'qolgan deb o'ylardi. Xatodan ham
   yomon.

3. **LC panelida sana buzuq edi: "M08 29, Sat".**
   `toLocaleDateString('uz-UZ', { month: 'long' })` brauzerda
   uz-UZ lug'ati bo'lmasa aynan shunday qaytaradi. Yetti joyda
   shu naqsh bor edi.

⚠️ **Xulosa: `npm run build` va `npm run check` yashil bo'lishi
   sahifa ochilishini KAFOLATLAMAYDI.** Katta o'zgarishdan
   keyin `npx vite preview` bilan bir marta ochib ko'ring.

**Landing raqamlari — qaror qabul qilindi**

"500+ o'qituvchi · 10K+ o'quvchi · 99% mamnun" olib tashlandi.
Tekshirib bo'lmaydigan da'vo bir marta ushlansa, qolgan hamma
gap shubha ostida qoladi. O'rniga tekshirib bo'ladigan uchtasi:
2 rejim, 3 til, Telegram xabarnoma.

⚠️ Bu yerga SON yozmang. Haqiqiy sanoq kerak bo'lsa — bazadan.

**Yangi guardrail'lar**

| Buyruq | Nimani ushlaydi |
|---|---|
| `npm run check:cache` | Kesh ishlayaptimi va ORTIQCHA ishlamayaptimi (QR keshlansa o'quvchi eski kod bilan "keldim" qilib qo'yardi) |
| `npm run check:uztext` | `<script>` ichidagi tarjimasiz o'zbekcha matn |
| `verify` §10 | Eski brend nomi (`FondSchool`, `Daftar`) |
| `check:i18n` uchinchi o'tishi | Istalgan tegdagi bitta so'zli tarjimasiz matn |

⚠️ Uchalasi ham `check:solo` da — CI ishga tushsa avtomatik
ishlaydi.

---

### Undan oldingi ish — "Backend bor, tugma yo'q"

`check:api` ning "backend'da bor, frontend chaqirmaydi"
ro'yxati shu paytgacha **hisobot** deb qaralardi. Uni qatorma-qator
tekshirib chiqilganda ikkitasi haqiqiy teshik bo'lib chiqdi.

#### 1. Noto'g'ri ulangan hisobni uzib bo'lmasdi 🔴

O'quvchi kartochkasidagi "Ulangan hisoblar" ro'yxati faqat
KO'RSATARDI. Noto'g'ri odam ulanib qolsa — bazadagi telefon
boshqa oilaniki bo'lsa yoki kod adashib berilgan bo'lsa — u
bolaning **bahosini, davomatini va to'lovini abadiy** ko'rardi.

`DELETE /teacher/links/:linkId` backendda bor edi, IDOR
himoyasi bilan. Lekin `getStudentLinks` javobida `id`
qaytmasdi — interfeys qatorni adreslay olmasdi, shuning uchun
endpoint hech qayerdan chaqirilmagan.

⚠️ Uzilganda yozuv **o'chirilmaydi**, `isActive: false` bo'ladi:
"bu odam qayerdan ko'rdi?" degan savol keyin ham so'raladi.

#### 2. Qo'shimcha mashg'ulotga qo'lda yozib bo'lmasdi

`POST /lc/support/bookings` va `GET /lc/support/free` backendda
tayyor, xodimga ochiq, va xodim yozganini `via: "crm"` deb
belgilaydi — ya'ni CRM interfeysi ATAYLAB mo'ljallangan edi.
Sahifasi esa yo'q edi.

Natijada yozilishning yagona yo'li Mini App edi: Telegram'i
yo'q ota-ona, yoki markazga shunchaki qo'ng'iroq qilgani,
umuman yozila olmasdi.

Endi "Yozuvlar" sarlavhasi yonida tugma bor: o'quvchini
qidirib tanlash → ustoz → sana → bo'sh vaqtlar.

#### 3. Yo'lda topilgan bug: "0 ta yuborildi"

`sendMonthlyReminders` (cron funksiyasi) hech narsa
qaytarmasdi, controller esa `result?.sent || 0` deb o'qirdi.
"Hammaga eslatma yuborish" tugmasi xabarlar HAQIQATAN ketgan
holda ham **doim nol** ko'rsatardi — direktor ishlamayapti deb
o'ylab, qayta-qayta bosardi va ota-onalarga takror xabar
ketardi.

#### 4. Tozalash

- **`src/tools/i18n/translations.js` o'chirildi** — 320
  qatorlik o'lik nusxa, hech qayerdan import qilinmaydi.
  Kalit qidirgan odam avval shuni topib tahrirlab qo'yishi
  mumkin edi va hech narsa o'zgarmasdi.
- **Interfeysdan emoji olib tashlandi** (19 ta Landing'da,
  ustiga tugma va xabarlar). Emoji `color` ni qabul qilmaydi
  va har platformada boshqacha chiziladi; `❄️` esa ba'zi
  brauzerda ikkita belgi bo'lardi. Hammasi `Icon.vue` ga.
- **`check:shape` va `check:api` Mini App'ni ham ko'radi.**
  `/api/tma/*` ikkalasidan ham tushib qolgandi — ya'ni
  ota-onalar har kuni ochadigan bo'lim tekshiruvsiz edi.
  Mini App `fetch` ishlatadi va javobning O'ZINI qaytaradi
  (`res.data.X` emas, `x.X`), shuning uchun ikkala naqsh ham
  qo'shildi. Qamrov: 103 → 108 chaqiruv, 204 → 220 route.

### Undan oldingi ish — "Ishlayapti deb ko'ringan, lekin ishlamagan"

Bu safar topilganlarning hammasi bitta turdagi: **kod bor,
tugma bor, xato yo'q — natija esa yo'q**. Hech biri log'da
ko'rinmaydi.

#### 1. Telegram xabarlari yangi ota-onalarga BORMASDI 🔴

Bog'lanishning ikkita manbai bor: eski `TelegramParent` va
yangi `StudentLink` (Mini App orqali, raqamini tasdiqlab).
**Yangi ota-onalar faqat ikkinchisiga tushadi.**

`utils/notifyTargets.js` aynan shu ikkalasini birlashtirish
uchun yozilgan edi — lekin unga faqat `reminderCron` o'tgan.
Qolgan to'rt joy eski modelni bevosita o'qiyverdi:

| Joy | Nima yo'qolardi |
|---|---|
| CRM "Ulangan ota-onalar" | "80 tadan 3 tasi" — direktor botni ishlamayapti deb o'ylardi |
| "Tanlanganlarga yuborish" | jimgina `failed` bo'lardi |
| Uy vazifasi reytingi | `skipped` |
| To'lov tasdiqlash | **pulini to'lagan ota-ona hech qanday tasdiq olmasdi** |
| Admin paneli | platforma bo'yicha bot ishlatilishi nol ko'rinardi |

⚠️ **Bitta bolada bir nechta qabul qiluvchi bo'lishi mumkin**
(ota, ona, o'quvchining o'zi). Eski `byStudent[id] = p` naqshi
bittasini ustiga yozib yuborardi. `groupByStudent` massiv
qaytaradi.

⚠️ **Guardrail:** `test/notifyTargets.test.js` — xabar
yuboradigan fayl `TelegramParent.find` yozsa test yiqiladi.
Bu xato loyihada besh marta takrorlangan.

#### 2. "Tanlanganlarga eslatma" HECH QACHON ishlamagan 🔴

`GET /teacher/reminder` javobida `studentId` UMUMAN yo'q edi.
Interfeys uning o'rniga qator RAQAMINI ishlatardi
(`st.studentId || idx`) — ya'ni so'rov backend'ga `[0, 1, 2]`
yuborardi.

`hasTelegram` ham yo'q edi: har bir qator "Ulanmagan" belgisi
bilan chiqardi va "Hammasini tanlash" tugmasi hech kimni
tanlamasdi.

Pro/Premium tarifda sotilayotgan oqim shu holatda turgan.

⚠️ `|| idx` naqshi bug'ni YASHIRIB turardi — backend maydonni
qaytarmasa ham kod jimgina qator raqamini ishlatardi.

#### 3. "SMS eslatma" sotiladi, lekin xizmat yo'q 🔴

`smsService` umuman ulanmagan edi va har bir o'quvchi uchun
jimgina `status: 'failed'` qaytarardi; endpoint esa buni
`success: true` bilan yuborardi. Premium sotib olgan direktor
"0 yuborildi, 25 muvaffaqiyatsiz" ni ko'rardi.

Endi Payme/Click va platforma kartasi bilan bir xil qoida:
kalit yo'q → **503 va halol xabar**. Obuna sahifasida SMS
qatori "tez orada" belgisi bilan — **sotib olishdan oldin**.

#### 4. Ro'yxatdan o'tishda LC'ga Fond narxi ko'rsatilardi 🔴

Tavsiya bloki faqat o'quv markaziga chiqadi, ichida esa
"oyiga 29 000 so'm" qotirib yozilgan edi — bu Fond raqami,
LC Pro esa 199 000. `Subscription.vue` da bu bir marta
tuzatilgan, `Onboarding.vue` o'sha holicha qolgandi.

`usePlanLimits` ga `plans`, `priceOf()` va `can()` qo'shildi —
narx ham, xususiyat ham endi bitta manbadan.

#### 5. Tarif bayroqlarining yettitasi tekshirilmasdi

`PLAN_FEATURES` dagi `import`, `branches`, `homework`,
`salaries`, `roles`, `branch_stats`, `reports`, `white_label`
hech qayerda `hasFeature(...)` bilan tekshirilmasdi.

`import` yopildi (yangi xususiyat, hech kim ishlatmayapti).
Qolganlari `test/planFeatures.test.js` dagi `UNGATED`
ro'yxatida izoh bilan — **ularni yopish mahsulot qarori**,
§4.2 ga qarang.

#### 6. Yangi guardrail — `npm run check:shape`

`check:api` faqat MANZILni tekshiradi. Eng ko'p takrorlangan
xato esa boshqa: manzil to'g'ri, javob keladi, frontend YO'Q
maydonni o'qiydi.

Birinchi yurishdayoq admin panelidan haqiqiy bug topdi:
`POST /admin/freeze/activate` `frozenCount` qaytaradi, sahifa
`affectedTeachers` ni o'qirdi — admin butun platformani
muzlatib, "**undefined** ta ustoz ta'sirlandi" ni ko'rardi.

O'sha sahifadagi "Ha, taklif qil" tugmasi ham hech narsa
qilmasdi: hech qanday so'rov yubormay, "yuborildi" deb
yozardi. Olib tashlandi.

⚠️ Skript **ataylab qo'rqoq**: o'qib bo'lmaydigan handler
(yuqori darajada `...spread`, javob o'zgaruvchidan yasalgan)
umuman tekshirilmaydi — 204 tadan 53 tasi. Soxta xato
beradigan guardrail'ga hech kim qaramaydi.

### Undan oldingi ish — "Jimgina yo'qotilayotgan pul"

Tizimdagi eng qimmat xatolar xato bermaydi — ular shunchaki
**sodir bo'lmaydi**. Uchtasi topildi va uchalasi ham pulga
tegadi.

#### 1. To'lov varaqasi unutilgan guruh 🔴

Oylik varaqa **qo'lda** yaratiladi va **har guruh uchun
alohida**. Administrator o'n guruhdan bittasini unutsa — o'sha
oy o'sha guruhdan pul **umuman so'ralmaydi**. Ota-ona ham
bilmaydi (unga eslatma varaqadan chiqadi), tizim ham xato
bermaydi. Oy oxirida faqat "nega tushum kam?" degan savol
qoladi va javobi hech qayerda yo'q.

Endi ikkita narsa bor:

- `GET /teacher/health` → **Dashboard'da "E'tibor talab qiladi"
  kartochkasi**: shu oy varaqasi yo'q guruhlar, telefoni yo'q
  o'quvchilar, jadvalsiz va ustozsiz guruhlar (oxirgi ikkitasi
  faqat LC'da).
- `POST /teacher/payments/create-monthly-all` — **hamma
  guruhga bir bosishda**. To'lovlar sahifasidagi tugma.

⚠️ **Bo'sh guruh tekshirilmaydi.** Yangi ochilgan, hali
o'quvchisi yo'q guruhda na jadval, na ustoz, na varaqa
bo'lishi tabiiy — u hali tayyorlanyapti. Uni ro'yxatga
qo'shsak, kartochka birinchi kundanoq "muammo" bilan to'lib
ketardi va direktor unga qaramay qo'yardi.

⚠️ **Sanoq + bir nechta misol, to'liq ro'yxat emas.**
Direktorga "nima unutilgan" kerak; ro'yxatning o'zi o'sha
sahifalarda allaqachon bor.

#### 2. Arxivdagi o'quvchiga har oy yangi qarz yozilardi 🔴

Varaqa yaratish `Student.find({ class })` deb olardi. Arxiv
paydo bo'lgach bu **bug** bo'ldi: markazni tashlab ketgan
bolaga har oy yangi qarz yozilib boraverardi, qarz hisoboti
esa o'sib turardi. Endi `isActive: { $ne: false }`.

⚠️ `{ $ne: false }` — `true` bilan solishtirilmaydi: eski
hujjatlarda bu maydon umuman yo'q (sxemadagi standart qiymat
mavjud hujjatlarga tushmaydi).

⚠️ **Ikki marta bosish xavfsiz.** Mavjud varaqalar bitta
so'rov bilan olinadi va faqat yetishmaganlari qo'shiladi.

#### 3. O'chirilgan o'quvchining yozuvlari bazada qolardi

`deleteStudent` faqat `Student` va `MonthlyPayment` ni
o'chirardi. Qolgan hammasi **egasiz** qolib ketardi:

| Nima qolardi | Nima buzilardi |
|---|---|
| `Attendance` | davomat foizi abadiy — maxrajda yo'q odam |
| `Grade`, `HomeworkResult` | o'rtacha baho va reyting |
| `Enrollment` | qo'shimcha guruhda "yo'q odam" turaverardi |
| `StudentLink`, `TelegramParent` | ota-ona hisobi bog'liq qolardi |
| `PaymentClaim`, `SupportBooking`, `InviteCode` | — |

Endi `utils/studentPurge.js` — bitta ro'yxat, `accountPurge`
bilan bir xil naqsh. `test/studentPurge.test.js` `src/models/`
papkasini **o'zi skanerlaydi**: `ref: "Student"` maydoni bor
model ro'yxatda bo'lmasa test yiqiladi.

⚠️ **Odatdagi yo'l baribir ARXIV.** O'chirish to'lov tarixini
ham olib ketadi — u faqat adashib qo'shilgan yozuv uchun.

### Undan oldingi ish — "O'chirish yagona yo'l bo'lmasin"

Uch joyda bir xil naqsh topildi: **ma'lumotni yo'qotish —
oddiy ishning yagona yo'li**.

| Nima qilmoqchi | Yagona yo'l edi | Nima yo'qolardi |
|---|---|---|
| Telefonni tuzatish | o'quvchini o'chirib qayta yaratish | butun to'lov tarixi |
| Ketgan o'quvchi | o'chirish | to'lov tarixi |
| O'quv yilini yopish | sinfni o'chirish | o'quvchilar, to'lovlar, xarajatlar |

Endi uchalasi ham bor: **tahrirlash**, **o'quvchi arxivi**,
**guruh/sinf arxivi**. O'chirish tugmasi qoldi — adashib
qo'shilgan yozuv uchun kerak.

⚠️ **Yo'lda ma'lum bo'ldi: arxivlash hech qachon ishlamagan.**
`updateClass` da `cls.isActive = isActive` turgandi, `Class`
sxemasida esa bunday maydon YO'Q — Mongoose uni jimgina tashlab
yuborardi. Endi `archivedAt` (sana): hisobotda "qachon yopilgan"
darhol so'raladi va bulean bunga javob bermaydi.

⚠️ **Filtr `archivedAt: null`** — Mongo'da u maydoni umuman
yo'q hujjatlarni ham topadi, ya'ni mavjud sinflar avtomatik
faol bo'lib qoladi. `$exists: false` yoki `false` bilan
solishtirsak, butun ro'yxat yo'qolardi (sxemadagi standart
qiymat mavjud hujjatlarga tushmaydi).

⚠️ **Arxivdagi guruh tarif chegarasini band qilmaydi.** O'tgan
yilni yopgan direktor yangi guruh ocholmay qolmasin — aks holda
arxivning ma'nosi qolmasdi.

### Undan oldingi ish — `check:dead` guardrail'i

Bugun "yozilgan-u ulanmagan" xato **besh marta** topildi
(`canAddStaff`, `updateStudent`, `updateClass`,
`sendFreezeNotification`, `cancelBooking`) — ilgari ikki marta
bo'lgani ustiga. Hech biri xato bermaydi: funksiya shunchaki
**yo'q** bo'lib turadi.

`npm run check:dead` ikki narsani qaraydi: controller eksporti
route'ga ulanganmi va servis funksiyasi umuman chaqiriladimi.

⚠️ **Heuristika ikki marta o'tkirlashtirildi va ikkalasi ham
o'z sinovidan yiqilgandan keyin:**

1. Birinchi variant **44 ta** nom qaytardi (konstantalar, test
   uchun eksport qilingan cron funksiyalari). Bunday ro'yxatga
   hech kim qaramaydi — guardrail o'zi shovqinga aylanardi.
2. Ikkinchi variantda **eksport qatorining o'zi** "ishlatilgan"
   deb sanalardi: ataylab qo'shilgan o'lik funksiya
   "ishlatilyapti" bo'lib chiqdi (ta'rif + `module.exports` = 2 ta).
   Lekin eksport blokidagi **qiymat** sanalishi kerak
   (`requireSchoolMode: requireMode("school")`).

Ataylab qoldirilganlar `ALLOW` ro'yxatida, har biri izohli.
⚠️ `getStudents` u yerda alohida ogohlantirish bilan: u ham
`updateStudent` bilan bir xil kasal edi
(`Student.find({ teacher })` — bunday maydon yo'q), route'ga
ulansa doim bo'sh ro'yxat qaytaradi.

### Undan oldingi ish — tezlik va platforma egasining paneli

**N+1 uch joyda** topildi va uchalasi ham eng ko'p ochiladigan
sahifalarda edi: admin paneli, Fond dashboard'i va Sinflar
ro'yxati. Har birida halqa ichida `MonthlyPayment.find(...)`
turardi — u sinfning (yoki markazning) **butun tarixini**
xotiraga yuklab, keyin JS'da yig'ardi. Uch yillik markazda bu
o'n minglab hujjat, yuzta markazli admin panelida esa 400 dan
ortiq so'rov. Render'ning bepul tarifida bunday sahifa avval
sekinlashadi, keyin umuman ochilmay qoladi.

Endi hammasi `aggregate` bilan — pul bazada yig'iladi.

**Admin paneliga "e'tibor talab qiladi" bo'limi** qo'shildi:
obunasi 7 kun ichida tugaydiganlar, yaqinda tugaganlar va 14
kundan beri kirmagan markazlar. Har birida telefon raqami
bosiladigan qilib turadi.

⚠️ Lumo direktorlarga "qaysi o'quvchi ketish arafasida" deb
aytadi; platforma egasiga esa aynan shu savol bir qavat
yuqorida turadi. `Teacher.lastLoginAt` shu uchun qo'shildi va
kirishda `await` siz yoziladi.

⚠️ **`lastLoginAt` yo'q eski hisoblar "kirmagan" ro'yxatiga
tushmaydi** — ularni "2 yil kirmagan" deb ko'rsatish yolg'on
bo'lardi.

### Undan oldingi ish — "Yozilgan-u ulanmagan kod" auditi

Sidirg'a qidiruv: `module.exports` dagi har bir nom boshqa
fayllarda ishlatiladimi? Bu loyihada shu turdagi xato allaqachon
ikki marta bo'lgan (`startReminderCron`, `manageExpenses`) —
uchinchi, to'rtinchi va beshinchisi ham topildi.

#### 1. O'quvchini tahrirlash UMUMAN yo'q edi 🔴

`updateStudent` yozilgan, route'ga ulanmagan — **va ustiga buzuq
ham edi**: `Student.findOne({ _id, teacher })` deb qidirardi,
`Student` da esa `teacher` maydoni umuman yo'q (o'quvchi guruh
orqali bog'lanadi). Ya'ni ulangan taqdirda ham har doim
"topilmadi" qaytarardi.

Natijada telefon o'zgarsa yoki ismda bitta harf xato bo'lsa,
yagona yo'l — **o'chirib qayta yaratish**. `deleteStudent` esa
o'quvchining butun to'lov tarixini o'chiradi. Xato uchun
ma'lumot yo'qotiladigan tizim — bu tizim emas.

Qayta yozildi: egalik guruh orqali tekshiriladi, boshqa guruhga
ko'chirish tarif chegarasidan o'tadi (aks holda "qo'shib"
bo'lmaydigan to'lgan guruhga "ko'chirib" bo'lardi), o'zgarishlar
`AuditLog` ga tushadi. Interfeys: `lc/Students.vue` va
`teacher/ClassDetail.vue` da tahrir tugmasi.

#### 2. Sinf nomini o'zgartirish ham yo'q edi

`updateClass` — xuddi shunday holat, faqat buzuq emas edi.
`PUT /teacher/classes/:classId` qo'shildi, nom o'zgarishi
jurnalga tushadi.

#### 3. Obuna muzlatilganda direktorga xabar bormasdi

`sendFreezeNotification` / `sendUnfreezeNotification`
`telegramService.js` da yozilgan, lekin **hech qayerdan
chaqirilmagan**. Sabab tushunarli: yozilgan paytda direktorga
xabar yuboradigan kanalning o'zi yo'q edi (bot faqat ota-onalar
uchun ishlardi). Kanal bu hafta paydo bo'ldi — ulandi.

`services/freezeNotify.js`: kimga ketishini sof funksiya
ajratadi, xabar **fonda** yuboriladi (200 ta hisob saqlanib,
200 ta Telegram xabari ketishi mumkin — admin so'rovi kutib
turmasin), har 20 tadan keyin tanaffus, 403 da ulanish
tozalanadi.

⚠️ **Rejim tanloviga qaramaydi.** `cashReport.mode` va
`churnDigest.mode` — kunlik/haftalik shovqin darajasi uchun.
Obuna muzlatilishi esa HISOB haqidagi xabar: uni o'chirib
qo'ygan direktor ham bilishi kerak, chunki bu uning puliga
tegadi.

#### 4. Bekor qilish qoidasi ikki joyda edi

`services/supportBooking.cancelBooking` faqat **faol** yozuvni
bekor qiladi; `supportController.updateBooking` esa o'z qo'lda
yozilgan nusxasini ishlatardi va **istalganini** bekor qilardi.
Ya'ni o'quvchi kelib, QR skanerlab `done` bo'lgan yozuvni ham
"bekor qilindi" ga o'tkazish mumkin edi — kelgani haqidagi yozuv
yo'qolardi. Endi controller servisni chaqiradi.

### Undan oldingi ish — "O'quvchilarni Excel'dan import qilish"

Yangi markaz Lumo'ga o'tayotganda 200 ta o'quvchini qo'lda
kiritishi kerak edi. Bu — tizimga o'tishning eng katta to'sig'i:
direktor bir kunlik ishni ko'radi va "keyinroq" deb qo'yadi.
Ro'yxat esa allaqachon uning Excel faylida turibdi.

`services/studentImport.js` — **sof** parser, `POST
/teacher/classes/:classId/students/import`.

**To'rtta ataylab qilingan qaror:**

1. **Avval ko'rsatadi, keyin yozadi.** `apply` berilmasa faqat
   tahlil qaytadi: nechta qo'shiladi, qaysilari takror, qaysi
   qatorda ism yo'q. Begona faylni ko'r-ko'rona bazaga
   to'kmaymiz (`/lc/rooms/import` bilan bir xil qoida).
2. **Yarim import yo'q.** Tarif chegarasidan oshsa hech narsa
   yozilmaydi: yarmi tushgan ro'yxatda direktor qaysi bola
   qolganini bilmaydi va butun faylni qo'lda solishtirishga
   majbur bo'ladi.
3. **Takror ikki qatlamda** — fayl ichida va bazada. Telefon
   **oxirgi 9 raqam** bo'yicha solishtiriladi (`utils/phone.js`):
   aks holda `+998 90 123 45 67` va `90 123 45 67` boshqa-boshqa
   ko'rinib, bitta bola ikki marta tushardi. Bu bug o'z sinovimda
   chiqdi.
4. **Bir xil ismli ikki bola ikkalasi ham tushadi** (raqami
   boshqa) — faqat ism bo'yicha solishtirsak ikkinchisi
   yo'qolardi, bu esa haqiqiy hol.

⚠️ **Fayl BACKENDDA o'qiladi.** Brauzerda o'qish uchun xlsx
kutubxonasi kerak bo'lardi — u ~500 KB, ya'ni butun CRM
bundle'ining yarmi. Backendda `xlsx` allaqachon bor (export
uchun).

⚠️ Ustun nomi topilmasa javobda **fayldagi sarlavhalar**
qaytadi — odam nimani tuzatishni bilsin.

### Undan oldingi ish — "Sotilayotgan tarif haqiqatan sotilsin"

Uchta narsa bir vaqtda ma'lum bo'ldi va uchalasi ham **pulga
tegadi**. Boshlanishi oddiy edi: "yozilgan-u ulanmagan kod bormi?"
degan sidirg'a qidiruv (bu loyihada `startReminderCron` va
`manageExpenses` bilan ikki marta takrorlangan xato).

#### 1. LC direktoriga FOND narxi ko'rsatilardi 🔴

`Subscription.vue` uchta tarifni **o'zi yozib turardi**:
`29 000 / 59 000` va "1 ta sinf, 30 ta o'quvchi". Bular Fond
raqamlari. Sahifa esa `lcNav` da ham bor.

Ya'ni o'quv markazi direktori Pro narxini **29 000** deb ko'rar,
o'shancha pul o'tkazar va chekni yuborardi. Backend esa so'rovni
`priceFor` bo'yicha **199 000** deb yozardi (bu joyi to'g'ri
ishlagan) — admin panelida 199 000 lik so'rov va 29 000 lik chek.
So'rov rad etiladi. Mijoz pul yubordi, xizmat olmadi va nima
uchunligini bilmadi.

Endi katalog **backenddan** keladi (`GET /teacher/subscription`):
narx, chegara va funksiyalar — hammasi `planHelper` dan, rejim
bo'yicha. Frontendda faqat ko'rinish qoldi (ikonka, tartib).

#### 2. Xodim va lid chegarasi UMUMAN tekshirilmasdi 🔴

`canAddStaff` yozilgan, eksport qilingan — va hech qayerdan
**chaqirilmagan**. `PLAN_LIMITS` dagi `leads` ham xuddi shunday.
Ya'ni Free hisob cheksiz xodim qo'sha olardi va cheksiz lid
yuritardi. Pro sotib olishning ma'nosi qolmasdi.

Endi `createStaff` va `createLead` chegarani tekshiradi.

⚠️ **Lidlarda faqat OCHIQ lidlar sanaladi** (`won`/`lost` emas).
Hammasini sansak, yigirmata lid yozgan markaz abadiy to'xtab
qolardi — hatto hammasini o'quvchiga aylantirgan bo'lsa ham.
Chegara "qancha ish yuritasan" haqida, "qancha ish yuritgansan"
haqida emas.

⚠️ Lid chegarasi **markaz bo'yicha**, filial bo'yicha emas —
aks holda uchta filiali bor Free markaz 60 ta lid tutardi.

#### 3. Filial chegarasi IKKITA jadvaldan o'qilardi 🔴

`branchController` o'z jadvalini tutardi (`free: 1, pro: 3,
premium: 10`), `planHelper` esa boshqa raqamlarni. Ikkita jadval —
ikkita haqiqat: **Premium LC'ga 9999 ta filial va'da qilinardi,
kod esa 10 tada to'xtatardi.** Eng ko'p to'lagan mijoz tushunarsiz
devorga urilardi.

Endi jadval bitta: `utils/planHelper.js`.

⚠️ **Fond filiallari (1 / 3 / 10) — ishlab turgan xatti-harakat.**
`planHelper` da `0 / 0 / 5` yozilgandi va u hech qachon
qo'llanmagan. Birlashtirishda ishlayotgani olindi: aks holda
bugun filiali bor Fond direktori ertaga yangisini ocholmay
qolardi. **Chegarani pasaytirish — mahsulot qarori**, kod
tozalashning yon ta'siri emas. Qaror qilsangiz, o'zgartirish
endi faqat bitta joyda.

#### Interfeys: chegara BOSISHDAN OLDIN ko'rinadi

- `composables/usePlanLimits.js` — `limits` va `usage` ni bir
  marta oladi, keshlaydi (raqam frontendda o'ylab topilmaydi).
- `StaffManagement.vue` (xodim va filial), `Leads.vue` — tugma
  o'chadi va "Tarifni ko'tarish" havolasi chiqadi.
- `Subscription.vue` — "Hozir ishlatilyapti: Guruh 3/15,
  Xodim 1/10…" va to'lgani to'q sariq.

⚠️ So'rov yiqilsa chegara ko'rsatkichi **jim o'chadi va tugmalar
ochiq qoladi** — haqiqiy tekshiruv baribir backendda. Qulaylik
sahifani bloklamasin.

#### 4. To'lov kartasi SOXTA edi 🔴

Sahifada `8600 1234 5678 9012` qotirib yozilgandi. Bu haqiqiy karta
emas — aynan shu satr `PaymentClaims.vue` va `Settings.vue` da
**`placeholder`** sifatida turadi, ya'ni namuna matn. Backendda
platforma kartasi degan tushuncha umuman yo'q edi.

Ya'ni yuqoridagi uchta xato tuzatilgandan keyin ham direktor
to'g'ri narxni ko'rib, **noto'g'ri kartaga** pul yuborardi.

Endi `config/platform.js` → `PLATFORM_CARD` / `PLATFORM_CARD_HOLDER`
env o'zgaruvchilari, javobda `payTo: { configured, card, cardPlain,
holder }`.

⚠️ **Kalit yo'q bo'lsa SOXTA RAQAM O'RNIGA OGOHLANTIRISH** chiqadi:
"rekvizitlar kiritilmagan, administrator bilan bog'laning". Bu
Payme/Click bilan bir xil qoida — yarim sozlangan holatda pul
qabul qilishga urinmaymiz.

⚠️ **Yarim yozilgan raqam ham `configured: false`** (16 xona
tekshiriladi): aks holda 12 xonali raqam ekranga chiqib, kimdir
o'shanga o'tkazishga urinardi.

⚠️ Kalitni **Muhammadumar qo'yadi** — 4.2 bo'limiga qarang.
Qo'yilmaguncha sotib olish oqimi ochiq qoladi (so'rov yuborish
mumkin), lekin karta ko'rsatilmaydi.

**Tekshirildi:** backend 420/420 test, `check:messages` toza;
frontend build + `check` 0 xato.

### Undan oldingi ish — "Ketayotgan o'quvchi direktorga o'zi aytadi"

Ro'yxat allaqachon bor edi (`/lc/at-risk`, `services/churnRisk.js`) —
lekin u **sahifada yotardi**. Direktor esa har kuni saytga kirmaydi:
bola uch dars kelmaydi, keyin to'rt, keyin butunlay qoladi va markaz
buni navbatdagi to'lov kelmaganda biladi. O'sha paytda qaytarib
bo'lmaydi.

Bu — kunlik kassa xabari bilan **aynan bir xil muammo**, shuning
uchun aynan o'sha kanal ishlatildi (`Teacher.telegram`). HANDOFF'da
u kanal haqida "bitta funksiya uchun emas" deb yozib qo'yilgandi;
ikkinchi ishlatuvchisi shu.

**Backend:**
- `services/churnDigest.js` — **sof** `buildDigest()` + `collect()`.
- `cron/churnDigestCron.js` — **dushanba 09:00 Toshkent**, `server.js` ga ulandi.
- `Teacher.churnDigest.mode` (`weekly` | `off`, standart `weekly`).
- `PUT /teacher/telegram/director/churn-mode`.
- `POST /teacher/telegram/director/preview` — **"Hozir yuborib ko'rish"**.
- 18 ta yangi test.

**Frontend:**
- `AtRisk.vue` — haftalik xabar sozlamasi aynan ro'yxat ostida.
- `Cash.vue` — kassa xabari uchun ham "Hozir yuborib ko'rish".
- `Settings.vue` — bitta ulanish, ikkita xabar ekani yozib qo'yildi.
- 10 ta i18n kalit × 3 til.

**Uchta ataylab qilingan qaror:**

1. **Telefon raqami xabarning O'ZIDA.** Telegram raqamni bosiladigan
   qiladi — direktor xabarni o'qib, o'sha yerdan qo'ng'iroq qiladi.
   Faqat ism yozsak, u CRM'ni ochib, o'quvchini qidirib, raqamni
   ko'chirishi kerak bo'lardi va ish aynan shu yerda "keyinroq" ga
   qolardi. Raqam **alohida qatorda, bezaksiz**: Markdown belgilari
   orasida qolsa Telegram uni tanimaydi (test bilan qulflangan).
2. **Bo'sh hafta — xabar yo'q.** "Bu hafta hech kim ketmayapti"
   foydali ko'rinadi, lekin odatni buzadi: xabar kelsa — ish bor.
   Kassa xabaridagi `problems` bilan bir xil qoida.
3. **Sozlama ro'yxat ostida, ULANISH esa Kassa sahifasida qoldi.**
   Bir martalik token ikki joydan so'ralsa, ikkinchisi jimgina
   eskirgan havola berardi.

⚠️ **"Hozir yuborib ko'rish" — bugungi HAQIQIY ma'lumot**, soxta
namuna emas. Namuna ulanishni tekshiradi, lekin "menga bu kerakmi?"
degan savolga javob bermaydi. Busiz direktor tugmani bosib ertaga
21:00 gacha kutishi va xabar kelmasa nima buzilganini bilmasligi
kerak edi: bot bloklanganmi, rejim o'chiqmi, ulanish uzilganmi —
uchalasi ham JIM.

### Shu bilan birga — tasdiqlanmagan to'lovlar kassa xabariga qo'shildi

Ota-ona kartaga o'tkazadi va ilovada "to'ladim" deydi
(`PaymentClaim`). Hech kim tasdiqlamasa, uning qarzi ochiq turadi
va u o'zini e'tiborsiz qoldirilgandek his qiladi — pul esa
allaqachon markazda.

Endi kunlik kassa xabarida alohida qator bor: nechta so'rov,
umumiy summa va **eng eskisi necha kundan beri kutayotgani**.

⚠️ **Yangi cron YOZILMADI.** Bu ham kassa haqidagi gap va xabar
allaqachon har kuni 21:00 da ketadi. Ikkinchi xabar birinchisining
o'qilishini kamaytirardi — bu loyihada bir necha marta takrorlangan
qoida.

⚠️ Tasdiqlanmagan so'rov `hasProblems` ni yoqadi, ya'ni `problems`
rejimidagi direktor ham ko'radi. Kutayotgan ota-ona — bu muammo.

### Yo'lda topilgan IKKITA jim bug

⚠️ **1. Kunlik kassa xabari eski hisoblarga UMUMAN kelmasdi.**
Cron `"cashReport.mode": { $in: ["problems", "daily"] }` deb
qidirardi. Lekin Mongoose standart qiymatni faqat hujjat
**saqlanganda** yozadi, ulanish esa `updateOne` bilan ketadi —
ya'ni `cashReport` maydoni paydo bo'lishidan oldin ochilgan
hisoblarda u bazada **umuman yo'q**. `$in` bunday hujjatni topmaydi.
Direktor Telegram'ga ulanadi, "Faqat muammo bo'lganda" turadi,
va xabar hech qachon kelmaydi — xatosiz, jimgina. Endi
`{ $ne: "off" }` (maydoni yo'q hujjat ham qamrab olinadi) va rejim
`dir.cashReport?.mode || "problems"` bilan o'qiladi.

**Yangi sxema maydoni qo'shsangiz shu tuzoqni eslang:** mavjud
hujjatlarda u yo'q. Filtrni "qiymat X ga teng" emas, "X emas" deb
yozing.

⚠️ **2. `check:api` va `check:perms` bulutli/yangi klonda umuman
ishlamasdi.** Backend yo'li qattiq yozilgan edi
(`../../school_fond`), GitHub'dagi repo nomi esa `beckend_fond`.
Skript to'rtta ogohlantirish yozib, ENOENT bilan yiqilardi — va bu
zanjirning o'rtasida bo'lgani uchun `check:perms`, `check:css`,
`check:i18n` **umuman ishlamasdi**. Ya'ni guardrail o'zi jimgina
o'chib qolardi. Endi `scripts/backend-path.cjs`: `LUMO_BACKEND`
o'zgaruvchisi → yonidagi papkalar (nomi muhim emas, `src/routes/lc.js`
va `src/models/Role.js` bo'yicha taniladi) → topilmasa tushunarli
xabar va exit 1.

### Undan oldingi ish — "Markaz sozlamalari sahifasi"

Sozlamalar **besh xil sahifaga tarqalgan** edi: qo'shimcha mashg'ulot
o'z sahifasida, xodim davomati o'zinikida, kassa xabari Kassa ostida,
to'lov rekvizitlari To'lov so'rovlari ichida, brend esa Profilda.

⚠️ **Asosiy muammo sozlash emas, KO'RINMASLIK edi.** Yoqilmagan
funksiyani direktor umuman bilmasdi — bilmagan narsasini esa
yoqmaydi ham. Qo'shimcha mashg'ulot, xodim davomati, ota-onadan
to'lov qabul qilish: uchalasi ham tayyor turgan, lekin tasodifan
o'sha sahifaga kirmaguncha mavjud emasdek edi.

`/lc/settings` — bitta sahifa, beshta blok. Har biri **o'chiq
holatda ham to'liq ko'rinadi** va "yoqilmasa nima bo'lmaydi" deb
yozib turadi: *"O'chiq: o'quvchi ilovasida \"Yozilish\" bo'limi
umuman ko'rinmaydi."*

**Uchta ataylab qilingan qaror:**

1. **Yangi endpoint qo'shilmadi.** Sahifa mavjud to'rtta GET ni
   `Promise.allSettled` bilan birga chaqiradi. Aggregator yozsak,
   bir xil mantiq ikki joyda bo'lib qolardi va biri jimgina
   eskirardi. Yon foydasi: bittasi yiqilsa qolgan bloklar baribir
   chiziladi.
2. **Chuqur boshqaruv ko'chirilmadi.** Sahifa faqat markaz
   darajasidagi kalitni tutadi; yozuvlar, jadval va Telegram ulash
   o'z sahifalarida qoladi va ularga havola beriladi. Aks holda
   ikkita joyda bir xil interfeys paydo bo'lardi.
3. **Rekvizitlar avtomatik saqlanmaydi, tugma bilan.** Karta
   raqamini yozib turganda har bosishda saqlasak, yarim raqam
   bazaga tushardi va ota-ona ilovada o'shani ko'rardi.

⚠️ **Qo'shimcha mashg'ulot bloki alohida ogohlantiradi:** xizmat
yoqilgan, lekin "Support Teacher" rolidagi xodim yo'q bo'lsa
o'quvchi bo'sh ro'yxat ko'radi. Direktor buni sozlamalar
sahifasidayoq bilsin, o'quvchi shikoyat qilgandan keyin emas.

⚠️ **Faqat direktorga**, `/staff/settings` ataylab yo'q.

⚠️ Sahifa tizimga kirishni talab qilgani va lokal API
production'ga CORS bilan bloklangani uchun **brauzerda
ko'rilmadi** — build, `npm run check` va endpoint shakllari qo'lda
solishtirildi. Birinchi deploy'dan keyin ko'z bilan tekshiring.

### Undan oldingi ish — "Tarjima qarzi yopildi"

18 ta faylda **159 ta** qattiq yozilgan matn bor edi — endi **0**.
~130 ta yangi kalit × 3 til, 25 tasi mavjud kalitdan qayta ishlatildi.

**Lekin eng qimmatlisi kod emas, guardrail.** Matn qoldirish
`check:i18n` da faqat **ogohlantirish** edi — yumshoq ro'yxat
o'qilmasdi va qarz aynan shunday to'plandi. Endi:

- tarjimasiz matn — **XATO**, `npm run check` yiqiladi;
- chegara **3 tadan 1 taga** tushdi (uchtadan kam matn qolgan fayl
  jimgina o'tib ketardi);
- `<label>`, `<button>`, `<h1..h3>`, `<option>`, `<th>` ichidagi
  **bitta so'zli** matn ham ushlanadi.

⚠️ **Oxirgi band aynan haqiqiy bugni yopdi.** Ruscha kirish
sahifasida "Parol" va "Kirish" o'zbekcha qolib ketgan edi, tekshiruv
esa yashil turardi — bitta so'zli matn kod nomi bilan chalkashmasin
deb ataylab o'tkazib yuborilardi. Endi faqat aniq matn teglarida
ushlanadi.

⚠️ **Ataylab chetlab o'tiladi:** til nomlari
(`LanguageSwitcher.vue` — "Русский" har doim ruscha yoziladi) va
mahsulot nomlari (`PRODUCT` ro'yxati: Telegram Bot, Excel, Lumo).
Ro'yxatga qo'shishdan oldin o'ylang: bu haqiqatan nommi yoki
tarjima qilinmagan matnmi?

⚠️ **Bo'lingan matnlar parametrga o'tkazildi.** Bold uchun matnni
ikkiga bo'lish tarjimada so'z tartibini buzardi — `lg_restoreText`,
`pf_deleteGrace`, `fp_expires`.

Brauzerda uch tilda tekshirildi; guardrail ataylab buzib sinaldi
(bitta matn → exit 1).

### Undan ham oldingi ish — "Mini App uch tilda"

`tma/App.vue` dagi **32 ta** qattiq matn → **0**. ~70 kalit × 3 til.

Landing bilan bir xil mantiq, lekin auditoriya boshqa: Mini App'ni
**ota-onalar ko'radi**, xodim emas. Ruscha gapiradigan ota-ona
farzandining bahosini tushunmasa, markazga qo'ng'iroq qiladi — ya'ni
ilova o'zi hal qilishi kerak bo'lgan ishni administratorga qaytaradi.

⚠️ **`vue-i18n` QO'SHILMADI — o'z lug'ati yozildi**
(`src/tma/i18n.js`). Mini App alohida kirish nuqtasi va uning butun
ma'nosi hajmda. O'lchandi:

| | xom | gzip |
|---|---|---|
| oldin | 23.9 KB | 8.1 KB |
| uch til bilan | 32.2 KB | 11.8 KB |

Kutubxona ~20 KB qo'shardi. Lug'at esa sof ma'lumot, kod emas.

⚠️ **Til Telegram'dan olinadi, tanlagich YO'Q.** Ota-ona
sozlamalar bilan ovora bo'lmasligi kerak — u bolasining bahosini
ko'rish uchun kirdi. Telegram allaqachon uning tilini biladi va bot
ham o'sha ma'lumotdan foydalanadi. Noma'lum til o'zbekchaga tushadi.

**Guardrail ikki joyda kuchaytirildi** (`npm run verify`):

1. TMA kalitlari endi **o'z lug'atidan** tekshiriladi, CRM `uz.js`
   dan emas — aks holda ular doim "yo'q" bo'lib chiqardi va
   tekshiruvdan foydalanish to'xtardi.
2. **Uch lug'at bir xil kalitga ega bo'lishi** qulflandi. Bittasida
   kalit tushib qolsa, ruscha ota-ona o'sha joyda o'zbekcha matn
   ko'rib qolardi — va buni faqat u sezardi.

Ikkalasi ham ataylab xato kiritib sinaldi — ushlaydi.

⚠️ `detect()` `window` ga to'g'ridan-to'g'ri tegmaydi:
`verify` modulni Node'da import qiladi va himoyasiz kod tekshiruvni
yiqitardi.

⚠️ Izohda `t(…)` ko'rinishida misol yozmang — skaner uni
haqiqiy kalit deb o'qiydi (bir marta shunday bo'ldi).

### Eskiroq — Landing tarjimasi

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

### Eskiroq — ruxsatlar auditi

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

### Eskiroq — lid→guruh oqimi va xona teshigi

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
backend :  npm test              →  567/567
backend :  npm run check:messages →  tarjimasiz matn 0 ta (endi XATO beradi)
backend :  npm run check          →  test + check:messages + check:dead
frontend:  npm run build         →  ✓
frontend:  npm run check         →  verify, check:api, check:perms, check:css, check:i18n — 0 xato
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

- 🔴 **Render → Environment: `PLATFORM_CARD`** — tarif uchun pul
  tushadigan karta. **Bugun sahifada soxta raqam turgan edi**
  (`8600 1234 5678 9012` — namuna matn), ya'ni Pro sotib olmoqchi
  bo'lgan har bir direktor pulni yo'qqa yuborardi. Endi raqam
  backenddan keladi va kalit qo'yilmaguncha sahifa "rekvizitlar
  kiritilmagan" deb yozib turadi — soxta raqam ko'rsatilmaydi.

  ```
  PLATFORM_CARD=8600XXXXXXXXXXXX
  PLATFORM_CARD_HOLDER=FAMILIYA ISM
  ```

  Kalit qo'yilishi bilan ishlaydi, deploy dan boshqa hech narsa
  kerak emas.

- 🟡 **SMS provayderi — "SMS eslatma" Premium'da sotiladi, lekin
  xizmat umuman ulanmagan.** Ilgari u soxta muvaffaqiyat
  qaytarardi; endi kalit yo'q bo'lsa **503** va sahifada "tez
  orada" belgisi turadi. Eskiz yoki Play Mobile merchant
  olingach:

  ```
  SMS_PROVIDER=eskiz
  SMS_EMAIL=...
  SMS_PASSWORD=...
  SMS_SENDER=4546
  ```

  ⚠️ To'rttasi ham to'ldirilishi shart — yarmi to'ldirilgan
  sozlama provayderga ulanishga urinib, har bir SMS uchun xato
  qaytarardi. `services/smsService.js` ichida `TODO(provayder)`
  belgisi bor, chaqiruvchi kod o'zgarmaydi.

- 🟡 **MAHSULOT QARORI: oltita tarif bayrog'i ochiq turibdi.**
  `homework`, `salaries`, `roles`, `branch_stats`, `reports`,
  `white_label` — `planHelper` jadvalida Free uchun `false`,
  lekin **hech qayerda tekshirilmaydi**, ya'ni Free hisob
  hammasidan foydalanmoqda.

  Yopish — sizning qaroringiz: bugun ulardan foydalanayotgan
  markazlar bor va yopish ulardan imkoniyatni tortib olish
  demakdir (filial chegarasini pasaytirish bilan bir xil
  qoida). Yopmoqchi bo'lsangiz, `test/planFeatures.test.js`
  dagi `UNGATED` ro'yxatidan olib tashlang va controllerga
  `hasFeature(...)` qo'shing — test yo'lni ko'rsatadi.

  Bayroqni butunlay olib tashlash ham to'g'ri yechim: u holda
  jadval yolg'on va'da bermay qo'yadi.

- 🟡 **GitHub Actions ishlamayapti — CI qo'shib bo'lmadi.**
  Ikkala repoga `.github/workflows/check.yml` qo'shib ko'rildi
  (har push'da `npm run check`). Ish **3 soniyada** yiqildi:
  runner umuman berilmadi va log yozilmadi. Repo **public**,
  ya'ni daqiqa cheklovi sabab emas.

  Ehtimoliy sabab (ikkalasi ham hisob sozlamasi):

  - GitHub hisobida Actions o'chirilgan yoki cheklangan
  - **Settings → Actions → General → Allowed actions** "Local
    actions only" ga qo'yilgan — u holda `actions/checkout`
    bloklanadi va ish darhol yiqiladi

  PR'da doimiy qizil belgi qolmasin deb workflow fayllari
  **olib tashlandi**. Sozlamani tuzatganingizdan keyin qaytadan
  qo'shsa bo'ladi — mazmuni oddiy:

  ```yaml
  name: check
  on: [push, pull_request]
  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: "20", cache: npm }
        - run: npm ci
        - run: npm run check          # frontendda: npm run check:solo && npm run build
  ```

  ⚠️ Frontendda `npm run check` EMAS, `check:solo`: to'liq
  tekshiruv backend repozitoriyasini o'qiydi, CI'da esa
  ikkinchi repo yo'q.

  ⚠️ Bazaga ulanmaydi va sir (secret) kerak emas — testlar sof
  mantiqni sinaydi.

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

Rollar bo'yicha o'ylash davom etadi. Kassa zanjiri, lid→guruh oqimi,
**butun frontend tarjimasi** va **backend xabarlari** tugadi.

Direktorning Telegram kanali endi **uchta** xabar tashiydi: kunlik
kassa (21:00), haftalik ketish arafasida (dushanba 09:00) va oy
boshidagi "varaqa yaratilmagan" (2-sana 09:00). To'rtinchisi uchun
ham o'rin tayyor: xabar matni sof funksiyada, cron esa bitta
naqshdan nusxa (uchtasi ham bir xil).

⚠️ **Yangi xabar qo'shishdan oldin o'ylang:** har bir qo'shimcha
xabar oldingilarining o'qilishini kamaytiradi. Uchtasi ham
"kelsa — ish bor" qoidasida (bo'sh bo'lsa yubormaydi) va aynan
shu ularni o'qiladigan qiladi.

### A. Backend xabarlari tarjimasi — ✅ TUGADI (2026-08-21)

Qolgan **30 ta** xabar (26 tasi eski ro'yxatdan + 4 tasi yangi kod)
`utils/messages.js` ga qo'shildi. `npm run check:messages` endi
**xato beradi** (exit 1), ogohlantirish emas — frontendda aynan shu
narsa qarzni bir kunda to'xtatgan edi. Guardrail ataylab buzib
sinaldi va `test/lang.test.js` uni qulflab turibdi.

ℹ️ Chiqishdagi "lug'atda bor, kodda topilmadi" ro'yxati (19 ta) —
**hisobot, xato emas**: skaner faqat `error:`/`message:` dan keyin
darhol qo'shtirnoq kelgan joyni ko'radi, shart ichida yasalgan
xabarni esa topmaydi.

### B. Guruh/sinf ajratish (reja 1.2)  ⭐ katta ish

LC guruhlari hali `Class` da yashaydi. Hujjat tayyor:
`docs/GROUP_MIGRATION.md`. Asosiy qiyinchilik — 13 joydagi
`populate("class")`.

🚨 **`src/scripts/migrateGroups.js` NI ISHLATMANG** — u endi
o'zini to'xtatadi va bu ataylab. Skript **B varianti** uchun
yozilgan (`Group` alohida kolleksiyada), loyihada esa **A
varianti** deploy qilingan: `models/Group.js` aynan `classes`
ga bog'langan. Shu holatda:

- `--apply` → o'sha `_id` bilan **o'sha** kolleksiyaga yozadi
- `--rollback --apply` → `deleteMany` **jonli `classes`** ga
  tushadi, ya'ni markazlarning hamma guruhini (va ular orqali
  o'quvchi, to'lov, davomat tarixini) o'chirib yuborishi mumkin

Bugun ikkinchisi tasodifan xavfsiz: `migratedFromClass` maydoni
sxemada yo'q, Mongoose uni jimgina tashlab yuboradi. Kimdir uni
qo'shsa — zarar haqiqiy bo'ladi.

Ajratishni rostdan boshlamoqchi bo'lsangiz: avval `Group` ni
alohida kolleksiyaga bog'lang, keyin skriptni qayta ko'rib
chiqing. `test/groupMigration.test.js` shu shartni qulflaydi.

⚠️ Bazadan nusxa olmasdan tegmang.

### Tarjima qarzi — ✅ TUGADI (2026-08-24)

Qolgan hamma joy yopildi:

- `check:i18n` teshigidan chiqqan **54 ta** matn (ko'p qatorli va
  `{{ }}` bilan aralash yozilganlari)
- `StaffManagement.vue` ichidagi **92 ta** matn — 24 ta huquq nomi
  va izohi, 13 ta bo'lim, 8 ta rol shabloni. Ular `<script>` da
  yozilgan edi va tekshiruv `<script>` ichini qaramaydi
- `Schedule.vue` dagi uchta validatsiya xabari

⚠️ **`<script>` ichidagi matn hamon tekshirilmaydi.** Yangi
sahifada matnni obyekt ichiga yozib qo'ysangiz, tekshiruv yashil
turaveradi. Naqsh: obyektda faqat ikonka/rang, matn esa i18n
kalitida (`PERM_META` ga qarang).

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
   o'zbekcha chiqaveradi. `npm run check:messages` aynan shuni topadi
   va 2026-08-21 dan beri **exit 1** qaytaradi.

10. **Sxemadagi standart qiymat MAVJUD hujjatlarga tushmaydi.**
    Mongoose uni faqat hujjat `save()` qilinganda yozadi;
    `updateOne` / `findOneAndUpdate` yozmaydi. Ya'ni yangi maydon
    qo'shsangiz, eski hisoblarda u bazada **umuman yo'q**.

    Shu sabab cron va hisobot filtrlarida **"qiymat X ga teng"
    emas, "X emas"** deb yozing:

    ```js
    "cashReport.mode": { $in: ["problems", "daily"] }  // ❌ eski hisob tushmaydi
    "cashReport.mode": { $ne: "off" }                  // ✅ standart ham qamrab olinadi
    ```

    Kodda o'qiyotganda ham shunday: `dir.cashReport?.mode || "problems"`.
    Kunlik kassa xabari aynan shu sababli eski hisoblarga hech qachon
    kelmagan — va xato bermagani uchun buni hech kim sezmagan.

11. **Tarif raqamini FRONTENDDA yozmang.** Narx ham, chegara ham
    `utils/planHelper.js` da va `GET /teacher/subscription`
    orqali keladi. `Subscription.vue` ilgari o'zi yozib turardi
    va LC direktoriga Fond narxini ko'rsatardi — u o'sha summani
    kartaga o'tkazardi.

12. **"Yozilgan-u ulanmagan" kodni vaqti-vaqti bilan qidiring.**
    Bu loyihada uch marta takrorlandi: `startReminderCron`
    (cron ulanmagan), `manageExpenses` (ruxsat tekshirilmagan),
    `canAddStaff` / `canOpenBranch` (chegara chaqirilmagan).
    Hech biri xato bermaydi — funksiya shunchaki **yo'q** bo'lib
    turadi. Eng oson tekshiruv: `module.exports` dagi nomni
    boshqa fayllarda qidirib ko'ring.

13. **Ikkala repoda `HANDOFF.md` bir xil bo'lishi shart.** Birini
    yangilab ikkinchisini unutsangiz, keyingi sessiya qaysi
    repodan boshlashiga qarab boshqa holatni o'qiydi.

---

## 7. Har o'zgarishdan keyin

```bash
# backend
cd /c/Users/Lenovo/Desktop/school_fond
npm run check          # npm test + check:messages

# frontend
cd /c/Users/Lenovo/Desktop/font_front/font
npm run build
npm run check          # api + perms + css + i18n
git diff --stat        # CRLF tuzog'i uchun
```

Commit xabari — **o'zbekcha**, nima o'zgargani emas, **nima uchun**
o'zgargani. Namuna: `O'zgarishlar tarixi: kim to'lovni o'zgartirdi`.
