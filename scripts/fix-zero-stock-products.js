/**
 * Create Variant records + Inventory Movements for the 53 products
 * at rows 28–80 that currently show Total Stock Quantity = 0.
 *
 * Product record IDs verified against live Airtable fetch on 2026-06-15.
 * Stock quantity: 5 for skincare/COSRX; 3 for frames.
 */

require('dotenv').config();
const axios = require('axios');

const BASE_ID         = process.env.AIRTABLE_BASE_ID;
const TOKEN           = process.env.AIRTABLE_TOKEN;
const HEADERS         = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const AT_BASE         = `https://api.airtable.com/v0/${BASE_ID}`;
const PRODUCTS_TABLE  = process.env.AIRTABLE_TABLE_ID;
const VARIANTS_TABLE  = process.env.AIRTABLE_VARIANTS_TABLE_ID;
const MOVEMENTS_TABLE = 'tblQ7JNyChQuSay0a';
const sleep           = ms => new Promise(r => setTimeout(r, ms));

// ── Master product list ───────────────────────────────────────────────────────
// [ sku, productId, stockQty ]
const PRODUCTS = [
  // ── Generic / The Ordinary formulations (rows 28–42) ─────────────────────
  ['BB-TOGA2-DEF',   'recWvSbkOC7BSS5ja', 5],  // Glycolic Acid 7% Toning Solution
  ['BB-TOHA2-DEF',   'rece06OeoR8u4g8ek', 5],  // Hyaluronic Acid 2% + B5 with Ceramides
  ['BB-TONMF-DEF',   'recpcw1aqtQPmztGJ', 5],  // TO Natural Moisturizing Factors + HA
  ['BB-TOVC23-DEF',  'recjEChLL7xePHHqb', 5],  // Vitamin C Suspension 23% + HA Spheres 2%
  ['BB-TOSQC-DEF',   'recUP4g14CoMzlcZg', 5],  // Squalane Cleanser
  ['BB-TOLA10-DEF',  'rec4fkeEZiHOBm8gW', 5],  // Lactic Acid 10% + HA 2% Exfoliating Serum
  ['BB-TOAZ10-DEF',  'recT0fvtWyATdSB8z', 5],  // Azelaic Acid 10% Suspension Brightening Cream
  ['BB-TOMPE-DEF',   'recB4aLmvRlHd323y', 5],  // Multi-Peptide Eye Serum
  ['BB-TOSF10-DEF',  'recMy7lLyh5hS1xsS', 5],  // Sulfur 10% Powder-to-Cream Spot Treatment
  ['BB-TOSBS-DEF',   'recEoIjjFGKqfNkcG', 5],  // Soothing & Barrier Support Serum
  ['BB-TOGCC-DEF',   'recQ1751mPDSSakO8', 5],  // Glycolipid Cream Cleanser
  ['BB-TOGF15-DEF',  'rec8UTRrer8ZXJ59p', 5],  // GF 15% Serum for Visible Skin Repair
  ['BB-TOBCS-DEF',   'recvVR6VtWVmFf7uv', 5],  // Balancing & Clarifying Serum
  ['BB-TOARG-DEF',   'recGuJti77fx0zymN', 5],  // 100% Organic Cold-Pressed Moroccan Argan Oil
  ['BB-TOSA05-DEF',  'recLXXXFWMnsp003o', 5],  // Salicylic Acid 0.5% Body Serum

  // ── COSRX (rows 43–74) ───────────────────────────────────────────────────
  ['BB-CSHA-DEF',    'recx8HJ5YA2mWa2UU', 5],  // COSRX - Hyaluronic Acid Hydra Power Essence 100ml
  ['BB-CSOF-DEF',    'recSOO1bkXo2nNV2n', 5],  // COSRX Oil Free Ultra Moisturising Lotion
  ['BB-CSVC-DEF',    'recngDuhyKrb0DDie', 5],  // COSRX The Vitamin C 23 Serum 20G
  ['BB-CSAL-DEF',    'recGohPK0ix45DVIq', 5],  // COSRX Aloe Soothing Sun Cream 50ml
  ['BB-CSRD-DEF',    'rechQB9GHA5Th63z3', 5],  // COSRX Advanced Snail Radiance Dual Essence 80ml
  ['BB-CSAS96X-DEF', 'recUdjPDxzBsz5Gi9', 5],  // COSRX - Advanced Snail 96 Mucin Power Essence 100ml
  ['BB-CSAS92X-DEF', 'recrEedRrlxX1KjNb', 5],  // COSRX - Advanced Snail 92 All In One Cream 100ml
  ['BB-CSHI-DEF',    'rec5018TVhfcMmdb4', 5],  // COSRX - Hyaluronic Acid Intensive Cream 100ml
  ['BB-CSBHA-DEF',   'rec6cemget9KwahIs', 5],  // COSRX- BHA Blackhead Power Liquid 100ml
  ['BB-CSAP-DEF',    'rec7K32s71YKsqZmb', 5],  // COSRX Acne Pimple Master Patch 7g
  ['BB-CSN15-DEF',   'rec2wNtRK5X6Wo3ov', 5],  // COSRX The Niacinamide 15 Serum 20ml
  ['BB-CSLP-DEF',    'recfhwlUh2hXsQEC3', 5],  // COSRX-Low Ph Good Morning Gel Cleanser 150ml
  ['BB-CS6P-DEF',    'recTgzF3fTstPdGCC', 5],  // COSRX The 6 Peptide Skin Booster Serum 150ml
  ['BB-CSAB-DEF',    'recvttVbjmh1eAYUf', 5],  // COSRX The Alpha-Arbutin 2 Discoloration Care Serum 50ml
  ['BB-CSUS-DEF',    'rec1rzdQRZV6CRpJJ', 5],  // COSRX Ultra-Light Invisible Sunscreen SPF50 PA++++
  ['BB-CSAH7-DEF',   'recznbU2Boy6HaJdq', 5],  // COSRX- AHA 7 Whitehead Power Liquid 100ml
  ['BB-CSFPH-DEF',   'recJQGBk999ohhD0g', 5],  // COSRX - Full Fit Propolis Honey Overnight Mask 60ml
  ['BB-CSASM-DEF',   'recZOpKWjWmrB94QQ', 5],  // COSRX Advanced Snail Mucin Power Sheet Mask 25ml
  ['BB-CSHM-DEF',    'rec3zzPWezqCIpFXW', 5],  // COSRX Hydrium Moisture Power Enriched Cream 50ml
  ['BB-CSCICA-DEF',  'rec6oXYXOhH12XgBw', 5],  // COSRX Pure Fit Cica Cream 50ml
  ['BB-CSCB-DEF',    'recJVlhz1wFsUvSFn', 5],  // COSRX Centella Blemish Cream 30ml
  ['BB-CSCWT-DEF',   'recvqwKa0DzBtElo3', 5],  // COSRX - Centella Water Alcohol-Free Toner 150ml
  ['BB-CSRET5-DEF',  'reccFZ5UeRUsVUffd', 5],  // COSRX The Retinol 0.5 Oil 20ml
  ['BB-CSFPA-DEF',   'recw6NeuiB4GM5liI', 5],  // COSRX Full Fit Propolis Light Ampoule 30ml
  ['BB-CSRS-DEF',    'recxYZ10IsVwZhopJ', 5],  // COSRX- Ultimate Nourishing Rice Overnight Spa Mask
  ['BB-CSRET1-DEF',  'recwI0ucd1xZCbEjz', 5],  // COSRX The Retinol 0.1 Cream 20ml
  ['BB-CSASMG-DEF',  'recYAG9kK2qXmPsDN', 5],  // COSRX Advanced Snail Mucin Gel Cleanser 150ml
  ['BB-CSFPS-DEF',   'recZr9mryOoQCUzHH', 5],  // COSRX - Full Fit Propolis Synergy Toner 150ML
  ['BB-CSABT-DEF',   'recQzthEZzTXgHc9r', 5],  // COSRX - Aha/Bha Clarifying Treatment Toner 150ml
  ['BB-CSAS92T-DEF', 'recHHaYPSOc7WXpNc', 5],  // COSRX- Advance Snail 92 All In One Cream Tube 100g
  ['BB-CSASPE-DEF',  'recYgh0hy4kertSpk', 5],  // COSRX - Advanced Snail Peptide Eye Cream 25ml
  ['BB-CSHA3-DEF',   'recIgTfJNDJ7r9C59', 5],  // COSRX The Hyaluronic Acid 3 Serum 20ml

  // ── Country Road Frames (rows 75–78) ─────────────────────────────────────
  ['BB-CRPM-DEF',    'recAixdfHmWcEnssV', 3],  // Country Road Paton Medium Frame
  ['BB-CRPS-DEF',    'rec5uQGtjCRgVeOrI', 3],  // Country Road Paton Small Frame
  ['BB-CRAM-DEF',    'recR42gkVpchpwOLc', 3],  // Country Road Adler Medium Frame
  ['BB-CRAC-DEF',    'recmEDlPHfEqjbwQE', 3],  // Country Road Adler Certificate Frame

  // ── Olivia Frames (rows 79–80) ────────────────────────────────────────────
  ['BB-OLSQ-DEF',    'recajDaUkuhWtWnF8', 3],  // Olivia Square Frame
  ['BB-OLOVAL-DEF',  'rec2aFe1ARwY8TxZF', 3],  // Olivia Oval Frame
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchExistingSkus() {
  const skus = new Set();
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['SKU'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${VARIANTS_TABLE}`, { headers: HEADERS, params });
    data.records.forEach(r => { if (r.fields.SKU) skus.add(r.fields.SKU); });
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);
  return skus;
}

async function fetchExistingMovementVariantIds() {
  const ids = new Set();
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Reference', 'Variant'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${MOVEMENTS_TABLE}`, { headers: HEADERS, params });
    data.records.forEach(r => {
      if (r.fields['Reference'] === 'INITIAL' && (r.fields['Variant'] || []).length) {
        ids.add(r.fields['Variant'][0]);
      }
    });
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);
  return ids;
}

async function batchCreate(tableId, records) {
  const BATCH = 10;
  const created = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    try {
      const { data } = await axios.post(
        `${AT_BASE}/${tableId}`,
        { records: chunk, typecast: true },
        { headers: HEADERS }
      );
      created.push(...data.records);
      data.records.forEach(r => console.log(`  ✓ ${r.id}`));
    } catch (e) {
      console.log(`  ✗ Batch ${i}–${i + BATCH}: ${e.response?.data?.error?.message || e.message}`);
    }
    if (i + BATCH < records.length) await sleep(260);
  }
  return created;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Beyond Beauty — Fix zero-stock products (rows 28–80)');
  console.log(`${PRODUCTS.length} products to process\n`);

  console.log('Fetching existing SKUs…');
  const existingSkus = await fetchExistingSkus();
  console.log(`${existingSkus.size} SKUs already exist\n`);

  // ── Step 1: Create Variant records ────────────────────────────────────────
  const toCreate = PRODUCTS.filter(([sku]) => !existingSkus.has(sku));
  const alreadyHave = PRODUCTS.length - toCreate.length;
  if (alreadyHave) console.log(`${alreadyHave} SKUs already exist — skipping`);

  console.log(`══ Creating ${toCreate.length} Variant records ══`);
  const newVariants = await batchCreate(
    VARIANTS_TABLE,
    toCreate.map(([sku, productId]) => ({
      fields: { SKU: sku, Active: true, Products: [productId] },
    }))
  );

  // Build SKU → variant ID map (existing + newly created)
  const skuToVarId = {};
  toCreate.forEach(([sku], i) => {
    if (newVariants[i]) skuToVarId[sku] = newVariants[i].id;
  });

  // For any SKUs that already existed, fetch their record IDs
  if (alreadyHave) {
    let offset = null;
    do {
      const params = { pageSize: 100, 'fields[]': ['SKU'] };
      if (offset) params.offset = offset;
      const { data } = await axios.get(`${AT_BASE}/${VARIANTS_TABLE}`, { headers: HEADERS, params });
      data.records.forEach(r => {
        if (r.fields.SKU && existingSkus.has(r.fields.SKU)) {
          skuToVarId[r.fields.SKU] = r.id;
        }
      });
      offset = data.offset || null;
      if (offset) await sleep(200);
    } while (offset);
  }

  // ── Step 2: Create Inventory Movements ────────────────────────────────────
  console.log('\nFetching existing INITIAL movements…');
  const existingMovVariants = await fetchExistingMovementVariantIds();
  console.log(`${existingMovVariants.size} INITIAL movements already exist`);

  const movements = PRODUCTS
    .filter(([sku]) => {
      const varId = skuToVarId[sku];
      return varId && !existingMovVariants.has(varId);
    })
    .map(([sku, , qty]) => {
      const varId = skuToVarId[sku];
      return {
        fields: {
          'Movement':      `Initial stock — ${sku}`,
          'Date':          '2026-06-15',
          'Movement Type': 'Stock In',
          'Quantity':      qty,
          'Reason':        'Opening stock — initial catalogue load',
          'Reference':     'INITIAL',
          'Variant':       [varId],
        },
      };
    });

  console.log(`\n══ Creating ${movements.length} Inventory Movement records ══`);
  await batchCreate(MOVEMENTS_TABLE, movements);

  // ── Step 3: Verify ────────────────────────────────────────────────────────
  console.log('\n══ Verification (3s for Airtable recalc) ══');
  await sleep(3000);

  const productRecords = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Product Name', 'Total Stock Quantity'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${PRODUCTS_TABLE}`, { headers: HEADERS, params });
    productRecords.push(...data.records);
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);

  const spotChecks = [
    ['Glycolic Acid 7% Toning Solution',       5],
    ['Vitamin C Suspension 23%',                5],
    ['Squalane Cleanser',                       5],
    ['COSRX The Vitamin C 23',                  5],
    ['COSRX Aloe Soothing Sun Cream',           5],
    ['COSRX The Niacinamide 15',                5],
    ['COSRX Ultra-Light Invisible Sunscreen',   5],
    ['COSRX Pure Fit Cica Cream',               5],
    ['COSRX The Retinol 0.5',                   5],
    ['COSRX The Retinol 0.1',                   5],
    ['Country Road Paton Medium Frame',         3],
    ['Country Road Adler Certificate Frame',    3],
    ['Olivia Square Frame',                     3],
    ['Olivia Oval Frame',                       3],
  ];

  let pass = 0, fail = 0;
  spotChecks.forEach(([query, expected]) => {
    const rec = productRecords.find(r => (r.fields['Product Name'] || '').includes(query));
    const qty = rec?.fields?.['Total Stock Quantity'];
    const ok  = qty === expected;
    console.log(`  ${ok ? '✓' : '✗'} "${query}": ${qty ?? 'null'} (expected ${expected})`);
    ok ? pass++ : fail++;
  });

  const errorCount = productRecords.filter(r =>
    typeof r.fields['Total Stock Quantity'] === 'string' &&
    r.fields['Total Stock Quantity'].includes('ERROR')
  ).length;
  console.log(`\n  ${errorCount === 0 ? '✓' : '✗'} #ERROR! count: ${errorCount}`);
  console.log(`\n  ${pass}/${spotChecks.length} spot-checks passed`);

  if (fail > 0) {
    console.log('  ⚠ Some checks failed — Airtable may still be recalculating. Wait 1–2 min and re-check.');
  } else {
    console.log('  ✓ All done — rows 28–80 now have stock.');
  }
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.response?.data || err.message);
  process.exit(1);
});
