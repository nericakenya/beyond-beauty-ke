// 1. Create a "Brand" Single Select field via Airtable Meta API
// 2. Populate Brand from Sub-Category (PRD products) or Product Name prefix (pre-existing products)
// 3. Correct Product Category where it differs from user's spec
require('dotenv').config();
const axios = require('axios');

const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const META_URL = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`;
const HEADERS  = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const sleep    = ms => new Promise(r => setTimeout(r, ms));

// Brand names that were (incorrectly) stored in Sub-Category by the seed scripts
const BRANDS_IN_SUBCATEGORY = new Set([
  'Sol de Janeiro', 'Estée Lauder', 'Medicube', 'ANUA', 'Advanced Clinicals',
  'Beauty of Joseon', 'Olaplex', 'Naturium', 'Saltair', 'Laneige', 'Dr. Althea',
]);

// Brands whose names appear at the START of Product Name (pre-existing records)
const BRAND_NAME_PREFIXES = [
  'The Ordinary', 'Fenty Beauty', 'COSRX', 'CeraVe',
  'Sol de Janeiro', 'Estée Lauder', 'Medicube', 'ANUA',
  'Beauty of Joseon', 'Olaplex', 'Naturium', 'Saltair', 'Laneige',
  'Dr. Althea', 'Advanced Clinicals',
];

// Correct Product Category per brand (from user's spec)
const BRAND_CATEGORY = {
  'The Ordinary':       'Skincare',
  'Fenty Beauty':       'Make-up',
  'Sol de Janeiro':     'Skincare',
  'Estée Lauder':       'Skincare',
  'Medicube':           'Skincare',
  'ANUA':               'Skincare',
  'Advanced Clinicals': 'Skincare',
  'Beauty of Joseon':   'Skincare',
  'Olaplex':            'Hair Care',
  'Naturium':           'Skincare',
  'Saltair':            'Skincare',
  'Laneige':            'Beauty',
  'Dr. Althea':         'Skincare',
};

function detectBrand(record) {
  const subCat = (record.fields['Sub-Category'] || '').trim();
  const name   = (record.fields['Product Name']  || '').trim();

  if (BRANDS_IN_SUBCATEGORY.has(subCat)) return subCat;

  for (const brand of BRAND_NAME_PREFIXES) {
    if (name === brand || name.startsWith(brand + ' ') || name.startsWith(brand + ':')) {
      return brand;
    }
  }
  return null;
}

async function createBrandField() {
  try {
    await axios.post(META_URL, {
      name: 'Brand',
      type: 'singleSelect',
      options: {
        choices: Object.keys(BRAND_CATEGORY).map(name => ({ name })),
      },
    }, { headers: HEADERS });
    console.log('  ✓ Brand field created');
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.response?.data || e.message;
    if (e.response?.status === 422) {
      console.log('  ℹ Brand field already exists — continuing with data population');
    } else if (e.response?.status === 403) {
      console.log('  ℹ Meta API not permitted (token lacks schema.bases:write scope)');
      console.log('  → Please create a "Brand" (Single Select) field manually in Airtable first,');
      console.log('    then re-run this script to populate it.');
      return false;
    } else {
      throw new Error(`Meta API error: ${JSON.stringify(msg)}`);
    }
  }
  return true;
}

async function run() {
  console.log('Step 1 — Creating Brand field via Meta API...');
  const canContinue = await createBrandField();
  if (!canContinue) process.exit(0);

  console.log('\nStep 2 — Fetching all product records...');
  let records = [];
  let offset;
  do {
    const params = { fields: ['Product Name', 'Product Category', 'Sub-Category'], pageSize: 100 };
    if (offset) params.offset = offset;
    const { data } = await axios.get(BASE_URL, { headers: HEADERS, params });
    records.push(...data.records);
    offset = data.offset;
    if (offset) await sleep(200);
  } while (offset);
  console.log(`  ${records.length} records fetched`);

  console.log('\nStep 3 — Building patch list...');
  const patches = [];
  let skipped   = 0;

  for (const rec of records) {
    const brand = detectBrand(rec);
    if (!brand) { skipped++; continue; }

    const currentCat = rec.fields['Product Category'] || '';
    const correctCat = BRAND_CATEGORY[brand];
    const fields     = { Brand: brand };

    if (correctCat && currentCat !== correctCat) {
      fields['Product Category'] = correctCat;
      console.log(`  ↺ Category ${currentCat} → ${correctCat}  [${(rec.fields['Product Name']||'').slice(0,40)}]`);
    }

    patches.push({ id: rec.id, fields });
  }

  console.log(`  ${patches.length} records to patch, ${skipped} skipped (no brand detected)\n`);

  console.log('Step 4 — Patching records...');
  const BATCH = 10;
  let done = 0;
  for (let i = 0; i < patches.length; i += BATCH) {
    const chunk = patches.slice(i, i + BATCH);
    const { data } = await axios.patch(BASE_URL, { records: chunk, typecast: true }, { headers: HEADERS });
    data.records.forEach(r => {
      console.log(`  ✓ ${r.fields.Brand}  |  ${(r.fields['Product Name'] || '').slice(0, 50)}`);
      done++;
    });
    if (i + BATCH < patches.length) await sleep(260);
  }

  console.log(`\n✓ Done. Brand field populated for ${done} records.`);
  if (skipped) {
    console.log(`  ${skipped} records had no detectable brand (non-product records like Bags, Frames, etc.)`);
  }
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
