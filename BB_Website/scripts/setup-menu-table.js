#!/usr/bin/env node
/**
 * Creates the "Menu" table in Airtable and populates it with all
 * category/sub-category/secondary sub-category records.
 *
 * Run once:  node scripts/setup-menu-table.js
 * Re-run safely: detects existing table and skips creation.
 */
require('dotenv').config();
const axios = require('axios');

const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TOKEN    = process.env.AIRTABLE_TOKEN;
const META_URL = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
const JSON_HDR = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const TREE = [
  { name: 'Fashion', slug: 'fashion', image: 'https://placehold.co/400x600/e8e4df/6b6560?text=Fashion', subs: [
    { name: 'Clothing',           slug: 'clothing',          sec: ['Dresses','Tops & T-Shirts','Pants & Jeans','Skirts','Jackets & Coats','Knitwear','Suits & Co-ords','Activewear','Swimwear','Maternity','Multi-packs'] },
    { name: 'Lingerie & Sleepwear', slug: 'lingerie-sleepwear', sec: ['Bras','Underwear','Shapewear','Sleepwear','Socks & Hosiery','Multi-packs'] },
    { name: 'Accessories',        slug: 'accessories',       sec: ['Jewellery','Bags & Wallets','Belts','Sunglasses','Scarves & Hats','Watches','Multi-packs'] },
    { name: 'Shoes',              slug: 'shoes',             sec: ['Boots & Ankle Boots','Heels & Wedges','Flats & Loafers','Sneakers','Sandals','Multi-packs'] },
  ]},
  { name: 'Beauty', slug: 'beauty', image: 'https://placehold.co/400x600/f0ede9/6b6560?text=Beauty', subs: [
    { name: 'Skincare',           slug: 'skincare',          sec: ['Face Moisturisers','Cleansers & Toners','Serums & Treatments','Eye Care','Body Moisturisers','Sun Care','Multi-packs'] },
    { name: 'Makeup',             slug: 'makeup',            sec: ['Foundation & Primer','Blush & Bronzer','Eye Makeup','Lip Colour','Nail Colour','Multi-packs'] },
    { name: 'Hair Care',          slug: 'hair-care',         sec: ['Shampoo & Conditioner','Hair Treatments & Masks','Styling Products','Multi-packs'] },
    { name: 'Hair Extensions',    slug: 'hair-extensions',   sec: ['Body Wave','Silky Straight','Deep Curly','Kinky Curly','Multi-packs'] },
    { name: 'Bath & Body',        slug: 'bath-body',         sec: ['Body Washes & Soaps','Body Moisturisers','Scrubs & Exfoliants','Hand Care','Multi-packs'] },
    { name: 'Fragrance',          slug: 'fragrance',         sec: ["Women's Fragrance","Men's Fragrance","Fragrance Mists & Wands","Deodorants & Antiperspirants","Gift Sets","Multi-packs"] },
    { name: 'Accessories & Tools',slug: 'accessories-tools', sec: ['Makeup Brushes & Sponges','Hair Tools','Skincare Tools','Hair Accessories','Multi-packs'] },
  ]},
  { name: 'Accessories', slug: 'accessories', image: 'https://placehold.co/400x600/ddd8d0/6b6560?text=Accessories', subs: [
    { name: 'Jewellery',          slug: 'jewellery',         sec: ['Necklaces','Earrings','Bracelets','Rings','Multi-packs'] },
    { name: 'Bags & Handbags',    slug: 'bags-handbags',     sec: ['Tote Bags','Shoulder Bags','Crossbody Bags','Clutches','Backpacks'] },
    { name: 'Belts',              slug: 'belts',             sec: [] },
    { name: 'Sunglasses',         slug: 'sunglasses',        sec: [] },
    { name: 'Scarves & Hats',     slug: 'scarves-hats',      sec: [] },
    { name: 'Watches',            slug: 'watches',           sec: [] },
  ]},
  { name: 'Home', slug: 'home', image: 'https://placehold.co/400x600/e8e4df/6b6560?text=Home', subs: [
    { name: 'Bedding',            slug: 'bedding',           sec: ['Duvet Covers & Sets','Pillowcases','Blankets & Throws','Mattress Protectors'] },
    { name: 'Bath',               slug: 'bath',              sec: ['Towels','Bath Mats & Accessories','Robes'] },
    { name: 'Kitchen & Dining',   slug: 'kitchen-dining',    sec: ['Cookware','Bakeware','Dinnerware','Glassware','Kitchen Accessories'] },
    { name: 'Décor',              slug: 'decor',             sec: ['Candles & Diffusers','Vases & Planters','Frames & Art','Cushions & Throws'] },
    { name: 'Living',             slug: 'living',            sec: ['Rugs','Lighting','Storage & Organisation','Multi-packs'] },
  ]},
  { name: 'Sale',     slug: 'sale',     subs: [] },
  { name: 'Thriftly', slug: 'thriftly', subs: [] },
];

// ── Flatten tree into Airtable record field objects ──────────────────────────
function flattenToRecords() {
  const rows = [];
  TREE.forEach((cat, ci) => {
    rows.push({
      Name:          cat.name,
      Slug:          cat.slug,
      Level:         'Category',
      'Parent Slug': '',
      'Category Slug': cat.slug,
      Status:        'Enabled',
      'Sort Order':  (ci + 1) * 10,
      ...(cat.image ? { Image: [{ url: cat.image }] } : {}),
    });

    cat.subs.forEach((sub, si) => {
      rows.push({
        Name:          sub.name,
        Slug:          sub.slug,
        Level:         'Sub-Category',
        'Parent Slug': cat.slug,
        'Category Slug': cat.slug,
        Status:        'Enabled',
        'Sort Order':  (si + 1) * 10,
      });

      sub.sec.forEach((secName, sei) => {
        rows.push({
          Name:            secName,
          Slug:            toSlug(secName),
          Level:           'Secondary Sub-Category',
          'Parent Slug':   sub.slug,
          'Category Slug': cat.slug,
          Status:          'Enabled',
          'Sort Order':    (sei + 1) * 10,
        });
      });
    });
  });
  return rows;
}

// ── Airtable helpers ─────────────────────────────────────────────────────────
async function listTables() {
  const { data } = await axios.get(META_URL, { headers: JSON_HDR });
  return data.tables;
}

async function createMenuTable() {
  const body = {
    name: 'Menu',
    fields: [
      { name: 'Name',           type: 'singleLineText' },
      { name: 'Slug',           type: 'singleLineText' },
      { name: 'Level',          type: 'singleSelect',  options: { choices: [
        { name: 'Category' },
        { name: 'Sub-Category' },
        { name: 'Secondary Sub-Category' },
      ]}},
      { name: 'Parent Slug',    type: 'singleLineText' },
      { name: 'Category Slug',  type: 'singleLineText' },
      { name: 'Status',         type: 'singleSelect',  options: { choices: [
        { name: 'Enabled',      color: 'greenLight2' },
        { name: 'Disabled',     color: 'redLight2'   },
        { name: 'Coming Soon',  color: 'yellowLight2' },
      ]}},
      { name: 'Sort Order',     type: 'number',        options: { precision: 0 } },
      { name: 'Image',          type: 'multipleAttachments' },
    ],
  };
  const { data } = await axios.post(META_URL, body, { headers: JSON_HDR });
  return data;
}

async function insertBatch(tableId, batch) {
  const url  = `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
  const body = { records: batch.map(fields => ({ fields })) };
  await axios.post(url, body, { headers: JSON_HDR });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🔍 Checking existing tables…');
  const tables   = await listTables();
  let   menuTable = tables.find(t => t.name === 'Menu');

  if (menuTable) {
    console.log(`✓ Menu table already exists (${menuTable.id}) — skipping creation`);
  } else {
    console.log('📋 Creating Menu table…');
    menuTable = await createMenuTable();
    console.log(`✓ Created Menu table (${menuTable.id})`);
  }

  const tableId = menuTable.id;
  const records = flattenToRecords();
  console.log(`📥 Inserting ${records.length} records in batches of 10…`);

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    await insertBatch(tableId, batch);
    process.stdout.write(`   ${Math.min(i + 10, records.length)}/${records.length}\r`);
    // Respect Airtable rate limit: 5 req/s
    await new Promise(r => setTimeout(r, 220));
  }

  console.log(`\n✅ Done — ${records.length} Menu records created`);
  console.log(`\n🔗 View your Menu table:`);
  console.log(`   https://airtable.com/${BASE_ID}/${tableId}`);
})().catch(err => {
  const msg = err.response?.data?.error || err.message;
  console.error('❌ Error:', msg);
  process.exit(1);
});
