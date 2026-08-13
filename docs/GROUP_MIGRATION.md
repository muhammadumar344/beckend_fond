# LC guruhini Fond sinfidan ajratish (reja 1.2)

> **Holat: A varianti bajarildi.** LC kodi endi `Group` modelini
> ishlatadi (`src/models/Group.js`), lekin u `classes` kolleksiyasiga
> bog'langan — ya'ni **ma'lumot ko'chirilmagan**. Quyidagi "Uch yo'l"
> bo'limi nima uchun aynan A tanlanganini tushuntiradi.
>
> C variantiga o'tish uchun kerakli skriptlar tayyor va o'zgarmagan.

## A varianti nima berdi

- LC kodi `Class` emas, `Group` deb yozilgan — niyat aniq
- `Group` sxemasida **faqat LC maydonlari** bor. `initialBalance` va
  `initialBalanceNote` yo'q, shu sabab LC kodi ularga tasodifan ham
  teg olmaydi
- `director` / `monthlyPrice` alias'lari — LC atamalari bilan o'qish
- Ma'lumotga umuman tegilmagan: orqaga qaytarish = kodni qaytarish

**Nima bermadi:** jismoniy ajralish. Ikkala rejim hujjatlari hamon
bitta kolleksiyada. Bu C variantining vazifasi.

⚠️ **Alias tuzog'i** — `models/Group.js` dagi izohni o'qing.
`.sort({ monthlyPrice: 1 })` va `updateOne({}, { monthlyPrice: 5 })`
**ishlamaydi** (birinchisi tartiblamaydi, ikkinchisi yangi maydon
yozadi). So'rov filtrida alias ishlaydi — `pre` hook tarjima qiladi.

## Keyingi qadam (C varianti) endi arzonroq

A bajarilgani uchun quyidagi 4-qadamning katta qismi tayyor: LC kodi
allaqachon `Group` deb yozilgan. C ga o'tish uchun qoladi:

1. `models/Group.js` dagi 3-argumentni (`"classes"`) olib tashlash
2. Alias'larni haqiqiy nomga aylantirish (`director`, `monthlyPrice`)
3. `migrateGroups.js --apply` bilan ma'lumotni nusxalash
4. `populate("class")` ni LC yo'llarida qo'lda birlashtirishga o'tkazish

## Hozirgi holat

LC "guruh"lari Fond'ning `Class` modelida saqlanadi. `Class` da ikkala
rejimning maydonlari birga turadi:

| Maydon | Kim ishlatadi |
|---|---|
| `name`, `teacher`, `branch` | ikkalasi |
| `defaultAmount` | Fond: oylik fond puli · LC: kurs narxi |
| `initialBalance`, `initialBalanceNote` | faqat Fond |
| `subject`, `assignedTeacher`, `capacity` | faqat LC |

Bu ataylab qilingan — migratsiya xavfini kechiktirish uchun. Endi
loyiha kattalashdi va ajratish mantiqiy.

## Asosiy g'oya: `_id` o'zgarmaydi

`Class` ga **9 ta kolleksiya** ishora qiladi:

```
Student.class          Attendance.class     Grade.class
Schedule.class         MonthlyPayment.class Expense.class
Homework.class         HomeworkResult.class TelegramParent.classId
```

Agar `Group` yozuvlari **aynan o'sha `_id`** bilan yaratilsa, bu 9 ta
kolleksiyadagi ishoralarni **umuman qayta yozish kerak emas** —
ular allaqachon to'g'ri ObjectId ga ishora qiladi.

`migrateGroups.js` shunday ishlaydi. Bu migratsiyani o'n baravar
xavfsizroq qiladi: ming-minglab yozuvni yangilash o'rniga faqat
guruhlar soniga teng yangi hujjat yaratiladi.

## Asosiy qiyinchilik: `ref: 'Class'`

Ma'lumot ko'chirilsa ham, sxemalarda `ref: "Class"` yozilgan. Ya'ni
`populate("class")` `classes` kolleksiyasidan qidiradi va **LC uchun
bo'sh qaytaradi**.

`populate("class")` loyihada **13 joyda** ishlatiladi:

| Fayl | Soni |
|---|---|
| `teacherController.js` | 5 |
| `freezeController.js` | 2 |
| `homeworkController.js` | 2 |
| `telegramController.js` | 2 |
| `groupController.js` | 1 |
| `scheduleController.js` | 1 |

Shu 13 joy migratsiya bilan **bir vaqtda** hal qilinishi kerak.

## Uch yo'l — qaysi birini tanlash

### A. Bir xil kolleksiya, boshqa model (ma'lumot ko'chirilmaydi)

```js
mongoose.model('Group', groupSchema, 'classes')  // 3-argument
```

Kod toza `Group` API oladi, ma'lumot joyida qoladi, `populate` ishlaydi.

- ✅ Migratsiya umuman yo'q, xavf nolga yaqin, istalgan vaqtda orqaga
- ❌ Jismoniy ajralish yo'q — bitta kolleksiyada ikkala rejim
- ❌ Kelajakda LC uchun alohida indeks/validatsiya qo'yish qiyin

### B. Alohida kolleksiya + dinamik ref (`refPath`)

Har bir bog'liq modelga `classModel` maydoni qo'shiladi
(`"Class"` yoki `"Group"`), `ref` o'rniga `refPath` ishlatiladi.

- ✅ To'liq ajralish, `populate` ikkala rejimda ishlaydi
- ❌ 9 ta modelga yangi maydon + **barcha mavjud yozuvlarga** uni to'ldirish
  kerak — ya'ni asosiy yutuq (`_id` o'zgarmasligi) yo'qoladi
- ❌ Eng ko'p kod o'zgarishi

### C. Alohida kolleksiya + LC yo'llarida `populate` ishlatmaslik

`Group` alohida kolleksiya. LC controller'larida `populate("class")`
o'rniga guruhlarni alohida so'rab, xotirada birlashtiriladi.

- ✅ To'liq ajralish, `_id` o'zgarmaydi, ma'lumot ko'chirish arzon
- ✅ 13 ta `populate` ning faqat LC'ga tegishlilari o'zgaradi
- ❌ Bir nechta joyda qo'lda birlashtirish kodi paydo bo'ladi

### Tanlangan yo'l: A (2026-08, bajarildi)

Avvalgi tavsiya **C** edi. Amalda **A** tanlandi — sabab texnik emas,
sharoitga bog'liq:

| | A | C |
|---|---|---|
| Staging muhit kerakmi | yo'q | ha (yo'q) |
| Jonli bazaga tegadimi | yo'q | ha |
| Migratsiya + deploy bir vaqtda | yo'q | **ha** |
| Orqaga qaytarish | kodni qaytarish | skript + tekshirish |
| Jismoniy ajralish | yo'q | ha |

C ning eng katta xavfi — 5-qadam: ma'lumot ko'chirish va yangi kod
deploy'i **bir daqiqa ichida** bo'lishi kerak. Oraliqda LC direktorlari
guruhlarini umuman ko'rmaydi. Staging muhit yo'q, ya'ni bu qadam
birinchi marta jonli saytda sinaladi.

A esa ma'lumotga tegmaydi va **C ning boshlang'ich qismi**: eng katta
mehnat (LC kodini `Group` ga o'tkazish) A da bajarildi. Keyinchalik C
qilinsa, u endi katta-portlash emas, kichik qadam bo'ladi.

**B variantdan qochish** tavsiya etiladi: u eng ko'p ish talab qiladi
va migratsiyaning asosiy yutug'ini (`_id` o'zgarmasligi) yo'qotadi.

## Tartib (C variant uchun)

1. **Tahlil**

   ```bash
   node src/scripts/analyzeGroupSplit.js
   ```

   Hech narsa o'zgartirmaydi. Muammoli yozuv topilsa avval shuni tuzating.

2. **Bazadan nusxa oling.** MongoDB Atlas'da snapshot yoki
   `mongodump`. Bu qadamni o'tkazib yubormang.

3. **Quruq yurish**

   ```bash
   node src/scripts/migrateGroups.js
   ```

   Nechta yozuv yaratilishini va namunani ko'rsatadi.

4. **Kodni tayyorlang** (hali deploy qilmang):
   - LC controller'larida `Class` → `Group`
     (`groupController`, `homeworkController`, `scheduleController`,
     `attendanceController`, `gradeController` ning LC yo'llari)
   - `defaultAmount` → `monthlyPrice`, `teacher` → `director`
   - 13 ta `populate("class")` dan LC'ga tegishlilarini qo'lda
     birlashtirishga o'tkazing
   - Testlarni yangilang

5. **Ko'chirish va deploy — birga**

   ```bash
   node src/scripts/migrateGroups.js --apply
   ```

   So'ng darhol yangi kodni deploy qiling. Oraliqda ilova LC
   guruhlarini topa olmaydi.

6. **Tekshiring**: guruhlar, davomat, baholar, jadval, to'lovlar,
   uy vazifasi, filial statistikasi — hammasi LC hisobida.

7. **Eski yozuvlarni o'chirish — shoshilmang.** `Class` dagi LC
   yozuvlari tegilmagan holda qoladi. Bir necha hafta ishlagach,
   ishonch hosil qilib, qo'lda o'chiring.

## Orqaga qaytarish

```bash
node src/scripts/migrateGroups.js --rollback --apply
```

Faqat `migratedFromClass` belgisi bor `Group` yozuvlarini o'chiradi.
`Class` ga hech qachon tegilmagani uchun ma'lumot to'liq saqlanib
qoladi — eski kodni qaytarsangiz ilova ishlayveradi.

## Nima uchun hozir bajarilmadi

Bu o'zgarish jonli bazadagi ma'lumotga tegadi va staging muhit yo'q.
Skriptlar va reja tayyor — qaror va ishga tushirish egasiga tegishli.
