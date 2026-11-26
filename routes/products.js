const express = require('express');
const router = express.Router();
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');

const AIRTABLE_BASE       = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AIRTABLE_VARIANTS   = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const AIRTABLE_CATEGORIES = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Categories`;
const AIRTABLE_MENU       = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Menu`;
const AIRTABLE_HEADERS    = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` });

// ── In-memory cache (5-minute TTL) ──
const CACHE_TTL = 5 * 60 * 1000;
let cache         = { data: null, fetchedAt: 0 };
let catCache      = { data: null, fetchedAt: 0 };
let menuGroupCache = { data: null, fetchedAt: 0 };
let variantsCache = {}; // keyed by product record ID

// Old top-level category slugs → new cat_slug (for legacy URLs like /bags, /hair)
const LEGACY_CAT = { bags: 'fashion', hair: 'beauty', skincare: 'beauty' };

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

// ── Categories cache — resolves linked record IDs to slugs and builds parent maps ──
async function fetchCategories() {
  if (catCache.data && Date.now() - catCache.fetchedAt < CACHE_TTL) return catCache.data;

  const allRecs = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': ['Category Name', 'Slug', 'Level', 'Parent Category'] };
    if (offset) params.offset = offset;
    const { data } = await axios.get(AIRTABLE_CATEGORIES, { headers: AIRTABLE_HEADERS(), params });
    allRecs.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  // id → { slug, name, level, parentId }
  const byId = {};
  allRecs.forEach(r => {
    byId[r.id] = {
      slug:     r.fields.Slug                   || '',
      name:     r.fields['Category Name']       || '',
      level:    r.fields.Level                  || '',
      parentId: (r.fields['Parent Category'] || [])[0] || null,
    };
  });

  // sub slug → main category slug  (Sub Category → its Main Category parent)
  // sec slug → main category slug  (Secondary → Sub → Main)
  const subToCat = {};
  const secToCat = {};
  Object.values(byId).forEach(rec => {
    if (rec.level === 'Sub Category' && rec.parentId) {
      const parent = byId[rec.parentId];
      if (parent) subToCat[rec.slug] = parent.slug;
    } else if (rec.level === 'Secondary Sub Category' && rec.parentId) {
      const sub = byId[rec.parentId];
      if (sub?.parentId) {
        const cat = byId[sub.parentId];
        if (cat) secToCat[rec.slug] = cat.slug;
      }
    }
  });

  const result = { byId, subToCat, secToCat };
  catCache = { data: result, fetchedAt: Date.now() };
  return result;
}

// ── Menu groups — a single nav slug (e.g. "cleansers-toners") can link multiple
// Categories records via Menu's "Category Ref" field (e.g. Cleansers, Toners, and
// Cleansers & Toners itself). Products are tagged with whichever individual category
// they actually belong to, so filtering must match against the whole group, not just
// the nav slug's own category — otherwise pages like this return zero products. ──
async function fetchMenuGroups() {
  if (menuGroupCache.data && Date.now() - menuGroupCache.fetchedAt < CACHE_TTL) {
    return menuGroupCache.data;
  }

  const [{ byId }, menuRecords] = await Promise.all([
    fetchCategories(),
    (async () => {
      const recs = [];
      let offset = null;
      do {
        const params = { pageSize: 100, 'fields[]': ['Slug', 'Level', 'Category Ref'] };
        if (offset) params.offset = offset;
        const { data } = await axios.get(AIRTABLE_MENU, { headers: AIRTABLE_HEADERS(), params });
        recs.push(...data.records);
        offset = data.offset || null;
      } while (offset);
      return recs;
    })(),
  ]);

  // slug → Set of equivalent slugs (all Categories records linked from that Menu row)
  const subGroups = {};
  const secGroups = {};
  menuRecords.forEach(r => {
    const slug = r.fields.Slug;
    const refs = r.fields['Category Ref'] || [];
    if (!slug || !refs.length) return;
    const equivalentSlugs = new Set(refs.map(id => byId[id]?.slug).filter(Boolean));
    equivalentSlugs.add(slug); // always match the nav slug itself too
    if (r.fields.Level === 'Sub-Category') subGroups[slug] = equivalentSlugs;
    else if (r.fields.Level === 'Secondary Sub-Category') secGroups[slug] = equivalentSlugs;
  });

  const result = { subGroups, secGroups };
  menuGroupCache = { data: result, fetchedAt: Date.now() };
  return result;
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

// Today's date in Nairobi (UTC+3) as YYYY-MM-DD, to compare with Airtable date fields.
function todayNairobi() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// While a product is on sale, each variant costs the lower of its own price and the
// product's sale price, so the sale reaches the bag and the WhatsApp message (variant
// prices used to win over the sale). A variant already cheaper than the sale price keeps
// its price. original_price = the variant's price without the sale, when it is reduced.
// Returns copies: one variant record can be linked to more than one product.
function applySale(p, variants) {
  return variants.map(v => {
    const full = v.price_override ?? p.original_price ?? p.price;
    if (p.original_price == null || full == null) return { ...v, original_price: null };
    const sale = Math.min(full, p.price);
    return { ...v, price_override: sale, original_price: sale < full ? full : null };
  });
}

function mapRecord(record, catMap = {}) {
  const f = record.fields;
  const price = f['Price (KES)'] || null;
  const salePrice = f['Sale Price'] ? parseFloat(f['Sale Price']) : null;

  // Badge is now a multi-select — REST API returns string[] or null
  let badges = Array.isArray(f['Badge']) ? [...f['Badge']] : [];

  const totalStock = f['Total Stock Quantity'] ?? null;
  const availabilityStatus = f['Availability Status'] || null;

  // Derive sold_out from badges and stock as a safety net for stale Airtable badge state
  const sold_out = badges.includes('Sold Out')
    || badges.includes('Out of Stock')
    || (totalStock <= 0 && !badges.includes('Coming Soon') && !!price);

  // A sale is on when the sale price is below the price and today (Nairobi) is within
  // the optional Sale Start / Sale End dates.
  const today = todayNairobi();
  const saleStart = f['Sale Start Date'] || null;
  const saleEnd   = f['Sale End Date']   || null;
  const saleIsActive = !!(salePrice && price && salePrice < price
    && (!saleStart || saleStart <= today) && (!saleEnd || saleEnd >= today));

  // Safety net: if product has an active sale price but Airtable automation hasn't set the badge yet
  if (saleIsActive && !badges.includes('Sale') && !sold_out && !badges.includes('Coming Soon')) {
    badges = ['Sale', ...badges];
  }

  // Safety net: strip "Only 'X' Left" if stock is above the threshold (stale Airtable badge)
  if (totalStock > 2) {
    badges = badges.filter(b => b !== "Only 'X' Left");
  }

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

  // Resolve linked Category record IDs → slugs + display names
  const catRec = catMap[(f['Category (Link)']               || [])[0]] || null;
  const subRec = catMap[(f['Sub-Category (Link)']           || [])[0]] || null;
  const secRec = catMap[(f['Secondary Sub-Category (Link)'] || [])[0]] || null;
  const cat_slug = catRec?.slug || '';
  const sub_slug = subRec?.slug || '';
  const sec_slug = secRec?.slug || '';

  return {
    id: record.id,
    name: f['Product Name'] || '',
    description: f['Product Description'] || '',
    price: saleIsActive ? salePrice : price,
    original_price: saleIsActive ? price : null,
    category: cat_slug || (f['Product Category'] || '').toLowerCase(),
    cat_slug,
    sub_slug,
    sec_slug,
    cat_name: catRec?.name || '',
    sub_name: subRec?.name || '',
    sec_name: secRec?.name || '',
    badges,
    total_stock_quantity: totalStock,
    sold_out,
    availability_status: availabilityStatus,
    image_url,
    images,
    colour: f['Review Count'] || null,
    has_variants: Array.isArray(f['Variants']) && f['Variants'].length > 1,
    split_colours: f['Split colours on shop'] === true,
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
    hair_concerns_and_benefits:  f['Hair Concerns & Benefits']    || null,
  };
}

async function fetchAllFromAirtable() {
  const [{ byId }, records] = await Promise.all([
    fetchCategories(),
    (async () => {
      const recs = [];
      let offset = null;
      do {
        const params = { pageSize: 100 };
        if (offset) params.offset = offset;
        const { data } = await axios.get(AIRTABLE_BASE, { headers: AIRTABLE_HEADERS(), params });
        recs.push(...data.records);
        offset = data.offset || null;
      } while (offset);
      return recs;
    })(),
  ]);
  return records.map(r => mapRecord(r, byId));
}

async function getProducts() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
  const products = await fetchAllFromAirtable();
  cache = { data: products, fetchedAt: Date.now() };
  console.log(`[Airtable] Fetched ${products.length} products`);
  return products;
}

// ── COLOUR CARDS ──
// The shop grid shows one card per colour of a style (ASOS-style) for products ticked
// "Split colours on shop" in Airtable. A "card" is a product object with colour-specific
// image, price, stock and link; `id` stays the product record ID so cart, wishlist and
// back-in-stock keep working. Set SHOP_COLOUR_CARDS=0 to switch the whole thing off.
const colourCardsEnabled = () => process.env.SHOP_COLOUR_CARDS !== '0';
const STOCK_BADGES = ['Sold Out', 'Out of Stock', "Only 'X' Left"];

function nameSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// "Carlie Medium Clutch" + "Khaki" → "Carlie Medium Clutch in Khaki" (skipped when the
// product name already mentions the colour).
function nameWithColour(name, colour) {
  if (!colour || name.toLowerCase().includes(colour.toLowerCase())) return name;
  return `${name} in ${colour}`;
}

// Groups a product's active variants by colour. Returns [] unless there are 2+ colours.
// Each group's gallery = that colour's own photos (Variant Image, then product images
// tagged with the colour via "Colour Names"), followed by shared/untagged product images.
function buildColourGroups(p, variants) {
  const order = [];
  const byColour = new Map();
  variants.filter(v => v.active && v.colour).forEach(v => {
    if (!byColour.has(v.colour)) { byColour.set(v.colour, []); order.push(v.colour); }
    byColour.get(v.colour).push(v);
  });
  if (order.length < 2) return [];

  const productImages = p.images || [];
  const shared = productImages.filter(img => !img.name || !byColour.has(img.name));

  return order.map(colour => {
    const vs = byColour.get(colour);
    // Photos live on one variant per colour — take the first variant that has any
    const withImages = vs.find(v => v.images.length > 0);
    const own = [
      ...(withImages ? withImages.images : []),
      ...productImages.filter(img => img.name === colour),
    ].map(img => ({ thumb: img.thumb, full: img.full, name: colour }));
    const images = own.length ? [...own, ...shared] : (shared.length ? shared : productImages);

    const stock = vs.reduce((sum, v) => sum + Math.max(v.stock_quantity || 0, 0), 0);
    const priced = (vs.some(v => v.stock_quantity > 0) ? vs.filter(v => v.stock_quantity > 0) : vs)
      .map(v => ({ price: v.price_override ?? p.price, original: v.original_price ?? null }))
      .filter(x => x.price != null)
      .sort((a, b) => a.price - b.price);
    const price = priced.length ? priced[0].price : p.price;
    const original_price = priced.length ? priced[0].original : p.original_price;

    return { colour, variants: vs, images, own_count: own.length, has_own_image: own.length > 0, stock, price, original_price };
  });
}

function plainCard(p) {
  return { ...p, card_key: p.id, style_key: p.id, url: `/product?id=${p.id}&name=${nameSlug(p.name)}` };
}

function expandToCards(products, variantsByProduct) {
  const cards = [];
  products.forEach(p => {
    const groups = (colourCardsEnabled() && p.split_colours)
      ? buildColourGroups(p, applySale(p, variantsByProduct.get(p.id) || []))
      : [];
    // Sold-out colours are hidden while another colour is in stock; if every colour
    // is sold out the style falls back to a single card, exactly as before.
    const inStock = groups.filter(g => g.stock > 0);
    if (!inStock.length) { cards.push(plainCard(p)); return; }

    inStock.forEach(g => {
      const badges = p.badges.filter(b => !STOCK_BADGES.includes(b));
      if (g.stock <= 2) badges.push("Only 'X' Left");
      const name = nameWithColour(p.name, g.colour);
      cards.push({
        ...p,
        card_key: `${p.id}:${g.colour}`,
        style_key: p.id,
        style_name: p.name,
        colour: g.colour,
        name,
        image_url: g.images[0]?.thumb || p.image_url,
        // Hover photo only when the colour itself has a second photo (never a shared one)
        hover_image_url: g.own_count > 1 ? g.images[1].thumb : null,
        images: g.images,
        price: g.price,
        original_price: g.original_price,
        total_stock_quantity: g.stock,
        sold_out: false,
        badges,
        // Quick "Add to Bag" needs an exact SKU — only possible when the colour has one size
        sku: g.variants.length === 1 ? g.variants[0].sku : null,
        has_variants: g.variants.length > 1,
        url: `/product?id=${p.id}&name=${nameSlug(name)}&colour=${encodeURIComponent(g.colour)}`,
      });
    });
  });
  return cards;
}

async function getVariantsByProduct() {
  const all = await fetchAllVariants();
  const map = new Map();
  all.forEach(r => {
    const v = mapVariantRecord(r);
    (r.fields.Products || []).forEach(pid => {
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(v);
    });
  });
  return map;
}

// Expands any list of products (already filtered/ordered) into shop cards
async function toShopCards(products) {
  return expandToCards(products, await getVariantsByProduct());
}

async function getShopCards() {
  return toShopCards(await getProducts());
}

// GET /api/products  (add ?cards=1 for one card per colour — used by the shop grid)
router.get('/', async (req, res) => {
  try {
    let products = req.query.cards === '1' ? await getShopCards() : await getProducts();
    const { category, cat, sub, sec } = req.query;

    if (category === 'sale' || cat === 'sale') {
      products = products.filter(p => p.badges.includes('Sale') || p.original_price != null);
    } else if (category === 'new' || cat === 'new') {
      products = products.filter(p => p.badges.includes('New In'));
    } else {
      const catSlug = cat || (category && category !== 'all' ? (LEGACY_CAT[category] || category) : null);
      if (sec) {
        const { secGroups } = await fetchMenuGroups();
        const allowedSlugs = secGroups[sec] || new Set([sec]);
        products = products.filter(p => allowedSlugs.has(p.sec_slug));
      } else if (sub) {
        const { subGroups } = await fetchMenuGroups();
        const allowedSlugs = subGroups[sub] || new Set([sub]);
        products = products.filter(p => allowedSlugs.has(p.sub_slug));
      } else if (catSlug) {
        // Expand the filter to include products linked at any level of this category's
        // sub-tree, so clicking a top-level nav item returns all its sub/sec products too.
        const { subToCat, secToCat } = await fetchCategories();
        products = products.filter(p =>
          p.cat_slug === catSlug ||
          subToCat[p.sub_slug] === catSlug ||
          secToCat[p.sec_slug] === catSlug
        );
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
    cache            = { data: null, fetchedAt: 0 };
    catCache         = { data: null, fetchedAt: 0 };
    menuGroupCache   = { data: null, fetchedAt: 0 };
    allVariantsCache = { data: null, fetchedAt: 0 };
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
    const [variants, products] = await Promise.all([fetchVariantsForProduct(req.params.id), getProducts()]);
    const p = products.find(p => p.id === req.params.id);
    res.json(p ? applySale(p, variants) : variants);
  } catch (err) {
    console.error('[Airtable] Variants fetch error:', err.message);
    res.status(500).json({ error: 'Could not load variants' });
  }
});

// GET /api/products/:id
// Adds `colours` (per-colour gallery + stock) for multi-colour products. With ?sku=…
// the image_url is that SKU's colour photo — used to keep cart thumbnails correct.
router.get('/:id', async (req, res) => {
  try {
    const products = await getProducts();
    const p = products.find(p => p.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });

    const variants = applySale(p, await fetchVariantsForProduct(p.id));
    const groups = buildColourGroups(p, variants);
    const out = {
      ...p,
      colours: groups.map(g => ({
        colour: g.colour,
        images: g.images,
        has_own_image: g.has_own_image,
        stock: g.stock,
      })),
    };
    if (req.query.sku) {
      const group = groups.find(g => g.variants.some(v => v.sku === req.query.sku));
      if (group?.images[0]) out.image_url = group.images[0].thumb;
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getProducts = getProducts;
module.exports.toShopCards = toShopCards;
