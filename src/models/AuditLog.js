// src/models/AuditLog.js
// ════════════════════════════════════════════════════════════
// Kim nimani o'zgartirdi.
//
// NEGA BU MODEL BOR: `MonthlyPayment` da to'lovni KIM "to'landi"
// qilgani yozilmasdi. Administrator to'lovni bekor qilsa yoki
// summasini o'zgartirsa, hech qanday iz qolmasdi. Direktor
// "men bermadim" bilan "men to'ladim" orasida hakamlik qila
// olmasdi — naqd pul bilan ishlaydigan markazda bu eng katta
// ishonchsizlik nuqtasi.
//
// Bu jurnal ikki tomonni ham himoya qiladi: direktor ko'radi,
// administrator esa o'zini oqlay oladi.
//
// ⚠️ JURNAL O'ZGARMAS. Hech qayerda `update` yoki `delete`
//    yozmang — aks holda uning butun ma'nosi yo'qoladi. Faqat
//    yozish va o'qish. Model darajasida ham qulflangan (pastga
//    qarang).
//
// ⚠️ YOZUV MUVAFFAQIYATSIZ BO'LSA ASOSIY AMAL TO'XTAMASIN.
//    To'lov saqlanishi jurnaldan muhimroq. `services/audit.js`
//    shuning uchun hech qachon `throw` qilmaydi.
// ════════════════════════════════════════════════════════════
const mongoose = require("mongoose");

// Bir yildan keyin o'chadi. Sabab: jurnal tez o'sadi va bir
// yildan eski to'lov nizosi amalda uchramaydi. Kerak bo'lsa
// bu qiymatni oshiring — kamaytirmang.
const TTL_DAYS = 365;

const auditLogSchema = new mongoose.Schema(
  {
    // ── Kimning markazi ──
    // Har bir so'rov shu bo'yicha filtrlanadi. Bunsiz bir
    // direktor boshqasining jurnalini ko'rib qolishi mumkin.
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },

    // ── Kim qildi ──
    // Ism NUSXA qilib saqlanadi. Xodim ishdan bo'shab, yozuvi
    // o'chirilsa ham jurnalda "Dilnoza Karimova" bo'lib qoladi.
    // `populate` ga tayansak, o'sha yerda bo'sh joy qolardi.
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      model: { type: String, enum: ["Teacher", "Staff"], required: true },
      name: { type: String, default: "" },
      roleName: { type: String, default: "" },
    },

    // ── Nima qilindi ──
    // `entity.fe'l` ko'rinishida: "payment.marked_paid",
    // "payment.amount_changed", "student.deleted".
    action: { type: String, required: true, index: true },

    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },

    // O'quvchi ismi, oy nomi — jurnalni O'QIB tushunish uchun.
    // Bunsiz direktor har bir qatorni ochib ko'rishga majbur
    // bo'lardi, ya'ni jurnaldan amalda foydalanmasdi.
    entityLabel: { type: String, default: "" },

    // ── Nima o'zgardi ──
    // [{ field: 'amount', from: 300000, to: 250000 }]
    changes: [
      {
        _id: false,
        field: { type: String, required: true },
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
      },
    ],

    // Nizo paytida "qaysi kompyuterdan" degan savol chiqadi.
    ip: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
  },
  {
    // ⚠️ `versionKey` o'chirilgan: yozuv hech qachon
    //    yangilanmaydi, demak versiya raqami ortiqcha.
    versionKey: false,
  },
);

// ── Indekslar ───────────────────────────────────────────────
// 1) Asosiy ko'rinish: markazning oxirgi o'zgarishlari.
auditLogSchema.index({ director: 1, createdAt: -1 });
// 2) "Shu to'lov bilan nima bo'lgan?" — o'quvchi kartasidan.
auditLogSchema.index({ director: 1, entity: 1, entityId: 1, createdAt: -1 });
// 3) "Dilnoza bu oy nima qildi?" — xodim bo'yicha filtr.
auditLogSchema.index({ director: 1, "actor.id": 1, createdAt: -1 });
// 4) Muddati o'tganini Mongo o'zi tozalaydi.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 86400 });

// ── O'zgarmaslikni majburlash ───────────────────────────────
// Kod noto'g'ri yozilib qolsa ham jurnal tahrirlanmasin.
// Bu shunchaki ehtiyot chorasi emas: jurnalni o'zgartira
// oladigan odam uchun jurnal hech narsani isbotlamaydi.
const blockWrite = function (next) {
  next(new Error("Audit jurnalini o'zgartirib yoki o'chirib bo'lmaydi"));
};
for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  auditLogSchema.pre(op, blockWrite);
}

module.exports = mongoose.model("AuditLog", auditLogSchema);
