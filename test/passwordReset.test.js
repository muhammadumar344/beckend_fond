// test/passwordReset.test.js
// ════════════════════════════════════════════════════════════
// Direktor parolni tiklay olmasdi: forma ishlardi, "xat yuborildi"
// deb javob berardi, lekin qidiruv FAQAT Staff kolleksiyasida
// borardi. Xato jimgina yutilardi — foydalanuvchi xat kutib qolardi.
//
// Shu sabab bu yerda ikkita narsa qulflanadi:
//   1. Model darajasida — Teacher'da tiklash maydonlari BOR
//   2. Controller darajasida — ikkala kolleksiya ham qidiriladi
// ════════════════════════════════════════════════════════════
const test = require("node:test");
const assert = require("node:assert/strict");

const Teacher = require("../src/models/Teacher");
const Staff = require("../src/models/Staff");

// ── Model shakli ──────────────────────────────────────────────
test("Teacher'da parol tiklash maydonlari bor", () => {
  // Bu ikkovi bo'lmasa oqim texnik jihatdan ham ishlay olmaydi
  assert.ok(
    Teacher.schema.paths.resetPasswordToken,
    "resetPasswordToken yo'q — direktor parolni tiklay olmaydi",
  );
  assert.ok(Teacher.schema.paths.resetPasswordExpires);
});

test("tiklash maydonlari select:false — tasodifan chiqib ketmasin", () => {
  for (const M of [Teacher, Staff]) {
    assert.equal(
      M.schema.paths.resetPasswordToken.options.select,
      false,
      `${M.modelName}: token javobga chiqib ketishi mumkin`,
    );
  }
});

test("Teacher va Staff bir xil maydon nomlarini ishlatadi", () => {
  // Controller ikkalasiga bir xil so'rov yuboradi — nomlar farq qilsa
  // biri jimgina topilmay qoladi
  for (const f of ["resetPasswordToken", "resetPasswordExpires", "password"]) {
    assert.ok(Teacher.schema.paths[f], `Teacher.${f} yo'q`);
    assert.ok(Staff.schema.paths[f], `Staff.${f} yo'q`);
  }
});

test("parol select:false — login uchun aniq so'ralishi shart", () => {
  assert.equal(Teacher.schema.paths.password.options.select, false);
  assert.equal(Staff.schema.paths.password.options.select, false);
});

// ── Controller xatti-harakati ─────────────────────────────────
// Bazaga ulanmaymiz: modellarning so'rov funksiyalari stub qilinadi.

const ctrl = require("../src/controllers/passwordResetController");

function mkRes() {
  const res = { code: 200, body: null };
  res.status = (c) => {
    res.code = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

/** Modellarni vaqtincha almashtiradi */
async function withStubs({ teacher = null, staff = null }, fn) {
  const tFind = Teacher.findOne;
  const sFind = Staff.findOne;
  const calls = { teacher: 0, staff: 0 };

  const wrap = (doc) => {
    const p = Promise.resolve(doc);
    p.select = () => p;
    return p;
  };
  Teacher.findOne = () => {
    calls.teacher++;
    return wrap(teacher);
  };
  Staff.findOne = () => {
    calls.staff++;
    return wrap(staff);
  };

  try {
    return await fn(calls);
  } finally {
    Teacher.findOne = tFind;
    Staff.findOne = sFind;
  }
}

const mkDoc = (over = {}) => ({
  email: "a@b.uz",
  name: "Test",
  isActive: true,
  save: async () => {},
  ...over,
});

test("forgotPassword — direktor topilsa Staff'ga umuman bormaydi", async () => {
  await withStubs({ teacher: mkDoc() }, async (calls) => {
    const res = mkRes();
    await ctrl.forgotPassword({ body: { email: "A@B.uz" } }, res);

    assert.equal(calls.teacher, 1);
    assert.equal(calls.staff, 0, "direktor topilgach staff qidirilmasligi kerak");
    assert.equal(res.body.success, true);
  });
});

test("forgotPassword — direktor yo'q bo'lsa Staff qidiriladi", async () => {
  await withStubs({ teacher: null, staff: mkDoc() }, async (calls) => {
    const res = mkRes();
    await ctrl.forgotPassword({ body: { email: "a@b.uz" } }, res);

    assert.equal(calls.teacher, 1);
    assert.equal(calls.staff, 1, "⚠️ ASOSIY: ikkala kolleksiya ham qidirilsin");
  });
});

test("forgotPassword — direktorga token yoziladi", async () => {
  const doc = mkDoc();
  await withStubs({ teacher: doc }, async () => {
    await ctrl.forgotPassword({ body: { email: "a@b.uz" } }, mkRes());

    assert.ok(doc.resetPasswordToken, "token yozilmagan");
    assert.equal(doc.resetPasswordToken.length, 64, "32 bayt hex bo'lishi kerak");
    assert.ok(doc.resetPasswordExpires > new Date(), "muddat o'tmishda");
  });
});

test("forgotPassword — email topilmasa ham bir xil javob (oshkor qilmaydi)", async () => {
  const found = mkRes();
  await withStubs({ teacher: mkDoc() }, async () => {
    await ctrl.forgotPassword({ body: { email: "a@b.uz" } }, found);
  });

  const missing = mkRes();
  await withStubs({ teacher: null, staff: null }, async () => {
    await ctrl.forgotPassword({ body: { email: "yoq@b.uz" } }, missing);
  });

  // Matn bir xil bo'lishi SHART — aks holda qaysi email ro'yxatda
  // borligini tashqaridan bilib olish mumkin
  assert.equal(found.body.message, missing.body.message);
  assert.equal(found.code, missing.code);
});

test("forgotPassword — bloklangan hisobga token yozilmaydi", async () => {
  const doc = mkDoc({ isActive: false });
  await withStubs({ teacher: doc }, async () => {
    const res = mkRes();
    await ctrl.forgotPassword({ body: { email: "a@b.uz" } }, res);

    assert.equal(doc.resetPasswordToken, undefined);
    assert.equal(res.body.success, true); // javob baribir bir xil
  });
});

test("forgotPassword — email berilmasa 400", async () => {
  const res = mkRes();
  await ctrl.forgotPassword({ body: {} }, res);
  assert.equal(res.code, 400);
});

test("resetPassword — direktor topilsa paroli yangilanadi", async () => {
  const doc = mkDoc({ password: "eski" });
  await withStubs({ teacher: doc }, async () => {
    const res = mkRes();
    await ctrl.resetPassword(
      { params: { token: "t".repeat(64) }, body: { password: "yangiParol" } },
      res,
    );

    // ⚠️ Ochiq matn yoziladi — pre('save') hook hash qiladi.
    // Bu yerda qo'lda hash qilinsa parol IKKI MARTA hash bo'lardi
    // va login hech qachon ishlamasdi.
    assert.equal(doc.password, "yangiParol");
    assert.equal(doc.resetPasswordToken, null, "token bekor qilinmagan");
    assert.equal(res.body.success, true);
  });
});

test("resetPassword — direktor yo'q bo'lsa Staff qidiriladi", async () => {
  await withStubs({ teacher: null, staff: mkDoc() }, async (calls) => {
    await ctrl.resetPassword(
      { params: { token: "t" }, body: { password: "yangiParol" } },
      mkRes(),
    );
    assert.equal(calls.staff, 1, "⚠️ ASOSIY: staff ham qidirilsin");
  });
});

test("resetPassword — qisqa parol rad etiladi", async () => {
  const res = mkRes();
  await ctrl.resetPassword(
    { params: { token: "t" }, body: { password: "123" } },
    res,
  );
  assert.equal(res.code, 400);
});

test("resetPassword — token topilmasa 400", async () => {
  await withStubs({ teacher: null, staff: null }, async () => {
    const res = mkRes();
    await ctrl.resetPassword(
      { params: { token: "yoq" }, body: { password: "yangiParol" } },
      res,
    );
    assert.equal(res.code, 400);
    assert.match(res.body.error, /muddati/);
  });
});

test("resetPassword — newPassword nomi ham qabul qilinadi", async () => {
  const doc = mkDoc();
  await withStubs({ teacher: doc }, async () => {
    await ctrl.resetPassword(
      { params: { token: "t" }, body: { newPassword: "yangiParol" } },
      mkRes(),
    );
    assert.equal(doc.password, "yangiParol");
  });
});
