// test/supportCancel.test.js
// Bekor qilish qoidasi BITTA joyda — servisda.
//
// ⚠️ Qoida ikki joyda edi: `services/supportBooking.cancelBooking`
//    (faqat FAOL yozuvni bekor qiladi) va `supportController.
//    updateBooking` (istalganini). Ikkinchisi ishlatilardi, ya'ni
//    o'quvchi kelib QR skanerlagan va `done` bo'lgan yozuvni ham
//    "bekor qilindi" ga o'tkazish mumkin edi — kelgani haqidagi
//    yozuv yo'qolardi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SVC = fs.readFileSync(
  path.join(__dirname, "../src/services/supportBooking.js"),
  "utf8",
);
const CTRL = fs.readFileSync(
  path.join(__dirname, "../src/controllers/supportController.js"),
  "utf8",
);

test("servis faqat FAOL yozuvni bekor qiladi", () => {
  const fn = SVC.slice(SVC.indexOf("async function cancelBooking"));
  assert.ok(fn.includes("ACTIVE.includes(booking.status)"));
});

test("controller o'z qoidasini yozmaydi — servisni chaqiradi", () => {
  assert.ok(CTRL.includes("svc.cancelBooking("));
});

test("controllerda qo'lda bekor qilish qolmagan", () => {
  // `booking.cancelledBy = "crm"` — o'sha takroriy mantiq edi.
  const code = CTRL.split("\n")
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
  assert.ok(!code.includes('booking.cancelledBy = "crm"'));
});

test("bekor qilingandan keyin ota-onaga xabar ketadi", () => {
  const block = CTRL.slice(CTRL.indexOf("svc.cancelBooking("));
  assert.ok(block.includes("notifyBooking"));
});

test("yozilish qoidalari ham servisda (CRM va Mini App uchun bitta)", () => {
  assert.ok(CTRL.includes("svc.bookSlot("));
});
