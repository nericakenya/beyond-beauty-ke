// Generic Shopify collection → Airtable importer for Beyond Beauty KE.
// Usage:
//   node scripts/import-collection.js --url <shopify-collection-url> [--upload]
//
// Examples:
//   node scripts/import-collection.js --url https://shopeve.com/collections/the-ordinary
//   node scripts/import-collection.js --url https://glowsecret.co.ke/collections/cosrx --upload

require('dotenv').config();
const axios = require('axios');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
if (urlIdx === -1 || !args[urlIdx + 1]) {
  console.error('Usage: node scripts/import-collection.js --url <shopify-collection-url> [--upload]');
  process.exit(1);
}
const SOURCE_URL = args[urlIdx + 1].split('?')[0]; // strip query params
const DRY_RUN   = !args.includes('--upload');

// ── Airtable config ───────────────────────────────────────────────────────────
const AT_PRODUCTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AT_VARIANTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const AT_HEADERS  = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function applyMargin(kesPrice) {
  return Math.round((parseFloat(kesPrice) * 0.95) / 100) * 100;
}

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Normalize size labels to match Airtable Size field options (e.g. "100 mL" → "100ml")
function normalizeSize(title) {
  const match = title.match(/(\d+)\s*ml/i);
  return match ? `${match[1]}ml` : title;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch Shopify products ────────────────────────────────────────────────────
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchShopifyProducts(baseUrl) {
  const all = [];
  let page = 1;
  while (true) {
    const { data } = await axios.get(`${baseUrl}/products.json`, {
      params: { limit: 250, page },
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (!data.products?.length) break;
    all.push(...data.products);
    console.log(`  Page ${page}: ${data.products.length} products`);
    if (data.products.length < 250) break;
    page++;
  }
  return all;
}

// ── Transform ─────────────────────────────────────────────────────────────────
function transformProduct(p) {
  const realVariants = p.variants.filter(v => v.title.toLowerCase() !== 'default title');
  const hasVariants  = realVariants.length > 1;
  const activeVariants = hasVariants ? realVariants : p.variants;

  const lowestKES = Math.min(...activeVariants.map(v => parseFloat(v.price)));
  const priceKES  = applyMargin(lowestKES);

  // Sale price: if first variant has compare_at_price > price
  const base = p.variants[0];
  let salePriceKES = null;
  if (base.compare_at_price && parseFloat(base.compare_at_price) > parseFloat(base.price)) {
    salePriceKES = applyMargin(base.price);
  }

  const attachments = (p.images || []).map(img => ({ url: img.src }));

  const productFields = {
    'Product Name':        p.title,
    'Product Description': stripHtml(p.body_html),
    'Price (KES)':         priceKES,
    'Product Category':    'Beauty',
    'Sub-Category':        'Skincare',
    'Primary Image URL':   attachments,
  };

  if (salePriceKES) productFields['Sale Price'] = salePriceKES;

  // Variant records — deduplicate by normalized size label, keep first occurrence
  const seenSizes = new Set();
  const dedupedVariants = hasVariants
    ? realVariants.filter(v => {
        const s = normalizeSize(v.title);
        if (seenSizes.has(s)) return false;
        seenSizes.add(s);
        return true;
      })
    : [];
  const variantFields = dedupedVariants.length > 1
    ? dedupedVariants.map(v => ({
        'Size':           normalizeSize(v.title),
        'Price Override': applyMargin(v.price),
        'Active':         true,
      }))
    : []; // collapsed to single product if all sizes were duplicates

  return { productFields, variantFields, title: p.title };
}

// ── Airtable batch helpers ────────────────────────────────────────────────────
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

// ── Upload ────────────────────────────────────────────────────────────────────
async function upload(transformed) {
  const missing = ['AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'AIRTABLE_VARIANTS_TABLE_ID', 'AIRTABLE_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  // Step 1: main product records
  console.log(`Step 1/2 — Creating ${transformed.length} product records...\n`);
  const productRecords = await batchCreate(AT_PRODUCTS, transformed.map(t => t.productFields));
  console.log(`  ✓ ${productRecords.length} products created\n`);

  // Step 2: variant records linked to their product
  const allVariantFields = [];
  productRecords.forEach((rec, i) => {
    transformed[i].variantFields.forEach(vf => {
      allVariantFields.push({ ...vf, 'Products': [rec.id] });
    });
  });

  if (allVariantFields.length > 0) {
    console.log(`Step 2/2 — Creating ${allVariantFields.length} variant records...\n`);
    const variantRecords = await batchCreate(AT_VARIANTS, allVariantFields);
    console.log(`  ✓ ${variantRecords.length} variants created\n`);
  } else {
    console.log('Step 2/2 — No variant records needed.\n');
  }

  console.log(`Done. ${productRecords.length} products uploaded.`);
}

// ── Dry-run preview ───────────────────────────────────────────────────────────
function preview(transformed) {
  const totalVariants = transformed.reduce((s, t) => s + t.variantFields.length, 0);
  console.log('─'.repeat(66));
  console.log(`DRY RUN — ${transformed.length} products, ${totalVariants} variant records`);
  console.log(`          Run with --upload to write to Airtable.`);
  console.log('─'.repeat(66) + '\n');
  transformed.forEach((t, i) => {
    const f = t.productFields;
    const varStr = t.variantFields.length
      ? t.variantFields.map(v => `${v.Size} → KES ${v['Price Override'].toLocaleString()}`).join(' | ')
      : `KES ${f['Price (KES)'].toLocaleString()} (no size variants)`;
    console.log(`[${i + 1}] ${f['Product Name']}`);
    console.log(`    ${varStr}`);
    console.log(`    Images: ${f['Primary Image URL'].length}`);
    console.log();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nBeyond Beauty KE — Collection Import');
  console.log(`Source  : ${SOURCE_URL}`);
  console.log(`Pricing : source KES × 0.95, rounded to nearest KES 100`);
  console.log(`Mode    : ${DRY_RUN ? 'DRY RUN' : 'UPLOAD'}\n`);

  console.log('Fetching products...\n');
  const shopifyProducts = await fetchShopifyProducts(SOURCE_URL);
  console.log(`Total: ${shopifyProducts.length} products\n`);

  const transformed = shopifyProducts.map(transformProduct);

  if (DRY_RUN) {
    preview(transformed);
  } else {
    await upload(transformed);
  }
}

main().catch(err => {
  console.error('\nFatal:', err.response?.data || err.message);
  process.exit(1);
});
