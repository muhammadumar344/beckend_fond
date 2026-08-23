# HANDOFF — ishni qayerdan davom ettirish kerak

> **Bu fayl ikkala repoda bir xil.** Birini o'zgartirsangiz, ikkinchisini ham
> yangilang:
> - `Desktop/school_fond/HANDOFF.md` (backend)
> - `Desktop/font_front/font/HANDOFF.md` (frontend)
>
> Oxirgi yangilanish: **2026-08-21** (ketish arafasidagi o'quvchilar
> Telegram'ga chiqdi, backend xabarlari tarjimasi tugadi, tarif
> chegaralari haqiqatan ishlay boshladi)
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

### Oxirgi tugagan ish — "Sotilayotgan tarif haqiqatan sotilsin"

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
backend :  npm test              →  420/420
backend :  npm run check:messages →  tarjimasiz matn 0 ta (endi XATO beradi)
backend :  npm run check          →  test + check:messages (yangi qisqartma)
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

Direktorning Telegram kanali endi **ikkita** xabar tashiydi (kunlik
kassa, haftalik ketish arafasida). Uchinchisi uchun tayyor o'rin bor:
xabar matni sof funksiyada, cron esa bitta naqshdan nusxa
(`cashReportCron` / `churnDigestCron` — ikkalasi bir xil).

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
