// backend/src/models/MonthlyPayment.js
const mongoose = require('mongoose');

const monthlyPaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  amount: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ['paid', 'not_paid'],
    default: 'not_paid'
  },
  paidDate: Date,

  // ⚠️ `markPayment` allaqachon `payment.note = note` deb yozardi,
  //    lekin sxemada bunday maydon YO'Q edi — Mongoose strict
  //    rejimida noma'lum yo'lni jimgina tashlab yuboradi. Ya'ni
  //    xodim izoh yozib "Saqlash"ni bosardi, xato chiqmasdi va
  //    izoh hech qayerga tushmasdi.
  note: { type: String, default: '' },

  // ── Kassa uchun ──────────────────────────────────────────
  // ⚠️ NEGA KERAK: administrator kun oxirida sanaydigan narsa —
  //    QO'LIDAGI NAQD PUL. Karta orqali kelgan to'lov uning
  //    qutisiga tushmaydi. Bu maydonsiz "kutilgan naqd" barcha
  //    to'lovlarning yig'indisi bo'lib chiqardi va har bir smena
  //    kamomad ko'rsatardi — bunday hisobotni hech kim ikkinchi
  //    marta ochmaydi.
  //
  // ⚠️ ESKI YOZUVLARDA BU MAYDON YO'Q. Mongoose `default` faqat
  //    yangi hujjatga qo'llanadi, bazadagi eskilariga emas.
  //    Shuning uchun agregatsiyada har doim
  //    `$ifNull: ['$paymentMethod', 'cash']` yozing.
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer'],
    default: 'cash',
  },

  // Pulni kim qabul qilgani. Ism NUSXA qilib saqlanadi: xodim
  // ishdan bo'shab, hisobi o'chirilsa ham o'sha kungi smena
  // kimga tegishli ekani ko'rinib turishi kerak.
  receivedBy: {
    id: { type: mongoose.Schema.Types.ObjectId },
    model: { type: String, enum: ['Teacher', 'Staff'] },
    name: { type: String, default: '' },
  },

  createdAt: { type: Date, default: Date.now }
});

// ✅ To'lovlar, hisobotlar, dashboard va filial statistikasi — hammasi
// { class, month, year } bo'yicha so'raydi.
monthlyPaymentSchema.index({ class: 1, month: 1, year: 1 });
// "Qarzdorlar" va "to'langanlar" ro'yxatlari uchun
monthlyPaymentSchema.index({ class: 1, status: 1 });
// Telegram eslatmasi: o'quvchining to'lanmagan oylari
monthlyPaymentSchema.index({ student: 1, status: 1 });
monthlyPaymentSchema.index({ teacher: 1, month: 1, year: 1 });
// Kassa: "shu direktorda, shu kun ichida to'langanlar". `paidDate`
// bo'yicha oraliq so'rov — indekssiz butun to'lovlar to'plami
// skanerlanardi va yil o'tgach smena yopish sekinlashardi.
monthlyPaymentSchema.index({ teacher: 1, paidDate: -1 });

module.exports = mongoose.model('MonthlyPayment', monthlyPaymentSchema);