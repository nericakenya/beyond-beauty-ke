// Part 5: Saltair (1) + Laneige (4) = 5 products
// Then: variants for Laneige Lip Sleeping Mask (Berry + Vanilla) via Variants table
require('dotenv').config();
const axios = require('axios');

const BASE_URL     = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const VARIANTS_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_VARIANTS_TABLE_ID}`;
const HEADERS      = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const RETURNS = `• Free delivery on orders over KSh 5,000\n• Standard delivery within Nairobi: KSh 250 – 1 to 3 hours\n• We deliver nationwide across Kenya: KSh 500 – 1 to 3 working days\n• Exchanges accepted within 3 days of delivery\n\nFor full details, see our Delivery & Refund Policy at beyondbeauty.co.ke/policies/delivery-refund`;

async function batchCreate(url, records) {
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { data } = await axios.post(url, { typecast: true, records: chunk }, { headers: HEADERS });
    results.push(...data.records);
    if (i + BATCH < records.length) await sleep(260);
  }
  return results;
}

const productRecords = [

  // ── SALTAIR ───────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Saltair 5% AHA Serum Deodorant',
      'Product Category':    'Body Care',
      'Sub-Category':        'Saltair',
      'Badge':               'Coming Soon',
      'Product Description': 'A serum deodorant formulated with 5% AHA — clinically shown to reduce underarm discoloration in 91% of users after 4 weeks. Aluminium-free format using AHA for gentle daily odour control and skin brightening.\n\n• Active: 5% AHA\n• Aluminium-free\n• Clinical study: 91% reduction in underarm discoloration (34 women)\n• Brand: Saltair',
      'How to Use':          'Apply to clean, dry underarms. Allow to absorb before dressing. Use daily.\n\nNote: As an active formula, avoid using immediately after shaving — allow 24 hours.',
      'Ingredients':         '• 5% AHA — gently exfoliates dead skin cells for odour control and visible reduction of underarm discoloration\n• Soothing botanicals — reduce post-shave irritation\n• Odour-neutralising complex — aluminium-free protection',
      'Skin Concerns & Benefits': '• Underarm discoloration (very common concern, especially in East African skin tones)\n• Aluminium-free deodorant seekers\n• Skin brightening in the underarm area\n• Daily odour control without harsh chemicals',
      'Returns Override':    RETURNS,
    },
  },

  // ── LANEIGE ───────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Laneige Lip Sleeping Mask 20g',
      'Product Category':    'Skincare',
      'Sub-Category':        'Laneige',
      'Badge':               'Coming Soon',
      'Product Description': 'The original K-beauty lip mask — a global phenomenon. Laneige Lip Sleeping Mask repairs and hydrates lips overnight with its exclusive Moisture Wrap technology, Berry Mix Complex, and Evening Primrose Root Extract.\n\nReduces flakiness and dryness for visibly softer, fuller lips by morning.\n\n• Size: 20g\n• Use: PM overnight\n• Available scents: Berry / Vanilla\n• Includes spatula applicator\n• Brand: Laneige',
      'How to Use':          'Apply a generous layer to lips as the last step of your evening routine. Do not apply over other lip products. Leave overnight and wake up to soft, hydrated lips.\n\nA small spatula is included — use to apply cleanly.',
      'Ingredients':         '• Berry Mix Complex (Raspberry, Strawberry, Cranberry, Blueberry Extracts) — Vitamin C-rich antioxidants; soothing\n• Evening Primrose Root Extract — essential fatty acids for barrier repair\n• Hunza Apricot Extract — nourishes and repairs overnight\n• Moisture Wrap (Hyaluronic Acid + Minerals) — locks moisture in',
      'Skin Concerns & Benefits': '• Dry, chapped, or flaky lips\n• Lip hydration overnight\n• Prep for lipstick application (soft, smooth base)\n• Regular lip maintenance\n• Travel recovery (air conditioning and aeroplane dryness)',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Laneige Cream Skin Cerapeptide Refiner',
      'Product Category':    'Skincare',
      'Sub-Category':        'Laneige',
      'Badge':               'Coming Soon',
      'Product Description': 'The second-generation Cream Skin — a milky toner-moisturiser hybrid. Now upgraded with Cerapeptide (Ceramides + Peptides) for deep hydration that also strengthens the skin barrier. White Leaf Tea Water provides amino acids for a strong, glowing skin barrier.\n\nA 3-in-1: toner, essence, and moisturiser in one milky formula.\n\n• Texture: Milky, lightweight\n• Key upgrade: Cerapeptide (Ceramide + Peptide complex)\n• Skin type: All, especially dry and sensitive\n• Brand: Laneige',
      'How to Use':          'After cleansing, apply to face and neck by pressing directly into skin with palms, or with a cotton pad. Can be layered 2–3 times for deeper hydration (functions as toner, essence, and light moisturiser combined).',
      'Ingredients':         '• Cerapeptide Complex — Ceramides + Peptides for barrier repair and hydration\n• White Leaf Tea Water — cold-brewed; rich in amino acids for skin radiance\n• Beta-Glucan — deep hydration and barrier support',
      'Skin Concerns & Benefits': '• Dry / dehydrated skin at all depths\n• Compromised or sensitive skin barrier\n• Those wanting to simplify their routine (replaces multiple steps)\n• Skin needing barrier repair after exfoliation or actives',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Laneige Glaze Craze Tinted Lip Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'Laneige',
      'Badge':               'Coming Soon',
      'Product Description': 'A tinted lip serum with 95% skincare ingredients — buildable colour with a high-shine "glazed donut" finish. Infused with Polypeptide (plumping), Argan Ceramides (barrier nourishment), and Polyglutamic Acid (moisture retention). 12 hours of hydration.\n\n• 95% skincare ingredients\n• Finish: High-shine, glazed\n• Wear: 12-hour hydration\n• Donut-shaped applicator for even coating\n• Confirm shade variants from Accessories Trend\n• Brand: Laneige',
      'How to Use':          'Apply directly from the donut applicator to lips for an even, glossy coat. Layer for more colour and shine. Can be worn alone or over any lip liner or lipstick.',
      'Ingredients':         '• Polypeptide — visibly plumps lips\n• Argan Ceramides — nourish and support lip moisture barrier\n• Polyglutamic Acid (PGA) — retains and attracts moisture for lasting hydration',
      'Skin Concerns & Benefits': '• Dry lips needing colour + care combined\n• Those who want the glazed-lip look with skincare benefits\n• Buildable colour from sheer to bolder with layering\n• Everyday lip hydration',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Laneige Bouncy & Firm Sleeping Mask',
      'Product Category':    'Skincare',
      'Sub-Category':        'Laneige',
      'Badge':               'Coming Soon',
      'Product Description': 'An overnight firming sleeping mask inspired by the Korean "slow ageing" trend. Melting glow capsules mimic skin\'s lipids to protect the moisture barrier overnight. Peony & Collagen Complex™ and Peptides help boost and preserve collagen for visibly plump, bouncy skin.\n\n• Use: PM — leave-on overnight mask\n• Targets: Fine lines, loss of firmness, radiance\n• Brand: Laneige',
      'How to Use':          'Apply as the final skincare step in the evening as an overnight treatment. Use 2–3 times per week, or whenever skin needs a firming boost. Rinse off in the morning.',
      'Ingredients':         '• Peony & Collagen Complex™ — boosts and preserves collagen for firmness\n• Melting Glow Capsules — mimic skin\'s own lipids for overnight barrier protection\n• Peptides — anti-ageing and skin elasticity support',
      'Skin Concerns & Benefits': '• Loss of firmness and skin elasticity\n• Fine lines and early wrinkles\n• Dull skin needing overnight renewal\n• Anti-ageing maintenance for skin in its 30s–50s',
      'Returns Override':    RETURNS,
    },
  },
];

async function run() {
  // 1. Create base products
  console.log(`Creating ${productRecords.length} products (Part 5: Saltair + Laneige)…`);
  const created = await batchCreate(BASE_URL, productRecords);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));

  // 2. Find the Lip Sleeping Mask record ID
  const lipMaskRecord = created.find(r => r.fields['Product Name'] === 'Laneige Lip Sleeping Mask 20g');
  if (!lipMaskRecord) { console.log('\n⚠ Lip Sleeping Mask not found — skipping variants'); return; }

  const lipMaskId = lipMaskRecord.id;
  console.log(`\nCreating variants for Laneige Lip Sleeping Mask (${lipMaskId})…`);

  // 3. Create Berry + Vanilla scent variants
  const variantRecords = [
    {
      fields: {
        'SKU':      'BB-LLSM-BERRY',
        'Colour':   'Berry',
        'Active':   true,
        'Products': [lipMaskId],
      },
    },
    {
      fields: {
        'SKU':      'BB-LLSM-VANILLA',
        'Colour':   'Vanilla',
        'Active':   true,
        'Products': [lipMaskId],
      },
    },
  ];

  const createdVariants = await batchCreate(VARIANTS_URL, variantRecords);
  createdVariants.forEach(r => console.log(`  ${r.id}  ${r.fields['Colour']} (${r.fields['SKU']})`));

  console.log(`\n✓ Part 5 done. ${created.length} products + ${createdVariants.length} variants created.`);
  console.log('\n── FULL CATALOGUE SUMMARY ──────────────────────────────');
  console.log('  Part 1: Sol de Janeiro (3) + Estée Lauder (8)   = 11');
  console.log('  Part 2: Medicube (7) + ANUA (8)                 = 15');
  console.log('  Part 3: Adv. Clinicals (3) + BOJ (4) + DA (4)  = 11');
  console.log('  Part 4: Olaplex (5) + Naturium (8)              = 13');
  console.log('  Part 5: Saltair (1) + Laneige (4)               =  5');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  TOTAL: 55 products created across 11 brands');
  console.log('\n  ⚠ Open items before publishing:');
  console.log('  • Add product images for all 55 products in Airtable');
  console.log('  • Confirm prices at ShopEve (Sol de Janeiro) and Accessories Trend (all others)');
  console.log('  • Confirm remaining Laneige scent variants (Gummy Bear, Sweet Candy, Peach)');
  console.log('  • Confirm Olaplex No.3 250ml size — add as variant when price confirmed');
  console.log('  • Change Badge from "Coming Soon" to active when stock confirmed');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
