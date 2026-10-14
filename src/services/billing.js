// src/services/billing.js
// Oylik to'lovlarni markazlashgan tarzda yaratish.

const MonthlyPayment = require("../models/MonthlyPayment");
const Enrollment = require("../models/Enrollment");
const { getGroupStudents } = require("../utils/enrollment");
const { priceMap } = require("../utils/pricing");

function pickMissing(students = [], existing = []) {
  const have = new Set(existing.map((p) => String(p.student)));
  return students.filter((s) => !have.has(String(s._id)));
}

async function ensureBillsForClass({ cls, teacherId, month, year }) {
  const students = await getGroupStudents(cls._id);

  if (!students.length) {
    return {
      created: 0,
      alreadyExisted: 0,
      total: 0,
      discounted: 0,
    };
  }

  const existing = await MonthlyPayment.find({
    class: cls._id,
    month,
    year,
  }).select("student");

  const missing = pickMissing(students, existing);

  let discounted = 0;

  if (missing.length) {
    const enrollments = await Enrollment.find({
      class: cls._id,
      status: "active",
    })
      .select("student priceOverride")
      .lean();

    const prices = priceMap(students, cls, enrollments);

    await MonthlyPayment.insertMany(
      missing.map((student) => {
        const price = prices.get(String(student._id));

        if (price.source !== "group") {
          discounted++;
        }

        return {
          student: student._id,
          class: cls._id,
          teacher: teacherId,
          amount: price.amount,
          month,
          year,
          status: "not_paid",
        };
      }),
    );
  }

  return {
    created: missing.length,
    alreadyExisted: students.length - missing.length,
    total: students.length,
    discounted,
  };
}

async function ensureBillsForClasses({ classes, teacherId, month, year }) {
  const groups = [];
  let created = 0;
  let discounted = 0;

  for (const cls of classes) {
    const result = await ensureBillsForClass({
      cls,
      teacherId,
      month,
      year,
    });

    created += result.created;
    discounted += result.discounted || 0;

    if (result.total > 0) {
      groups.push({
        id: String(cls._id),
        name: cls.name,
        ...result,
      });
    }
  }

  return {
    created,
    discounted,
    groups,
    touched: groups.filter((group) => group.created > 0).length,
  };
}

module.exports = {
  pickMissing,
  ensureBillsForClass,
  ensureBillsForClasses,
};
