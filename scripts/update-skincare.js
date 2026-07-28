require('dotenv').config();
const axios = require('axios');

const BASE          = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;
const PRODUCTS_URL  = `${BASE}/${process.env.AIRTABLE_TABLE_ID}`;
const VARIANTS_URL  = `${BASE}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const MOVEMENTS_URL = `${BASE}/tblQ7JNyChQuSay0a`;
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

async function batchCreate(url, records) {
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { data } = await axios.post(url, { records: chunk }, { headers: HEADERS });
    results.push(...data.records);
    if (i + BATCH < records.length) await sleep(260);
  }
  return results;
}

// ── Product data: Airtable record ID + Pharmaplus price + brand image URL ──────

const CERAVE = 'https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us';
const TO     = 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default';
const LRP    = 'https://www.laroche-posay-me.com/-/media/project/loreal/brand-sites/lrp/apac/mena/products';

const products = [
  // ── CeraVe ──────────────────────────────────────────────────────────────────
  {
    id:    'recDb3DcF0jGQJI4Q',
    name:  'CeraVe Moisturising Lotion 236ml',
    price: 2376,
    img:   `${CERAVE}/skincare/moisturizers/daily-moisturizing-lotion/2025/daily-moisturizing-lotion_front.jpg`,
  },
  {
    id:    'rec1zSkT16HPPcgPU',
    name:  'CeraVe Renewing Night Cream 48g',
    price: 3990,
    img:   `${CERAVE}/skincare/2025/skin-renewing-night-cream/700x785/skin-renewing-night-cream-packshot-front-700x785-v1.jpg`,
  },
  {
    id:    'recVJjkVeGSwgYx41',
    name:  'CeraVe Healing Ointment 144g',
    price: 2500,
    img:   `${CERAVE}/skincare/moisturizers/healing-ointment/2025/healing-ointment_front.jpg`,
  },
  {
    id:    'recFZGmX44Fl1rojg',
    name:  'CeraVe Acne Foaming Cream Cleanser 150ml',
    price: 3800,
    img:   `${CERAVE}/skincare/acne/acne/foaming-cream-wash/acne-foaming-cream-wash_front.jpg`,
  },
  {
    id:    'recw6J0GHCENoBxec',
    name:  'CeraVe Oil Control Moisturising Gel-Cream 52ml',
    price: 2950,
    img:   `${CERAVE}/skincare/2025/oil-control/pasted-image-(22).jpg`,
  },
  {
    id:    'recLAtprQc9kP1aYj',
    name:  'CeraVe Acne Control Cleanser 237ml',
    price: 3360,
    img:   `${CERAVE}/skincare/acne/acne/control-cleanser/acne-cleanser_front.jpg`,
  },
  {
    id:    'recAf8XDuWJZJbX0s',
    name:  'CeraVe Skin Renewing Retinol Serum 30ml',
    price: 4550,
    img:   `${CERAVE}/products/skin-renewing-retinol-serum/700x875/cerave_skin_renewing_retinol_serum-front-700x875-v1.jpg`,
  },
  {
    id:    'recadw5i4TZtXFlZx',
    name:  'CeraVe Skin Renewing Day Cream SPF 30 50g',
    price: 8956,
    img:   `${CERAVE}/products/skin-renewing-day-cream/skin-renewing-day-cream_front.jpg`,
  },
  {
    id:    'recDfjWLNPI8bWopU',
    name:  'CeraVe AM Facial Moisturising Lotion SPF 30 52ml',
    price: 2800,
    img:   `${CERAVE}/skincare/moisturizers/am-facial-moisturizing-lotion-with-sunscreen/am-30-facial-moisturizer_front.jpg`,
  },

  // ── La Roche-Posay ───────────────────────────────────────────────────────────
  {
    id:    'recwGfQm9p5zR35xG',
    name:  'La Roche-Posay Effaclar Duo(+) SPF 30 40ml',
    price: 3950,
    img:   `${LRP}/effaclar/effaclar-duo-plus-spf-30/larocheposayfacecareeffaclarduospf30antiimperfectionsmarksuv40ml3337875549493front.png`,
  },
  {
    id:    'recgKOua7gOnB6c9l',
    name:  'La Roche-Posay Pure Retinol B3 Serum 30ml',
    price: 7250,
    img:   'https://skintypesolutions.com/cdn/shop/products/la-roche-posay-retinol-b3-pure-retinol-serum-la-roche-posay-1-fl-oz-374174_1100x.jpg?v=1762198311',
  },
  {
    id:    'recVQT66N9qAYqJil',
    name:  'La Roche-Posay Cicaplast Baume B5+',
    price: 3690,
    img:   `${LRP}/cicaplast/cicaplast-baume-b5-plus/larocheposayproductcicaplastbaumeb5100ml3337875816847.png`,
  },
  {
    id:    'reccodW3xPkkOmgow',
    name:  'La Roche-Posay Lipikar Syndet AP+ Refill 400ml',
    price: 2850,
    img:   `${LRP}/lipikar/lipikar-syndet-ap-plus/eczema-lipikar-syndet-ap/la-roche-posay-productpage-eczema-lipikar-syndet-ap-400ml-3337875537315-front.png`,
  },
  {
    id:    'recI6hwUlxlipf1vh',
    name:  'La Roche-Posay Anthelios Sunscreen (SKU TBC)',
    price: null, // SKU not confirmed — price not yet set
    img:   'https://www.laroche-posay-me.com/-/media/project/loreal/brand-sites/lrp/apac/my/products/anthelios/anthelios-uvmune-400-invisible-fluid-spf50--plus-non-perfumed/lrpproductpagesunantheliosuvmune400fluidspspf503337875797597frontpng.png',
  },

  // ── The Ordinary ─────────────────────────────────────────────────────────────
  {
    id:    'reck9eVSsPF3jm8iR',
    name:  'The Ordinary Niacinamide 10% + Zinc 1% 30ml',
    price: 2230,
    img:   `${TO}/dwce8a7cdf/Images/products/The%20Ordinary/rdn-niacinamide-10pct-zinc-1pct-30ml.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recJkIh0lSCjMOXEj',
    name:  'The Ordinary Hyaluronic Acid 2% + B5 30ml',
    price: 2409,
    img:   `${TO}/dw67286abd/Images/products/The%20Ordinary/ord-hyaluronic-acid-2pct-B5-30ml-Clr-Acu.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recbvQretVovZorqz',
    name:  'The Ordinary Buffet Peptide Serum 30ml',
    price: 2430,
    img:   `${TO}/dw68423659/Images/products/The%20Ordinary/rdn-multi-peptide-ha-serum-30ml.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recowkLH0sQTUJBAB',
    name:  'The Ordinary Azelaic Acid Suspension 10% 30ml',
    price: 4000,
    img:   `${TO}/dw711cec9a/Images/products/The%20Ordinary/rdn-azelaic-acid-suspension-10pct-30ml.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recb5v1zc0nlJXi0P',
    name:  'The Ordinary Ascorbic Acid 8% + Alpha Arbutin 2% 30ml',
    price: 2850,
    img:   `${TO}/dwa0a0786e/Images/products/The%20Ordinary/rdn-100pct-AscorbicAcid8+AlphaArbutin2-Product-30ml.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recBmSQxME8PD0rag',
    name:  'The Ordinary Salicylic Acid 2% Solution 30ml',
    price: 2950,
    img:   `${TO}/dwc17b2bd6/Images/products/The%20Ordinary/rdn-salicylic-acid-2pct-solution-otc.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'rec3JmoLvGNr0u2pH',
    name:  'The Ordinary Lactic Acid 5% + HA 30ml',
    price: 2760,
    img:   `${TO}/dwff3b7bf8/Images/products/The%20Ordinary/rdn-lactic-acid-5pct-ha-30ml.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'recWJ38o5Pdu4ygP8',
    name:  'The Ordinary Glycolic Acid 7% Toning Solution 240ml',
    price: 3680,
    img:   `${TO}/dw8b57fa2b/Images/products/The%20Ordinary/ord-glyc-acid-7pct-100ml-Aug-UPC.png?sw=800&sh=800&sm=fit`,
  },
  {
    id:    'rec4x7s4ioJJUbYzQ',
    name:  'The Ordinary 100% Plant-Derived Squalane 30ml',
    price: 2230,
    img:   `${TO}/dwc1227059/Images/products/The%20Ordinary/rdn-100pct-plant-derived-squalane-30ml.png?sw=800&sh=800&sm=fit`,
  },

  // ── COSRX ────────────────────────────────────────────────────────────────────
  {
    id:    'recxxKkGui7F7roSd',
    name:  'COSRX Advanced Snail 96 Mucin Power Essence 100ml',
    price: 2600,
    img:   'https://www.cosrx.com/cdn/shop/files/advanced-snail-96-mucin-power-essence-cosrx-official-4.jpg?v=1763111577',
  },
  {
    id:    'reckEhQ2mvQVkRaSt',
    name:  'COSRX Advanced Snail 92 All-In-One Cream',
    price: 3268,
    img:   'https://www.cosrx.com/cdn/shop/files/advanced-snail-92-all-in-one-cream-cosrx-official-4.jpg?v=1762909943',
  },
  {
    id:    'recyoFYzscBdg3FsW',
    name:  'COSRX Salicylic Acid Daily Gentle Cleanser 150ml',
    price: 2200,
    img:   'https://us.facethefuture.store/cdn/shop/products/11540297-1054840932408354.jpg?v=1695139150',
  },
];

async function run() {
  // 1. Patch prices + images
  console.log('1/3  Updating prices and images…');
  const patchRecords = products.map(p => {
    const fields = { 'Primary Image URL': [{ url: p.img }] };
    if (p.price !== null) fields['Price (KES)'] = p.price;
    return { id: p.id, fields };
  });
  const updated = await batchPatch(PRODUCTS_URL, patchRecords);
  updated.forEach(r => {
    const p = products.find(x => x.id === r.id);
    const priceStr = p.price !== null ? `KES ${p.price.toLocaleString()}` : 'no price (SKU TBC)';
    console.log(`     ✓ ${r.fields['Product Name']} — ${priceStr}`);
  });

  // 2. Create one variant per product
  console.log('\n2/3  Creating variants…');
  const variantRecords = products.map(p => ({
    fields: { 'Active': true, 'Products': [p.id] },
  }));
  const variants = await batchCreate(VARIANTS_URL, variantRecords);
  variants.forEach((v, i) => console.log(`     ✓ Variant ${v.id} → ${products[i].name}`));

  // 3. Create Stock In movement (qty 5) per variant
  console.log('\n3/3  Creating inventory movements (qty 5)…');
  const today = new Date().toISOString().slice(0, 10);
  const movementRecords = variants.map((v, i) => ({
    fields: {
      'Movement':      `Initial stock — ${products[i].name}`,
      'Date':          today,
      'Movement Type': 'Stock In',
      'Quantity':      5,
      'Variant':       [v.id],
    },
  }));
  const movements = await batchCreate(MOVEMENTS_URL, movementRecords);
  movements.forEach((m, i) => console.log(`     ✓ Movement ${m.id} → qty 5 — ${products[i].name}`));

  console.log(`\n✓ Done. ${products.length} products updated.\n`);
  console.log('⚠  Note: CeraVe Day Cream SPF 30 priced at KSh 8,956 — verify this on Pharmaplus before publishing.');
  console.log('⚠  LRP Anthelios has no price set — confirm SKU with Pharmaplus before publishing.');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
