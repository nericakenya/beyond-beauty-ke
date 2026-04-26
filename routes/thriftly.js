const express  = require('express');
const multer   = require('multer');
const axios    = require('axios');
const router   = express.Router();
const { listActiveListings, createListing, updateListingStatus, createPayment, getListing } = require('../thriftly/airtable');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const DARAJA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// in-memory map: checkoutRequestId -> { recordId, phone }
const pendingPayments = new Map();

async function getMpesaToken() {
  const creds = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  return data.access_token;
}

function formatPhone(raw) {
  let p = raw.toString().replace(/\s/g, '').replace(/^\+/, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);
  return p;
}

// GET /api/thriftly/listings
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

// POST /api/thriftly/listings — create listing, photos uploaded to Airtable
router.post('/listings', upload.array('photos', 5), async (req, res) => {
  try {
    const b      = req.body;
    const photos = (req.files || []).map((f, i) => ({
      buffer:      f.buffer,
      filename:    f.originalname || `photo_${i + 1}.jpg`,
      contentType: f.mimetype || 'image/jpeg',
    }));

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
      listing_fee_paid:   false,
      status:             'pending_review',
    }, photos);

    res.json({ id: record.id, status: 'pending_review' });
  } catch (err) {
    console.error('[Thriftly] create listing error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create listing' });
  }
});

// POST /api/thriftly/pay/stk-push — trigger KES 250 M-Pesa STK push for listing fee
router.post('/pay/stk-push', async (req, res) => {
  const { record_id, phone } = req.body;
  if (!record_id || !phone) return res.status(400).json({ error: 'record_id and phone required' });

  try {
    const token      = await getMpesaToken();
    const shortcode  = process.env.MPESA_SHORTCODE;
    const passkey    = process.env.MPESA_PASSKEY;
    const timestamp  = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password   = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const fmtPhone   = formatPhone(phone);
    const listingFee = Number(process.env.THRIFTLY_LISTING_FEE) || 250;

    const { data } = await axios.post(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount:            listingFee,
      PartyA:            fmtPhone,
      PartyB:            shortcode,
      PhoneNumber:       fmtPhone,
      CallBackURL:       `${process.env.BASE_URL}/api/thriftly/pay/callback`,
      AccountReference:  'THRIFTLY',
      TransactionDesc:   'Thriftly listing fee',
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResponseCode === '0') {
      pendingPayments.set(data.CheckoutRequestID, { recordId: record_id, phone: fmtPhone });
      res.json({ success: true, checkout_request_id: data.CheckoutRequestID });
    } else {
      res.status(400).json({ error: data.ResponseDescription || 'STK push failed' });
    }
  } catch (err) {
    console.error('[Thriftly STK]', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// POST /api/thriftly/pay/callback — Safaricom callback after payment
router.post('/pay/callback', async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  const pending = pendingPayments.get(CheckoutRequestID);

  if (pending && ResultCode === 0) {
    const items      = CallbackMetadata?.Item || [];
    const mpesaCode  = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || '';
    const amount     = items.find(i => i.Name === 'Amount')?.Value || 250;
    try {
      await updateListingStatus(pending.recordId, 'pending_review', {
        listing_fee_paid:       true,
        mpesa_confirmation_code: mpesaCode,
        mpesa_phone_used:       pending.phone,
      });
      await createPayment({
        listingRecordId: pending.recordId,
        amount,
        mpesaCode,
        phone: pending.phone,
      });
      console.log(`[Thriftly] Fee paid for record ${pending.recordId} — ${mpesaCode}`);
    } catch (e) {
      console.error('[Thriftly] post-payment Airtable update failed:', e.message);
    }
    pendingPayments.delete(CheckoutRequestID);
  } else if (pending) {
    pendingPayments.delete(CheckoutRequestID);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// POST /api/thriftly/pay/status — frontend polls this to detect payment confirmation
router.post('/pay/status', async (req, res) => {
  const { checkout_request_id, record_id } = req.body;
  if (!checkout_request_id || !record_id) return res.status(400).json({ error: 'Missing params' });

  // If it's no longer in pendingPayments, callback has fired — check Airtable
  if (!pendingPayments.has(checkout_request_id)) {
    try {
      const record = await getListing(record_id);
      if (record?.fields?.listing_fee_paid) {
        return res.json({ status: 'paid', mpesa_code: record.fields.mpesa_confirmation_code || '' });
      }
    } catch (_) {}
    return res.json({ status: 'pending' });
  }

  // Still in map — query Daraja directly to catch any missed callbacks
  try {
    const token     = await getMpesaToken();
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey   = process.env.MPESA_PASSKEY;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const { data } = await axios.post(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkout_request_id,
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResultCode === '0' || data.ResultCode === 0) {
      return res.json({ status: 'paid', mpesa_code: '' });
    } else if (data.ResultCode !== undefined && data.ResultCode !== '1032') {
      pendingPayments.delete(checkout_request_id);
      return res.json({ status: 'failed' });
    }
  } catch (_) {}

  res.json({ status: 'pending' });
});

module.exports = router;
