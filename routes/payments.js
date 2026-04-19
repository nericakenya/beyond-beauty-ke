const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');

const DARAJA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

async function getMpesaToken() {
  const creds = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  return data.access_token;
}

function formatPhone(raw) {
  let phone = raw.toString().replace(/\s/g, '').replace(/^\+/, '');
  if (phone.startsWith('07') || phone.startsWith('01')) phone = '254' + phone.slice(1);
  return phone;
}

// POST /api/payments/mpesa/stk-push
router.post('/mpesa/stk-push', async (req, res) => {
  const { order_id, phone } = req.body;
  if (!order_id || !phone) return res.status(400).json({ error: 'order_id and phone are required' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_status === 'paid') return res.status(400).json({ error: 'Order already paid' });

  try {
    const token = await getMpesaToken();
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const formattedPhone = formatPhone(phone);
    const amount = Math.ceil(order.total_amount);

    const { data } = await axios.post(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.BASE_URL}/api/payments/mpesa/callback`,
      AccountReference: order.order_number,
      TransactionDesc: `Beyond Beauty KE Order ${order.order_number}`,
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResponseCode === '0') {
      db.prepare(`UPDATE orders SET mpesa_checkout_request_id = ?, payment_status = 'stk_sent', updated_at = datetime('now') WHERE id = ?`)
        .run(data.CheckoutRequestID, order_id);
      res.json({ success: true, checkout_request_id: data.CheckoutRequestID });
    } else {
      res.status(400).json({ error: data.ResponseDescription || 'STK push failed' });
    }
  } catch (err) {
    console.error('[Mpesa STK]', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// POST /api/payments/mpesa/callback — Safaricom posts here after customer pays
router.post('/mpesa/callback', (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  const order = db.prepare('SELECT id FROM orders WHERE mpesa_checkout_request_id = ?').get(CheckoutRequestID);

  if (order) {
    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const receiptNumber = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
      db.prepare(`UPDATE orders SET payment_status = 'paid', mpesa_transaction_id = ?, status = 'confirmed', updated_at = datetime('now') WHERE id = ?`)
        .run(receiptNumber, order.id);
      console.log(`[Mpesa] Order ${order.id} paid — receipt ${receiptNumber}`);
    } else {
      db.prepare(`UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`)
        .run(order.id);
      console.log(`[Mpesa] Order ${order.id} payment failed — result code ${ResultCode}`);
    }
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// POST /api/payments/mpesa/query — check STK push status manually
router.post('/mpesa/query', async (req, res) => {
  const { checkout_request_id } = req.body;
  if (!checkout_request_id) return res.status(400).json({ error: 'checkout_request_id required' });

  try {
    const token = await getMpesaToken();
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const { data } = await axios.post(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkout_request_id,
    }, { headers: { Authorization: `Bearer ${token}` } });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

module.exports = router;
