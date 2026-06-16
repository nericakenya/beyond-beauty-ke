/**
 * Fix Bug 3 (Part 2) — Create missing Variant records then Inventory Movements
 *
 * The original fix-airtable-bugs.js created 26 Fenty records but skipped 84 rows
 * because the Variant records didn't exist in the Variants table.
 * This script creates those Variant records first, then creates the Inventory Movements.
 */

require('dotenv').config();
const axios = require('axios');
const fs    = require('fs');

const BASE_ID       = process.env.AIRTABLE_BASE_ID;
const TOKEN         = process.env.AIRTABLE_TOKEN;
const HEADERS       = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const AT_BASE       = `https://api.airtable.com/v0/${BASE_ID}`;

const PRODUCTS_TABLE  = process.env.AIRTABLE_TABLE_ID;           // tbleE0hPVfKi0xVLA
const VARIANTS_TABLE  = process.env.AIRTABLE_VARIANTS_TABLE_ID;  // tblnUje4pZyI53p2C
const MOVEMENTS_TABLE = 'tblQ7JNyChQuSay0a';

const CSV_PATH = '/Users/nericakuguru/Downloads/BB_Missing_Stock_Entries.csv';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── SKU → { productId, variantFields } ───────────────────────────────────────
// productId values from live Airtable fetch on 2026-06-15
const SKU_MAP = {
  // CeraVe
  'BB-CVML-DEF':   { productId: 'recDb3DcF0jGQJI4Q' },
  'BB-CVNC-DEF':   { productId: 'rec1zSkT16HPPcgPU' },
  'BB-CVHO-DEF':   { productId: 'recVJjkVeGSwgYx41' },
  'BB-CVAFC-DEF':  { productId: 'recFZGmX44Fl1rojg' },
  'BB-CVOC-DEF':   { productId: 'recw6J0GHCENoBxec' },  // Oil Control Moisturising Gel-Cream
  'BB-CVACC-DEF':  { productId: 'recLAtprQc9kP1aYj' },
  'BB-CVRTS-DEF':  { productId: 'recAf8XDuWJZJbX0s' },
  'BB-CVDC-DEF':   { productId: 'recadw5i4TZtXFlZx' },  // Skin Renewing Day Cream SPF 30
  'BB-CVAM-DEF':   { productId: 'recDfjWLNPI8bWopU' },  // AM Facial Moisturising Lotion

  // La Roche-Posay
  'BB-LRPED-DEF':  { productId: 'recwGfQm9p5zR35xG' },  // Effaclar Duo(+) SPF 30
  'BB-LRPRB-DEF':  { productId: 'recgKOua7gOnB6c9l' },
  'BB-LRPCB-DEF':  { productId: 'recVQT66N9qAYqJil' },
  'BB-LRPLS-DEF':  { productId: 'reccodW3xPkkOmgow' },  // Lipikar Syndet AP+ Refill
  'BB-LRPAN-DEF':  { productId: 'recI6hwUlxlipf1vh' },  // Anthelios Sunscreen

  // The Ordinary
  'BB-TONZ-DEF':   { productId: 'reck9eVSsPF3jm8iR' },
  'BB-TOHA-DEF':   { productId: 'recJkIh0lSCjMOXEj' },
  'BB-TOBP-DEF':   { productId: 'recbvQretVovZorqz' },
  'BB-TOAA-DEF':   { productId: 'recowkLH0sQTUJBAB' },
  'BB-TOAC-DEF':   { productId: 'recb5v1zc0nlJXi0P' },
  'BB-TOSA-DEF':   { productId: 'recBmSQxME8PD0rag' },
  'BB-TOLA-DEF':   { productId: 'rec3JmoLvGNr0u2pH' },
  'BB-TOGA-DEF':   { productId: 'recWJ38o5Pdu4ygP8' },
  'BB-TOSQ-DEF':   { productId: 'rec4x7s4ioJJUbYzQ' },

  // COSRX
  'BB-CSAS-DEF':   { productId: 'recxxKkGui7F7roSd' },  // Advanced Snail 96 Mucin Power Essence
  'BB-CSAC-DEF':   { productId: 'reckEhQ2mvQVkRaSt' },  // Advanced Snail 92 All-In-One Cream
  'BB-CSSC-DEF':   { productId: 'recyoFYzscBdg3FsW' },

  // Sol de Janeiro
  'BB-SDBBBC-DEF': { productId: 'recfIYEHXthKd8y7S' },  // Brazilian Bum Bum® Cream
  'BB-SDBFE-DEF':  { productId: 'recLmMJjzm3pQay3F' },  // Beija Flor™ Elasti-Cream
  'BB-SDBCM-DEF':  { productId: 'receINlC7uTm9l9tx' },  // Cheirosa™ Perfume Mist

  // Estée Lauder
  'BB-ELANR-115':  { productId: 'recMOARvUoPQLCQW6' },  // Advanced Night Repair 115ml
  'BB-ELANRE-DEF': { productId: 'recWWC0cTuHvi7drv' },  // ANR Eye Supercharged Gel-Creme
  'BB-ELPPRF-DEF': { productId: 'recOIqRYbP9SRVP56' },  // Perfectionist Pro Rapid Firm + Lift
  'BB-ELNREL-DEF': { productId: 'recFUPXuAC0Ox83pH' },  // Nutritious Radiant Essence Lotion
  'BB-ELDWM-DEF':  { productId: 'recCouv9AIOjWkk4e' },  // DayWear Matte Oil-Control Gel Crème
  'BB-ELRSEB-DEF': { productId: 'rec13ksRb7b2NKqWA' },  // Revitalizing Supreme+ Eye Balm
  'BB-ELRMN-DEF':  { productId: 'recXHkXRGc5JUwrho' },  // Resilience Multi-Effect Night
  'BB-ELNAL-DEF':  { productId: 'recPIAAhsBaXA5fhv' },  // Nutritious Airy Lotion Moisturizer

  // Medicube
  'BB-MCZFC-DEF':  { productId: 'recbjGqP3bmxZGSNf' },
  'BB-MCZPP-DEF':  { productId: 'recS57fwRuOJYbeoj' },
  'BB-MCTCS-DEF':  { productId: 'recyf7FIGue8Xnq4U' },
  'BB-MCCJC-DEF':  { productId: 'recH21ji6ydWBQ0UU' },
  'BB-MCZPB-DEF':  { productId: 'recnYUT1FuDUHHghe' },
  'BB-MCPDRN-DEF': { productId: 'recplmY2Vidtw6JvJ' },
  'BB-MCEXO-DEF':  { productId: 'recLPU5M4qyDZ4g97' },

  // ANUA
  'BB-ANHL77-DEF': { productId: 'recR0ZcUXCNxai6oD' },
  'BB-ANHL70-DEF': { productId: 'recbjOoPSVlHTJLQ7' },
  'BB-ANPN-DEF':   { productId: 'recLGWEiG2y376u3a' },
  'BB-ANDS-DEF':   { productId: 'recarv7DAhv4NPoDk' },  // Dark Spot Correcting Serum (full name)
  'BB-ANAA-DEF':   { productId: 'rec1QG09u51DVW1kk' },
  'BB-ANNR-DEF':   { productId: 'recASjqUVfpxpR6Zk' },
  'BB-ANRE-DEF':   { productId: 'recvrk5f8YyfM1df7' },
  'BB-ANRC-DEF':   { productId: 'recjixnfKtzrmpdGl' },

  // Advanced Clinicals
  'BB-ACRF-DEF':   { productId: 'recrTLZPFth3YctYs' },  // Retinol Firming Cream (Fragrance-Free)
  'BB-ACVC-DEF':   { productId: 'recquUFc6REsrEZcP' },
  'BB-ACGL-DEF':   { productId: 'recZeecKcn6qqx1Z3' },  // 10% Glycolic + Lactic Acid Exfoliating Body Cream

  // Beauty of Joseon
  'BB-BOJGE-DEF':  { productId: 'recGAZHH0girpkfYx' },
  'BB-BOJRS-DEF':  { productId: 'recNsxL4beQfjmICZ' },  // Relief Sun: Rice + Probiotics
  'BB-BOJGS-DEF':  { productId: 'recT4N9dxClqwLqJU' },  // Glow Serum: Propolis + Niacinamide
  'BB-BOJDC-DEF':  { productId: 'recrqAaf1GbN0GBRo' },

  // Dr. Althea
  'BB-DARC-DEF':   { productId: 'rec6b426z7NMwzorO' },  // 345 Relief Cream
  'BB-DABC-DEF':   { productId: 'recOF5eaUSG8NFhTL' },  // 147 Barrier Cream
  'BB-DAVCS-DEF':  { productId: 'recIULTRL6LoccCtl' },  // Vitamin C Boosting Serum
  'BB-DACB-DEF':   { productId: 'rec4XddkfqB9iK9iy' },  // Pure Grinding Cleansing Balm

  // Olaplex
  'BB-OLP0-DEF':   { productId: 'recNLAr6gVIwK645F' },  // Nº.0 Intensive Bond Builder
  'BB-OLP3-100':   { productId: 'rec3JeJWAI3Psobmv', size: '100ml' },  // Nº.3 Hair Perfector
  'BB-OLP3-250':   { productId: 'rec3JeJWAI3Psobmv', size: '250ml' },
  'BB-OLP4-DEF':   { productId: 'rec8APEwdLaDE5mqX' },  // Nº.4 Shampoo
  'BB-OLP5-DEF':   { productId: 'recSzv4f38qaGA9P6' },  // Nº.5 Conditioner
  'BB-OLP8-DEF':   { productId: 'recoc6YrtR1ayG6kq' },  // Nº.8 Moisture Mask

  // Naturium
  'BB-NATVC-DEF':  { productId: 'recz6WRrjiWx7TEoA' },
  'BB-NATTA-DEF':  { productId: 'recqYjNvoJbiCsgiO' },
  'BB-NATMP-DEF':  { productId: 'recPZOb88kg9bFTK2' },
  'BB-NATMPM-DEF': { productId: 'recrT2yQOcEDsK2wO' },
  'BB-NATNG-DEF':  { productId: 'recHPj4PvNmK7s1Dk' },
  'BB-NATDG-DEF':  { productId: 'reca0016Uy1Y5j2k8' },
  'BB-NATGA-DEF':  { productId: 'recS9XkH6HS9DHKqS' },  // Glycolic Acid Exfoliating Body Wash
  'BB-NATKP-DEF':  { productId: 'recVg1tc5szHgKIt7' },  // KP Body Scrub & Mask

  // Saltair
  'BB-SALAHA-DEF': { productId: 'rec96uZ13Ze2VGRML' },

  // Laneige
  'BB-LANLSM-BERRY':   { productId: 'recokNrm7lT2K3xmN', colour: 'Berry' },
  'BB-LANLSM-VANILLA': { productId: 'recokNrm7lT2K3xmN', colour: 'Vanilla' },
  'BB-LANCSR-DEF':     { productId: 'recOF2HeEH63Br8se' },
  'BB-LANGC-DEF':      { productId: 'recvvFTlcy20PbwCg' },
  'BB-LANBF-DEF':      { productId: 'rec643fNI8dV5bhjU' },  // Bouncy & Firm Sleeping Mask
};

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
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

// ── Batch helpers ─────────────────────────────────────────────────────────────

async function batchCreate(tableId, records, label) {
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
      data.records.forEach(r => {
        const key = Object.values(r.fields).find(v => typeof v === 'string' && v.length < 60) || r.id;
        console.log(`  ✓ ${label}: ${r.id}`);
      });
    } catch (e) {
      console.log(`  ✗ Batch ${i}–${i + BATCH} failed: ${e.response?.data?.error?.message || e.message}`);
    }
    if (i + BATCH < records.length) await sleep(260);
  }
  return created;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Beyond Beauty — Bug 3 Part 2: Create missing Variants + Inventory Movements');
  console.log(`Base: ${BASE_ID}\n`);

  // Load CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  const nonFenty = rows.filter(r => !r.Movement.includes('Fenty'));
  console.log(`${nonFenty.length} non-Fenty rows in CSV`);

  // Fetch existing Variant SKUs to avoid duplicates
  console.log('\nFetching existing Variant SKUs…');
  const existingVariants = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['SKU'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${VARIANTS_TABLE}`, { headers: HEADERS, params });
    existingVariants.push(...data.records);
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);

  const existingSkus = new Set(existingVariants.map(r => r.fields.SKU).filter(Boolean));
  console.log(`${existingSkus.size} variant SKUs already exist`);

  // Build list of variants to create
  const variantsToCreate = [];
  const unmapped = [];

  for (const row of nonFenty) {
    const sku = row['Variant']?.trim();
    if (!sku) continue;
    if (existingSkus.has(sku)) {
      console.log(`  skip (exists): ${sku}`);
      continue;
    }

    const mapping = SKU_MAP[sku];
    if (!mapping) {
      unmapped.push(sku);
      continue;
    }

    const fields = {
      'SKU':      sku,
      'Active':   true,
      'Products': [mapping.productId],
    };
    if (mapping.size)   fields['Size']   = mapping.size;
    if (mapping.colour) fields['Colour'] = mapping.colour;

    variantsToCreate.push({ sku, row, fields });
  }

  if (unmapped.length) {
    console.log(`\n⚠ ${unmapped.length} SKUs not in SKU_MAP — will be skipped:`);
    unmapped.forEach(s => console.log(`  • ${s}`));
  }

  console.log(`\n══ Creating ${variantsToCreate.length} Variant records ══`);
  const variantRecords = await batchCreate(
    VARIANTS_TABLE,
    variantsToCreate.map(v => ({ fields: v.fields })),
    'Variant'
  );

  // Build SKU → new variantId map
  const newSkuToId = {};
  variantRecords.forEach((r, i) => {
    const sku = variantsToCreate[i]?.sku;
    if (sku) newSkuToId[sku] = r.id;
  });

  // Also build full SKU map (existing + new)
  existingVariants.forEach(r => {
    if (r.fields.SKU) newSkuToId[r.fields.SKU] = r.id;
  });

  // Now create Inventory Movements for all non-Fenty rows (skip if already exists)
  console.log('\nChecking existing INITIAL Inventory Movements…');
  const existingMovements = [];
  offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Reference', 'Variant'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${MOVEMENTS_TABLE}`, { headers: HEADERS, params });
    existingMovements.push(...data.records);
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);

  const existingMovementVariants = new Set();
  existingMovements.forEach(r => {
    if (r.fields['Reference'] === 'INITIAL' && (r.fields['Variant'] || []).length) {
      existingMovementVariants.add(r.fields['Variant'][0]);
    }
  });
  console.log(`${existingMovementVariants.size} INITIAL movements already exist`);

  const movementsToCreate = [];
  const movementSkipped = [];

  for (const row of nonFenty) {
    const sku = row['Variant']?.trim();
    if (!sku) continue;

    const varId = newSkuToId[sku];
    if (!varId) { continue; } // unmapped or failed creation

    if (existingMovementVariants.has(varId)) {
      movementSkipped.push(sku);
      continue;
    }

    movementsToCreate.push({
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

  if (movementSkipped.length) {
    console.log(`${movementSkipped.length} movements already exist — skipped`);
  }

  console.log(`\n══ Creating ${movementsToCreate.length} Inventory Movement records ══`);
  await batchCreate(MOVEMENTS_TABLE, movementsToCreate, 'Movement');

  // ── Verification ──────────────────────────────────────────────────────────
  console.log('\n══ Verification — allow 3s for Airtable recalc ══');
  await sleep(3000);

  const productRecords = [];
  offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Product Name', 'Total Stock Quantity'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(`${AT_BASE}/${PRODUCTS_TABLE}`, { headers: HEADERS, params });
    productRecords.push(...data.records);
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);

  const checks = [
    'CeraVe Moisturising Lotion',
    'La Roche-Posay Cicaplast',
    'The Ordinary Niacinamide',
    'COSRX Advanced Snail 96',
    'Sol de Janeiro Brazilian',
    'Estée Lauder Advanced Night Repair Synchronized',
    'Medicube Zero Foam',
    'ANUA Heartleaf 77',
    'Advanced Clinicals Retinol',
    'Beauty of Joseon Ginseng',
    'Dr. Althea 345',
    'Olaplex Nº.3',
    'Naturium Vitamin C',
    'Saltair',
    'Laneige Lip Sleeping Mask',
  ];

  const errors = [];
  checks.forEach(query => {
    const rec = productRecords.find(r => (r.fields['Product Name'] || '').includes(query));
    const qty = rec?.fields?.['Total Stock Quantity'];
    const ok  = typeof qty === 'number' && qty > 0;
    const status = ok ? '✓' : (qty === null || qty === undefined) ? '?' : '✗';
    console.log(`  ${status} "${query}": ${qty ?? 'null'}`);
    if (!ok) errors.push(query);
  });

  const errorCount = productRecords.filter(r =>
    typeof r.fields['Total Stock Quantity'] === 'string' &&
    r.fields['Total Stock Quantity'].includes('ERROR')
  ).length;

  console.log(`\n  ${errorCount === 0 ? '✓' : '✗'} #ERROR! count in Total Stock Quantity: ${errorCount}`);

  if (errors.length) {
    console.log(`\n  ⚠ ${errors.length} products still show no stock — Airtable may still be recalculating.`);
    console.log('  Wait 1–2 minutes and check the Products table in Airtable.');
  } else {
    console.log('\n  ✓ All spot-checks pass. Bug 3 complete.');
  }
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.response?.data || err.message);
  process.exit(1);
});
