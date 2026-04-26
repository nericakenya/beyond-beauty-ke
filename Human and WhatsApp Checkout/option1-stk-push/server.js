const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('.')); // Serve static files like checkout.html

const DARAJA_BASE = 'https://sandbox.safaricom.co.ke'; // Sandbox
const transactions = {}; // In-memory store for demo

async function getMpesaToken() {
  const creds = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
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

// POST /stk-push
app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount are required' });

  try {
    const token = await getMpesaToken();
    const shortcode = process.env.DARAJA_SHORTCODE;
    const passkey = process.env.DARAJA_PASSKEY;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const formattedPhone = formatPhone(phone);

    const { data } = await axios.post(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.BASE_URL || `http://localhost:${PORT}`}/callback`,
      AccountReference: 'TestPayment',
      TransactionDesc: 'Test STK Push Payment',
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResponseCode === '0') {
      const checkoutRequestId = data.CheckoutRequestID;
      transactions[checkoutRequestId] = { status: 'pending', resultCode: null, mpesaReceiptNumber: null };
      res.json({ success: true, checkoutRequestId });
    } else {
      res.status(400).json({ error: data.ResponseDescription || 'STK push failed' });
    }
  } catch (err) {
    console.error('[STK Push]', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// POST /callback — Safaricom posts here
app.post('/callback', (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  if (transactions[CheckoutRequestID]) {
    transactions[CheckoutRequestID].resultCode = ResultCode;
    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      transactions[CheckoutRequestID].mpesaReceiptNumber = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
    }
    console.log(`[Callback] ${CheckoutRequestID} - Result: ${ResultCode}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// GET /status/:checkoutRequestId
app.get('/status/:checkoutRequestId', (req, res) => {
  const { checkoutRequestId } = req.params;
  const transaction = transactions[checkoutRequestId];
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  res.json({
    resultCode: transaction.resultCode,
    mpesaReceiptNumber: transaction.mpesaReceiptNumber,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});