require('dotenv').config();
const axios = require('axios');

const VARIANTS_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const PRODUCTS_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Generate a short product code from a product name.
// Strips brand prefixes, removes vowels from key words, caps at 4 chars.
function productCode(name) {
  const stopWords = /^(fenty|beauty|the|ordinary|la|roche-posay|country|road|poetry|cosrx|loreal|by|and|with|for|in|of|a|an)$/i;
  const words = name
    .replace(/['''\-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/[^a-z]/gi, ''))
    .filter(w => w.length > 1 && !stopWords.test(w));

  // Take first consonant-heavy chars from each word, cap at 4 words
  const code = words
    .slice(0, 4)
    .map(w => w.replace(/[aeiou]/gi, '').slice(0, 2) || w.slice(0, 1))
    .join('')
    .toUpperCase()
    .slice(0, 5);

  return code || name.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase();
}

// Slugify a colour/size/texture value for use as SKU suffix
function variantCode(v) {
  if (!v) return 'DEF';
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 15);
}

async function fetchAll(url, fields) {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': fields };
    if (offset) params.offset = offset;
    const { data } = await axios.get(url, { headers: HEADERS, params });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

async function batchPatch(records) {
  const BATCH = 10;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await axios.patch(VARIANTS_URL, { records: chunk }, { headers: HEADERS });
    if (i + BATCH < records.length) await sleep(260);
  }
}

async function run() {
  // 1. Fetch all variants and products
  const [variants, products] = await Promise.all([
    fetchAll(VARIANTS_URL, ['SKU', 'Colour', 'Size', 'Texture', 'Products']),
    fetchAll(PRODUCTS_URL, ['Product Name']),
  ]);

  const productNames = {};
  products.forEach(p => { productNames[p.id] = p.fields['Product Name'] || ''; });

  // 2. Identify blanks
  const blank = variants.filter(r => !r.fields['SKU']);
  console.log(`Variants total: ${variants.length} | Missing SKU: ${blank.length}`);

  // 3. Track used SKUs to avoid duplicates within this run
  const used = new Set(variants.filter(r => r.fields['SKU']).map(r => r.fields['SKU']));

  // 4. Build patches
  const patches = blank.map(r => {
    const f = r.fields;
    const productId = (f['Products'] || [])[0] || '';
    const name = productNames[productId] || '';
    const pCode = productCode(name);
    const vAttr = f['Colour'] || f['Size'] || f['Texture'];
    const vCode = variantCode(vAttr);
    let sku = `BB-${pCode}-${vCode}`;

    // Deduplicate: append counter if collision
    if (used.has(sku)) {
      let i = 2;
      while (used.has(`${sku}-${i}`)) i++;
      sku = `${sku}-${i}`;
    }
    used.add(sku);

    return { id: r.id, fields: { SKU: sku } };
  });

  // 5. Preview
  console.log('\nSample SKUs to be written:');
  patches.slice(0, 10).forEach(p => {
    const v = blank.find(r => r.id === p.id);
    const name = productNames[(v.fields['Products'] || [])[0]] || '(no product)';
    console.log(`  ${p.fields.SKU}  ← ${name.slice(0, 50)} [${v.fields['Colour'] || v.fields['Size'] || 'DEF'}]`);
  });

  // 6. Write
  console.log(`\nPatching ${patches.length} variants…`);
  await batchPatch(patches);
  console.log('✓ Done — all blank SKUs filled.');
}

run().catch(err => {
  console.error('✗', err.response?.data || err.message);
  process.exit(1);
});
