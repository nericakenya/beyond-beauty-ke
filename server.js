require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { initDb } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/products',      require('./routes/products'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/thriftly',      require('./routes/thriftly'));
app.use('/api/mpesa',         require('./routes/mpesa-thriftly'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/api/config/public', (req, res) => res.json({ mpesa_shortcode: process.env.MPESA_SHORTCODE || '174379' }));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/product',  (req, res) => res.sendFile(path.join(__dirname, 'public/product.html')));
app.get('/thriftly/item',     (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/item.html')));
app.get('/thriftly/dispatch', (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/dispatch.html')));
app.get('/thriftly/confirm',  (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/confirm.html')));

app.get('/policies/delivery-refund',  (req, res) => res.sendFile(path.join(__dirname, 'public/policies/delivery-refund.html')));
app.get('/policies/privacy-policy',   (req, res) => res.sendFile(path.join(__dirname, 'public/policies/privacy-policy.html')));
app.get('/policies/terms-of-service', (req, res) => res.sendFile(path.join(__dirname, 'public/policies/terms-of-service.html')));

const PORT = process.env.PORT || 3000;

// ── Restock polling — checks every 5 min for inventory 0→>0 transitions ──────
const POLL_INTERVAL_MS   = 5 * 60 * 1000;
const AIRTABLE_BASE      = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const airtableHeaders    = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` });
let   prevStockSnapshot  = null; // map of { productId → total_stock_quantity }
const { notifyRestockedProduct } = require('./routes/notifications');

async function fetchStockSnapshot() {
  const snap = {};
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Total Stock Quantity', 'Product Name', 'Badge'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(AIRTABLE_BASE, { headers: airtableHeaders(), params });
    for (const r of data.records) {
      snap[r.id] = {
        qty:  r.fields['Total Stock Quantity'] ?? null,
        name: r.fields['Product Name']         || r.id,
        badge: r.fields['Badge']               || null,
      };
    }
    offset = data.offset || null;
  } while (offset);
  return snap;
}

async function pollRestock() {
  try {
    const snap = await fetchStockSnapshot();
    if (prevStockSnapshot) {
      for (const [id, cur] of Object.entries(snap)) {
        const prev = prevStockSnapshot[id];
        if (prev && prev.qty === 0 && cur.qty > 0 && cur.badge !== 'Coming Soon') {
          console.log(`[Restock] "${cur.name}" back in stock — notifying subscribers`);
          await notifyRestockedProduct(id, cur.name);
        }
      }
    }
    prevStockSnapshot = snap;
  } catch (err) {
    console.error('[Restock] poll error:', err.message);
  }
}

initDb()
  .then(() => {
    console.log('✓ Database connected');
    // Start restock polling only when Airtable credentials are present
    if (process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_TOKEN) {
      pollRestock(); // initial snapshot
      setInterval(pollRestock, POLL_INTERVAL_MS);
      console.log('✓ Restock polling active (5-min interval)');
    }
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
