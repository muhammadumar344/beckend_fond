# LC guruhini Fond sinfidan ajratish (reja 1.2)

> **Holat: tayyorgarlik.** Kod hali `Class` ni ishlatadi. Bu hujjat
> ko'chirishni qanday qilish kerakligini va nimaga ehtiyot bo'lish
> kerakligini yozadi. Skriptlar tayyor, lekin ishga tushirilmagan.

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

### Tavsiya

**C variant.** `_id` saqlanishi tufayli ma'lumot ko'chirish deyarli
tekin, ajralish esa haqiqiy. `populate` o'rniga qo'lda birlashtirish —
bu allaqachon loyihada bor naqsh (`getHomeworks` da statistika xuddi
shunday birlashtiriladi).

**A variant** ham to'liq mantiqiy — agar maqsad faqat kodni tozalash
bo'lsa va jismoniy ajralish shart bo'lmasa, u eng arzoni.

**B variantdan qochish** tavsiya etiladi: u eng ko'p ish talab qiladi
va migratsiyaning asosiy yutug'ini yo'qotadi.

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
