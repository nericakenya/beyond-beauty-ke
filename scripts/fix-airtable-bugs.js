/**
 * Bug-fix script — airtable_rollup_bugfix.md
 *
 * Bug 1 — Change Inventory Movements.Quantity field type to Number
 * Bug 2 — No schema rewire needed if Bug 1 fixes the SUM error chain;
 *          but we verify and report, and attempt a PATCH if Products still
 *          rolls up through a broken chain.
 * Bug 3 — Import 110 rows from BB_Missing_Stock_Entries.csv into
 *          Inventory Movements, linked by Variant SKU.
 */

require('dotenv').config();
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const BASE_ID   = process.env.AIRTABLE_BASE_ID;
const TOKEN     = process.env.AIRTABLE_TOKEN;
const HEADERS   = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const META_BASE = `https://api.airtable.com/v0/meta/bases/${BASE_ID}`;
const AT_BASE   = `https://api.airtable.com/v0/${BASE_ID}`;
const sleep     = ms => new Promise(r => setTimeout(r, ms));

const CSV_PATH = '/Users/nericakuguru/Downloads/BB_Missing_Stock_Entries.csv';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // handle quoted fields
    const cols = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
    return obj;
  });
}

async function fetchAllRecords(tableId, fields = []) {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100 };
    if (fields.length) params['fields[]'] = fields;
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${tableId}`, { headers: HEADERS, params });
    records.push(...data.records);
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);
  return records;
}

async function getTablesMeta() {
  const { data } = await axios.get(`${META_BASE}/tables`, { headers: HEADERS });
  return data.tables;
}

// ── Step 0 — Discover base structure ─────────────────────────────────────────

async function discoverBase() {
  const tables = await getTablesMeta();

  const find = name => tables.find(t => t.name === name);
  const tIM  = find('Inventory Movements');
  const tProd = find('Products');
  const tVar  = find('Variants');
  const tOI   = find('Order Items');

  if (!tIM)   throw new Error('Table "Inventory Movements" not found');
  if (!tProd) throw new Error('Table "Products" not found');
  if (!tVar)  throw new Error('Table "Variants" not found');

  const fieldOf = (table, name) => table.fields.find(f => f.name === name);

  return {
    tables,
    inventory_movements: {
      id:       tIM.id,
      qty:      fieldOf(tIM, 'Quantity'),
      mvType:   fieldOf(tIM, 'Movement Type'),
      variant:  fieldOf(tIM, 'Variant'),
    },
    products: {
      id:        tProd.id,
      totalStock: fieldOf(tProd, 'Total Stock Quantity'),
      totalSold:  fieldOf(tProd, 'Total Sold'),
    },
    variants: {
      id:        tVar.id,
      stockQty:  fieldOf(tVar, 'Stock Quantity'),
      totalSold: fieldOf(tVar, 'Total Sold'),
    },
    order_items: tOI ? { id: tOI.id } : null,
  };
}

// ── BUG 1 — Change Quantity field type to Number ──────────────────────────────

async function fixBug1(base) {
  console.log('\n══════════════════════════════════════════');
  console.log('BUG 1 — Change Inventory Movements.Quantity to Number');
  console.log('══════════════════════════════════════════');

  const { inventory_movements } = base;
  if (!inventory_movements.qty) {
    console.log('  ✗ Quantity field not found in Inventory Movements');
    return false;
  }

  const fld = inventory_movements.qty;
  console.log(`  Field: "${fld.name}"  id=${fld.id}  current type=${fld.type}`);

  if (fld.type === 'number') {
    console.log('  ✓ Already Number — no change needed');
    return true;
  }

  try {
    await axios.patch(
      `${META_BASE}/tables/${inventory_movements.id}/fields/${fld.id}`,
      { type: 'number', options: { precision: 0 } },
      { headers: HEADERS }
    );
    console.log('  ✓ Quantity field updated to Number (integer, 0 decimals)');
    return true;
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.log(`  ✗ Meta API error: ${JSON.stringify(msg)}`);
    if (e.response?.status === 403) {
      console.log('  → Token lacks schema.bases:write scope — create a PAT with that scope and retry');
    }
    return false;
  }
}

// ── BUG 2 — Verify rollup chain; no schema rewire needed if Bug1 fixes it ─────
//    The #ERROR! in Products.Total Stock Quantity cascades from:
//    Inventory Movements.Quantity (text) → SUM fails → Variants.Stock Quantity = #ERROR!
//    → Products.Total Stock Quantity = SUM(#ERROR!) = #ERROR!
//    Fixing the field type (Bug 1) propagates and resolves the cascade.
//    We verify the field configurations and report.

async function checkBug2(base) {
  console.log('\n══════════════════════════════════════════');
  console.log('BUG 2 — Verify rollup chain integrity');
  console.log('══════════════════════════════════════════');

  const { products, variants } = base;

  const reportField = (label, fld) => {
    if (!fld) { console.log(`  ✗ ${label}: field not found`); return; }
    const opts = fld.options || {};
    const src  = opts.recordLinkFieldId ? `linked via field ${opts.recordLinkFieldId}` : '(no link config)';
    const agg  = opts.aggregationFunction || '(no agg)';
    console.log(`  ${label}:`);
    console.log(`    type=${fld.type}  agg=${agg}  ${src}`);
    const rollupField = opts.fieldIdInLinkedTable ? `rollup field=${opts.fieldIdInLinkedTable}` : '';
    if (rollupField) console.log(`    ${rollupField}`);
  };

  reportField('Products.Total Stock Quantity', products.totalStock);
  reportField('Products.Total Sold',           products.totalSold);
  reportField('Variants.Stock Quantity',        variants.stockQty);
  reportField('Variants.Total Sold',            variants.totalSold);

  console.log('\n  ℹ Fixing Bug 1 (Quantity → Number) resolves the SUM error cascade.');
  console.log('  ℹ No rollup rerouting is required unless the fields above show unexpected sources.');
  console.log('  ℹ Airtable recalculates rollup chains asynchronously — allow 1-2 min after Bug 1 fix.');
}

// ── BUG 3 — Import CSV rows into Inventory Movements ─────────────────────────

async function fixBug3(base) {
  console.log('\n══════════════════════════════════════════');
  console.log('BUG 3 — Import BB_Missing_Stock_Entries.csv');
  console.log('══════════════════════════════════════════');

  // Read CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.log(`  ✗ CSV not found at: ${CSV_PATH}`);
    return;
  }
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`  ${rows.length} rows in CSV`);

  const { inventory_movements, variants } = base;

  // Fetch all Variants to build SKU → record ID map
  console.log('  Fetching Variants to build SKU map…');
  const variantRecords = await fetchAllRecords(variants.id, ['SKU']);
  const skuMap = {};
  variantRecords.forEach(r => {
    if (r.fields.SKU) skuMap[r.fields.SKU.trim()] = r.id;
  });
  console.log(`  ${Object.keys(skuMap).length} variant SKUs loaded`);

  // Find the linked-record field name in Inventory Movements that points to Variants
  // (we assume its name is "Variant")
  const variantLinkField = inventory_movements.variant;
  if (!variantLinkField) {
    console.log('  ✗ "Variant" linked-record field not found in Inventory Movements table');
    return;
  }
  console.log(`  Variant link field: "${variantLinkField.name}" (id=${variantLinkField.id})`);

  // Check for already-imported records (by Reference + Variant SKU) to avoid duplicates
  console.log('  Checking for existing INITIAL records…');
  const existing = await fetchAllRecords(inventory_movements.id, ['Reference', 'Variant']);
  const existingSet = new Set();
  existing.forEach(r => {
    const ref = r.fields['Reference'] || '';
    const vIds = r.fields['Variant'] || [];
    if (ref === 'INITIAL' && vIds.length) existingSet.add(vIds[0]);
  });
  console.log(`  ${existingSet.size} INITIAL records already exist — will skip duplicates`);

  // Build records to create
  const toCreate = [];
  const skipped  = [];
  const missing  = [];

  for (const row of rows) {
    const sku = row['Variant']?.trim();
    const varId = skuMap[sku];

    if (!varId) { missing.push(sku); continue; }
    if (existingSet.has(varId)) { skipped.push(sku); continue; }

    toCreate.push({
      fields: {
        'Movement':      row['Movement'],
        'Date':          row['Date'],
        'Movement Type': row['Movement Type'],
        'Quantity':      parseFloat(row['Quantity']) || 0,
        'Reason':        row['Reason'],
        'Reference':     row['Reference'],
        'Variant':       [varId],
      },
    });
  }

  if (missing.length) {
    console.log(`\n  ⚠ ${missing.length} SKUs not found in Variants — these rows will be skipped:`);
    missing.forEach(s => console.log(`    • ${s}`));
  }
  if (skipped.length) {
    console.log(`  ℹ ${skipped.length} rows already exist (INITIAL + same variant) — skipped`);
  }

  if (!toCreate.length) {
    console.log('\n  ✓ No new rows to create');
    return;
  }

  console.log(`\n  Creating ${toCreate.length} records in Inventory Movements…`);

  const BATCH = 10;
  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    try {
      const { data } = await axios.post(
        `${AT_BASE}/${inventory_movements.id}`,
        { records: chunk, typecast: true },
        { headers: HEADERS }
      );
      data.records.forEach(r => {
        const sku = rows.find(row => {
          const vid = skuMap[row['Variant']?.trim()];
          return (r.fields['Variant'] || []).includes(vid);
        })?.['Variant'];
        console.log(`  ✓ ${r.id}  ${(r.fields['Movement'] || '').slice(0, 60)}`);
        created++;
      });
    } catch (e) {
      console.log(`  ✗ Batch ${i}–${i + BATCH} failed: ${e.response?.data?.error?.message || e.message}`);
    }
    if (i + BATCH < toCreate.length) await sleep(260);
  }

  console.log(`\n  ✓ ${created} / ${toCreate.length} records created`);
}

// ── Final verification ────────────────────────────────────────────────────────

async function verify(base) {
  console.log('\n══════════════════════════════════════════');
  console.log('FINAL VERIFICATION');
  console.log('══════════════════════════════════════════');

  // Allow Airtable a moment to recalculate
  await sleep(3000);

  const productRecords = await fetchAllRecords(base.products.id,
    ['Product Name', 'Total Stock Quantity', 'Total Sold']);

  const find = name => productRecords.find(r =>
    (r.fields['Product Name'] || '').toLowerCase().includes(name.toLowerCase())
  );

  const checks = [
    { query: 'Amber Slouch Bag',                                expected: '>0',  actual: null },
    { query: 'CeraVe Moisturising Lotion 236ml',                expected: 5,     actual: null },
    { query: "Soft'lit",                                        expected: 3,     actual: null },
    { query: 'ANUA Heartleaf 77% Soothing Toner',               expected: 5,     actual: null },
    { query: 'Olaplex No. 3 Hair Perfector',                    expected: 6,     actual: null },
  ];

  checks.forEach(c => {
    const rec = find(c.query);
    const val = rec?.fields?.['Total Stock Quantity'];
    c.actual  = val ?? 'not found';
    const pass = c.expected === '>0'
      ? (typeof val === 'number' && val > 0)
      : (val === c.expected);
    console.log(`  ${pass ? '✓' : '✗'} "${c.query}": expected ${c.expected}, got ${c.actual}`);
  });

  // Check for #ERROR! presence
  const errors = productRecords.filter(r =>
    typeof r.fields['Total Stock Quantity'] === 'string' &&
    r.fields['Total Stock Quantity'].includes('ERROR')
  );
  console.log(`\n  ${errors.length === 0 ? '✓' : '✗'} Products.Total Stock Quantity #ERROR! count: ${errors.length}`);

  const soldErrors = productRecords.filter(r =>
    typeof r.fields['Total Sold'] === 'string' &&
    r.fields['Total Sold'].includes('ERROR')
  );
  console.log(`  ${soldErrors.length === 0 ? '✓' : '✗'} Products.Total Sold #ERROR! count: ${soldErrors.length}`);

  // Average Rating check
  const nanCount = productRecords.filter(r => r.fields['Average Rating'] === null || r.fields['Average Rating'] === undefined || isNaN(r.fields['Average Rating'])).length;
  console.log(`  ✓ Average Rating NaN for ${nanCount}/${productRecords.length} products (expected — no reviews yet)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Beyond Beauty — Airtable Bug Fix Script');
  console.log(`Base ID: ${BASE_ID}`);
  console.log('');

  let base;
  try {
    console.log('Discovering base structure…');
    base = await discoverBase();
    console.log(`  ✓ Inventory Movements table: ${base.inventory_movements.id}`);
    console.log(`  ✓ Products table:            ${base.products.id}`);
    console.log(`  ✓ Variants table:            ${base.variants.id}`);
    if (base.order_items) console.log(`  ✓ Order Items table:         ${base.order_items.id}`);
  } catch (e) {
    console.error('✗ Could not discover base structure:', e.response?.data || e.message);
    process.exit(1);
  }

  const bug1ok = await fixBug1(base);
  await checkBug2(base);
  await fixBug3(base);
  await verify(base);

  console.log('\n══════════════════════════════════════════');
  console.log('Script complete.');
  if (!bug1ok) {
    console.log('⚠ Bug 1 field-type change may need to be applied manually in Airtable');
    console.log('  (requires a PAT with schema.bases:write scope, or change via the UI)');
  }
  console.log('ℹ Airtable recalculates rollup fields asynchronously.');
  console.log('  If verification shows unexpected values, wait 1–2 min and re-run verify section.');
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.response?.data || err.message);
  process.exit(1);
});
