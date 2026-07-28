require('dotenv').config();
const axios = require('axios');

// ── Config ────────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--upload');

const AIRTABLE_PRODUCTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AIRTABLE_VARIANTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const AT_HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Apply -5% margin and round to nearest KES 100
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Fetch ShopEve products ────────────────────────────────────────────────────
async function fetchShopifyProducts() {
  const all = [];
  let page = 1;
  console.log('Fetching products from ShopEve...\n');
  while (true) {
    const { data } = await axios.get(
      'https://shopeve.com/collections/the-ordinary/products.json',
      { params: { limit: 250, page } }
    );
    if (!data.products?.length) break;
    all.push(...data.products);
    console.log(`  Page ${page}: ${data.products.length} products`);
    if (data.products.length < 250) break;
    page++;
  }
  console.log(`\nTotal: ${all.length} products\n`);
  return all;
}

// ── Transform ─────────────────────────────────────────────────────────────────
function transformProduct(p) {
  // "Default Title" is Shopify's placeholder for products with no real variants
  const realVariants = p.variants.filter(v => v.title.toLowerCase() !== 'default title');
  const hasVariants = realVariants.length > 1; // only if 2+ real sizes exist

  const activeVariants = hasVariants ? realVariants : p.variants;

  // Main product price = lowest variant price with margin applied
  const lowestKES = Math.min(...activeVariants.map(v => parseFloat(v.price)));
  const priceKES = applyMargin(lowestKES);

  // All product images as Airtable attachments (Airtable downloads & re-hosts them)
  const attachments = (p.images || []).map(img => ({ url: img.src }));

  const productFields = {
    'Product Name': p.title,
    'Product Description': stripHtml(p.body_html),
    'Price (KES)': priceKES,
    'Product Category': 'Beauty',
    // Sub-Category skipped — field is a Single Select; add "Skincare" option in Airtable first, then backfill
    'Primary Image URL': attachments,
  };

  // Only create variant records for products with 2+ real sizes.
  // 'Colour' is the variant label field the frontend reads (used here for size labels).
  const variantFields = hasVariants ? realVariants.map(v => ({
    'Colour': v.title,
    'Price Override': applyMargin(v.price),
    'Stock Quantity': 0,
    'Active': true,
    // 'Products' linked field added after we have the product record ID
  })) : [];

  return { productFields, variantFields, title: p.title };
}

// ── Airtable batch create ─────────────────────────────────────────────────────
async function batchCreate(url, fieldsList) {
  const BATCH = 10;
  const createdRecords = [];
  for (let i = 0; i < fieldsList.length; i += BATCH) {
    const chunk = fieldsList.slice(i, i + BATCH);
    const { data } = await axios.post(
      url,
      { records: chunk.map(fields => ({ fields })) },
      { headers: AT_HEADERS }
    );
    createdRecords.push(...data.records);
    process.stdout.write(`  ${createdRecords.length}/${fieldsList.length}\r`);
    if (i + BATCH < fieldsList.length) await sleep(250); // Airtable: 5 req/s limit
  }
  process.stdout.write('\n');
  return createdRecords;
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function upload(transformed) {
  const missing = ['AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'AIRTABLE_VARIANTS_TABLE_ID', 'AIRTABLE_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // ── Step 1: Create main product records ──
  console.log(`Step 1/2 — Creating ${transformed.length} product records in Airtable...\n`);
  const productRecords = await batchCreate(
    AIRTABLE_PRODUCTS,
    transformed.map(t => t.productFields)
  );
  console.log(`  ✓ ${productRecords.length} products created\n`);

  // ── Step 2: Create variant records linked to each product ──
  const allVariantFields = [];
  productRecords.forEach((record, i) => {
    transformed[i].variantFields.forEach(vf => {
      allVariantFields.push({ ...vf, 'Products': [record.id] });
    });
  });

  const totalVariants = allVariantFields.length;
  console.log(`Step 2/2 — Creating ${totalVariants} variant records...\n`);
  const variantRecords = await batchCreate(AIRTABLE_VARIANTS, allVariantFields);
  console.log(`  ✓ ${variantRecords.length} variants created\n`);

  console.log(`Done. ${productRecords.length} products, ${variantRecords.length} variants uploaded.`);
}

// ── Dry-run preview ───────────────────────────────────────────────────────────
function preview(transformed) {
  const totalVariants = transformed.reduce((s, t) => s + t.variantFields.length, 0);
  console.log('─'.repeat(66));
  console.log(`DRY RUN — ${transformed.length} products, ${totalVariants} variant records`);
  console.log(`          (run with --upload to write to Airtable)`);
  console.log('─'.repeat(66) + '\n');

  transformed.forEach((t, i) => {
    const f = t.productFields;
    const variantsSummary = t.variantFields
      .map(v => `${v.Size} → KES ${v['Price Override'].toLocaleString()}`)
      .join(' | ');
    console.log(`[${i + 1}] ${f['Product Name']}`);
    console.log(`    Sub-category : ${f['Sub-Category'] || '—'}`);
    console.log(`    Base price   : KES ${f['Price (KES)'].toLocaleString()} (lowest size, after -5%)`);
    console.log(`    Variants     : ${variantsSummary}`);
    console.log(`    Images       : ${f['Primary Image URL'].length}`);
    console.log();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nBeyond Beauty KE — The Ordinary Import');
  console.log(`Pricing : ShopEve KES × 0.95, rounded to nearest KES 100`);
  console.log(`Mode    : ${DRY_RUN ? 'DRY RUN' : 'UPLOAD'}\n`);

  const shopifyProducts = await fetchShopifyProducts();
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
