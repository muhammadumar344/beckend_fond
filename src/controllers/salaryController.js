// src/controllers/salaryController.js
const Salary = require('../models/Salary')
const Staff  = require('../models/Staff')

// ── Maosh belgilash/yangilash (Director yoki manageSalaries huquqi bor manager) ──
exports.setSalary = async (req, res) => {
  try {
    const { staffId, baseSalary, bonus = 0, deduction = 0, month, year, note } = req.body

    if (!staffId || baseSalary === undefined || !month || !year) {
      return res.status(400).json({ success: false, error: 'staffId, baseSalary, month, year majburiy' })
    }

    const staff = await Staff.findById(staffId).populate('role')
    if (!staff) return res.status(404).json({ success: false, error: 'Xodim topilmadi' })

    // ── Ruxsat tekshirish ──────────────────────────────────
    if (req.user.role === 'staff') {
      const caller = await Staff.findById(req.user.id).populate('role')
      if (!caller.role.permissions.manageSalaries) {
        return res.status(403).json({ success: false, error: 'Maosh boshqarish huquqi yo\'q' })
      }
      // Manager faqat o'z filialidagi xodimlarga maosh belgilaydi
      if (String(caller.branch) !== String(staff.branch)) {
        return res.status(403).json({ success: false, error: 'Faqat o\'z filialingizdagi xodimlarga maosh belgilashingiz mumkin' })
      }
    }

    const salary = await Salary.findOneAndUpdate(
      { staff: staffId, month: Number(month), year: Number(year) },
      {
        director: staff.director,
        branch: staff.branch,
        baseSalary: Number(baseSalary),
        bonus: Number(bonus),
        deduction: Number(deduction),
        note: (note || '').trim(),
      },
      { upsert: true, new: true }
    )

    res.json({ success: true, message: 'Maosh belgilandi', salary })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Maoshni to'langan deb belgilash ──────────────────────────
exports.markAsPaid = async (req, res) => {
  try {
    const { salaryId } = req.params
    const salary = await Salary.findById(salaryId)
    if (!salary) return res.status(404).json({ success: false, error: 'Maosh yozuvi topilmadi' })

    salary.status = 'paid'
    salary.paidAt = new Date()
    await salary.save()

    res.json({ success: true, message: 'To\'langan deb belgilandi', salary })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Filial bo'yicha oylik maoshlar ro'yxati ──────────────────
exports.getBranchSalaries = async (req, res) => {
  try {
    const { branchId } = req.params
    const { month, year } = req.query
    const m = Number(month) || new Date().getMonth() + 1
    const y = Number(year)  || new Date().getFullYear()

    const salaries = await Salary.find({ branch: branchId, month: m, year: y })
      .populate('staff', 'name email')

    const total = salaries.reduce((s, sal) => s + sal.baseSalary + sal.bonus - sal.deduction, 0)
    const paidTotal = salaries.filter(s => s.status === 'paid')
      .reduce((s, sal) => s + sal.baseSalary + sal.bonus - sal.deduction, 0)

    res.json({
      success: true, month: m, year: y, salaries,
      summary: { total, paidTotal, pendingTotal: total - paidTotal, count: salaries.length },
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}

// ── Xodimning o'z maosh tarixi ────────────────────────────────
exports.getMySalaryHistory = async (req, res) => {
  try {
    const salaries = await Salary.find({ staff: req.user.id }).sort({ year: -1, month: -1 }).limit(12)
    res.json({ success: true, salaries })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}