const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { v4: uuid } = require('uuid');
const { pool } = require('../database');
const { notify } = require('../lib/thriftly-notify');
const { transition } = require('./thriftly');

const DARAJA_BASE = () => process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let _token = null, _tokenExpiry = 0;
async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const creds = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(`${DARAJA_BASE()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  _token = data.access_token;
  _tokenExpiry = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  return _token;
}

function ts() { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); }

function fmt(raw) {
  let p = raw.toString().replace(/\s/g, '').replace(/^\+/, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);
  return p;
}

// ── POST /api/mpesa/stk-push — initiate buyer payment ───────────────────────
router.post('/stk-push', async (req, res) => {
  const { listing_id, buyer_phone, amount } = req.body;
  if (!listing_id || !buyer_phone || !amount) {
    return res.status(400).json({ error: 'listing_id, buyer_phone, and amount are required' });
  }

  const till     = process.env.MPESA_TILL_NUMBER || '3481515';
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  const phone     = fmt(buyer_phone);
  const kes       = Math.ceil(Number(amount));

  // Fetch listing details from Airtable to get title and seller phone
  let itemTitle = 'Thriftly Item', sellerPhone = '';
  try {
    const { getListing } = require('../thriftly/airtable');
    const record = await getListing(listing_id);
    itemTitle   = record?.fields?.item_title || itemTitle;
    sellerPhone = record?.fields?.seller_phone || '';
  } catch (e) {
    console.warn('[MpesaThriftly] Could not fetch listing for STK push:', e.message);
  }

  // Create transaction row (pending_payment)
  const txId        = uuid();
  const buyerToken  = require('crypto').randomBytes(32).toString('hex');
  const sellerToken = require('crypto').randomBytes(32).toString('hex');

  try {
    await pool.execute(
      `INSERT INTO thriftly_transactions
         (id, listing_id, item_title, amount, buyer_phone, buyer_token, seller_phone, seller_token, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [txId, listing_id, itemTitle, kes, phone, buyerToken, sellerPhone, sellerToken, 'pending_payment']
    );
  } catch (err) {
    console.error('[MpesaThriftly] Insert transaction failed:', err.message);
    return res.status(500).json({ error: 'Could not create transaction' });
  }

  // Initiate STK push
  try {
    const token    = await getToken();
    const nowTs    = ts();
    const password = Buffer.from(`${shortcode}${passkey}${nowTs}`).toString('base64');

    const { data } = await axios.post(`${DARAJA_BASE()}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         nowTs,
      TransactionType:   'CustomerBuyGoodsOnline',
      Amount:            kes,
      PartyA:            phone,
      PartyB:            till,
      PhoneNumber:       phone,
      CallBackURL:       `${process.env.BASE_URL}/api/mpesa/callback/stk`,
      AccountReference:  txId.slice(0, 12),
      TransactionDesc:   `Thriftly payment for ${itemTitle}`.slice(0, 100),
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResponseCode === '0') {
      await pool.execute(
        'UPDATE thriftly_transactions SET mpesa_checkout_request_id = ? WHERE id = ?',
        [data.CheckoutRequestID, txId]
      );
      return res.json({ transaction_id: txId, checkout_request_id: data.CheckoutRequestID });
    } else {
      await pool.execute('UPDATE thriftly_transactions SET status = ? WHERE id = ?', ['payment_failed', txId]);
      return res.status(400).json({ error: data.ResponseDescription || 'STK push failed' });
    }
  } catch (err) {
    console.error('[MpesaThriftly] STK push error:', err.response?.data || err.message);
    await pool.execute('UPDATE thriftly_transactions SET status = ? WHERE id = ?', ['payment_failed', txId]);
    return res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// ── POST /api/mpesa/callback/stk — Safaricom STK push result ────────────────
router.post('/callback/stk', async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  const [[tx]] = await pool.execute(
    'SELECT * FROM thriftly_transactions WHERE mpesa_checkout_request_id = ?',
    [CheckoutRequestID]
  );

  if (tx) {
    if (ResultCode === 0) {
      const items   = CallbackMetadata?.Item || [];
      const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
      await pool.execute(
        'UPDATE thriftly_transactions SET mpesa_receipt = ? WHERE id = ?',
        [receipt, tx.id]
      );
      try {
        await transition(tx.id, 'paid_held', 'system', null, `Payment received — receipt ${receipt}`);
      } catch (e) {
        console.error('[MpesaThriftly] STK callback transition failed:', e.message);
      }
      // Notify seller to dispatch
      const dispatchUrl = `${process.env.BASE_URL}/thriftly/dispatch?token=${tx.seller_token}`;
      notify('payment_received', { seller_phone: tx.seller_phone, item_title: tx.item_title, dispatch_url: dispatchUrl });
      console.log(`[MpesaThriftly] Transaction ${tx.id} paid — receipt ${receipt}`);
    } else {
      try {
        await transition(tx.id, 'payment_failed', 'system', null, `STK result code ${ResultCode}`);
      } catch (e) {
        console.error('[MpesaThriftly] Payment failed transition error:', e.message);
      }
      notify('payment_failed', { buyer_phone: tx.buyer_phone });
      console.log(`[MpesaThriftly] Transaction ${tx.id} payment failed — code ${ResultCode}`);
    }
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// ── GET /api/mpesa/transaction-status/:id — poll from frontend ───────────────
router.get('/transaction-status/:id', async (req, res) => {
  const [[tx]] = await pool.execute(
    'SELECT id, status, item_title, amount FROM thriftly_transactions WHERE id = ?',
    [req.params.id]
  );
  if (!tx) return res.status(404).json({ error: 'Not found' });
  res.json({ status: tx.status, item_title: tx.item_title, amount: tx.amount });
});

// ── B2C payout: called internally from routes/thriftly.js triggerPayout ─────
async function initiatePayout(txId, tx) {
  const token = await getToken();
  const { data } = await axios.post(`${DARAJA_BASE()}/mpesa/b2c/v3/paymentrequest`, {
    InitiatorName:      process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
    CommandID:          'BusinessPayment',
    Amount:             Math.floor(Number(tx.amount)),
    PartyA:             process.env.MPESA_SHORTCODE,
    PartyB:             fmt(tx.seller_phone),
    Remarks:            `Thriftly payout for ${tx.item_title}`.slice(0, 100),
    QueueTimeOutURL:    process.env.MPESA_B2C_QUEUE_URL  || `${process.env.BASE_URL}/api/mpesa/callback/b2c`,
    ResultURL:          process.env.MPESA_B2C_RESULT_URL || `${process.env.BASE_URL}/api/mpesa/callback/b2c`,
    Occasion:           txId.slice(0, 12),
  }, { headers: { Authorization: `Bearer ${token}` } });

  if (data.ResponseCode !== '0') throw new Error(data.ResponseDescription || 'B2C initiation failed');

  await pool.execute(
    'UPDATE thriftly_transactions SET payout_conversation_id = ? WHERE id = ?',
    [data.ConversationID, txId]
  );
  return data.ConversationID;
}

// ── POST /api/mpesa/callback/b2c — B2C result from Safaricom ────────────────
router.post('/callback/b2c', async (req, res) => {
  const result = req.body?.Result;
  if (!result) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { ConversationID, ResultCode, ResultParameters } = result;
  const [[tx]] = await pool.execute(
    'SELECT * FROM thriftly_transactions WHERE payout_conversation_id = ?',
    [ConversationID]
  );

  if (tx) {
    if (ResultCode === 0) {
      const params  = ResultParameters?.ResultParameter || [];
      const receipt = params.find(p => p.Key === 'TransactionReceipt')?.Value || null;
      const last4   = tx.seller_phone?.toString().slice(-4);
      await pool.execute(
        'UPDATE thriftly_transactions SET payout_receipt = ?, status = ?, completed_at = NOW() WHERE id = ?',
        [receipt, 'payout_sent', tx.id]
      );
      try {
        await transition(tx.id, 'payout_sent', 'system', null, `B2C sent — receipt ${receipt}`);
        await transition(tx.id, 'completed', 'system', null, 'Transaction completed');
      } catch (e) {
        console.error('[MpesaThriftly] B2C completion transition error:', e.message);
      }
      await pool.execute('UPDATE thriftly_transactions SET completed_at = NOW() WHERE id = ?', [tx.id]);
      notify('payout_completed', { seller_phone: tx.seller_phone, amount: tx.amount, receipt, last4 });
      console.log(`[MpesaThriftly] Payout complete for tx ${tx.id} — receipt ${receipt}`);
    } else {
      const errMsg = result.ResultDesc || `B2C result code ${ResultCode}`;
      try {
        await transition(tx.id, 'payout_failed', 'system', null, errMsg);
      } catch (e) {
        console.error('[MpesaThriftly] Payout failed transition error:', e.message);
      }
      notify('admin_payout_failed', { transaction_id: tx.id, amount: tx.amount, seller_phone: tx.seller_phone, error: errMsg });
      console.log(`[MpesaThriftly] Payout failed for tx ${tx.id}: ${errMsg}`);
    }
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
module.exports.initiatePayout = initiatePayout;
