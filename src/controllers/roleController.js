const Role  = require('../models/Role');
const Staff = require('../models/Staff');
const { resolveContext } = require('../utils/resolveContext');

// GET /api/lc/roles — Director: o'z rollari; Staff: o'z directorining rollari
const getRoles = async (req, res) => {
  try {
    const ctx = await resolveContext(req);
    const roles = await Role.find({ director: ctx.directorId })
      .sort({ isDefault: -1, name: 1 });
    res.json(roles);
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
    const { name, permissions = [], color = '#4299e1' } = req.body;
    if (!name) return res.status(400).json({ message: 'Rol nomi majburiy' });

    const role = new Role({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      permissions,
      color,
      director: req.user.id,
      isDefault: false,
    });
    await role.save();
    res.status(201).json(role);
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
    const { name, permissions, color } = req.body;
    if (name !== undefined) role.name = name;
    if (permissions !== undefined) role.permissions = permissions;
    if (color !== undefined) role.color = color;
    await role.save();
    res.json(role);
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
    await role.deleteOne();
    res.json({ message: "Rol o'chirildi" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = { getRoles, getMyRole, createRole, updateRole, deleteRole };