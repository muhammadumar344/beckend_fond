# To'lov tizimlari — Payme va Click

> **Holat: kod tayyor, tizim O'CHIQ.**
> Merchant shartnomasi yo'q (YaTT ochilmagan), shuning uchun kalitlar
> ham yo'q. Kalit qo'yilmaguncha barcha endpoint'lar **503** qaytaradi
> va foydalanuvchiga to'lov tugmasi umuman ko'rinmaydi.

## Yoqish (merchant olgandan keyin)

Render → **Environment** ga qo'shing va qayta deploy qiling.
Kodda hech narsa o'zgartirish shart emas.

```
# Payme
PAYME_MERCHANT_ID=...        # kabinetdan
PAYME_KEY=...                # kassa kaliti
PAYME_TEST_KEY=...           # ixtiyoriy, sandbox uchun

# Click
CLICK_MERCHANT_ID=...
CLICK_SERVICE_ID=...
CLICK_SECRET_KEY=...
CLICK_MERCHANT_USER_ID=...
```

Ikkalasidan **bittasi** ham yetarli — ikkinchisi o'chiq qolaveradi.

Kabinetda webhook manzilini ko'rsating:

| Tizim | Manzil |
|---|---|
| Payme | `https://beckend-fond.onrender.com/api/payments/payme` |
| Click | `https://beckend-fond.onrender.com/api/payments/click` |

## ⚠️ Yoqishdan oldin SHART

Bu kod **jonli sinalmagan** — merchant hisobi bo'lmagani uchun
sandbox'ga ulanib bo'lmadi. Kalit qo'yishdan oldin quyidagilarni
ularning sinov muhitida tekshiring:

- [ ] Payme sandbox: 5 ta metod ham to'g'ri javob qaytaradimi
- [ ] Payme: takroriy `CreateTransaction` yangi yozuv YARATMAYDI
- [ ] Payme: `PerformTransaction` ikki marta kelsa pul ikki marta yechilmaydi
- [ ] Click: `Prepare` → `Complete` ketma-ketligi
- [ ] Click: `merchant_prepare_id` mos kelmasa rad etiladi
- [ ] Ikkalasida ham: summa noto'g'ri bo'lsa rad etiladi
- [ ] Obuna muddati **ustiga qo'shiladi** (nolga tushmaydi)

Sinovdan keyin bu ro'yxatni belgilab qo'ying.

## Qanday ishlaydi

```
Foydalanuvchi                 Biz                      Payme/Click
     │                         │                            │
     ├── "Pro sotib olish" ───▶│                            │
     │                         ├── /payments/checkout ──────│
     │◀── to'lov havolasi ─────┤                            │
     ├─────────────── havolaga o'tadi ───────────────────▶  │
     │                         │◀── webhook: tayyorlash ────┤
     │                         │    (Transaction: pending)  │
     │                         │◀── webhook: yakunlash ─────┤
     │                         │    (Transaction: paid)     │
     │                         ├── obuna faollashadi        │
```

**Ikki bosqich shart.** Avval pul bloklanadi, keyin yechiladi.
Oradagi holat `Transaction` da saqlanadi — aks holda tizim so'rovni
takrorlaganda (ular buni tez-tez qiladi) pul ikki marta yechilardi.

## Muhim tafsilotlar

**Summa birligi farq qiladi.** Payme **tiyinda** yuboradi
(1 so'm = 100 tiyin), Click **so'mda**. Aralashtirilsa 100 barobar
xato bo'ladi. `config/payments.js` dagi `amountMultiplier` shuni
hal qiladi — qo'lda ko'paytirmang.

**Idempotentlik.** `Transaction.providerTransactionId` unique.
Takroriy so'rovga **yangi yozuv emas, bir xil javob** qaytariladi.
Bu eng muhim qoida — buzilsa mijozdan ikki marta pul yechiladi.

**Obuna qo'shiladi, almashtirilmaydi.** Amaldagi obuna tugamagan
bo'lsa yangi muddat ustiga qo'shiladi (`routes/payments.js` →
`activateSubscription`).

**Imzo tekshiruvi `timingSafeEqual` bilan.** Oddiy `===`
solishtiruvi kalitni belgima-belgi topish imkonini beradigan
vaqt farqi qoldiradi.

**Webhook'lar `auth` middleware ORTIDA EMAS** — Payme/Click bizga
JWT bilan kelmaydi. Ularning haqiqiyligi Basic parol (Payme) va
MD5 imzo (Click) orqali tekshiriladi.

## Merchant yo'q ekan — hozirgi yo'l

Hozir obuna to'lovi **qo'lda** qabul qilinadi va u ishlaydi:

1. Foydalanuvchi karta orqali pul o'tkazadi
2. Chek skrinshotini yuklaydi (`PaymentRequest`)
3. Admin ko'rib chiqadi va tasdiqlaydi
4. Obuna faollashadi

Bu oqim to'liq tayyor va `Transaction` dan mustaqil — to'lov
tizimlari yoqilganda ham ishlab turaveradi (ba'zi mijozlar
kartasiz to'lashni afzal ko'radi).

### Yaxshilash g'oyalari (merchant kutmasdan)

**1. Shaxsiy Payme/Click havolasi.** Payme'da `payme.uz/@nom`,
Click'da "Click Pass" QR — bular **shaxsiy** o'tkazma, merchant
shartnomasi talab qilmaydi. Pul shaxsiy kartaga tushadi. Skrinshot
oqimi saqlanadi, lekin foydalanuvchi karta raqamini qo'lda
kiritmaydi — bitta bosishda to'laydi. **Eng tez yutuq shu.**

**2. Telegram bot orqali tasdiqlash.** Bot allaqachon bor.
Skrinshot botga yuborilsa admin telefonidan bitta tugma bilan
tasdiqlaydi — kompyuter ochish shart emas.

**3. Bank SMS'ini avtomatik o'qish.** Kartaga pul tushganda bank
SMS yuboradi. O'sha SMS botga yo'naltirilsa, summa va vaqt bo'yicha
kutilayotgan so'rov bilan solishtirib **avtomatik tasdiqlash**
mumkin. Tez, lekin mo'rt — SMS formati o'zgarsa buziladi.
Avtomatik tasdiqlangan to'lovni baribir admin ko'radigan qilish
kerak.

**4. Yillik to'lovga chegirma.** 12 oylik to'lov = 10 oy narxi.
Qo'lda tasdiqlash soni 12 barobar kamayadi — merchant yo'qligining
asosiy og'rig'i aynan shu.

> YaTT ochilgach 1-variant merchant'ga o'tadi va qolganlari zaxira
> yo'l sifatida qoladi.
