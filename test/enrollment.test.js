// test/enrollment.test.js
// `utils/enrollment.js` — guruh ro'yxatini yig'adigan yagona joy.
// Ikki manbani (Student.class + Enrollment) birlashtiradi, shuning
// uchun eng katta xavf — TAKROR SANASH yoki kimningdir tushib qolishi.
//
// Bazaga ulanmaymiz: Student/Enrollment modellarining so'rov
// funksiyalari vaqtincha almashtiriladi (stub). Tekshirilayotgan
// narsa — birlashtirish mantig'i, Mongoose emas.
const test = require("node:test");
const assert = require("node:assert/strict");

const Student = require("../src/models/Student");
const Enrollment = require("../src/models/Enrollment");
const {
  getGroupStudents,
  countGroupStudents,
  countUniqueStudents,
  getStudentGroupIds,
  buildGroupStudentMap,
} = require("../src/utils/enrollment");

/** `.select()` zanjirini qo'llab-quvvatlaydigan soxta so'rov */
const q = (rows) => {
  const p = Promise.resolve(rows);
  p.select = () => p;
  return p;
};

const inList = (v, list) => list.some((x) => String(x) === String(v));

/**
 * Filtrni HISOBGA OLADIGAN stub. Bu muhim: soddaroq stub (filtrga
 * qaramay bir xil massiv qaytaradigan) birlashtirish mantig'idagi
 * takror sanashni umuman ko'rsata olmaydi.
 */
const matchStudents = (rows, filter = {}) =>
  rows.filter((r) => {
    if (filter.class !== undefined) {
      const want = filter.class.$in;
      if (want) return inList(r.class, want);
      return String(r.class) === String(filter.class);
    }
    if (filter._id?.$in) return inList(r._id, filter._id.$in);
    return true;
  });

const matchEnrollments = (rows, filter = {}) =>
  rows.filter((r) => {
    if (filter.class !== undefined) {
      const want = filter.class.$in;
      if (want) return inList(r.class, want);
      return String(r.class) === String(filter.class);
    }
    if (filter.student !== undefined) {
      return String(r.student) === String(filter.student);
    }
    return true;
  });

/** Modellarni vaqtincha almashtirib, testdan keyin tiklaydi */
function withStubs({ students = [], enrollments = [] }, fn) {
  const sFind = Student.find,
    sCount = Student.countDocuments,
    sById = Student.findById;
  const eFind = Enrollment.find,
    eCount = Enrollment.countDocuments;

  Student.find = (f) => q(matchStudents(students, f));
  Student.countDocuments = async (f) => matchStudents(students, f).length;
  Student.findById = (id) =>
    q(students.find((s) => String(s._id) === String(id)) || null);
  Enrollment.find = (f) => q(matchEnrollments(enrollments, f));
  Enrollment.countDocuments = async (f) =>
    matchEnrollments(enrollments, f).length;

  return (async () => {
    try {
      return await fn();
    } finally {
      Student.find = sFind;
      Student.countDocuments = sCount;
      Student.findById = sById;
      Enrollment.find = eFind;
      Enrollment.countDocuments = eCount;
    }
  })();
}

const stu = (id, cls, roll) => ({ _id: id, class: cls, rollNumber: roll });

// ── Birlashtirish ─────────────────────────────────────────────
test("asosiy va qo'shimcha o'quvchilar birlashadi", async () => {
  await withStubs(
    {
      students: [stu("s1", "g1", 2), stu("s2", "g1", 1), stu("s3", "g9", 3)],
      enrollments: [{ student: "s3", class: "g1" }],
    },
    async () => {
      const rows = await getGroupStudents("g1");
      const ids = rows.map((r) => r._id);
      assert.deepEqual(ids, ["s2", "s1", "s3"], "rollNumber bo'yicha 1,2,3");
      assert.equal(new Set(ids).size, ids.length, "takror bo'lmasligi kerak");
    },
  );
});

test("asosiy guruhda ham, Enrollment'da ham bo'lsa bir marta chiqadi", async () => {
  await withStubs(
    {
      students: [stu("s1", "g1", 1)],
      // Eski ma'lumotda tasodifan qo'sh yozuv bo'lib qolgan holat
      enrollments: [{ student: "s1", class: "g1" }],
    },
    async () => {
      const rows = await getGroupStudents("g1");
      assert.equal(rows.length, 1, "takror yozuv qo'shilmasligi kerak");
    },
  );
});

test("rollNumber bo'yicha tartiblanadi", async () => {
  await withStubs(
    { students: [stu("s1", "g1", 5), stu("s2", "g1", 1), stu("s3", "g1", 3)] },
    async () => {
      const rows = await getGroupStudents("g1");
      assert.deepEqual(
        rows.map((r) => r.rollNumber),
        [1, 3, 5],
      );
    },
  );
});

test("rollNumber yo'q o'quvchi yiqilmaydi", async () => {
  await withStubs(
    { students: [stu("s1", "g1", undefined), stu("s2", "g1", 2)] },
    async () => {
      const rows = await getGroupStudents("g1");
      assert.equal(rows.length, 2);
    },
  );
});

// ── Sanash ────────────────────────────────────────────────────
test("guruh soni = asosiy + qo'shimcha", async () => {
  await withStubs(
    {
      students: [stu("s1", "g1"), stu("s2", "g1")],
      enrollments: [{ student: "s3", class: "g1" }],
    },
    async () => {
      assert.equal(await countGroupStudents("g1"), 3);
    },
  );
});

test("markaz umumiy soni NOYOB — ikki guruhdagi bola bir marta", async () => {
  await withStubs(
    {
      // s1 asosiy guruhda (g1), ayni paytda g2 ga ham yozilgan
      students: [
        { _id: "s1", class: "g1" },
        { _id: "s2", class: "g1" },
      ],
      enrollments: [
        { student: "s1", class: "g2" },
        { student: "s3", class: "g2" },
      ],
    },
    async () => {
      // s1, s2, s3 → 3 ta (s1 ikki marta sanalmasligi kerak)
      assert.equal(await countUniqueStudents(["g1", "g2"]), 3);
    },
  );
});

test("bo'sh ro'yxatda 0 qaytaradi, so'rov yubormaydi", async () => {
  assert.equal(await countUniqueStudents([]), 0);
  assert.equal(await countUniqueStudents(null), 0);
});

// ── O'quvchining guruhlari ────────────────────────────────────
test("asosiy guruh ham ro'yxatga kiradi", async () => {
  await withStubs(
    {
      students: [{ _id: "s1", class: "g1" }],
      enrollments: [{ student: "s1", class: "g2" }, { student: "s1", class: "g3" }],
    },
    async () => {
      const ids = await getStudentGroupIds("s1");
      assert.deepEqual(ids.sort(), ["g1", "g2", "g3"]);
    },
  );
});

test("asosiy guruh qo'shimcha ro'yxatda ham bo'lsa takrorlanmaydi", async () => {
  await withStubs(
    {
      students: [{ _id: "s1", class: "g1" }],
      enrollments: [{ student: "s1", class: "g1" }, { student: "s1", class: "g2" }],
    },
    async () => {
      const ids = await getStudentGroupIds("s1");
      assert.deepEqual(ids.sort(), ["g1", "g2"]);
    },
  );
});

// ── Xarita (N+1 oldini olish) ─────────────────────────────────
test("buildGroupStudentMap har bir guruhga to'g'ri taqsimlaydi", async () => {
  await withStubs(
    {
      students: [
        { _id: "s1", class: "g1" },
        { _id: "s2", class: "g2" },
      ],
      enrollments: [
        { student: "s1", class: "g2" }, // s1 ikkala guruhda
        { student: "s3", class: "g1" },
      ],
    },
    async () => {
      const map = await buildGroupStudentMap(["g1", "g2"]);
      assert.deepEqual([...map.get("g1")].sort(), ["s1", "s3"]);
      assert.deepEqual([...map.get("g2")].sort(), ["s1", "s2"]);
    },
  );
});

test("noma'lum guruh xaritaga tushmaydi (yiqilmaydi)", async () => {
  await withStubs(
    {
      students: [{ _id: "s1", class: "boshqa" }],
      enrollments: [{ student: "s2", class: "yana-boshqa" }],
    },
    async () => {
      const map = await buildGroupStudentMap(["g1"]);
      assert.equal(map.get("g1").size, 0);
    },
  );
});

// ── Model shakli ──────────────────────────────────────────────
test("Enrollment indekslari o'rnatilgan", () => {
  const idx = Enrollment.schema.indexes();
  const has = (keys) =>
    idx.some((i) => JSON.stringify(Object.keys(i[0])) === JSON.stringify(keys));

  assert.ok(has(["student", "class"]), "student+class indeksi yo'q");
  assert.ok(has(["class", "status"]), "class+status indeksi yo'q");
  assert.ok(has(["student", "status"]), "student+status indeksi yo'q");

  // Takror yozuvni baza darajasida to'sadi
  const uniq = idx.find(
    (i) => JSON.stringify(Object.keys(i[0])) === '["student","class"]',
  );
  assert.equal(uniq[1].unique, true, "student+class unique bo'lishi kerak");
});

test("status qiymatlari cheklangan", () => {
  assert.deepEqual(Enrollment.schema.paths.status.enumValues, [
    "active",
    "frozen",
    "left",
  ]);
  assert.equal(Enrollment.schema.paths.status.defaultValue, "active");
});
