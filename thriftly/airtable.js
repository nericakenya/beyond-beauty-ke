require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const BASE_URL    = 'https://api.airtable.com';
const TOKEN       = process.env.THRIFTLY_AIRTABLE_TOKEN;
const BASE_ID     = process.env.THRIFTLY_BASE_ID;
const LISTINGS    = process.env.THRIFTLY_LISTINGS_TABLE_ID;
const PAYMENTS    = process.env.THRIFTLY_PAYMENTS_TABLE_ID;

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${TOKEN}`, ...extra };
}

// ── Generic JSON request ───────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(BASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers:  authHeaders({
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }),
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Patch a record's attachment fields with public URLs ────────────────────
// Airtable fetches and stores each URL on its CDN.
// photos: array of { url, filename } — must be publicly reachable URLs.
async function patchPhotos(recordId, photos) {
  if (!photos.length) return;
  const fields = {};
  const fieldNames = ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'];
  photos.slice(0, 5).forEach((p, i) => {
    fields[fieldNames[i]] = [{ url: p.url, filename: p.filename || `photo_${i + 1}.jpg` }];
  });
  const payload = JSON.stringify({ fields });
  return request('PATCH', `/v0/${BASE_ID}/${LISTINGS}/${recordId}`, { fields });
}

// ── Create a listing record ───────────────────────────────────────────────
// photos: array of { buffer, filename, contentType } OR { url, filename }
// Photos are uploaded after record creation.
async function createListing(fields, photos = []) {
  const payload = {
    fields: {
      status:                fields.status               || 'pending_review',
      seller_name:           fields.seller_name          || '',
      seller_id_number:      fields.seller_id_number     || '',
      seller_phone:          fields.seller_phone         || '',
      seller_email:          fields.seller_email         || '',
      seller_location:       fields.seller_location      || '',
      item_title:            fields.item_title           || '',
      item_condition:        fields.item_condition       || '',
      item_description:      fields.item_description     || '',
      item_category:         fields.item_category        || '',
      item_price_kes:        Number(fields.item_price_kes) || 0,
      listing_fee_paid:      fields.listing_fee_paid     ?? true,
      mpesa_confirmation_code: fields.mpesa_confirmation_code || '',
      mpesa_phone_used:      fields.mpesa_phone_used     || '',
      submission_channel:    fields.submission_channel   || 'website',
      whatsapp_number:       fields.whatsapp_number      || '',
    },
  };

  const result = await request('POST', `/v0/${BASE_ID}/${LISTINGS}`, { records: [payload] });
  if (!result.records?.[0]) throw new Error('Airtable create failed: ' + JSON.stringify(result));

  const record = result.records[0];
  const recordId = record.id;

  // Attach photos via URL PATCH — Airtable fetches and stores each URL
  const urlPhotos = photos.filter(p => p.url).slice(0, 5);
  if (urlPhotos.length) {
    try {
      await patchPhotos(recordId, urlPhotos);
    } catch (err) {
      console.error('[Thriftly] Photo PATCH failed:', err.message);
    }
  }

  return record;
}

// ── List active listings (for the shop grid) ──────────────────────────────
async function listActiveListings() {
  const qs = new URLSearchParams({
    filterByFormula:  "{status} = 'active'",
    'sort[0][field]': 'created_at',
    'sort[0][direction]': 'desc',
  });
  const result = await request('GET', `/v0/${BASE_ID}/${LISTINGS}?${qs}`);
  return result.records || [];
}

// ── Get a single listing by record ID ────────────────────────────────────
async function getListing(recordId) {
  const result = await request('GET', `/v0/${BASE_ID}/${LISTINGS}/${recordId}`);
  return result;
}

// ── Update listing status ─────────────────────────────────────────────────
async function updateListingStatus(recordId, status, extra = {}) {
  const result = await request('PATCH', `/v0/${BASE_ID}/${LISTINGS}`, {
    records: [{ id: recordId, fields: { status, ...extra } }],
  });
  return result.records?.[0];
}

// ── Create a payment record ───────────────────────────────────────────────
async function createPayment({ listingRecordId, amount, mpesaCode, phone }) {
  const result = await request('POST', `/v0/${BASE_ID}/${PAYMENTS}`, {
    records: [{
      fields: {
        listing_id: [listingRecordId],
        amount_kes: amount || 250,
        mpesa_code: mpesaCode,
        phone,
        payment_time: new Date().toISOString(),
        verified: false,
      },
    }],
  });
  return result.records?.[0];
}

module.exports = {
  createListing,
  listActiveListings,
  getListing,
  updateListingStatus,
  createPayment,
  patchPhotos,
};
