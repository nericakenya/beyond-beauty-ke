const express = require('express');
const router = express.Router();
const axios = require('axios');

const AIRTABLE_CUSTOMERS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Customers`;
const AIRTABLE_HEADERS   = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe — { email }
// Reuses the Customers table (Email + Marketing Consent) rather than a separate
// list, so a subscriber who later places an order is already the same record.
router.post('/subscribe', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const escaped = email.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const { data: existing } = await axios.get(AIRTABLE_CUSTOMERS, {
      headers: AIRTABLE_HEADERS(),
      params: { filterByFormula: `LOWER({Email}) = "${escaped}"`, maxRecords: 1 },
    });

    if (existing.records.length) {
      const record = existing.records[0];
      if (!record.fields['Marketing Consent']) {
        await axios.patch(AIRTABLE_CUSTOMERS, {
          records: [{ id: record.id, fields: { 'Marketing Consent': true } }],
        }, { headers: AIRTABLE_HEADERS() });
      }
    } else {
      await axios.post(AIRTABLE_CUSTOMERS, {
        records: [{ fields: { Email: email, 'Marketing Consent': true } }],
      }, { headers: AIRTABLE_HEADERS() });
    }

    res.json({ subscribed: true });
  } catch (err) {
    console.error('[Newsletter] subscribe error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not subscribe right now. Please try again.' });
  }
});

module.exports = router;
