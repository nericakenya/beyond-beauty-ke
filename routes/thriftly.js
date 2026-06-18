const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const { v4: uuid } = require('uuid');
const fs       = require('fs');
const path     = require('path');
const { pool }   = require('../database');
const { listActiveListings, createListing, updateListingStatus, getListing } = require('../thriftly/airtable');
const { notify } = require('../lib/thriftly-notify');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads/thriftly');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Save multer buffers to public/uploads/thriftly/ and return { url, filename } objects.
// Files are deleted 60 s after createListing resolves (enough time for Airtable to fetch them).
function saveAndGetUrls(files) {
  return files.map(f => {
    const ext      = path.extname(f.originalname) || '.jpg';
    const name     = `${uuid()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, name);
    fs.writeFileSync(filepath, f.buffer);
    return { filepath, url: `${process.env.BASE_URL}/uploads/thriftly/${name}`, filename: f.originalname || name };
  });
}

function cleanupFiles(filePaths) {
  setTimeout(() => {
    filePaths.forEach(p => fs.unlink(p, () => {}));
  }, 60_000);
}

// ── State machine: valid next states ─────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending_payment:      ['paid_held', 'payment_failed'],
  payment_failed:       ['pending_payment'],
  paid_held:            ['dispatched'],
  dispatched:           ['confirmed', 'auto_release_pending', 'disputed'],
  confirmed:            ['payout_queued'],
  auto_release_pending: ['payout_queued'],
  disputed:             ['payout_queued', 'refunded'],
  payout_queued:        ['payout_sent', 'payout_failed'],
  payout_sent:          ['completed'],
  payout_failed:        ['payout_queued'],
  completed:            [],
};

async function transition(txId, toStatus, actorType, actorId, note, conn) {
  const db = conn || pool;
  const [[tx]] = await db.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [txId]);
  if (!tx) throw new Error(`Transaction ${txId} not found`);
  const allowed = VALID_TRANSITIONS[tx.status] || [];
  if (!allowed.includes(toStatus)) {
    await db.execute(
      `INSERT INTO thriftly_transaction_events (id, transaction_id, from_status, to_status, actor_type, actor_id, note)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), txId, tx.status, toStatus, actorType, actorId || null, `INVALID TRANSITION: ${note || ''}`]
    );
    throw new Error(`Invalid transition: ${tx.status} → ${toStatus}`);
  }
  await db.execute(
    'UPDATE thriftly_transactions SET status = ?, updated_at = NOW() WHERE id = ?',
    [toStatus, txId]
  );
  await db.execute(
    `INSERT INTO thriftly_transaction_events (id, transaction_id, from_status, to_status, actor_type, actor_id, note)
     VALUES (?,?,?,?,?,?,?)`,
    [uuid(), txId, tx.status, toStatus, actorType, actorId || null, note || null]
  );
  return { ...tx, status: toStatus };
}

// ── GET /api/thriftly/listings/:id — single listing detail ──────────────────
router.get('/listings/:id', async (req, res) => {
  try {
    const record = await getListing(req.params.id);
    if (record.error) return res.status(404).json({ error: 'Listing not found' });
    const f = record.fields || {};
    res.json({
      id:               record.id,
      item_title:       f.item_title       || '',
      item_category:    f.item_category    || '',
      item_description: f.item_description || '',
      item_condition:   f.item_condition   || '',
      item_price_kes:   f.item_price_kes   || 0,
      seller_location:  f.seller_location  || '',
      status:           f.status           || '',
      photos: ['photo_1','photo_2','photo_3','photo_4','photo_5']
        .map(k => f[k]?.[0]?.url || null)
        .filter(Boolean),
    });
  } catch (err) {
    console.error('[Thriftly] listing detail error:', err.message);
    res.status(500).json({ error: 'Failed to load listing' });
  }
});

// ── GET /api/thriftly/listings ──────────────────────────────────────────────
router.get('/listings', async (req, res) => {
  try {
    const records  = await listActiveListings();
    const listings = records.map(r => {
      const f = r.fields;
      return {
        id:              r.id,
        item_title:      f.item_title      || '',
        item_price_kes:  f.item_price_kes  || 0,
        item_category:   f.item_category   || '',
        seller_location: f.seller_location || '',
        photo_1:         f.photo_1?.[0]?.url || null,
        whatsapp_number: f.whatsapp_number || process.env.WHATSAPP_NUMBER || '',
      };
    });
    res.json(listings);
  } catch (err) {
    console.error('[Thriftly] listings error:', err.message);
    res.status(500).json({ error: 'Failed to load listings' });
  }
});

// ── POST /api/thriftly/listings — free listing creation ─────────────────────
router.post('/listings', upload.array('photos', 5), async (req, res) => {
  if (!req.files || req.files.length < 3) {
    return res.status(400).json({ error: 'Please upload at least 3 photos of your item.' });
  }
  const savedFiles = saveAndGetUrls(req.files || []);
  try {
    const b      = req.body;
    const photos = savedFiles.map(f => ({ url: f.url, filename: f.filename }));

    const record = await createListing({
      seller_name:        b.seller_name        || '',
      seller_phone:       b.seller_phone       || '',
      seller_email:       b.seller_email       || '',
      seller_location:    b.seller_location    || '',
      seller_id_number:   b.seller_id_number   || '',
      whatsapp_number:    b.whatsapp_number    || '',
      item_title:         b.item_title         || '',
      item_condition:     b.item_condition     || '',
      item_description:   b.item_description   || '',
      item_category:      b.item_category      || '',
      item_price_kes:     Number(b.item_price_kes) || 0,
      submission_channel: b.submission_channel || 'website',
      listing_fee_paid:   true,
      status:             'pending_review',
    }, photos);

    cleanupFiles(savedFiles.map(f => f.filepath));

    res.status(201).json({ id: record.id, status: 'pending_review' });
  } catch (err) {
    console.error('[Thriftly] create listing error:', err.message);
    cleanupFiles(savedFiles.map(f => f.filepath));
    res.status(500).json({ error: err.message || 'Failed to create listing' });
  }
});

// ── POST /api/thriftly/dispatch-by-token — seller confirms dispatch via token link ─
router.post('/dispatch-by-token', async (req, res) => {
  const { seller_token } = req.body;
  if (!seller_token) return res.status(400).json({ error: 'seller_token required' });
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE seller_token = ?', [seller_token]);
    if (!tx) return res.status(404).json({ error: 'Invalid or expired dispatch link' });
    if (tx.status !== 'paid_held') {
      if (tx.status === 'dispatched') return res.json({ ok: true, status: 'dispatched', already: true });
      return res.status(400).json({ error: `Cannot dispatch from status: ${tx.status}` });
    }
    const updated = await transition(tx.id, 'dispatched', 'seller', null, 'Seller confirmed dispatch via link');
    await pool.execute('UPDATE thriftly_transactions SET dispatched_at = NOW() WHERE id = ?', [tx.id]);
    notify('buyer_dispatched', {
      buyer_phone: tx.buyer_phone,
      item_title:  tx.item_title,
      confirm_url: `${process.env.BASE_URL}/thriftly/confirm?token=${tx.buyer_token}`,
    });
    setTimeout(async () => {
      const [[current]] = await pool.execute('SELECT status FROM thriftly_transactions WHERE id = ?', [tx.id]);
      if (current?.status === 'dispatched') {
        await pool.execute('UPDATE thriftly_transactions SET confirmation_prompt_sent_at = NOW() WHERE id = ?', [tx.id]);
        notify('buyer_confirm_prompt', {
          buyer_phone: tx.buyer_phone,
          item_title:  tx.item_title,
          confirm_url: `${process.env.BASE_URL}/thriftly/confirm?token=${tx.buyer_token}`,
        });
      }
    }, 48 * 60 * 60 * 1000);
    setTimeout(async () => {
      const [[current]] = await pool.execute('SELECT status FROM thriftly_transactions WHERE id = ?', [tx.id]);
      if (current?.status === 'dispatched') {
        await transition(tx.id, 'auto_release_pending', 'system', null, 'Auto-release: 7 days elapsed with no buyer confirmation');
        notify('admin_auto_release', { transaction_id: tx.id, amount: tx.amount, item_title: tx.item_title });
      }
    }, 7 * 24 * 60 * 60 * 1000);
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly dispatch-by-token]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/transactions/:id/dispatch — seller confirms dispatch ─
router.post('/transactions/:id/dispatch', async (req, res) => {
  const { id } = req.params;
  const { seller_token } = req.body;
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.seller_token !== seller_token) return res.status(403).json({ error: 'Invalid seller token' });

    const updated = await transition(id, 'dispatched', 'seller', null, 'Seller confirmed dispatch');
    await pool.execute('UPDATE thriftly_transactions SET dispatched_at = NOW() WHERE id = ?', [id]);

    // Notify buyer
    notify('buyer_dispatched', {
      buyer_phone: tx.buyer_phone,
      item_title:  tx.item_title,
      confirm_url: `${process.env.BASE_URL}/thriftly/confirm?token=${tx.buyer_token}`,
    });

    // Schedule delivery confirmation prompt at T+48h
    setTimeout(async () => {
      const [[current]] = await pool.execute('SELECT status FROM thriftly_transactions WHERE id = ?', [id]);
      if (current?.status === 'dispatched') {
        await pool.execute('UPDATE thriftly_transactions SET confirmation_prompt_sent_at = NOW() WHERE id = ?', [id]);
        notify('buyer_confirm_prompt', {
          buyer_phone: tx.buyer_phone,
          item_title:  tx.item_title,
          confirm_url: `${process.env.BASE_URL}/thriftly/confirm?token=${tx.buyer_token}`,
        });
      }
    }, 48 * 60 * 60 * 1000);

    // Schedule auto-release check at T+7d
    setTimeout(async () => {
      const [[current]] = await pool.execute('SELECT status FROM thriftly_transactions WHERE id = ?', [id]);
      if (current?.status === 'dispatched' || current?.status === 'confirmed') {
        await transition(id, 'auto_release_pending', 'system', null, 'Auto-release: 7 days elapsed with no buyer confirmation');
        notify('admin_auto_release', { transaction_id: id, amount: tx.amount, item_title: tx.item_title });
      }
    }, 7 * 24 * 60 * 60 * 1000);

    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly dispatch]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/confirm-by-token — buyer confirms delivery via token link ─
router.post('/confirm-by-token', async (req, res) => {
  const { buyer_token } = req.body;
  if (!buyer_token) return res.status(400).json({ error: 'buyer_token required' });
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE buyer_token = ?', [buyer_token]);
    if (!tx) return res.status(404).json({ error: 'Invalid or expired confirmation link' });
    if (tx.status === 'confirmed' || tx.status === 'payout_queued' || tx.status === 'completed') {
      return res.json({ ok: true, status: tx.status, already: true });
    }
    if (tx.status !== 'dispatched' && tx.status !== 'auto_release_pending') {
      return res.status(400).json({ error: `Cannot confirm from status: ${tx.status}` });
    }
    const updated = await transition(tx.id, 'confirmed', 'buyer', null, 'Buyer confirmed delivery via link');
    await pool.execute('UPDATE thriftly_transactions SET confirmed_at = NOW() WHERE id = ?', [tx.id]);
    notify('buyer_confirmed_ack',    { buyer_phone: tx.buyer_phone, item_title: tx.item_title });
    notify('seller_payout_initiated', { seller_phone: tx.seller_phone, item_title: tx.item_title });
    await triggerPayout(tx.id, tx);
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly confirm-by-token]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/dispute-by-token — buyer raises dispute via token link ─
router.post('/dispute-by-token', async (req, res) => {
  const { buyer_token, reason } = req.body;
  if (!buyer_token) return res.status(400).json({ error: 'buyer_token required' });
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE buyer_token = ?', [buyer_token]);
    if (!tx) return res.status(404).json({ error: 'Invalid or expired link' });
    if (tx.status === 'disputed') return res.json({ ok: true, status: 'disputed', already: true });
    if (!['dispatched', 'auto_release_pending'].includes(tx.status)) {
      return res.status(400).json({ error: `Cannot dispute from status: ${tx.status}` });
    }
    const updated = await transition(tx.id, 'disputed', 'buyer', null, `Buyer raised dispute via link: ${reason || 'no reason given'}`);
    notify('admin_dispute',      { transaction_id: tx.id, buyer_phone: tx.buyer_phone, seller_phone: tx.seller_phone, amount: tx.amount, item_title: tx.item_title, reason });
    notify('buyer_dispute_ack',  { buyer_phone: tx.buyer_phone });
    notify('seller_dispute_ack', { seller_phone: tx.seller_phone, item_title: tx.item_title });
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly dispute-by-token]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/transactions/:id/confirm — buyer confirms delivery ───
router.post('/transactions/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { buyer_token } = req.body;
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.buyer_token !== buyer_token) return res.status(403).json({ error: 'Invalid buyer token' });

    const updated = await transition(id, 'confirmed', 'buyer', null, 'Buyer confirmed delivery');
    await pool.execute('UPDATE thriftly_transactions SET confirmed_at = NOW() WHERE id = ?', [id]);

    notify('buyer_confirmed_ack', { buyer_phone: tx.buyer_phone, item_title: tx.item_title });
    notify('seller_payout_initiated', { seller_phone: tx.seller_phone, item_title: tx.item_title });

    // Trigger payout
    await triggerPayout(id, tx);

    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly confirm]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/transactions/:id/dispute — buyer raises dispute ──────
router.post('/transactions/:id/dispute', async (req, res) => {
  const { id } = req.params;
  const { buyer_token, reason } = req.body;
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.buyer_token !== buyer_token) return res.status(403).json({ error: 'Invalid buyer token' });

    const updated = await transition(id, 'disputed', 'buyer', null, `Buyer raised dispute: ${reason || 'no reason given'}`);

    notify('admin_dispute', { transaction_id: id, buyer_phone: tx.buyer_phone, seller_phone: tx.seller_phone, amount: tx.amount, item_title: tx.item_title, reason });
    notify('buyer_dispute_ack', { buyer_phone: tx.buyer_phone });
    notify('seller_dispute_ack', { seller_phone: tx.seller_phone, item_title: tx.item_title });

    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error('[Thriftly dispute]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/thriftly/admin/transactions/:id/release — admin releases payout
router.post('/admin/transactions/:id/release', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (!['auto_release_pending', 'disputed'].includes(tx.status)) {
      return res.status(400).json({ error: `Cannot release from status: ${tx.status}` });
    }
    await transition(id, 'payout_queued', 'admin', null, 'Admin manual payout release');
    await triggerPayout(id, tx);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/thriftly/admin/transactions — admin list ───────────────────────
router.get('/admin/transactions', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { status, page = 1 } = req.query;
    const offset = (Number(page) - 1) * 50;
    const where  = status ? 'WHERE status = ?' : '';
    const params = status ? [status, 50, offset] : [50, offset];
    const [rows] = await pool.execute(
      `SELECT * FROM thriftly_transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM thriftly_transactions ${where}`,
      status ? [status] : []
    );
    res.json({ transactions: rows, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/thriftly/admin/transactions/:id — transaction detail + events ──
router.get('/admin/transactions/:id', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const [[tx]] = await pool.execute('SELECT * FROM thriftly_transactions WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Not found' });
    const [events] = await pool.execute(
      'SELECT * FROM thriftly_transaction_events WHERE transaction_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ transaction: tx, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/thriftly/admin/stats ───────────────────────────────────────────
router.get('/admin/stats', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const heldStatuses = ['paid_held','dispatched','confirmed','auto_release_pending','payout_queued','payout_sent'];
    const [[{ held }]] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) AS held FROM thriftly_transactions WHERE status IN (${heldStatuses.map(()=>'?').join(',')})`,
      heldStatuses
    );
    const [[{ disbursed }]] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) AS disbursed FROM thriftly_transactions WHERE status = 'completed' AND MONTH(completed_at) = MONTH(NOW()) AND YEAR(completed_at) = YEAR(NOW())`
    );
    const [[{ disputed }]] = await pool.execute(
      `SELECT COUNT(*) AS disputed FROM thriftly_transactions WHERE status = 'disputed'`
    );
    const [[{ auto_release }]] = await pool.execute(
      `SELECT COUNT(*) AS auto_release FROM thriftly_transactions WHERE status = 'auto_release_pending'`
    );
    res.json({ held_kes: held, disbursed_this_month_kes: disbursed, disputed_count: disputed, auto_release_count: auto_release });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/thriftly/admin/transactions/:id/note ──────────────────────────
router.post('/admin/transactions/:id/note', async (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const [[tx]] = await pool.execute('SELECT status FROM thriftly_transactions WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Not found' });
    await pool.execute(
      `INSERT INTO thriftly_transaction_events (id, transaction_id, from_status, to_status, actor_type, actor_id, note)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), req.params.id, tx.status, tx.status, 'admin', null, req.body.note || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Payout helper (called from confirm + admin release) ──────────────────────
async function triggerPayout(txId, tx, attempt = 1) {
  const { initiatePayout } = require('./mpesa-thriftly');
  try {
    await transition(txId, 'payout_queued', 'system', null, `Payout queued (attempt ${attempt})`);
    await pool.execute('UPDATE thriftly_transactions SET payout_queued_at = NOW() WHERE id = ?', [txId]);
    await initiatePayout(txId, tx);
  } catch (err) {
    console.error('[Thriftly payout]', err.message);
    if (attempt < 3) {
      setTimeout(() => triggerPayout(txId, tx, attempt + 1), 2 * 60 * 60 * 1000);
    } else {
      await transition(txId, 'payout_failed', 'system', null, `Payout failed after ${attempt} attempts: ${err.message}`);
      notify('admin_payout_failed', { transaction_id: txId, amount: tx.amount, seller_phone: tx.seller_phone, error: err.message });
    }
  }
}

module.exports = router;
module.exports.transition = transition;
