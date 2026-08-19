# HANDOFF — ishni qayerdan davom ettirish kerak

> **Bu fayl ikkala repoda bir xil.** Birini o'zgartirsangiz, ikkinchisini ham
> yangilang:
> - `Desktop/school_fond/HANDOFF.md` (backend)
> - `Desktop/font_front/font/HANDOFF.md` (frontend)
>
> Oxirgi yangilanish: **2026-08-20** (xona boshqaruvi tugagach)
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

### Oxirgi tugagan ish — "Xona (kabinet) boshqaruvi"

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

### Undan oldingi ish — "Kassa" (kunlik smena)

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
backend :  npm test              →  298/298
backend :  npm run check:messages →  yangi xabarlar ru/en bilan
frontend:  npm run build         →  ✓
frontend:  npm run check         →  check:api, check:perms, check:css, check:i18n — 0 xato
```

---

## 4. 🔴 TO'XTAB TURGAN ISHLAR — Muhammadumar qilishi kerak

### 4.1 Push ishlamayapti (eng muhimi)

**Backend 5 ta, frontend 18 ta commit push qilinmagan.** Kod tayyor,
faqat GitHub'ga chiqmagan.

Sabab aniqlangan: `ssh -vT git@github.com` → **`Server accepts key`**.
Ya'ni GitHub kalitni qabul qildi, u yerda muammo yo'q. Muammo lokalda:
**yopiq kalit parol (passphrase) bilan himoyalangan**, men uni kirita
olmayman.

Noutbuk yoningizda bo'lganda **bitta buyruq**:

```powershell
ssh-add C:\Users\Lenovo\.ssh\id_ed25519
```

Parolni bir marta kiritasiz. `ssh-agent` xizmati **Running** va
**Automatic** — kompyuter o'chib yonsa ham eslab qoladi, qayta so'ramaydi.
Shundan keyin ikkala repoda:

```bash
git push origin main
```

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

Rollar bo'yicha o'ylash davom etadi. Xona (avvalgi A-variant) bajarildi.

### A. Bo'sh vaqtni topish — "yangi guruhni qachon ochsam bo'ladi?"  ⭐ tavsiya

Hozir jarayon teskari: administrator vaqtni **taxmin qiladi**, keyin
tizim "ustoz band" yoki "xona band" deydi. U yana taxmin qiladi. Yangi
guruh ochish — telefonda o'tirib beshinchi urinishda topiladigan narsa.

Kerak bo'lgani: *"Ingliz tili, Malika opa, 12 bola, haftada 3 kun"* →
tizim **bo'sh oynalarni o'zi ko'rsatadi**. Uchala cheklov allaqachon
kodda bor:

- ustoz bandligi — `utils/teacherAvailability.js`
- xona bandligi va sig'imi — `utils/roomAvailability.js` (yangi)
- markazning ish vaqti — `utils/supportSlots.js` naqshi

Ya'ni bu yangi ma'lumot emas, **mavjud uchtasini kesishtirish**.
Modme'da bunday narsa yo'q va aynan shu — direktor sotuvda
ko'rsatadigan farq.

### B. Kassa ustiga qurilishi mumkin bo'lganlar

Asos allaqachon bor (`paymentMethod`, `receivedBy`, `CashShift`):

- **Pulni direktorga topshirish.** Hozir smena yopiladi, lekin naqd pul
  jismonan kimga o'tgani yozilmaydi. Ikki tomonlama tasdiq kerak.
- **Xarajatni kassadan chiqarish.** `Expense` hozir kassaga bog'liq emas —
  administrator kassadan pul olib xarajat qilsa, kamomad bo'lib chiqadi.
- **Kassa haqida kunlik Telegram xabari** direktorga: kim yopdi, farq bormi.

### Ataylab keyinga qoldirilgan (mayda ish deb hisoblangan)

`Leads.vue` (9 ta satr), `Reports.vue` (10), `StaffManagement.vue` (20) da
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
