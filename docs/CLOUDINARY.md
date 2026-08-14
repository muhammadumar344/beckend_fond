# Cloudinary — logotiplarni saqlash

## Hozirgi holat: O'CHIQ

Kalitlar `.env` da bo'sh turibdi. Bu holda **hech narsa buzilmaydi** —
logotip avvalgidek base64 bo'lib MongoDB ga yoziladi.

## Yoqish (3 daqiqa)

1. [cloudinary.com](https://cloudinary.com) da bepul hisob oching.
   Free tier: 25 GB saqlash + 25 GB oylik trafik. Lumo uchun bu
   minglab logotipga yetadi.

2. Dashboard → **Product Environment Credentials** bo'limidan
   uchta qiymatni ko'chiring.

3. `.env` (lokalda) va **Render → Environment** (produksiyada) ga
   qo'ying:

   ```
   CLOUDINARY_CLOUD_NAME=dxxxxxxxx
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxx
   CLOUDINARY_FOLDER=lumo
   ```

4. Qayta deploy qiling. Tamom — kod o'zi sezadi.

## Yoqilgandan keyin nima o'zgaradi

| | O'chiq | Yoqiq |
|---|---|---|
| Logotip qayerda | MongoDB (base64) | Cloudinary CDN |
| Hajm cheklovi | 300 KB | 3 MB |
| Saqlashdan oldin | o'zgarmaydi | 512px gacha kichraytiriladi |
| Yetkazish | baza → server → brauzer | CDN → brauzer |
| Format | yuklangani | brauzer qo'llasa WebP/AVIF (`f_auto`) |

Interfeys cheklovni o'zi bilib oladi — `GET /api/teacher/branding`
javobida `logoMaxBytes` keladi.

## Eski logotiplarni ko'chirish

Shart emas: eski base64 logotiplar `<img src="data:...">` bo'lib
ishlayveradi. Bazani yengillatmoqchi bo'lsangiz:

```bash
node scripts/migrate-logos-cloudinary.js          # quruq yurish
node scripts/migrate-logos-cloudinary.js --apply  # rostdan
```

## Kod qayerda

| Fayl | Vazifasi |
|---|---|
| `src/config/cloudinary.js` | Kalitlar, papkalar, `enabled` |
| `src/services/cloudinary.js` | `uploadImage`, `destroyImage`, imzo |
| `src/controllers/teacherController.js` | `updateBranding` — CDN yoki base64 |
| `test/cloudinary.test.js` | Imzo qoidasi va o'chiq holat |

## Imzo — eng ko'p adashiladigan joy

Cloudinary "Invalid Signature" xatosini SABABSIZ qaytaradi.
Qoida:

1. Yuboriladigan parametrlardan `file`, `api_key`, `cloud_name`,
   `resource_type`, `signature` **chiqarib tashlanadi**
2. Qolganlari **alifbo tartibida** `k=v&k=v` qilib ulanadi
3. Oxiriga `api_secret` qo'shiladi
4. `sha1` olinadi

⚠️ Imzolangan qiymat **aynan** yuborilgan qiymat bo'lishi shart.
`services/cloudinary.js` da shuning uchun bitta `signed` obyekt
tuziladi va u ham imzolanadi, ham yuboriladi.

## Hisob to'lib qolsa

Har bir direktorga **bitta** doimiy nom beriladi
(`lumo/logos/director-<id>`), yangisi eskisi ustiga yoziladi.
Ya'ni 100 ta markaz = 100 ta rasm, necha marta almashtirishidan
qat'i nazar.
