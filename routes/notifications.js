const express    = require('express');
const router     = express.Router();
const { pool }   = require('../database');
const adminAuth  = require('../middleware/adminAuth');

// ── Phone normalisation ──────────────────────────────────────────────────────
// Accepts: 0712345678 / 254712345678 / +254712345678
// Returns: +254712345678  or null if invalid
function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+254' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('254')) return '+' + digits;
  if (digits.length === 13 && digits.startsWith('2540')) return null; // malformed
  return null;
}

// ── Twilio send (gracefully skipped when env vars absent) ───────────────────
async function sendRestockWhatsApp(phone, productName, productId) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return;
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const from   = process.env.TWILIO_WA_FROM || `whatsapp:+${process.env.WHATSAPP_NUMBER || '14155238886'}`;
    const siteUrl = process.env.SITE_URL || 'https://beyondbeauty.co.ke';
    await client.messages.create({
      from,
      to: `whatsapp:${phone}`,
      body: `Hi! 👋 Great news — *${productName}* is back in stock at Beyond Beauty KE.\n\nShop now: ${siteUrl}/product?id=${productId}`,
    });
  } catch (err) {
    console.error('[Twilio] WhatsApp send failed:', err.message);
  }
}

// ── POST /api/notifications/register ────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { product_id, variant_id, phone } = req.body || {};
  if (!product_id || !phone) return res.status(400).json({ error: 'product_id and phone are required' });

  const e164 = normalisePhone(String(phone));
  if (!e164) return res.status(400).json({ error: 'Invalid phone number. Use format +254712345678 or 0712345678.' });

  try {
    // Upsert: if same phone+product already registered and not notified, skip duplicate
    const [rows] = await pool.execute(
      `SELECT id FROM restock_notifications
       WHERE phone = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
         AND notified_at IS NULL AND opted_out = 0`,
      [e164, product_id, variant_id || null, variant_id || null]
    );
    if (!rows.length) {
      await pool.execute(
        `INSERT INTO restock_notifications (phone, product_id, variant_id) VALUES (?, ?, ?)`,
        [e164, product_id, variant_id || null]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] register error:', err.message);
    res.status(500).json({ error: 'Could not save notification request' });
  }
});

// ── GET /api/notifications — admin list ──────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, phone, product_id, variant_id, registered_at, notified_at, opted_out
       FROM restock_notifications
       ORDER BY registered_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/notifications/export — admin CSV download ──────────────────────
router.get('/export', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT phone, product_id, variant_id, registered_at, notified_at, opted_out
       FROM restock_notifications
       ORDER BY registered_at DESC`
    );
    const header = 'phone,product_id,variant_id,registered_at,notified_at,opted_out\n';
    const csv = rows.map(r =>
      [r.phone, r.product_id, r.variant_id || '', r.registered_at, r.notified_at || '', r.opted_out].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="restock-notifications.csv"');
    res.send(header + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/notifications/:productId — clear waitlist for a product ──────
router.delete('/:productId', adminAuth, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM restock_notifications WHERE product_id = ?`,
      [req.params.productId]
    );
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:productId/trigger — manual WhatsApp blast ───────
router.post('/:productId/trigger', adminAuth, async (req, res) => {
  const productId = req.params.productId;
  try {
    const [rows] = await pool.execute(
      `SELECT id, phone FROM restock_notifications
       WHERE product_id = ? AND notified_at IS NULL AND opted_out = 0`,
      [productId]
    );
    if (!rows.length) return res.json({ sent: 0, message: 'No pending subscribers for this product.' });

    const productName = req.body?.product_name || productId;
    let sent = 0;
    const ids = [];
    for (const row of rows) {
      await sendRestockWhatsApp(row.phone, productName, productId);
      ids.push(row.id);
      sent++;
    }
    if (ids.length) {
      await pool.execute(
        `UPDATE restock_notifications SET notified_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
    res.json({ sent, message: `Sent ${sent} WhatsApp notification${sent !== 1 ? 's' : ''}.` });
  } catch (err) {
    console.error('[Notifications] trigger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Exported helper for restock polling (used in server.js) ─────────────────
async function notifyRestockedProduct(productId, productName) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, phone FROM restock_notifications
       WHERE product_id = ? AND notified_at IS NULL AND opted_out = 0`,
      [productId]
    );
    if (!rows.length) return;
    const ids = [];
    for (const row of rows) {
      await sendRestockWhatsApp(row.phone, productName, productId);
      ids.push(row.id);
    }
    if (ids.length) {
      await pool.execute(
        `UPDATE restock_notifications SET notified_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
    console.log(`[Restock] Notified ${ids.length} subscriber(s) for "${productName}"`);
  } catch (err) {
    console.error('[Restock] notify error:', err.message);
  }
}

module.exports = router;
module.exports.notifyRestockedProduct = notifyRestockedProduct;
