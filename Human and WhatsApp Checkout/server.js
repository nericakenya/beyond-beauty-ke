/**
 * server.js — Option 1: M-Pesa STK Push
 *
 * Endpoints:
 *   POST /api/mpesa/stk-push     → Trigger a payment prompt on the customer's phone
 *   POST /api/mpesa/callback     → Safaricom calls this when payment completes/fails
 *   GET  /api/mpesa/status/:id   → Frontend polls this to check payment status
 *   GET  /health
 */

require('dotenv').config();

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // tighten this for production

// ── In-memory payment store ──────────────────────────────────────────────────
// Replace with a real database (e.g. Prisma + Postgres) in production.
const payments = new Map(); // checkoutRequestId → { status, message, phone, amount, orderId }

// ── Daraja token cache ───────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getDarajaToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

  const env = process.env.MPESA_ENV || 'sandbox';
  const url = env === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const { data } = await axios.get(url, {
    headers: { Authorization: `Basic ${credentials}` }
  });

  cachedToken = data.access_token;
  tokenExpiry  = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  return cachedToken;
}

// ── Timestamp helper ─────────────────────────────────────────────────────────
function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14); // YYYYMMDDHHmmss
}

// ── POST /api/mpesa/stk-push ─────────────────────────────────────────────────
app.post('/api/mpesa/stk-push', async (req, res) => {
  const { phone, amount, orderId } = req.body;

  if (!phone || !amount || !orderId) {
    return res.status(400).json({ error: 'phone, amount, and orderId are required' });
  }

  const {
    MPESA_SHORTCODE,        // Your till/paybill number, e.g. 174379 (sandbox test shortcode)
    MPESA_PASSKEY,          // From Daraja portal
    MPESA_CALLBACK_URL,     // Public HTTPS URL — e.g. https://yourdomain.com/api/mpesa/callback
    MPESA_ENV,
  } = process.env;

  const timestamp = getTimestamp();
  const password  = Buffer
    .from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`)
    .toString('base64');

  const baseUrl = (MPESA_ENV || 'sandbox') === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  try {
    const token = await getDarajaToken();

    const { data } = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerBuyGoodsOnline',  // Use 'CustomerPayBillOnline' for Paybill
        Amount:            Math.ceil(amount),          // Must be a whole number
        PartyA:            phone,                      // Customer phone: 254XXXXXXXXX
        PartyB:            MPESA_SHORTCODE,            // Your till/paybill
        PhoneNumber:       phone,
        CallBackURL:       MPESA_CALLBACK_URL,
        AccountReference:  orderId,                    // Visible on customer's M-Pesa statement
        TransactionDesc:   `Order ${orderId}`,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const checkoutRequestId = data.CheckoutRequestID;

    // Store pending payment
    payments.set(checkoutRequestId, {
      status:  'PENDING',
      message: 'Waiting for customer to approve',
      phone,
      amount,
      orderId,
    });

    console.log(`[stk-push] Initiated — ${checkoutRequestId} for ${phone} KES ${amount}`);
    res.json({ checkoutRequestId, merchantRequestId: data.MerchantRequestID });

  } catch (err) {
    const msg = err.response?.data?.errorMessage || err.message;
    console.error('[stk-push] Error:', msg);
    res.status(502).json({ error: msg });
  }
});

// ── POST /api/mpesa/callback ─────────────────────────────────────────────────
// Safaricom calls this with the payment result. Must return 200 quickly.
app.post('/api/mpesa/callback', (req, res) => {
  // Always acknowledge immediately
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const body = req.body?.Body?.stkCallback;
  if (!body) return;

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  const payment = payments.get(CheckoutRequestID);
  if (!payment) {
    console.warn('[callback] Unknown CheckoutRequestID:', CheckoutRequestID);
    return;
  }

  if (ResultCode === 0) {
    // Payment successful — extract metadata
    const items = CallbackMetadata?.Item || [];
    const get = (name) => items.find(i => i.Name === name)?.Value;

    payment.status          = 'SUCCESS';
    payment.message         = 'Payment confirmed';
    payment.mpesaReceiptNo  = get('MpesaReceiptNumber');
    payment.transactionDate = get('TransactionDate');
    payment.paidAmount      = get('Amount');
    payment.phoneUsed       = get('PhoneNumber');

    console.log(`[callback] ✅ SUCCESS — ${CheckoutRequestID} | Receipt: ${payment.mpesaReceiptNo}`);

    // ── Place your order here ───────────────────────────────────────────────
    // e.g. await db.orders.create({ ... payment })
    // e.g. await sendOrderConfirmationSMS(payment.phone, payment.orderId)
    // ─────────────────────────────────────────────────────────────────────

  } else {
    payment.status  = ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
    payment.message = ResultDesc;
    console.log(`[callback] ❌ ${payment.status} — ${CheckoutRequestID}: ${ResultDesc}`);
  }

  payments.set(CheckoutRequestID, payment);
});

// ── GET /api/mpesa/status/:checkoutRequestId ─────────────────────────────────
// Frontend polls this every few seconds to check if payment went through.
app.get('/api/mpesa/status/:id', (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ status: 'NOT_FOUND' });
  res.json({ status: payment.status, message: payment.message });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const env = process.env.MPESA_ENV || 'sandbox';
  console.log(`✅ M-Pesa STK Push server running on port ${PORT} [${env}]`);
  console.log(`   Callback URL must be publicly reachable: ${process.env.MPESA_CALLBACK_URL}`);
});
