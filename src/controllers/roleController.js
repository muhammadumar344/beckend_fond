const Role  = require('../models/Role');
const Staff = require('../models/Staff');
const { resolveContext } = require('../utils/resolveContext');
const { audit } = require('../services/audit');

// Huquq ro'yxati o'zgarganda jurnalda butun ro'yxatni ko'rsatish
// foydasiz: direktor 27 ta nomdan qaysi biri qo'shilganini
// o'zi qidirib topishga majbur bo'lardi. Shuning uchun faqat
// FARQNI yozamiz.
function permChanges(before = [], after = []) {
  const a = new Set(before.map(String));
  const b = new Set(after.map(String));
  const added = [...b].filter((p) => !a.has(p));
  const removed = [...a].filter((p) => !b.has(p));

  const out = [];
  if (added.length) out.push({ field: "qo'shilgan huquqlar", from: null, to: added.join(', ') });
  if (removed.length) out.push({ field: 'olib tashlangan huquqlar', from: removed.join(', '), to: null });
  return out;
}

// GET /api/lc/roles — Director: o'z rollari; Staff: o'z directorining rollari
const getRoles = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const roles = await Role.find({ director: ctx.directorId })
      .sort({ isDefault: -1, name: 1 });
    res.json({ success: true, roles });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// GET /api/lc/roles/my — Staff o'z rolini ko'radi
const getMyRole = async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      return res.json({ name: 'Director', slug: 'director', permissions: null, isDirector: true });
    }
    const staff = await Staff.findById(req.user.id).populate('role');
    if (!staff) return res.status(404).json({ message: 'Xodim topilmadi' });
    res.json(staff.role || null);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// POST /api/lc/roles — FAQAT Director
const createRole = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Faqat direktor rol yarata oladi' });
    }
    const { name, permissions = [], color = '#4299e1', isSupport = false } = req.body;
    if (!name) return res.status(400).json({ message: 'Rol nomi majburiy' });

    const role = new Role({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      permissions,
      color,
      // Shu roldagilar o'quvchining "qo'shimcha dars" ro'yxatida
      // chiqadi (services/supportStaff.js)
      isSupport: Boolean(isSupport),
      director: req.user.id,
      isDefault: false,
    });
    await role.save();

    audit(req, await resolveContext(req), {
      action: 'role.created',
      entity: 'Role',
      entityId: role._id,
      entityLabel: role.name,
      changes: permChanges([], role.permissions),
    });

    res.status(201).json({ success: true, role });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Bu nomli rol allaqachon mavjud' });
    }
    res.status(err.status || 500).json({ message: err.message });
  }
};

// PUT /api/lc/roles/:id — FAQAT Director
const updateRole = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Faqat direktor rol yangilaya oladi' });
    }
    const role = await Role.findOne({ _id: req.params.id, director: req.user.id });
    if (!role) return res.status(404).json({ message: 'Rol topilmadi' });
    if (role.isDefault) {
      return res.status(400).json({ message: "Default rolni o'zgartirish mumkin emas" });
    }
    const beforeName = role.name;
    const beforePerms = [...(role.permissions || [])];

    const { name, permissions, color, isSupport } = req.body;
    if (name !== undefined) role.name = name;
    if (permissions !== undefined) role.permissions = permissions;
    if (color !== undefined) role.color = color;
    if (isSupport !== undefined) role.isSupport = Boolean(isSupport);
    await role.save();

    const changes = permChanges(beforePerms, role.permissions);
    if (beforeName !== role.name) {
      changes.unshift({ field: 'nomi', from: beforeName, to: role.name });
    }

    audit(req, await resolveContext(req), {
      action: 'role.updated',
      entity: 'Role',
      entityId: role._id,
      entityLabel: role.name,
      changes,
    });

    res.json({ success: true, role });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// DELETE /api/lc/roles/:id — FAQAT Director
const deleteRole = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: "Faqat direktor rol o'chira oladi" });
    }
    const role = await Role.findOne({ _id: req.params.id, director: req.user.id });
    if (!role) return res.status(404).json({ message: 'Rol topilmadi' });
    if (role.isDefault) {
      return res.status(400).json({ message: "Default rolni o'chirish mumkin emas" });
    }
    const staffCount = await Staff.countDocuments({ role: role._id });
    if (staffCount > 0) {
      return res.status(400).json({
        message: `Bu rol ${staffCount} ta xodimga biriktirilgan. Avval ularni boshqa rolga o'tkazing.`,
      });
    }
    const hadPerms = [...(role.permissions || [])];
    await role.deleteOne();

    audit(req, await resolveContext(req), {
      action: 'role.deleted',
      entity: 'Role',
      entityId: role._id,
      entityLabel: role.name,
      changes: permChanges(hadPerms, []),
    });

    res.json({ success: true, message: "Rol o'chirildi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ YANGI — Onboarding paytida LC tanlanganda avtomatik chaqiriladi
// (teacherController.js dagi completeOnboarding shu funksiyani chaqiradi)
// require/export orqali ishlatiladi, HTTP route emas — shuning uchun (req, res) yo'q
const createDefaultRoles = async (directorId) => {
  const defaults = [
    {
      name: 'Branch Manager',
      slug: 'branch_manager',
      color: '#f6ad55',
      // ⚠️ `manageRooms` faqat shu rolda. Filial rahbari binoni
      //    biladi va xonani u qo'shadi. Administrationga bermadik:
      //    u kun bo'yi jadval tuzadi va xona ro'yxati oyiga bir
      //    marta o'zgaradi — bir marta bosiladigan tugmaga doimiy
      //    huquq berish shart emas, direktor kerak bo'lsa qo'shadi.
      permissions: [
        'manageStaff', 'manageGroups', 'manageStudents', 'manageAttendance',
        'manageGrades', 'managePayments', 'viewBranchStats', 'manageSubjects',
        'manageLeads', 'manageRooms',
      ],
    },
    {
      name: 'Administration',
      slug: 'administration',
      color: '#4299e1',
      permissions: ['manageGroups', 'manageStudents', 'managePayments', 'manageLeads'],
    },
    {
      name: 'Teacher',
      // ✅ slug'ga e'tibor: "teacher" emas "teacher_staff" — Teacher modeli/role
      // bilan atash chalkashmasligi uchun. Frontend'da nom baribir "Teacher" ko'rinadi.
      slug: 'teacher_staff',
      color: '#48bb78',
      permissions: ['manageAttendance', 'manageGrades', 'manageHomework'],
    },
    {
      name: 'Support Teacher',
      slug: 'support_teacher',
      color: '#9f7aea',
      permissions: ['manageAttendance'],
      // Qo'shimcha mashg'ulotga yoziladigan ustozlar shu roldan
      // olinadi — services/supportStaff.js
      isSupport: true,
    },
  ];

  for (const roleData of defaults) {
    const exists = await Role.findOne({ director: directorId, slug: roleData.slug });
    if (!exists) {
      await Role.create({ ...roleData, director: directorId, isDefault: true });
    }
  }
};

module.exports = { getRoles, getMyRole, createRole, updateRole, deleteRole, createDefaultRoles };