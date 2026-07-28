const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../database');

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

  const [[order]] = await pool.execute('SELECT * FROM orders WHERE id = ?', [order_id]);
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
      await pool.execute(
        `UPDATE orders SET mpesa_checkout_request_id = ?, payment_status = 'stk_sent' WHERE id = ?`,
        [data.CheckoutRequestID, order_id]
      );
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
router.post('/mpesa/callback', async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  const [[order]] = await pool.execute('SELECT id FROM orders WHERE mpesa_checkout_request_id = ?', [CheckoutRequestID]);

  if (order) {
    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const receiptNumber = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
      await pool.execute(
        `UPDATE orders SET payment_status = 'paid', mpesa_transaction_id = ?, status = 'confirmed' WHERE id = ?`,
        [receiptNumber, order.id]
      );
      console.log(`[Mpesa] Order ${order.id} paid — receipt ${receiptNumber}`);
    } else {
      await pool.execute(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
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
