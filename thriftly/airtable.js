require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const http  = require('http');

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

// ── Download a file from a URL into a Buffer ───────────────────────────────
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }));
    }).on('error', reject);
  });
}

// ── Upload a photo to an existing Airtable record ─────────────────────────
// Airtable upload API: POST /v0/{baseId}/{tableId}/{recordId}/uploadAttachment/{fieldName}
async function uploadPhoto(recordId, fieldName, fileBuffer, filename, contentType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now()}`;
    const disposition = `Content-Disposition: form-data; name="file"; filename="${filename}"`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n${disposition}\r\nContent-Type: ${contentType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const opts = {
      hostname: 'api.airtable.com',
      path:     `/v0/${BASE_ID}/${LISTINGS}/${recordId}/uploadAttachment/${fieldName}`,
      method:   'POST',
      headers:  authHeaders({
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
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
    req.write(body);
    req.end();
  });
}

// ── Upload photo from a remote URL (Twilio media, etc.) ───────────────────
async function uploadPhotoFromUrl(recordId, fieldName, url, filename) {
  const { buffer, contentType } = await downloadBuffer(url);
  return uploadPhoto(recordId, fieldName, buffer, filename, contentType);
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

  // Upload photos sequentially into photo_1 … photo_5
  const fieldNames = ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'];
  for (let i = 0; i < Math.min(photos.length, 5); i++) {
    const photo = photos[i];
    const field = fieldNames[i];
    try {
      if (photo.url) {
        await uploadPhotoFromUrl(recordId, field, photo.url, photo.filename || `photo_${i + 1}.jpg`);
      } else if (photo.buffer) {
        await uploadPhoto(recordId, field, photo.buffer, photo.filename || `photo_${i + 1}.jpg`, photo.contentType);
      }
    } catch (err) {
      console.error(`[Thriftly] Failed to upload ${field}:`, err.message);
    }
  }

  return record;
}

// ── List active listings (for the shop grid) ──────────────────────────────
async function listActiveListings() {
  const params = new URLSearchParams({
    filterByFormula: "{status} = 'active'",
    sort:            JSON.stringify([{ field: 'created_at', direction: 'desc' }]),
  });
  const result = await request('GET', `/v0/${BASE_ID}/${LISTINGS}?${params}`);
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
  uploadPhoto,
  uploadPhotoFromUrl,
};
