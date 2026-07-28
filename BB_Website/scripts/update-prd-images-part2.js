// Patch remaining confirmed images: Medicube (2) + Dr. Althea (2)
require('dotenv').config();
const axios = require('axios');

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS  = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

const imageMap = [

  // ── MEDICUBE (2 of 7 confirmed) ─────────────────────────────────────
  { id: 'recH21ji6ydWBQ0UU', url: 'https://medicube.world/images/products/collagen-jelly-cream.jpg' },
  { id: 'recS57fwRuOJYbeoj', url: 'https://medicube.world/images/products/zero-pore-pads.jpg' },

  // ── DR. ALTHEA (2 of 4 confirmed) ───────────────────────────────────
  { id: 'rec6b426z7NMwzorO', url: 'https://cdn.shopify.com/s/files/1/0249/1218/files/Soko-Glam-PDP-Revamped-Dr-Althea-Revamped-345-Relief-Cream-01.png?v=1715304073' },
  { id: 'recOF5eaUSG8NFhTL', url: 'https://cdn.shopify.com/s/files/1/0249/1218/files/Dr.Althea_147BarrierCream.jpg?v=1756218704' },

];

// STILL NEEDS MANUAL IMAGES:
// Medicube (5):
//   recbjGqP3bmxZGSNf - Zero Foam Cleanser
//   recyf7FIGue8Xnq4U - Triple Collagen Serum
//   recnYUT1FuDUHHghe - Zero Pore Blackhead Mud Mask
//   recplmY2Vidtw6JvJ - PDRN Pink Collagen Gel Mask
//   recLPU5M4qyDZ4g97 - One Day Exosome Shot Pore Ampoule 7500
// Dr. Althea (2):
//   recIULTRL6LoccCtl - Vitamin C Boosting Serum 30ml
//   rec4XddkfqB9iK9iy - Pure Grinding Cleansing Balm 50ml
// Estée Lauder (8):
//   recMOARvUoPQLCQW6 - Advanced Night Repair Serum 115ml
//   recWWC0cTuHvi7drv - Advanced Night Repair Eye Gel-Creme 15ml
//   recOIqRYbP9SRVP56 - Perfectionist Pro Rapid Firm + Lift 50ml
//   recFUPXuAC0Ox83pH - Nutritious Radiant Essence Lotion 200ml
//   recCouv9AIOjWkk4e - DayWear Matte Gel Crème 50ml
//   rec13ksRb7b2NKqWA - Revitalizing Supreme+ Eye Balm 15ml
//   recXHkXRGc5JUwrho - Resilience Multi-Effect Night Moisturizer 50ml
//   recPIAAhsBaXA5fhv - Nutritious Airy Lotion Moisturizer 100ml
// Laneige (4):
//   recokNrm7lT2K3xmN - Lip Sleeping Mask 20g
//   recOF2HeEH63Br8se - Cream Skin Cerapeptide Refiner
//   recvvFTlcy20PbwCg - Glaze Craze Tinted Lip Serum
//   rec643fNI8dV5bhjU - Bouncy & Firm Sleeping Mask

async function run() {
  const records = imageMap.map(({ id, url }) => ({
    id,
    fields: { 'Primary Image URL': [{ url }] },
  }));

  const { data } = await axios.patch(BASE_URL, { records }, { headers: HEADERS });
  data.records.forEach(r => {
    const att = r.fields['Primary Image URL'];
    const ok  = Array.isArray(att) && att.length > 0;
    console.log(`  ${ok ? '✓' : '✗'} ${r.id}  ${r.fields['Product Name'] || ''}`);
  });

  console.log('\n✓ Part 2 done.');
  console.log('Images patched so far: 36 / 55 products');
  console.log('Still needs manual images in Airtable: 19 products (see comments above)');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
