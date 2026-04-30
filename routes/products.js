const express = require('express');
const router = express.Router();
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');

const AIRTABLE_BASE     = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AIRTABLE_VARIANTS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const AIRTABLE_HEADERS  = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` });

// ── In-memory cache (5-minute TTL) ──
const CACHE_TTL = 5 * 60 * 1000;
let cache         = { data: null, fetchedAt: 0 };
let variantsCache = {}; // keyed by product record ID

function mapVariantRecord(record) {
  const f = record.fields;
  const attachments = Array.isArray(f['Variant Image']) ? f['Variant Image'] : [];
  return {
    id:                         record.id,
    sku:                        f['SKU']            || null,
    colour:                     f['Colour']         || null,
    size:                       f['Size']           || null,
    length:                     f['Length']         ?? null,
    texture:                    f['Texture']        || null,
    price_override:             f['Price Override'] != null ? parseFloat(f['Price Override']) : null,
    reorder_threshold_override: f['Reorder Threshold Override'] ?? null,
    stock_quantity:             f['Stock Quantity'] ?? 0,
    active:                     f['Active']         !== false,
    images: attachments.map(a => ({
      thumb: a.thumbnails?.large?.url || a.url,
      full:  a.url,
    })),
  };
}

// All-variants cache — fetched once, filtered per product
let allVariantsCache = { data: null, fetchedAt: 0 };

async function fetchAllVariants() {
  if (allVariantsCache.data && Date.now() - allVariantsCache.fetchedAt < CACHE_TTL) {
    return allVariantsCache.data;
  }
  const fields = ['SKU','Colour','Size','Length','Texture','Price Override',
                  'Reorder Threshold Override','Stock Quantity','Active','Variant Image','Products'];
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': fields };
    if (offset) params.offset = offset;
    const { data } = await axios.get(AIRTABLE_VARIANTS, { headers: AIRTABLE_HEADERS(), params });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  allVariantsCache = { data: records, fetchedAt: Date.now() };
  return records;
}

async function fetchVariantsForProduct(productId) {
  const all = await fetchAllVariants();
  // Airtable returns linked record IDs as plain strings in the Products array
  const records = all.filter(r => (r.fields.Products || []).includes(productId));
  return records.map(mapVariantRecord);
}

function mapRecord(record) {
  const f = record.fields;
  const price = f['Price (KES)'] || null;
  const salePrice = f['Sale Price'] ? parseFloat(f['Sale Price']) : null;

  const badge = f['Badge'] || null;

  // 'Primary Image URL' is now an Airtable attachment field containing all product images.
  // First attachment = primary (shop grid), all = gallery (product page).
  const attachments = Array.isArray(f['Primary Image URL']) ? f['Primary Image URL'] : [];
  const image_url = attachments[0]?.thumbnails?.large?.url || attachments[0]?.url || '';
  const colourNames = (f['Colour Names'] || '').split(',').map(c => c.trim()).filter(Boolean);
  const images = attachments.map((a, i) => ({
    thumb: a.thumbnails?.large?.url || a.url,
    full: a.url,
    name: colourNames[i] || null,
  }));

  return {
    id: record.id,
    name: f['Product Name'] || '',
    description: f['Product Description'] || '',
    price: salePrice && salePrice < price ? salePrice : price,
    original_price: salePrice && salePrice < price ? price : null,
    category: (f['Product Category'] || '').toLowerCase(),
    sub_category: f['Sub-Category'] || null,
    badge,
    total_stock_quantity: f['Total Stock Quantity'] ?? null,
    image_url,
    images,
    colour: f['Review Count'] || null,
    has_variants: f['Colour / Variant'] === 'Yes',
    in_stock: f['In Stock'] !== 'No',
    is_active: 1,
    created_at: record.createdTime,
    materials:                   f['Materials']                   || null,
    care_instructions:           f['Care Instructions']           || null,
    dimensions:                  f['Dimensions']                  || null,
    how_to_use:                  f['How to Use']                  || null,
    ingredients:                 f['Ingredients']                 || null,
    skin_concerns_and_benefits:  f['Skin Concerns & Benefits']    || null,
    hair_care:                   f['Hair Care']                   || null,
    returns_override:            f['Returns Override']            || null,
  };
}

async function fetchAllFromAirtable() {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100 };
    if (offset) params.offset = offset;
    const { data } = await axios.get(AIRTABLE_BASE, {
      headers: AIRTABLE_HEADERS(),
      params,
    });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records.map(mapRecord);
}

async function getProducts() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
  const products = await fetchAllFromAirtable();
  cache = { data: products, fetchedAt: Date.now() };
  console.log(`[Airtable] Fetched ${products.length} products`);
  return products;
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    let products = await getProducts();
    const { category } = req.query;
    if (category && category !== 'all') {
      if (category === 'sale') {
        products = products.filter(p => p.badge === 'Sale');
      } else if (category === 'new') {
        products = products.filter(p => p.badge === 'New In');
      } else {
        products = products.filter(p => p.category === category);
      }
    }
    res.json(products);
  } catch (err) {
    console.error('[Airtable] Fetch error:', err.message);
    res.status(500).json({ error: 'Could not load products from Airtable' });
  }
});

// GET /api/products/refresh — bust the cache (admin only)
router.get('/refresh', adminAuth, async (req, res) => {
  try {
    cache = { data: null, fetchedAt: 0 };
    const products = await getProducts();
    res.json({ refreshed: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/all — admin view (same as public for Airtable)
router.get('/all', adminAuth, async (req, res) => {
  try {
    cache = { data: null, fetchedAt: 0 };
    res.json(await getProducts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/variants
router.get('/:id/variants', async (req, res) => {
  try {
    const variants = await fetchVariantsForProduct(req.params.id);
    res.json(variants);
  } catch (err) {
    console.error('[Airtable] Variants fetch error:', err.message);
    res.status(500).json({ error: 'Could not load variants' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const products = await getProducts();
    const p = products.find(p => p.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
