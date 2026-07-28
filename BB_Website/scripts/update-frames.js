require('dotenv').config();
const axios = require('axios');

const BASE          = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;
const PRODUCTS_URL  = `${BASE}/${process.env.AIRTABLE_TABLE_ID}`;
const VARIANTS_URL  = `${BASE}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

const RETURNS = `• Free delivery on orders over KSh 5,000
• Standard delivery within Nairobi: KSh 250 – 1 to 3 hours
• We deliver nationwide across Kenya: KSh 500 – 1 to 3 working days
• Exchanges accepted within 24 hours of delivery
• For full details, see our [Delivery & Refund Policy](https://beyondbeauty.co.ke/policies/delivery-refund)`;

const MYER = 'https://myer-media.com.au/wcsstore/MyerCatalogAssetStore/images/70/704/4676/100/1';

const products = [
  { id: 'recAixdfHmWcEnssV', name: 'Paton Medium Frame',      price: 2350, img: `${MYER}/121133080/121133080_1_720x928.webp` },
  { id: 'rec5uQGtjCRgVeOrI', name: 'Paton Small Frame',       price: 2000, img: `${MYER}/121133140/121133140_1_720x928.webp` },
  { id: 'recR42gkVpchpwOLc', name: 'Adler Medium Frame',      price: 4000, img: `${MYER}/121132600/121132600_1_720x928.webp` },
  { id: 'recmEDlPHfEqjbwQE', name: 'Adler Certificate Frame', price: 5550, img: `${MYER}/121132780/121132780_1_720x928.webp` },
  { id: 'recajDaUkuhWtWnF8', name: 'Olivia Square Frame',     price: 2350, img: null },
  { id: 'rec2aFe1ARwY8TxZF', name: 'Olivia Oval Frame',       price: 2750, img: null },
];

async function run() {
  // 1. Update each product record
  console.log('Updating product records…');
  for (const p of products) {
    const fields = {
      'Price (KES)':      p.price,
      'Returns Override': RETURNS,
    };
    if (p.img) fields['Primary Image URL'] = [{ url: p.img }];

    await axios.patch(`${PRODUCTS_URL}/${p.id}`, { fields }, { headers: HEADERS });
    console.log(`  ✓ ${p.name} — KES ${p.price.toLocaleString()}${p.img ? ' + image' : ' (no image)'}`);
  }

  // 2. Create one variant per product (no colour/size — single unit)
  console.log('\nCreating variants…');
  const variantRecords = products.map(p => ({
    fields: {
      'Active':   true,
      'Products': [p.id],
    },
  }));

  const { data: vData } = await axios.post(VARIANTS_URL, { records: variantRecords }, { headers: HEADERS });
  vData.records.forEach((r, i) => console.log(`  ✓ Variant ${r.id} → ${products[i].name}`));

  // 3. Create Inventory Movement (Stock In, qty 1) for each variant
  console.log('\nCreating inventory movements (qty 1)…');
  const movementUrl = `${BASE}/tblQ7JNyChQuSay0a`;
  const movementRecords = vData.records.map((r, i) => ({
    fields: {
      'Movement':      `Initial stock — ${products[i].name}`,
      'Date':          new Date().toISOString().slice(0, 10),
      'Movement Type': 'Stock In',
      'Quantity':      1,
      'Variant':       [r.id],
    },
  }));

  const { data: mData } = await axios.post(movementUrl, { records: movementRecords }, { headers: HEADERS });
  mData.records.forEach((r, i) => console.log(`  ✓ Movement ${r.id} → ${products[i].name}`));

  console.log('\nDone.');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
