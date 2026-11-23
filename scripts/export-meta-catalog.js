require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PRODUCTS_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` };

const FIELDS = [
  'Product Name', 'Product Description', 'Price (KES)', 'Sale Price',
  'Total Stock Quantity', 'Status', 'Brand', 'Primary Image URL',
  'Product Page URL', 'Badge',
];

const EXCLUDED_STATUSES = ['Draft', 'Discontinued'];
const OUTPUT_PATH = path.join(__dirname, '..', 'exports', 'meta-catalog-feed.csv');
const FALLBACK_BRAND = 'Beyond Beauty';

async function fetchAllProducts() {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100, 'fields[]': FIELDS };
    if (offset) params.offset = offset;
    const { data } = await axios.get(PRODUCTS_URL, { headers: HEADERS, params });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatPrice(n) {
  return `${Number(n).toFixed(2)} KES`;
}

function buildRow(record) {
  const f = record.fields;
  const warnings = [];

  const title = (f['Product Name'] || '').trim();
  if (!title) warnings.push('missing title');

  const price = f['Price (KES)'];
  if (price === undefined || price === null) warnings.push('missing price');

  const link = f['Product Page URL'];
  if (!link) warnings.push('missing Product Page URL (formula field not computed yet?)');

  const attachments = Array.isArray(f['Primary Image URL']) ? f['Primary Image URL'] : [];
  const imageLink = attachments[0]?.url || '';
  if (!imageLink) warnings.push('missing image');
  const additionalImages = attachments.slice(1, 10).map(a => a.url);

  const badges = Array.isArray(f['Badge']) ? f['Badge'] : [];
  const totalStock = f['Total Stock Quantity'] ?? 0;
  let availability = 'in stock';
  if (badges.includes('Coming Soon')) availability = 'preorder';
  else if (totalStock <= 0) availability = 'out of stock';

  const salePrice = f['Sale Price'];
  const saleIsActive = salePrice != null && price != null && Number(salePrice) < Number(price);

  const row = {
    id: record.id,
    title,
    description: (f['Product Description'] || '').trim(),
    availability,
    condition: 'new',
    price: price != null ? formatPrice(price) : '',
    link: link || '',
    image_link: imageLink,
    additional_image_link: additionalImages.join(','),
    brand: f['Brand'] || FALLBACK_BRAND,
    visibility: 'published',
    item_group_id: record.id,
  };
  if (saleIsActive) row.sale_price = formatPrice(salePrice);

  return { row, warnings };
}

async function main() {
  console.log('Fetching products from Airtable...');
  const records = await fetchAllProducts();
  console.log(`Fetched ${records.length} total product records.`);

  const included = records.filter(r => !EXCLUDED_STATUSES.includes(r.fields['Status']));
  const excludedCount = records.length - included.length;
  console.log(`Excluding ${excludedCount} Draft/Discontinued records. ${included.length} remain for the feed.`);

  const columns = [
    'id', 'title', 'description', 'availability', 'condition', 'price',
    'sale_price', 'link', 'image_link', 'additional_image_link', 'brand',
    'visibility', 'item_group_id',
  ];

  const rows = [];
  const rowsWithWarnings = [];

  for (const record of included) {
    const { row, warnings } = buildRow(record);
    rows.push(row);
    if (warnings.length) {
      rowsWithWarnings.push({ id: record.id, title: row.title || '(untitled)', warnings });
    }
  }

  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map(c => csvEscape(row[c])).join(','));
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join('\r\n') + '\r\n', 'utf8');

  console.log(`\nWrote ${rows.length} rows to ${OUTPUT_PATH}`);

  if (rowsWithWarnings.length) {
    console.log(`\n${rowsWithWarnings.length} rows have data-quality warnings (still included in the file):`);
    for (const w of rowsWithWarnings.slice(0, 30)) {
      console.log(`  - [${w.id}] "${w.title}": ${w.warnings.join('; ')}`);
    }
    if (rowsWithWarnings.length > 30) {
      console.log(`  ...and ${rowsWithWarnings.length - 30} more. Fix the underlying Airtable records and re-run.`);
    }
  } else {
    console.log('No data-quality warnings.');
  }
}

main().catch(err => {
  console.error('Export failed:', err.response?.data || err.message);
  process.exit(1);
});
