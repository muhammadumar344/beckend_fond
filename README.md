# Lumo — Backend

O'quv markazlari va maktab sinf fondlari uchun CRM. Node.js /
Express / MongoDB (Mongoose 7).

Frontend alohida repoda: **`Fond_front`**.

> 📖 **Ishlashdan oldin ikkita faylni o'qing:**
> - **`HANDOFF.md`** — hozirgi holat: nima tugadi, nima to'xtab
>   turibdi, keyin nima qilinadi
> - **`CLAUDE.md`** — doimiy qoidalar: arxitektura, tuzoqlar,
>   uslub. Bu yerdagi har bir ⚠️ belgisi haqiqiy xatodan keyin
>   yozilgan
>
> Quyidagi matn faqat kirish uchun — batafsili o'sha ikkitasida.

## Ishga tushirish

```bash
npm install
npm run dev      # nodemon
npm start        # production
npm run check    # test + tarjima + ulanmagan kod
```

`.env`: `MONGODB_URI`, `PORT`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`,
`FRONTEND_URL`. To'liq ro'yxat va ixtiyoriy kalitlar (Cloudinary,
SMS, Payme/Click, platforma kartasi) — `HANDOFF.md` §4.

> 🚨 **`src/server.js` ni tekshiruv uchun `require()` QILMANG.**
> U import paytining o'zida `app.listen()`, `mongoose.connect()`
> va `initBot()` ni chaqiradi — ya'ni ishlab turgan bazaga
> ulanadi va Telegram botning ikkinchi nusxasini polling'ga
> qo'shadi. Bu bir marta production botni buzgan.
> Sintaksis uchun `node --check <fayl>` yetadi.

## Ikki rejim

Hisob ro'yxatdan o'tishda birini tanlaydi va keyin
o'zgartirilmaydi (`Teacher.institutionType`):

| Rejim | Kim uchun | Nima bor |
|---|---|---|
| `school` (**Fond**) | maktab sinfi | sinf, o'quvchi, oylik to'lov, xarajat |
| `learning_center` (**LC**) | o'quv markazi | guruh, davomat, baho, jadval, xodim, maosh, filial |

## Rollar

| Rol | Kim |
|---|---|
| `teacher` | **Direktor** — muassasa egasi, hammasiga ruxsati bor |
| `staff` | Xodim — ruxsatlari `Role.permissions` massivida |
| `admin` | Platforma administratori (`/api/admin/*`) |

## Tuzilma

```
src/
  server.js       kirish nuqtasi (cron'lar shu yerda ulanadi)
  routes/         auth · teacher · lc · tma · admin · payments
  controllers/    16 ta
  models/         Mongoose sxemalar
  services/       sof mantiq (kassa, hisobot, xabar, import)
  utils/          resolveContext · planHelper · enrollment · notifyTargets
  middleware/     auth · roles · mode · lang · rateLimit · security
  cron/           eslatma · kassa xabari · churn · tozalash · support
  bot/            Telegram bot
  scripts/        bir martalik migratsiyalar va guardrail'lar
test/             node:test — bazaga ULANMAYDI
docs/             PAYMENTS · CLOUDINARY · GROUP_MIGRATION
```

## Manzillar

| Prefiks | Nima |
|---|---|
| `/api/auth/*` | kirish, ro'yxatdan o'tish, parol tiklash |
| `/api/teacher/*` | Fond **va** LC uchun umumiy asos |
| `/api/lc/*` | faqat LC (rol, xodim, maosh, kassa, jadval…) |
| `/api/tma/*` | Telegram Mini App (ota-ona / o'quvchi) |
| `/api/admin/*` | platforma administratori |
| `/api/payments/*` | Payme / Click (kalit yo'q → 503) |

⚠️ Aniq ro'yxat **kodda** — `src/routes/`. Bu jadval faqat
yo'nalish beradi; endpoint'larni bu yerda takrorlash eskirgan
hujjatga olib keladi (aynan shunday bo'lgan).

## Tekshiruvlar

```bash
npm test              # 533 ta test, bazaga ulanmaydi
npm run check:messages  # tarjimasiz qolgan xabarlar
npm run check:dead      # yozilgan-u ulanmagan kod
npm run check           # uchalasi birga
```

⚠️ **Build yoki server ko'tarilishi hech narsani kafolatlamaydi.**
Bu loyihadagi eng qimmat xatolar xato bermaydi — funksiya
shunchaki chaqirilmaydi, xabar shunchaki bormaydi. Guardrail'lar
aynan shuning uchun bor.

Frontend repoda yana uchtasi bor va ular **ikkala reponi**
o'qiydi: `check:api` (manzil bormi), `check:shape` (javobdagi
maydon bormi), `check:perms` (menyu → route → ruxsat zanjiri).
