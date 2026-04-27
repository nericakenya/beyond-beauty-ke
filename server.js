require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/thriftly', require('./routes/thriftly'));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/api/config/public', (req, res) => res.json({ mpesa_shortcode: process.env.MPESA_SHORTCODE || '174379' }));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/product',  (req, res) => res.sendFile(path.join(__dirname, 'public/product.html')));

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    console.log('✓ Database connected');
  })
  .catch(err => {
    console.warn('⚠️  Database unavailable:', err.message);
    console.warn('   Orders and payments will not work — Airtable features are unaffected.');
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`✨ Beyond Beauty KE running on port ${PORT}`);
    });
  });
