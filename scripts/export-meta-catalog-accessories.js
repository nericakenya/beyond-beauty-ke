// Exports all live "Accessories" products (Jewellery, Bags & Wallets, Jewellery Boxes)
// to a Meta Commerce Manager-compatible CSV. Variant products (colour) are exploded
// into one row per colour, sharing item_group_id.
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const HEADERS = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` };
const PRODUCTS_URL = `https://api.airtable.com/v0/${BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const VARIANTS_URL = `https://api.airtable.com/v0/${BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const CATEGORIES_URL = `https://api.airtable.com/v0/${BASE_ID}/Categories`;

const SITE_URL = 'https://beyondbeauty.co.ke';
const FALLBACK_BRAND = 'Beyond Beauty';
// Note: the live shop (routes/products.js) doesn't filter by Status at all, so a product's
// Status field (Draft/Active/etc.) has no bearing on whether it's actually live and sellable —
// match that behavior here rather than excluding by Status.
const OUTPUT_PATH = path.join(__dirname, '..', 'exports', 'meta-catalog-accessories.csv');

async function fetchAll(url, params = {}) {
  const records = [];
  let offset = null;
  do {
    const { data } = await axios.get(url, { headers: HEADERS, params: { pageSize: 100, ...params, ...(offset ? { offset } : {}) } });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// number + ISO code, no decimals, no thousands separator — per Meta's price format spec
function formatPrice(n) {
  return `${Math.round(Number(n))} KES`;
}

// ── Categories: resolve linked record IDs → slugs, and build sub/sec → main-category slug maps ──
async function fetchCategoryMaps() {
  const recs = await fetchAll(CATEGORIES_URL, { 'fields[]': ['Category Name', 'Slug', 'Level', 'Parent Category'] });
  const byId = {};
  recs.forEach(r => {
    byId[r.id] = {
      slug: r.fields.Slug || '',
      level: r.fields.Level || '',
      parentId: (r.fields['Parent Category'] || [])[0] || null,
    };
  });
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
  return { byId, subToCat, secToCat };
}

function mapVariants(records) {
  const byProduct = {};
  records.forEach(r => {
    const f = r.fields;
    const productIds = f['Products'] || [];
    if (!productIds.length) return;
    const attachments = Array.isArray(f['Variant Image']) ? f['Variant Image'] : [];
    const variant = {
      id: r.id,
      colour: f['Colour'] || null,
      size: f['Size'] || null,
      active: f['Active'] !== false,
      stock: f['Stock Quantity'] ?? 0,
      image: attachments[0]?.url || null,
    };
    productIds.forEach(pid => {
      if (!byProduct[pid]) byProduct[pid] = [];
      byProduct[pid].push(variant);
    });
  });
  return byProduct;
}

async function main() {
  console.log('Fetching Products, Variants, and Categories from Airtable...');
  const [productRecords, variantRecords, { byId, subToCat, secToCat }] = await Promise.all([
    fetchAll(PRODUCTS_URL),
    fetchAll(VARIANTS_URL, {
      'fields[]': ['Colour', 'Size', 'Active', 'Stock Quantity', 'Variant Image', 'Products'],
    }),
    fetchCategoryMaps(),
  ]);
  const variantsByProduct = mapVariants(variantRecords);
  console.log(`Fetched ${productRecords.length} products, ${variantRecords.length} variants.`);

  const columns = ['id', 'title', 'description', 'availability', 'condition', 'link', 'image_link', 'brand', 'price', 'sale_price', 'item_group_id', 'color', 'size', 'material'];
  const rows = [];
  const warnings = [];
  let matchedCount = 0;

  for (const record of productRecords) {
    const f = record.fields;
    const catRec = byId[(f['Category (Link)'] || [])[0]] || null;
    const subRec = byId[(f['Sub-Category (Link)'] || [])[0]] || null;
    const secRec = byId[(f['Secondary Sub-Category (Link)'] || [])[0]] || null;
    const catSlug = catRec?.slug || '';
    const subSlug = subRec?.slug || '';
    const secSlug = secRec?.slug || '';

    const isAccessories = catSlug === 'accessories' || subToCat[subSlug] === 'accessories' || secToCat[secSlug] === 'accessories';
    if (!isAccessories) continue;
    matchedCount++;

    const title = (f['Product Name'] || '').trim();
    const description = (f['Product Description'] || '').trim();
    const price = f['Price (KES)'];
    const salePrice = f['Sale Price'];
    const saleIsActive = salePrice != null && price != null && Number(salePrice) < Number(price);

    const attachments = Array.isArray(f['Primary Image URL']) ? f['Primary Image URL'] : [];
    const primaryImage = attachments[0]?.url || '';

    const badges = Array.isArray(f['Badge']) ? f['Badge'] : [];
    const totalStock = f['Total Stock Quantity'] ?? 0;
    let availability = 'in stock';
    if (badges.includes('Sold Out') || badges.includes('Out of Stock')) availability = 'out of stock';
    else if (totalStock <= 0 && !badges.includes('Coming Soon') && price != null) availability = 'out of stock';

    if (!title) warnings.push(`[${record.id}] missing title`);
    if (price == null) warnings.push(`[${record.id}] "${title}" missing price`);
    if (!primaryImage) warnings.push(`[${record.id}] "${title}" missing image`);

    const link = `${SITE_URL}/product?id=${record.id}`;
    const brand = f['Brand'] || FALLBACK_BRAND;
    const material = f['Materials'] || '';

    const variants = (variantsByProduct[record.id] || []).filter(v => v.active);

    if (variants.length > 1) {
      // Explode into one row per variant, sharing item_group_id
      variants.forEach(v => {
        rows.push({
          id: v.id,
          title,
          description,
          availability: v.stock > 0 ? 'in stock' : 'out of stock',
          condition: 'new',
          link,
          image_link: v.image || primaryImage,
          brand,
          price: price != null ? formatPrice(price) : '',
          sale_price: saleIsActive ? formatPrice(salePrice) : '',
          item_group_id: record.id,
          color: v.colour || '',
          size: v.size || '',
          material,
        });
      });
    } else {
      rows.push({
        id: record.id,
        title,
        description,
        availability,
        condition: 'new',
        link,
        image_link: primaryImage,
        brand,
        price: price != null ? formatPrice(price) : '',
        sale_price: saleIsActive ? formatPrice(salePrice) : '',
        item_group_id: '',
        color: '',
        size: '',
        material,
      });
    }
  }

  const lines = [columns.join(',')];
  rows.forEach(row => lines.push(columns.map(c => csvEscape(row[c])).join(',')));

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join('\r\n') + '\r\n', 'utf8');

  console.log(`\nMatched ${matchedCount} accessories products -> ${rows.length} feed rows (variants exploded).`);
  console.log(`Wrote ${OUTPUT_PATH}`);

  if (warnings.length) {
    console.log(`\n${warnings.length} data-quality warning(s):`);
    warnings.forEach(w => console.log(`  - ${w}`));
  } else {
    console.log('No data-quality warnings.');
  }
}

main().catch(err => {
  console.error('Export failed:', err.response?.data || err.message);
  process.exit(1);
});
