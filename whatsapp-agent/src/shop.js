// Product data comes from the shop's own API, so Joy quotes exactly the prices, sale
// prices and stock the website shows (one source of truth: Airtable → shop API).
const { config } = require('./config');
const airtable = require('./airtable');

const VARIANTS_TABLE = 'tblnUje4pZyI53p2C';
const CACHE_MS = 3 * 60 * 1000;
let cache = { at: 0, products: null };
const variantCache = new Map(); // productId -> { at, variants }

async function getJson(path) {
  const res = await fetch(`${config.shopUrl}${path}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Shop API ${path} returned ${res.status}`);
  return res.json();
}

async function allProducts() {
  if (cache.products && Date.now() - cache.at < CACHE_MS) return cache.products;
  const products = await getJson('/api/products');
  cache = { at: Date.now(), products };
  return products;
}

async function variantsFor(productId) {
  const hit = variantCache.get(productId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.variants;
  const variants = (await getJson(`/api/products/${encodeURIComponent(productId)}/variants`)).filter(v => v.active !== false);
  variantCache.set(productId, { at: Date.now(), variants });
  return variants;
}

const productUrl = p => `${config.shopUrl}/product?id=${p.id}`;

function variantLabel(v) {
  return [v.colour, v.size, v.length != null ? `${v.length}"` : null, v.texture].filter(Boolean).join(' / ') || 'Standard';
}

// One sellable line: what a variant (or a product with no variants) costs and whether it's in stock
function priceOf(product, variant) {
  const price = variant ? (variant.price_override ?? product.price) : product.price;
  const was = variant ? (variant.original_price ?? null) : (product.original_price ?? null);
  return { price, was_price: was && was > price ? was : null };
}

function stockOf(product, variant) {
  if (product.badges?.includes('Coming Soon')) return { in_stock: false, note: 'coming soon' };
  const qty = variant ? (variant.stock_quantity ?? 0) : (product.total_stock_quantity ?? 0);
  return { in_stock: qty > 0, qty };
}

function searchScore(p, words) {
  const name = (p.name || '').toLowerCase();
  const hay = `${name} ${p.cat_name} ${p.sub_name} ${p.sec_name} ${(p.badges || []).join(' ')}`.toLowerCase();
  let score = 0;
  const startsWord = (text, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text);
  for (const w of words) {
    if (startsWord(name, w)) score += 3;
    else if (startsWord(hay, w)) score += 1;
    else if (w.length > 4 && startsWord(hay, w.slice(0, -1))) score += 1; // crude plural match: "bags" → "bag"
  }
  return score;
}

async function search(query, maxResults = 8) {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const products = await allProducts();
  const scored = products
    .map(p => ({ p, s: searchScore(p, words) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.p.sold_out - b.p.sold_out))
    .slice(0, Math.min(maxResults, 15));
  return scored.map(({ p }) => ({
    product_id: p.id,
    name: p.name,
    category: [p.cat_name, p.sub_name, p.sec_name].filter(Boolean).join(' › '),
    price_from: p.price,
    was_price: p.original_price || null,
    in_stock: !p.sold_out && !p.badges?.includes('Coming Soon'),
    has_options: !!p.has_variants,
    link: productUrl(p),
  }));
}

const trim = (s, n = 700) => (s && s.length > n ? `${s.slice(0, n)}…` : s || undefined);

async function product(productId) {
  const p = (await allProducts()).find(x => x.id === productId);
  if (!p) return null;
  const variants = await variantsFor(p.id);
  return {
    product_id: p.id,
    name: p.name,
    link: productUrl(p),
    category: [p.cat_name, p.sub_name, p.sec_name].filter(Boolean).join(' › '),
    badges: p.badges,
    description: trim(p.description),
    materials: trim(p.materials, 300),
    dimensions: trim(p.dimensions, 300),
    care_instructions: trim(p.care_instructions, 300),
    how_to_use: trim(p.how_to_use, 500),
    ingredients: trim(p.ingredients, 500),
    skin_concerns_and_benefits: trim(p.skin_concerns_and_benefits, 400),
    hair_concerns_and_benefits: trim(p.hair_concerns_and_benefits, 400),
    options: variants.length
      ? variants.map(v => ({ code: v.sku || p.id, option: variantLabel(v), ...priceOf(p, v), ...stockOf(p, v) }))
      : [{ code: p.id, option: 'Standard', ...priceOf(p, null), ...stockOf(p, null) }],
  };
}

// Resolves an order code (a variant SKU like "MNB-004-BLAC", or a product record ID for
// products without options) to the exact product + variant, with the current price and stock.
async function resolveCode(code) {
  code = String(code || '').trim();
  if (!code) return null;
  if (/^rec[A-Za-z0-9]{14}$/.test(code)) {
    const p = (await allProducts()).find(x => x.id === code);
    if (!p) return null;
    const variants = await variantsFor(p.id);
    if (variants.length > 1) return { product: p, variant: null, ambiguous: variants.map(v => ({ code: v.sku, option: variantLabel(v) })) };
    return { product: p, variant: variants[0] || null };
  }
  const recs = await airtable.list(VARIANTS_TABLE, {
    formula: `UPPER(ARRAYJOIN({SKU})) = UPPER(${airtable.str(code)})`,
    fields: ['SKU', 'Products'], maxRecords: 2,
  });
  const rec = recs[0];
  const productId = rec?.fields.Products?.[0];
  if (!productId) return resolveStyleCode(code);
  const p = (await allProducts()).find(x => x.id === productId);
  if (!p) return null;
  const v = (await variantsFor(p.id)).find(x => x.id === rec.id || (x.sku || '').toUpperCase() === code.toUpperCase());
  return { product: p, variant: v || null };
}

// A product-level style code (e.g. "RNG-002"), sent for items added to the bag from a shop
// card: one option → that option; several → the caller must ask which one.
async function resolveStyleCode(code) {
  const upper = code.toUpperCase();
  let p = (await allProducts()).find(x => (x.style_code || '').toUpperCase() === upper);
  if (!p) { // the shop API may not expose style codes yet — fall back to Airtable
    const recs = await airtable.list('tbleE0hPVfKi0xVLA', { formula: `UPPER({Style Code}) = UPPER(${airtable.str(code)})`, fields: ['Style Code'], maxRecords: 1 });
    p = recs[0] && (await allProducts()).find(x => x.id === recs[0].id);
  }
  if (!p) return null;
  const variants = await variantsFor(p.id);
  if (variants.length > 1) return { product: p, variant: null, ambiguous: variants.map(v => ({ code: v.sku, option: variantLabel(v) })) };
  return { product: p, variant: variants[0] || null };
}

// Website cart lines read "Product name · Option" (option = colour, or length like 22").
function splitCartName(line) {
  const [product, ...rest] = String(line || '').split(' · ');
  return { product: product.trim(), option: rest.join(' · ').trim() || null };
}

const norm = s => String(s || '').toLowerCase().replace(/[“”"]/g, '"').replace(/\s+/g, ' ').trim();

function optionMatches(v, option) {
  const o = norm(option);
  const labels = [v.colour, v.size, v.texture, v.length != null ? `${v.length}"` : null, v.length != null ? `${v.length} inch` : null, variantLabel(v)];
  return labels.filter(Boolean).some(l => norm(l) === o);
}

// Resolves a product by its exact name (as shown on the website) and an option label.
async function resolveByName(name, option) {
  const split = option ? { product: name, option } : splitCartName(name);
  const want = norm(split.product);
  const products = await allProducts();
  let matches = products.filter(p => norm(p.name) === want);
  if (!matches.length) matches = products.filter(p => norm(p.name).startsWith(want) || want.startsWith(norm(p.name)));
  if (matches.length !== 1) return matches.length ? { ambiguousProducts: matches.map(p => p.name) } : null;
  const p = matches[0];
  const variants = await variantsFor(p.id);
  if (variants.length <= 1) return { product: p, variant: variants[0] || null };
  if (split.option) {
    const v = variants.filter(x => optionMatches(x, split.option));
    if (v.length === 1) return { product: p, variant: v[0] };
  }
  return { product: p, variant: null, ambiguous: variants.map(v => ({ code: v.sku, option: variantLabel(v) })) };
}

module.exports = { search, product, resolveCode, resolveByName, splitCartName, priceOf, stockOf, variantLabel, productUrl };
