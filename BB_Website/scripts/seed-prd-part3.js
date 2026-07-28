// Part 3: Advanced Clinicals (3) + Beauty of Joseon (4) + Dr. Althea (4) = 11 products
require('dotenv').config();
const axios = require('axios');

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS  = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const RETURNS = `• Free delivery on orders over KSh 5,000\n• Standard delivery within Nairobi: KSh 250 – 1 to 3 hours\n• We deliver nationwide across Kenya: KSh 500 – 1 to 3 working days\n• Exchanges accepted within 3 days of delivery\n\nFor full details, see our Delivery & Refund Policy at beyondbeauty.co.ke/policies/delivery-refund`;

async function batchCreate(records) {
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { data } = await axios.post(BASE_URL, { typecast: true, records: chunk }, { headers: HEADERS });
    results.push(...data.records);
    if (i + BATCH < records.length) await sleep(260);
  }
  return results;
}

const records = [

  // ── ADVANCED CLINICALS ────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Advanced Clinicals Retinol Advanced Firming Cream (Fragrance-Free)',
      'Product Category':    'Skincare',
      'Sub-Category':        'Advanced Clinicals',
      'Price (KES)':         3200,
      'Sale Price':          2200,
      'Badge':               'Coming Soon',
      'Product Description': 'A high-concentration retinol firming cream for body and face. Fragrance-free formula designed to visibly firm and reduce the appearance of fine lines, crepey skin, and loss of elasticity.\n\n• Fragrance-free\n• Suitable for face and body\n• Brand: Advanced Clinicals',
      'How to Use':          'Apply to face, neck, and body areas of concern in the evening. Begin with every other day; build to nightly use.\n\nAlways use SPF 30+ the following morning.\n\n⚠ Not recommended during pregnancy.',
      'Ingredients':         '• Retinol — accelerates cell turnover, visibly firms and smooths\n• Vitamin E — antioxidant and skin conditioning\n• Hyaluronic Acid — hydration support\n• Shea Butter — nourishes while retinol works',
      'Skin Concerns & Benefits': '• Crepey, sagging skin on body (arms, neck, décolletage)\n• Fine lines and wrinkles (face and body)\n• Loss of firmness\n• Those wanting retinol at an accessible price point',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Advanced Clinicals Vitamin C Brightening Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'Advanced Clinicals',
      'Badge':               'Coming Soon',
      'Product Description': 'A potent Vitamin C facial serum targeting uneven skin tone. Ferulic Acid supports Vitamin C stability and enhances effectiveness. Instantly hydrating and therapeutic on application.\n\n• Key actives: Vitamin C, Ferulic Acid\n• Texture: Lightweight serum\n• Brand: Advanced Clinicals',
      'How to Use':          'Apply to clean, dry face in the morning before moisturiser and SPF. A few drops are sufficient. Allow to absorb fully.\n\nAlways pair Vitamin C with SPF for maximum effectiveness.',
      'Ingredients':         '• Vitamin C — brightens, antioxidant protection, stimulates collagen\n• Ferulic Acid — stabilises Vitamin C and enhances penetration\n• Hyaluronic Acid — lightweight hydration',
      'Skin Concerns & Benefits': '• Hyperpigmentation and dark spots\n• Dull complexion\n• Sun damage\n• Anti-ageing with antioxidant protection',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Advanced Clinicals 10% Glycolic + Lactic Acid Exfoliating Body Cream',
      'Product Category':    'Skincare',
      'Sub-Category':        'Advanced Clinicals',
      'Badge':               'Coming Soon',
      'Product Description': 'A dual AHA body cream combining 10% Glycolic and Lactic Acid with Licorice Root and Vitamin E for exfoliating, brightening, and hydrating all at once. Improves texture, reduces crepey appearance, and evens tone. No added fragrance.\n\n• AHA concentration: 10% (Glycolic + Lactic)\n• Fragrance-free\n• Dermatology and allergy tested\n• Brand: Advanced Clinicals',
      'How to Use':          'Apply to body in the evening after showering. Focus on rough, bumpy or uneven areas: elbows, knees, upper arms, back of thighs. Start every other day; build to daily use.\n\nUse SPF on exposed areas the following morning.',
      'Ingredients':         '• Glycolic Acid — resurfaces rough, bumpy skin texture\n• Lactic Acid — smooths flaky skin, locks in moisture\n• Licorice Root — brightens dark spots and soothes\n• Vitamin E — nourishes and intensely hydrates',
      'Skin Concerns & Benefits': '• Rough, bumpy body skin (keratosis pilaris)\n• Uneven body skin tone\n• Dry, crepey skin texture\n• Dark spots on body\n• Elbows, knees, and post-shave skin smoothing',
      'Returns Override':    RETURNS,
    },
  },

  // ── BEAUTY OF JOSEON ──────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Beauty of Joseon Ginseng Essence Water 150ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Beauty of Joseon',
      'Price (KES)':         1500,
      'Badge':               'Coming Soon',
      'Product Description': 'An essence-toner hybrid with 80% Ginseng Root Water — rich in antioxidants, saponins, and anti-inflammatory properties. Delivers deep hydration, promotes circulation and collagen production, and provides calming effects for reactive skin.\n\n• Ginseng Root Water: 80%\n• Texture: Water-light essence\n• All skin types\n• Brand: Beauty of Joseon',
      'How to Use':          'After cleansing, apply to a cotton pad and sweep across face, or press directly into skin with palms. Layer 2–3 times using the "7-skin method" for deeper hydration. Use AM and PM.',
      'Ingredients':         '• Ginseng Root Water 80% — antioxidant-rich, anti-ageing, anti-inflammatory\n• Niacinamide — brightens and minimises pores\n• Hyaluronic Acid — deep hydration',
      'Skin Concerns & Benefits': '• Dull, ageing skin\n• Loss of radiance and firmness\n• Dehydrated skin\n• Sensitive / reactive skin (anti-inflammatory)\n• Dark spots and uneven tone',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+ PA++++ 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Beauty of Joseon',
      'Price (KES)':         2000,
      'Badge':               'Coming Soon',
      'Product Description': 'Beauty of Joseon\'s viral SPF — one of the most loved sunscreens in the K-beauty community globally. A chemical sunscreen with no white cast, formulated with Rice Extract and Probiotics to calm, nourish, and brighten skin while protecting at SPF50+ PA++++.\n\n• SPF: 50+ PA++++\n• Type: Chemical sunscreen (no white cast)\n• Finish: Moist, slightly dewy\n• Skin type: All, including sensitive\n• Cruelty-free, EWG verified\n• Brand: Beauty of Joseon',
      'How to Use':          'Apply as the final step of your morning skincare routine, 15 minutes before sun exposure. Use approximately 1/4 teaspoon for the face. Reapply every 2 hours outdoors.\n\nThis is a chemical sunscreen — apply generously for full SPF efficacy. Do not rely on makeup with SPF as the sole sun protection.',
      'Ingredients':         '• Rice Extract — brightens and soothes skin\n• Probiotics — strengthens skin barrier, reduces irritation\n• Niacinamide — evens tone and minimises pores\n• SPF 50+ PA++++ Chemical Filters — broad-spectrum UV protection',
      'Skin Concerns & Benefits': '• Daily UV protection (critical in Nairobi\'s equatorial sun)\n• No white cast — essential for medium to deep skin tones\n• Sensitive skin — Rice + Probiotic formula is soothing\n• Prevention of UV-induced hyperpigmentation (PIH)\n• Dewy finish compatible with glass-skin routines',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Beauty of Joseon Glow Serum: Propolis + Niacinamide 30ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Beauty of Joseon',
      'Badge':               'Coming Soon',
      'Product Description': 'Beauty of Joseon\'s hero brightening serum. Propolis Extract (60%) and Niacinamide (2%) work together to deeply hydrate, brighten, and strengthen the skin barrier — leaving a natural glass-skin glow.\n\n• Propolis Extract: 60%\n• Niacinamide: 2%\n• Texture: Lightweight serum\n• Cruelty-free\n• Brand: Beauty of Joseon',
      'How to Use':          'After toning, apply 2–3 drops to face and neck. Press gently into skin. Use morning and/or evening before moisturiser.',
      'Ingredients':         '• Propolis Extract 60% — deeply hydrates, antioxidant, anti-inflammatory, strengthens barrier\n• Niacinamide 2% — brightens, fades dark spots, supports barrier\n• Hyaluronic Acid — lightweight deep hydration',
      'Skin Concerns & Benefits': '• Dull complexion\n• Dark spots and hyperpigmentation\n• Dehydrated skin\n• Sensitive / reactive skin\n• Glass-skin glow-seeking routines',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Beauty of Joseon Dynasty Cream 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Beauty of Joseon',
      'Badge':               'Coming Soon',
      'Product Description': 'Beauty of Joseon\'s most opulent moisturiser — inspired by the beauty rituals of Joseon Dynasty noblewomen. Formulated with Sesame Oil, Egg Yolk, and Rice Bran for deeply nourishing, anti-ageing hydration. A rich but non-greasy cream for normal to dry skin.\n\n• Key ingredients: Sesame Oil, Egg Yolk, Rice Bran Extract\n• Skin type: Normal to dry\n• Brand: Beauty of Joseon',
      'How to Use':          'Apply as the final moisturiser step, morning and evening. A small amount warms in fingertips and blends easily into skin.',
      'Ingredients':         '• Sesame Oil — traditional Hanbang ingredient; nourishing and antioxidant\n• Egg Yolk — rich in fatty acids for deep nourishment\n• Rice Bran Extract — brightening and anti-ageing\n• Niacinamide — tone-evening and pore support',
      'Skin Concerns & Benefits': '• Dry / normal skin needing rich hydration\n• Dull, ageing skin\n• Loss of firmness\n• Hanbang traditional skincare enthusiasts',
      'Returns Override':    RETURNS,
    },
  },

  // ── DR. ALTHEA ────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Dr. Althea 345 Relief Cream 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Dr. Althea',
      'Badge':               'Coming Soon',
      'Product Description': 'The product that put Dr. Althea on the global skincare map. The 345 Relief Cream is an ointment-textured moisturiser formulated with Resveratrol — a powerful antioxidant that boosts cell turnover and improves elasticity — alongside wrinkle-smoothing Adenosine and calming Centella Asiatica.\n\nFree of parabens, sulfates, artificial colour, animal products, alcohol, mineral oil, and fragrance. Named for the 3-4-5 step skin barrier repair protocol it was built around.\n\n• Size: 50ml\n• Texture: Ointment-cream (richer, very nourishing)\n• Vegan, fragrance-free\n• Brand: Dr. Althea',
      'How to Use':          'Apply as the final step of your PM routine or as a daytime moisturiser for very dry skin. A small amount goes a long way — warm between fingertips before pressing into skin.\n\nPairs well with the Dr. Althea 147 Barrier Cream (alternating by need).',
      'Ingredients':         '• Resveratrol — antioxidant that boosts cell turnover and skin elasticity\n• Adenosine — clinically proven wrinkle-smoothing active\n• Centella Asiatica (Cica) — calms inflammation and repairs barrier\n• Niacinamide — brightens and reduces pores\n• Cactus Extract — deep hydration and soothing',
      'Skin Concerns & Benefits': '• Acne-prone skin and post-acne scarring\n• Fine lines and early signs of ageing\n• Very dry or dehydrated skin\n• Sensitive / reactive skin\n• Post-procedure skin recovery',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Dr. Althea 147 Barrier Cream 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Dr. Althea',
      'Badge':               'Coming Soon',
      'Product Description': 'A deep hydration barrier cream formulated with the brand\'s patented Paeonia Albiflora Flower Extract alongside 7-layered Hyaluronic Acid, Avocado Fruit Extract, Argan Kernel Oil, and Camellia Seed Oil.\n\nThe "147" refers to the 7-depth hydration layers and the patented ratio of key ingredients. Silky texture with no greasy residue.\n\n• Size: 50ml\n• Texture: Silky, non-greasy cream\n• Contains 10,000ppm each of 3 key plant extracts\n• Vegan, fragrance-free\n• Brand: Dr. Althea',
      'How to Use':          'Apply to clean skin morning and/or evening as your main moisturiser. Particularly effective for dry, dehydrated or barrier-compromised skin. Use fingertips to press into skin in gentle upward motions.',
      'Ingredients':         '• Paeonia Albiflora Flower Extract (patented) — soothing, anti-ageing\n• 7-Layered Hyaluronic Acid — hydration at all skin depths\n• Avocado Fruit Extract (10,000ppm) — deeply nourishes\n• Argania Spinosa (Argan) Kernel Oil — antioxidant and restorative\n• Camellia Sinensis (Green Tea) Seed Oil — anti-inflammatory',
      'Skin Concerns & Benefits': '• Dry / dehydrated skin at all depths\n• Compromised or sensitive skin barrier\n• Ageing skin needing deep nourishment\n• Skin dehydrated by retinol or acid use\n• All skin types',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Dr. Althea Vitamin C Boosting Serum 30ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Dr. Althea',
      'Badge':               'Coming Soon',
      'Product Description': 'A brightening Vitamin C serum designed to be gentle enough for sensitive skin. Formulated with stable Vitamin C derivatives and Niacinamide for visible brightening without the irritation of pure ascorbic acid.\n\n• Size: 30ml\n• Actives: Stable Vitamin C + Niacinamide\n• Vegan, cruelty-free, fragrance-free\n• Brand: Dr. Althea',
      'How to Use':          'Apply in the morning after toning, before moisturiser and SPF. A few drops are sufficient. Allow to absorb fully.\n\nAlways pair with SPF 30+ for maximum effectiveness.',
      'Ingredients':         '• Stable Vitamin C Derivative — brightening without oxidation or irritation\n• Niacinamide — tone-evening, pore-minimising, barrier support\n• Centella Asiatica — calming for any sensitivities',
      'Skin Concerns & Benefits': '• Dull complexion\n• Hyperpigmentation and dark spots\n• Sensitive skin that reacts to pure Vitamin C (ascorbic acid)\n• Anti-ageing antioxidant protection',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Dr. Althea Pure Grinding Cleansing Balm 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Dr. Althea',
      'Badge':               'Coming Soon',
      'Product Description': 'A cleansing balm that dissolves with a built-in grinding dispenser for fresh, consistent texture every use. Gently removes makeup, sunscreen, and impurities without stripping the skin. Minimal ingredient list.\n\n• Format: Grind-to-dispense cleansing balm\n• Vegan, fragrance-free\n• Brand: Dr. Althea',
      'How to Use':          'Twist the grinder to dispense the balm. Warm between dry fingertips and massage onto dry face in circular motions to dissolve makeup and sunscreen. Rinse or remove with a warm, damp cloth.\n\nUse as the first step of a double cleanse, followed by a water-based cleanser.',
      'Ingredients':         '• Plant-based cleansing oils — dissolve makeup and SPF without irritation\n• Minimal fragrance-free base — suitable for sensitive skin\n\nFull INCI: dr-althea.com before publishing',
      'Skin Concerns & Benefits': '• Full makeup and sunscreen removal\n• Double-cleansing first step\n• Sensitive skin\n• Dry skin (cleansing balms don\'t strip)\n• Those who prefer a tactile, ritual cleansing experience',
      'Returns Override':    RETURNS,
    },
  },
];

async function run() {
  console.log(`Creating ${records.length} products (Part 3: Advanced Clinicals + Beauty of Joseon + Dr. Althea)…`);
  const created = await batchCreate(records);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
  console.log(`\n✓ Part 3 done. ${created.length} products created.`);
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
