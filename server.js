require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/teacher',      require('./routes/teacher'));
app.use('/api/classes',      require('./routes/classes'));
app.use('/api/students',     require('./routes/students'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/subscription', require('./routes/subscription'));

// ─── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint topilmadi' });
});

// ─── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server xatosi' });
});

// ─── MongoDB + Server ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB ulandi');
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB ulanmadi:', err.message);
    process.exit(1);
  });