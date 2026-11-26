// Back-in-stock requests, stored in the Airtable "Restock Requests" table.
// The WhatsApp agent (Joy, whatsapp-agent/) checks stock every 12 hours and messages
// waiting customers through the Meta WhatsApp Cloud API. Nothing is sent from this server.
const express   = require('express');
const axios     = require('axios');
const router    = express.Router();
const adminAuth = require('../middleware/adminAuth');

const TABLE = process.env.AIRTABLE_RESTOCK_TABLE_ID || 'tblLxLD6A1xDe6Qnc';
const API   = () => `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${TABLE}`;
const HEADERS = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' });

// Accepts 0712345678 / 254712345678 / +254712345678 (also 01…). Returns 254712345678 or null.
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && /^0[17]/.test(digits)) return '254' + digits.slice(1);
  if (digits.length === 12 && /^254[17]/.test(digits)) return digits;
  return null;
}

async function listRecords(params = {}) {
  const records = [];
  let offset;
  do {
    const { data } = await axios.get(API(), { headers: HEADERS(), params: { pageSize: 100, ...params, ...(offset ? { offset } : {}) } });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function toRow(r) {
  const f = r.fields;
  return {
    id: r.id,
    phone: f.Phone ? `+${f.Phone}` : '',
    product_id: (f.Product || [])[0] || '',
    variant_id: (f.Variant || [])[0] || null,
    product: f.Request || '',
    status: f.Status || 'Waiting',
    registered_at: f['Requested at'] || r.createdTime,
    notified_at: f['Notified at'] || null,
    opted_out: f.Status === 'Cancelled' ? 1 : 0,
  };
}

// ── POST /api/notifications/register — "Notify me" on the product page ──────
router.post('/register', async (req, res) => {
  const { product_id, variant_id, phone } = req.body || {};
  if (!product_id || !phone) return res.status(400).json({ error: 'product_id and phone are required' });
  const wa = normalisePhone(phone);
  if (!wa) return res.status(400).json({ error: 'Invalid phone number. Use format 0712345678 or +254712345678.' });

  try {
    const waiting = await listRecords({ filterByFormula: `AND({Phone} = '${wa}', {Status} = 'Waiting')`, 'fields[]': ['Product', 'Variant'] });
    const duplicate = waiting.some(r => (r.fields.Product || []).includes(product_id) && ((r.fields.Variant || [])[0] || null) === (variant_id || null));
    if (!duplicate) {
      let label = product_id;
      try {
        const { getProducts } = require('./products');
        label = (await getProducts()).find(p => p.id === product_id)?.name || product_id;
      } catch { /* name is only a label */ }
      await axios.post(API(), {
        fields: {
          Request: `+${wa} — ${label}`,
          Phone: wa,
          Product: [product_id],
          ...(variant_id ? { Variant: [variant_id] } : {}),
          Status: 'Waiting',
          Source: 'Website',
          'Requested at': new Date().toISOString(),
        },
        typecast: true,
      }, { headers: HEADERS() });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Restock] register error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not save your request — please try again.' });
  }
});

// ── GET /api/notifications — admin list ──────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const rows = (await listRecords({ 'sort[0][field]': 'Requested at', 'sort[0][direction]': 'desc' })).map(toRow);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/notifications/export — admin CSV download ──────────────────────
router.get('/export', adminAuth, async (req, res) => {
  try {
    const rows = (await listRecords()).map(toRow);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['phone,product,product_id,variant_id,status,registered_at,notified_at']
      .concat(rows.map(r => [r.phone, r.product, r.product_id, r.variant_id || '', r.status, r.registered_at, r.notified_at || ''].map(esc).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="restock-requests.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/notifications/:productId — cancel the waiting list for a product ──
// Requests are marked Cancelled (kept for history), not deleted.
router.delete('/:productId', adminAuth, async (req, res) => {
  try {
    const waiting = (await listRecords({ filterByFormula: `{Status} = 'Waiting'`, 'fields[]': ['Product'] }))
      .filter(r => (r.fields.Product || []).includes(req.params.productId));
    for (let i = 0; i < waiting.length; i += 10) {
      await axios.patch(API(), { records: waiting.slice(i, i + 10).map(r => ({ id: r.id, fields: { Status: 'Cancelled' } })) }, { headers: HEADERS() });
    }
    res.json({ success: true, cancelled: waiting.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:productId/trigger — no longer sends from here ───
router.post('/:productId/trigger', adminAuth, (req, res) => {
  res.json({ message: 'Messages are sent automatically: Joy (the WhatsApp agent) checks stock every 12 hours and messages everyone waiting once the item is back in stock.' });
});

module.exports = router;
