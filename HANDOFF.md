# HANDOFF — ishni qayerdan davom ettirish kerak

> **Bu fayl ikkala repoda bir xil.** Birini o'zgartirsangiz, ikkinchisini ham
> yangilang:
> - `Desktop/school_fond/HANDOFF.md` (backend)
> - `Desktop/font_front/font/HANDOFF.md` (frontend)
>
> Oxirgi yangilanish: **2026-08-19** (kassa tugagach)
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

Backend: Node + Express + MongoDB (Mongoose 7), 29 ta model.
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

### Oxirgi tugagan ish — "Kassa" (kunlik smena)

Rollar bo'yicha o'ylashning **ikkinchi** katta funksiyasi. Administrator kun
bo'yi naqd pul oladi va kechqurun direktorga topshiradi — 29 ta modelning
hech birida smena tushunchasi yo'q edi, hisob daftarda yuritilardi.

**Backend** (commit `6137bcf`):
- `src/models/CashShift.js` — o'zgarmas (oltita yozish amali bloklangan),
  `(director, staff.id, date)` unikal indeks.
- `src/services/cashShift.js` — `dayRange`, `totals`, `shiftView`, `close`.
- `src/controllers/cashController.js` + `/lc/cash/{my,close,shifts,open,day}`.
- `MonthlyPayment` ga `paymentMethod` (`cash|card|transfer`), `receivedBy`
  (ism nusxasi bilan) va `{ teacher, paidDate }` indeksi qo'shildi.
- Yangi ruxsat: `viewCash`. 15 ta yangi test.

**Frontend** (commit `314ea98`):
- `src/views/lc/Cash.vue`, route `/lc/cash` va `/staff/cash`, menyu, ~40 ta
  i18n kalit × 3 til, `viewCash` ruxsat kartochkasi.
- `views/teacher/Payments.vue` ga qabul usuli tanlagichi.

**Uchta ataylab qilingan qaror** — o'zgartirishdan oldin o'ylang:

1. **"Smena ochish" tugmasi yo'q.** Smena = ODAM + KUN. Ertalab tugmani
   hech kim bosmaydi va kun bo'yi olingan pul hech qaysi smenaga tegishli
   bo'lmay qolardi. Noto'g'ri hisob — hisob yo'qligidan battar.
2. **Farq tugmani bosishdan OLDIN ko'rinadi.** Odam summani kiritishi bilan
   "kamomad 50 000" chiqadi va yana sanab ko'rishi mumkin.
3. **To'lov belgilashda oyna chiqmaydi.** Qabul usuli sahifa tepasida bir
   marta tanlanadi. Har bir to'lovga oyna qo'ysak, ketma-ket yigirmatasini
   belgilaydigan administrator tugmani o'ylamasdan bosib ketardi.

### Undan oldingi ish — "O'zgarishlar tarixi" (audit log)

Rollar bo'yicha o'ylash natijasida tanlangan **birinchi** katta funksiya.
Sabab: direktor "to'lovni kim o'zgartirdi?" degan savolga javob berolmasdi,
administrator esa ayblovdan o'zini oqlay olmasdi. Naqd pul aylanadigan
o'zbek o'quv markazlarida bu — eng katta ishonch teshigi.

**Backend** (commit `10d27a1`):
- `src/models/AuditLog.js` — **o'zgarmas**. `updateOne`, `updateMany`,
  `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete` —
  oltitasi ham `pre` hook bilan bloklangan. Jurnalni tahrirlay oladigan
  odam uchun jurnal hech narsani isbotlamaydi. TTL 365 kun, 4 ta indeks.
  Aktyor ismi **nusxa qilib** saqlanadi (`populate` emas) — xodim
  o'chirilsa ham kim qilgani ko'rinib turadi.
- `src/services/audit.js` — `audit()` va `diff()`. **`await` qilinmaydi va
  hech qachon `throw` qilmaydi.** To'lovning saqlanishi jurnaldan muhimroq.
- Ulangan joylar: `teacherController` (`updatePaymentStatus`, `markPayment`,
  `deleteStudent`), `salaryController` (`setSalary`, `markSalaryPaid`,
  `deleteSalary`), `roleController` (create / update / delete).
- `Role.js` da yangi ruxsat: `viewAudit`.
- `src/controllers/auditController.js` + `GET /lc/audit`, `/lc/audit/actors`
  — **faqat o'qish**. Bu route'ga POST/PUT/DELETE yozmang.
- `src/utils/accountPurge.js` ga qo'shildi (pastdagi 5-tuzoqqa qarang).
- 11 ta yangi test.

**Frontend** (commit `42df853`):
- `src/views/lc/AuditLog.vue` — kim / nima / qachon filtri, sahifalash,
  `eski → yangi` ko'rinishi. Pul va o'chirish amallari rang bilan ajraladi.
- `lcApi.getAudit` / `getAuditActors`, route `/lc/audit` va `/staff/audit`,
  menyu yozuvlari, ~40 ta i18n kalit × 3 til.

**Ataylab qilingan qaror:** `viewAudit` standart rollarda **yo'q**.
O'z izini ko'ra oladigan administrator uchun jurnal nazorat emas,
**ogohlantirishga** aylanadi — tekshiruvdan oldin izini yashira boshlaydi.
Direktorda esa u avtomatik bor.

### Tekshiruvlar — hammasi yashil

```
backend :  npm test        →  283/283
frontend:  npm run build   →  ✓
frontend:  npm run check   →  check:api, check:perms, check:css, check:i18n — 0 xato
```

---

## 4. 🔴 TO'XTAB TURGAN ISHLAR — Muhammadumar qilishi kerak

### 4.1 Push ishlamayapti (eng muhimi)

**Backend 3 ta, frontend 16 ta commit push qilinmagan.** Kod tayyor,
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

---

## 5. Keyin nima qilinadi

Rollar bo'yicha o'ylash davom etadi. Kassa (avvalgi 1-variant) bajarildi.
Qolgani va yangi topilganlari:

### A. Xona (kabinet) boshqaruvi  ⭐ tavsiya

`Schedule.room` hozir — oddiy **matn maydoni** (`src/models/Schedule.js:15`).
Ustoz bandligi tekshiriladi, lekin **xona bandligi tekshirilmaydi**. Ya'ni
ikki guruhni bir vaqtda bitta xonaga qo'yish mumkin. Bu — kundalik
operatsion falokat va modme'da bor. Kerak: `Room` modeli, jadval saqlashda
konflikt tekshiruvi.

### B. Kassa ustiga qurilishi mumkin bo'lganlar

Asos allaqachon bor (`paymentMethod`, `receivedBy`, `CashShift`):

- **Pulni direktorga topshirish.** Hozir smena yopiladi, lekin naqd pul
  jismonan kimga o'tgani yozilmaydi. Ikki tomonlama tasdiq kerak.
- **Xarajatni kassadan chiqarish.** `Expense` hozir kassaga bog'liq emas —
  administrator kassadan pul olib xarajat qilsa, kamomad bo'lib chiqadi.
- **Kassa haqida kunlik Telegram xabari** direktorga: kim yopdi, farq bormi.

### Ataylab keyinga qoldirilgan (mayda ish deb hisoblangan)

`Leads.vue` (9 ta satr), `Reports.vue` (10), `StaffManagement.vue` (20) da
tarjima qilinmagan matnlar. `npm run check:i18n` ularni ogohlantirish
sifatida ko'rsatadi, build'ni to'xtatmaydi. Katta funksiya orasida
o'z-o'zidan tuzatilsa — yaxshi; alohida ish sifatida qilinmasin.

---

## 6. Qonga singgan tuzoqlar

Bular allaqachon bir marta bug chiqargan. Takrorlamang.

1. **`sed -i` CRLF ni buzadi.** Git Bash'da `.vue` fayllarga `sed -i`
   ishlatilsa, fayl LF ga o'tadi va 18 qatorlik tuzatish 2400 qatorlik
   diff bo'lib ko'rinadi — haqiqiy o'zgarish ko'milib ketadi. Teskarisi ham
   bo'ladi: LF fayl CRLF ga aylanib qolsa, natija bir xil. Commit'dan
   oldin **doim** `git diff --stat`. Fayllarni tahrirlash uchun `Edit`
   ishlatilsin.

2. **`aggregate()` Mongoose sxemasidan o'tmaydi.** Matn ID avtomatik
   `ObjectId` ga aylanmaydi — `$match` **jimgina bo'sh** qaytaradi, xato
   bermaydi. Qo'lda cast qiling. `Model.collection.*` ham shunday.

3. **Vue `scoped` CSS bolaning faqat ILDIZ elementiga tegadi.** Ichkariga
   yozgan uslubingiz ishlamaydi. Bir marta production'da QR kod oq fonsiz
   chizilib, skaner o'qiy olmagan.

4. **`require('./src/server.js')` — bu tekshiruv emas, deploy.** Fayl
   oxirida `app.listen()`, `mongoose.connect()`, `initBot()` bor va import
   paytida darhol ishlaydi. Bir marta shunday qilinib, production bot
   ikkinchi nusxa polling'ga kirgan va Telegram `409 Conflict` bergan.
   Tekshiruvga faqat `routes/`, `controllers/`, `models/`, `utils/`,
   `services/` ni qo'shing.

5. **`AuditLog` va `CashShift` `deleteMany` ni bloklaydi.** Shuning uchun
   `accountPurge.js` da **faqat o'sha bitta joyda** drayver darajasidagi
   `Model.collection.deleteMany()` ishlatiladi (`IMMUTABLE` to'plami).
   Ro'yxatga yangi nom qo'shishdan oldin o'ylang: chetlab o'tish faqat
   o'zgarmas modellar uchun, faqat shu yerda.

6. **Yangi menyu havolasi = 3 ta joy.** `src/config/navigation.js`,
   `router/index.js` dagi route, `TITLES` yozuvi. `npm run check:perms`
   buni nazorat qiladi.

7. **Yangi model qo'shsangiz `accountPurge.js` ga ham qo'shing.** Aks holda
   hisob o'chirilganda bazada egasiz o'quvchi ismlari va telefon raqamlari
   qolib ketadi. `npm test` buni tekshiradi. `AuditLog` va `CashShift`
   o'zgarmas, shuning uchun u yerda drayver darajasida o'chiriladi —
   `IMMUTABLE` to'plamiga qarang.

---

## 7. Har o'zgarishdan keyin

```bash
# backend
cd /c/Users/Lenovo/Desktop/school_fond
npm test

# frontend
cd /c/Users/Lenovo/Desktop/font_front/font
npm run build
npm run check          # api + perms + css + i18n
git diff --stat        # CRLF tuzog'i uchun
```

Commit xabari — **o'zbekcha**, nima o'zgargani emas, **nima uchun**
o'zgargani. Namuna: `O'zgarishlar tarixi: kim to'lovni o'zgartirdi`.
