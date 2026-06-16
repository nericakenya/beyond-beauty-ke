// Part 1: Sol de Janeiro (3) + Estée Lauder (8) = 11 products
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

  // ── SOL DE JANEIRO ────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Sol de Janeiro Brazilian Bum Bum® Cream',
      'Product Category':    'Body Care',
      'Sub-Category':        'Sol de Janeiro',
      'Badge':               'Coming Soon',
      'Product Description': 'The one that started a global obsession. Brazilian Bum Bum® Cream visibly firms, tightens, and hydrates — fast-absorbing and scented with the iconic Cheirosa 62™ fragrance (pistachio, salted caramel, vanilla).\n\nAward-winning since 2015. One sold every 4 seconds worldwide.\n\n• Key actives: Guaraná Extract (5× caffeine of coffee), Cupuaçu Butter, Plant Squalane\n• Finish: Fast-absorbing, non-greasy\n• Scent: Cheirosa 62™ — pistachio, almond, heliotrope, vanilla, salted caramel, sandalwood\n• Clinically proven to reduce appearance of cellulite in 4 weeks\n• Vegan, cruelty-free\n• Brand: Sol de Janeiro',
      'How to Use':          'Massage generously onto bum, thighs, tummy, arms, and body in circular motions immediately after showering. Circular massage creates warmth for better absorption and maximum firming effect.\n\nUse daily for best results. Can be used morning or evening.',
      'Ingredients':         '• Guaraná Extract — caffeine-rich, visibly firms and energises skin\n• Cupuaçu Butter — Amazon\'s shea butter; deeply nourishes and locks in moisture\n• Plant Squalane — replenishes barrier lipids, prevents moisture loss\n• Açaí Extract — antioxidant-rich, protects against environmental damage\n\nFull INCI: soldejaneiro.com/products/brazilian-bum-bum-cream',
      'Skin Concerns & Benefits': '• Visible skin tightening and firming\n• Cellulite and uneven texture (clinically tested)\n• Dry body skin needing intense nourishment\n• Fast-absorbing for busy mornings\n• Signature scent as a daily sensory ritual',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Sol de Janeiro Beija Flor™ Elasti-Cream',
      'Product Category':    'Body Care',
      'Sub-Category':        'Sol de Janeiro',
      'Badge':               'Coming Soon',
      'Product Description': 'Named after the hummingbird — the symbol of beauty and agility in Brazil — Beija Flor™ Elasti-Cream visibly plumps and improves skin elasticity with every use. Formulated with Elastin and plant-powered ingredients, it targets the look of crepey, sagging skin.\n\n• Key actives: Elastin, Açaí Extract, Cupuaçu Butter\n• Scent: Cheirosa 40™ — passion fruit, citrus blossom, soft woods\n• Vegan, cruelty-free\n• Brand: Sol de Janeiro',
      'How to Use':          'Apply generously to skin after bathing, massaging in upward strokes to encourage elasticity and absorption. Focus on areas prone to crepey texture: arms, neck, décolletage, and thighs.',
      'Ingredients':         '• Elastin — supports skin elasticity and bounce\n• Açaí Extract — antioxidant protection against environmental stressors\n• Cupuaçu Butter — deep nourishment and moisture sealing\n• Vitamin E — free radical protection and skin conditioning',
      'Skin Concerns & Benefits': '• Loss of elasticity and skin firmness\n• Crepey or sagging skin texture\n• Dry body skin on arms, neck and décolletage\n• Anti-ageing body care',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Sol de Janeiro Cheirosa™ Perfume Mist',
      'Product Category':    'Body Care',
      'Sub-Category':        'Sol de Janeiro',
      'Badge':               'Coming Soon',
      'Product Description': 'Sol de Janeiro\'s perfume mists are layering fragrances — designed to be worn alone or spritzed over body cream to intensify and extend scent. Long-lasting, vegan, cruelty-free.\n\n• Format: Fine fragrance mist\n• Vegan, cruelty-free\n• Brand: Sol de Janeiro\n• Scent: Confirm from ShopEve which Cheirosa scent(s) are stocked',
      'How to Use':          'Spritz onto body after moisturising for an intensified, longer-lasting scent. Can be layered with matching Brazilian Bum Bum® Cream or Beija Flor™ Elasti-Cream for a full-body scent experience.\n\nApply to pulse points (wrists, neck, behind knees) or mist all over body from 20–30cm away.',
      'Ingredients':         'Alcohol-based fine fragrance. Key fragrance notes depend on scent variant.\nFull INCI: soldejaneiro.com — confirm per scent before publishing.',
      'Skin Concerns & Benefits': '• Layering fragrance over body cream for lasting scent\n• A mood-lifting daily ritual\n• Lightweight fragrance that doesn\'t overwhelm',
      'Returns Override':    RETURNS,
    },
  },

  // ── ESTÉE LAUDER ──────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Estée Lauder Advanced Night Repair Synchronized Multi-Recovery Complex 115ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         38650,
      'Badge':               'Coming Soon',
      'Product Description': 'The original — and still the benchmark. Advanced Night Repair is Estée Lauder\'s iconic anti-ageing serum, now in its most advanced incarnation. Formulated with ChronoluxCB™ Technology, it syncs with the skin\'s natural nighttime repair processes to target the full spectrum of visible ageing: lines, uneven tone, dullness, dehydration, and pores.\n\n• Size: 115ml (largest available size — premium value)\n• Texture: Lightweight serum\n• Use: PM (and AM if paired with SPF)\n• Fragrance-free\n• Tested on sensitive skin\n• Brand: Estée Lauder',
      'How to Use':          'After cleansing and toning, apply 2–3 drops to face and neck, pressing gently into skin. Use nightly. Can also be worn in the morning under moisturiser and SPF.\n\nFor best results, begin using every night and allow 4 weeks for visible improvement.',
      'Ingredients':         '• ChronoluxCB™ Technology — supports the skin\'s natural nighttime repair cycle to address multiple signs of ageing\n• Hyaluronic Acid — multi-weight hydration for all skin depths\n• Caffeine — de-puffs and energises tired-looking skin\n• Bifida Ferment Lysate — improves skin resilience and radiance\n\nFull INCI: esteelauder.com before publishing',
      'Skin Concerns & Benefits': '• Fine lines and wrinkles\n• Dull, fatigued skin\n• Uneven skin tone\n• Dehydrated skin\n• Post-travel or post-stress skin recovery\n• All skin types including sensitive',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Advanced Night Repair Eye Supercharged Gel-Creme 15ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         12150,
      'Badge':               'Coming Soon',
      'Product Description': 'The eye-area companion to Advanced Night Repair. This gel-cream targets multiple signs of visible ageing around the eyes: fine lines, puffiness, dark circles, and dryness.\n\n• Size: 15ml\n• Texture: Gel-cream (cooling on application)\n• Use: AM and PM\n• Ophthalmologist tested\n• Safe for contact lens wearers\n• Brand: Estée Lauder',
      'How to Use':          'Using the metal tip applicator, gently pat a small amount around the orbital bone — do not pull or drag the delicate eye-area skin.\n\nApply morning and night as the final step before moisturiser or SPF. The cooling metal tip helps de-puff on application.',
      'Ingredients':         '• ChronoluxCB™ Technology — syncs with the skin\'s nighttime repair cycle\n• Caffeine — visibly reduces puffiness and dark circles\n• Hyaluronic Acid — intense hydration for the delicate eye area\n• Peptides — target fine lines and crow\'s feet\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Dark circles\n• Puffiness and under-eye bags\n• Fine lines and crow\'s feet\n• Dryness around the eye area\n• Fatigued or stressed-looking eyes',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Perfectionist Pro Rapid Firm + Lift Treatment 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         27750,
      'Badge':               'Coming Soon',
      'Product Description': 'A firming serum that works visibly fast. The Perfectionist Pro Rapid Firm + Lift Treatment is formulated with Tri-Peptide technology and Acetyl Hexapeptide-8 to target loss of firmness and facial contour. Clinically shown to visibly lift and firm in 4 weeks.\n\n• Size: 50ml\n• Texture: Lightweight serum\n• Use: AM and PM\n• All skin types\n• Brand: Estée Lauder',
      'How to Use':          'Apply to cleansed face and neck morning and evening before moisturiser. Smooth upward and outward from centre of face toward temples and jawline to support the lifting direction of the formula.',
      'Ingredients':         '• Tri-Peptide Complex — targets loss of firmness and visible sagging\n• Acetyl Hexapeptide-8 — relaxes facial tension for smoother appearance\n• Moringa Seed Extract — antioxidant support\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Loss of facial firmness and contour\n• Visible sagging along jawline and cheeks\n• Fine lines and deep wrinkles\n• Skin in its 30s–50s showing early to established signs of ageing',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Nutritious Radiant Essence Lotion 200ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         6650,
      'Badge':               'Coming Soon',
      'Product Description': 'A brightening essence-toner that preps skin for better absorption of serums and moisturisers. Formulated with Pomegranate Extract and Red Algae Extract for antioxidant protection and lasting radiance.\n\n• Size: 200ml\n• Texture: Essence-lotion (not a traditional toner)\n• Use: AM and PM, after cleansing\n• All skin types\n• Brand: Estée Lauder',
      'How to Use':          'After cleansing, apply to a cotton pad and sweep across face and neck from inner to outer, or press into skin directly with palms for deeper penetration. Follow with serum and moisturiser.',
      'Ingredients':         '• Pomegranate Extract — rich in antioxidants; brightens and protects\n• Red Algae Extract — hydrates and enhances skin radiance\n• Nutrigenomics™ Technology — supports skin\'s natural nutrition system\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Dull skin needing a radiance boost\n• Skin needing deeper product absorption preparation\n• Antioxidant protection\n• All skin types including normal, dry and combination',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder DayWear Matte Oil-Control Anti-Oxidant Moisture Gel Crème 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         10300,
      'Badge':               'Coming Soon',
      'Product Description': 'A mattifying, oil-controlling moisturiser for oily to combination skin. Antioxidant-rich formula with a gel texture that absorbs quickly and controls shine throughout the day.\n\n• Size: 50ml\n• Skin type: Oily / combination\n• Use: AM — gel-cream texture suits daytime wear under makeup\n• Brand: Estée Lauder',
      'How to Use':          'Apply to cleansed, toned face and neck in the morning. Smooth a small amount over face and blend. Allow to absorb before applying SPF or makeup.',
      'Ingredients':         '• Antioxidant Blend — protects against environmental damage\n• Oil-Control Complex — minimises shine and reduces excess sebum\n• Gel-Cream Base — lightweight hydration without heaviness\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Oily / combination skin\n• Excess shine and large pores\n• Antioxidant daily protection\n• Under-makeup hydration that won\'t cause breakouts',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Revitalizing Supreme+ Youth Power Eye Balm 15ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         14550,
      'Badge':               'Coming Soon',
      'Product Description': 'A rich eye balm from Estée Lauder\'s Revitalizing Supreme+ collection. This balm format provides intensive nourishment for the delicate eye area, targeting lines, dryness, and loss of firmness simultaneously.\n\n• Size: 15ml\n• Texture: Rich balm\n• Use: AM and PM\n• Ophthalmologist-tested\n• Brand: Estée Lauder',
      'How to Use':          'Gently pat a small amount around the eye area, including the upper lid. Apply morning and night. Ideal for PM use when a richer formula is preferred.',
      'Ingredients':         '• Moringa Seed Extract + Peptides — anti-ageing and firming\n• Super-C Complex (3 forms of Vitamin C) — brightens dark circles\n• Hyaluronic Acid — intense hydration for dry eye areas\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Dry, dehydrated under-eye area\n• Fine lines and crow\'s feet\n• Dark circles\n• Loss of firmness and fullness around the eye',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Resilience Multi-Effect Night Moisturizer 50ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         24650,
      'Badge':               'Coming Soon',
      'Product Description': 'A rich, restorative night moisturiser formulated with Estée Lauder\'s Tri-Peptide Complex to visibly lift, firm, and strengthen the skin barrier overnight. Addresses the face and neck simultaneously.\n\n• Size: 50ml\n• Use: PM only\n• Skin type: Normal to dry\n• Brand: Estée Lauder',
      'How to Use':          'Apply as the final step of your PM routine to face and neck, smoothing upward and outward. Use nightly.',
      'Ingredients':         '• Tri-Peptide Complex — visibly firms and lifts skin overnight\n• Lipids + Ceramides — strengthen and restore the skin barrier\n• Shea Butter — deeply nourishes for softness by morning',
      'Skin Concerns & Benefits': '• Dry, mature skin needing overnight repair\n• Loss of firmness\n• Fine lines and wrinkles\n• Skin barrier needing strengthening',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Estée Lauder Nutritious Airy Lotion Moisturizer 100ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Estée Lauder',
      'Price (KES)':         7450,
      'Badge':               'Coming Soon',
      'Product Description': 'A lightweight moisturiser from the Nutritious line — airy texture, deep hydration, and antioxidant protection in a daily formula suitable for balanced to normal-oily skin types.\n\n• Size: 100ml\n• Skin type: Balanced / combination-to-normal\n• Use: AM and PM\n• Brand: Estée Lauder',
      'How to Use':          'Apply after toner or essence, morning and evening. A small amount goes a long way — use fingertips to blend upward and outward.',
      'Ingredients':         '• Pomegranate Complex — antioxidant, brightening\n• Hyaluronic Acid — lightweight hydration\n• Red Algae — radiance-enhancing\n\nFull INCI: esteelauder.com',
      'Skin Concerns & Benefits': '• Lightweight daily hydration\n• Antioxidant daily protection\n• Normal / balanced skin\n• Under-makeup moisturiser',
      'Returns Override':    RETURNS,
    },
  },
];

async function run() {
  console.log(`Creating ${records.length} products (Part 1: Sol de Janeiro + Estée Lauder)…`);
  const created = await batchCreate(records);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
  console.log(`\n✓ Part 1 done. ${created.length} products created.`);
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
