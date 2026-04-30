// One-time script: create variant records for The Ordinary products already in Airtable.
// Matches Shopify product names → Airtable record IDs, then creates linked variant records.
require('dotenv').config();
const axios = require('axios');

const AIRTABLE_PRODUCTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AIRTABLE_VARIANTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const AT_HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

function applyMargin(kesPrice) {
  return Math.round((parseFloat(kesPrice) * 0.95) / 100) * 100;
}

// Normalize ShopEve's inconsistent size labels ("100mL", "100 ml", "30 mL") → "100ml"
function normalizeSize(title) {
  const match = title.match(/(\d+)\s*ml/i);
  return match ? `${match[1]}ml` : title;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchShopifyProducts() {
  const { data } = await axios.get(
    'https://shopeve.com/collections/the-ordinary/products.json',
    { params: { limit: 250 } }
  );
  return data.products;
}

async function fetchAirtableProductsByName(names) {
  // Fetch all products, then filter by name
  const all = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Product Name'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(AIRTABLE_PRODUCTS, { headers: AT_HEADERS, params });
    all.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  const nameSet = new Set(names);
  return all.filter(r => nameSet.has(r.fields['Product Name']));
}

async function batchCreate(url, fieldsList) {
  const BATCH = 10;
  const created = [];
  for (let i = 0; i < fieldsList.length; i += BATCH) {
    const chunk = fieldsList.slice(i, i + BATCH);
    const { data } = await axios.post(
      url,
      { records: chunk.map(fields => ({ fields })) },
      { headers: AT_HEADERS }
    );
    created.push(...data.records);
    process.stdout.write(`  ${created.length}/${fieldsList.length}\r`);
    if (i + BATCH < fieldsList.length) await sleep(250);
  }
  process.stdout.write('\n');
  return created;
}

async function main() {
  console.log('\nBeyond Beauty KE — The Ordinary Variant Upload\n');

  // 1. Fetch Shopify products and build variant data
  console.log('Fetching Shopify products...');
  const shopifyProducts = await fetchShopifyProducts();

  // Only products with 2+ real size variants
  const productsWithVariants = shopifyProducts
    .map(p => ({
      title: p.title,
      variants: p.variants.filter(v => v.title.toLowerCase() !== 'default title'),
    }))
    .filter(p => p.variants.length > 1);

  console.log(`  ${productsWithVariants.length} products have size variants\n`);

  // 2. Fetch matching Airtable records to get their IDs
  console.log('Fetching Airtable product records...');
  const names = productsWithVariants.map(p => p.title);
  const airtableRecords = await fetchAirtableProductsByName(names);

  // Build name → record ID map
  const nameToId = {};
  airtableRecords.forEach(r => { nameToId[r.fields['Product Name']] = r.id; });

  const matched = productsWithVariants.filter(p => nameToId[p.title]);
  const unmatched = productsWithVariants.filter(p => !nameToId[p.title]);

  if (unmatched.length) {
    console.warn(`  Warning: ${unmatched.length} products not found in Airtable:`);
    unmatched.forEach(p => console.warn(`    - ${p.title}`));
  }
  console.log(`  Matched ${matched.length} products\n`);

  // 3. Build variant records
  const allVariantFields = [];
  matched.forEach(p => {
    p.variants.forEach(v => {
      allVariantFields.push({
        'Size': normalizeSize(v.title),
        'Price Override': applyMargin(v.price),
        'Active': true,
        'Products': [nameToId[p.title]],
      });
    });
  });

  console.log(`Creating ${allVariantFields.length} variant records...\n`);
  const created = await batchCreate(AIRTABLE_VARIANTS, allVariantFields);
  console.log(`\nDone. ${created.length} variant records created.`);
}

main().catch(err => {
  console.error('\nFatal:', err.response?.data || err.message);
  process.exit(1);
});
