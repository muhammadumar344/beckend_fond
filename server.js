require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',         require('./src/routes/auth'));
app.use('/api/admin',        require('./src/routes/admin'));
app.use('/api/teacher',      require('./src/routes/teacher'));
app.use('/api/classes',      require('./src/routes/classes'));
app.use('/api/students',     require('./src/routes/students'));
app.use('/api/payments',     require('./src/routes/payments'));
app.use('/api/expenses',     require('./src/routes/expenses'));
app.use('/api/subscription', require('./src/routes/subscription'));

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint topilmadi' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server xatosi' });
});

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