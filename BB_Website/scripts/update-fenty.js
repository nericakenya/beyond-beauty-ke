require('dotenv').config();
const axios = require('axios');

const BASE          = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;
const PRODUCTS_URL  = `${BASE}/${process.env.AIRTABLE_TABLE_ID}`;
const VARIANTS_URL  = `${BASE}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function batchPatch(url, records) {
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { data } = await axios.patch(url, { records: chunk }, { headers: HEADERS });
    results.push(...data.records);
    if (i + BATCH < records.length) await sleep(260);
  }
  return results;
}

const FB = 'https://cdn.shopify.com/s/files/1/0341/3458/9485/files';
const W  = 'https://static.wixstatic.com/media'; // fallback for 4 shades not on Fenty's site

// ── Variant image updates (record ID from seed-fenty.js output) ───────────────
// img: null  = no image change (P8/P9/P10 no-shade variants don't have variant images)
const variants = [

  // P1 — Shake N' Play Liquid Blush
  { id: 'reclwixrQHJxBsH7P', label: "BOW'PEEP",        img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_BOW-PEEP_1200X1500_72DPI_793ec26e-e4f9-41e5-a4e1-dadb0c2d7588.jpg?v=1774661216` },
  { id: 'recEi9AutA24L1AbL', label: 'FIYA PAPAYA',     img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_FIYA-PAPAYA_1200X1500_72DPI_74ba1bc7-4aed-4c52-9d55-cae8cedf03d9.jpg?v=1774661215` },
  { id: 'recS6xb3Rev3WAD0u', label: "WILD'BERRY WHIP", img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_WILDBERRY-WHIP_1200X1500_72DPI_7208eb0b-f336-415b-832f-336059de0066.jpg?v=1774661215` },
  { id: 'recdLGBaLagMqhMXD', label: "QUIT WINE'IN",    img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_QUIT-WINE-IN_1200X1500_72DPI.jpg?v=1774661215` },
  { id: 'recLvHME4L57W9kpI', label: 'VIOLET VICE$',    img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_VIOLET-VICES_1200X1500_72DPI_10267098-6997-42cf-93cd-cd9d7fcc26a8.jpg?v=1774661215` },

  // P2 — Sun Stalk'R Soufflé Bronzer
  { id: 'rec0GJIj2kBaE30tD', label: 'Biscotti',        img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_BISCOTTI_1200X1500_72DPI.jpg` },
  { id: 'recXAm73GO3Jv1jMN', label: "Brown Butt'R",    img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_BROWNBUTTR_1200X1500_72DPI.jpg?v=1776731545` },
  { id: 'reci1SaIYC4fnZJ39', label: 'Sweet Truffle',   img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_SWEETTRUFFLE_1200X1500_72DPI.jpg?v=1776729829` },
  { id: 'recSjGG3RIKjxSona', label: 'Coffee Toffee',   img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_COFFEETOFFEE_1200X1500_72DPI.jpg?v=1776730018` },
  { id: 'recdmxWlQkXm1FgpU', label: 'Hot Fudge',       img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_HOTFUDGE_1200X1500_72DPI.jpg?v=1776731546` },

  // P3 — Soft'lit Foundation (not on Fenty's current site — keeping Lintons images)
  { id: 'rec4Nu4y5ZN0Fl0Mm', label: '225',              img: `${W}/8832f2_0f4aa958e4fd48e28b73e3f894049d74~mv2.jpg`, note: 'Lintons (not on Fenty site)' },
  { id: 'recK2Z4AASAsxQNYc', label: '385',              img: `${W}/8832f2_8492212d9b284bdbb712b80b30fd4f59~mv2.jpg`, note: 'Lintons (not on Fenty site)' },

  // P4 — Stunna Lip Paint
  { id: 'recc8AK7rSCwlty5t', label: 'Riri',             img: `${FB}/FB_FALL25_T2PRODUCT_ECOMM_STUNNA_RIRI_1200X1500_72DPI.jpg?v=1753824978` },
  { id: 'recmQisP1lqVQV29h', label: 'Uninterested',     img: `${FB}/FB_FALL25_T2PRODUCT_ECOMM_STUNNA_UNINTERESTED_1200X1500_72DPI.jpg?v=1753825018` },
  { id: 'recXm4OlU9WMHWRMv', label: 'Unlawful',         img: `${FB}/FB_FALL25_T2PRODUCT_ECOMM_STUNNA_UNLAWFUL_1200X1500_72DPI.jpg?v=1753824946` },

  // P5 — Trace'd Out Lip Liner
  { id: 'rec09DGu0TKf86L3x', label: 'RIRI',             img: `${FB}/FB_FALL24_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_RIRI_1200x1500_72DPI.jpg?v=1762285110` },
  { id: 'recYAYEZIym02ESrc', label: 'Satin Panty',      img: `${FB}/FB_FALL24_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_SATINPANTY_1200x1500_72DPI.jpg?v=1762285111` },
  { id: 'recVDM3EJ6zhkcCfW', label: 'Pnut Butta',       img: `${FB}/FB_FALL24_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_PNUTBUTTA_1200x1500_72DPI.jpg?v=1762285116` },
  { id: 'recwD3FgYffIhlL5G', label: 'Rose Amber',       img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_ROSE-AMBER_1200x1500_72DPI.jpg?v=1771449787` },
  { id: 'recvR5TnnqoKJKo8Y', label: 'Whiskey',          img: `${FB}/FB_SMR25_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_WHISKEY_1200x1500_72DPI.jpg?v=1762291418` },
  { id: 'recwQSVHqHWRmdSUo', label: 'Bored Heaux',      img: `${FB}/FB_SMR25_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_BOREDHEAUX_1200x1500_72DPI.jpg?v=1762291417` },

  // P6 — Gloss Bomb Stix
  { id: 'recrVJXTAuGEP09VZ', label: 'Rose Amber',       img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_GB_ROSE-AMBER_1200x1500_72DPI.jpg?v=1771449143` },
  { id: 'recbnVVVzAgkLuVV5', label: 'Peach Nude',       img: `${W}/8832f2_64244f4cc97c490d9b44686be26f43e8~mv2.jpg`, note: 'Lintons (shade not on Fenty site)' },

  // P7 — Hella Thicc Mascara
  { id: 'recaBxRmbovNMtDFL', label: "Cuz I'm Black",    img: 'https://cdn.shopify.com/s/files/1/0341/3458/9485/products/54548.jpg?v=1762271787' },

  // P8 / P9 / P10 — no-shade variants: no Variant Image needed (product primary image handles it)
  // These are skipped below (img: null check)
];

// ── Product primary image updates ─────────────────────────────────────────────
// First shade image becomes the primary (what users see before selecting a shade).
// Query Airtable for Fenty products by name to get their record IDs.
const productPrimaryImages = [
  { name: "Fenty Beauty Shake N' Play Liquid Blush",                          img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SHAKE-N-PLAY_BLUSH_BOW-PEEP_1200X1500_72DPI_793ec26e-e4f9-41e5-a4e1-dadb0c2d7588.jpg?v=1774661216` },
  { name: "Fenty Beauty Sun Stalk'R Soufflé Bronzer",                         img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_SUNSTALKR_SOUFFLE_BRONZER_BISCOTTI_1200X1500_72DPI.jpg` },
  { name: "Fenty Beauty Soft'lit Naturally Luminous Longwear Foundation",      img: `${W}/8832f2_0f4aa958e4fd48e28b73e3f894049d74~mv2.jpg` }, // no Fenty CDN available
  { name: 'Fenty Beauty Stunna Lip Paint Longwear Fluid Lip Color',           img: `${FB}/FB_FALL25_T2PRODUCT_ECOMM_STUNNA_RIRI_1200X1500_72DPI.jpg?v=1753824978` },
  { name: "Fenty Beauty Trace'd Out Longwear Waterproof Pencil Lip Liner",    img: `${FB}/FB_FALL24_T2PRODUCT_ECOMM_TRACDOUT-LIPLINER_RIRI_1200x1500_72DPI.jpg?v=1762285110` },
  { name: 'Fenty Beauty Gloss Bomb Stix High-Shine Gloss Stick',              img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_GB_ROSE-AMBER_1200x1500_72DPI.jpg?v=1771449143` },
  { name: 'Fenty Beauty Hella Thicc Volumizing Mascara',                      img: 'https://cdn.shopify.com/s/files/1/0341/3458/9485/products/54548.jpg?v=1762271787' },
  { name: 'Fenty Beauty Blush Brush 155',                                     img: `${FB}/FB_FALL24_T2PRODUCT_ECOMM_BLUSHBRUSH_155_STANDING_sRGB72.jpg?v=1762287266` },
  { name: 'Fenty Beauty Gloss Bomb Universal Lip Luminizer — Wattabrat',      img: `${FB}/FB_SPR26_T2PRODUCT_ECOMM_LE-WATTAMOMENT_GB-OG_WATTABRAT_1200x1500_72DPI_NOBOX.jpg?v=1774988171` },
  { name: 'Fenty Beauty Iconic Lip Trio — Lips that Blush',                   img: `${W}/8832f2_3f5c2da53c3e4dfca666641b87312bfb~mv2.jpg` }, // no Fenty CDN available
];

async function run() {
  // 1. Patch variant images
  console.log('1/2  Patching variant images…');
  const variantPatches = variants
    .filter(v => v.img)
    .map(v => ({ id: v.id, fields: { 'Variant Image': [{ url: v.img }] } }));

  const updatedVariants = await batchPatch(VARIANTS_URL, variantPatches);
  updatedVariants.forEach((r, i) => {
    const v = variants.find(x => x.id === r.id);
    const source = v?.note ? ` [${v.note}]` : ' [Fenty CDN]';
    console.log(`     ✓ ${v?.label ?? r.id}${source}`);
  });

  // 2. Fetch product IDs by name and patch primary images
  console.log('\n2/2  Patching product primary images…');
  const { data: allProducts } = await axios.get(PRODUCTS_URL, {
    headers: HEADERS,
    params: { filterByFormula: `{Product Category} = "Beauty"`, fields: ['Product Name'], maxRecords: 50 },
  });

  const nameToId = {};
  allProducts.records.forEach(r => { nameToId[r.fields['Product Name']] = r.id; });

  const productPatches = productPrimaryImages
    .map(p => {
      const id = nameToId[p.name];
      if (!id) { console.log(`     ⚠ Not found: ${p.name}`); return null; }
      return { id, fields: { 'Primary Image URL': [{ url: p.img }] } };
    })
    .filter(Boolean);

  const updatedProducts = await batchPatch(PRODUCTS_URL, productPatches);
  updatedProducts.forEach(r => {
    const p = productPrimaryImages.find(x => nameToId[x.name] === r.id);
    const source = (p?.img?.includes('wixstatic') ? ' [Lintons — no Fenty CDN image found]' : ' [Fenty CDN]');
    console.log(`     ✓ ${p?.name ?? r.id}${source}`);
  });

  console.log('\n✓ Done. Variant + product images updated.\n');
  console.log('⚠  4 images kept from Lintons CDN (not found on Fenty Beauty official site):');
  console.log('   • Soft\'lit Foundation 225 — fentybeauty.com may not carry this shade in US store');
  console.log('   • Soft\'lit Foundation 385 — same');
  console.log('   • Gloss Bomb Stix Peach Nude — shade not found in current Fenty lineup');
  console.log('   • Iconic Lip Trio — Lips that Blush — not in current Fenty catalog');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
