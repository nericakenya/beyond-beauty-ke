// Part 2: Medicube (7) + ANUA (8) = 15 products
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

  // ── MEDICUBE ──────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Medicube Zero Foam Cleanser',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Price (KES)':         2500,
      'Sale Price':          2250,
      'Badge':               'Coming Soon',
      'Product Description': 'Medicube\'s gentle pore-purifying foam cleanser. The mochi-like lather cleanses deeply without stripping, formulated with Lemon Balm Extract to purify pores, Quince Extract to strengthen the moisture barrier, and Orange Blossom to soothe.\n\n• Texture: Rich foam\n• Skin type: All, including sensitive\n• Brand: Medicube',
      'How to Use':          'Wet face with lukewarm water. Dispense 1–2 pumps onto palm, lather into foam, and massage gently onto face for 20–30 seconds. Rinse thoroughly. Use AM and PM.',
      'Ingredients':         '• Lemon Balm Extract — purifies pores\n• Quince Extract — strengthens moisture barrier\n• Orange Blossom Extract — soothes and softens',
      'Skin Concerns & Benefits': '• Clogged pores and excess oil\n• All skin types including sensitive\n• Daily pore maintenance\n• Pore-tightening effect',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube Zero Pore Pad 2.0',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Price (KES)':         3200,
      'Sale Price':          2880,
      'Badge':               'Coming Soon',
      'Product Description': 'Toner pads formulated with AHA and BHA to gently exfoliate dead skin cells and purify pores. Includes Anti-Sebum P — a patented ingredient for tightening the appearance of pores. Plant extracts and oils maintain moisture during exfoliation.\n\n• Format: Pre-soaked toner pads\n• Actives: AHA + BHA + patented Anti-Sebum P\n• Brand: Medicube',
      'How to Use':          'After cleansing, swipe one pad gently across face, avoiding the eye area. Use 2–3 times per week, building to daily use if well tolerated. Follow with serum and moisturiser. Always wear SPF the next morning.\n\nDo not use alongside other chemical exfoliants.',
      'Ingredients':         '• BHA (Salicylic Acid) — penetrates pores, unclogs and refines\n• AHA — surface exfoliation for texture and brightness\n• Anti-Sebum P (patented) — targets sebum production and pore size',
      'Skin Concerns & Benefits': '• Large pores\n• Blackheads and clogged pores\n• Excess sebum / oily skin\n• Uneven texture\n• Dull, rough skin',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube Triple Collagen Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Badge':               'Coming Soon',
      'Product Description': 'A collagen-boosting serum using a Triple Collagen Complex — Hydrolyzed, Atelo, and Soluble Collagen — that penetrates deeper than standard collagen serums for plumper, more elastic-looking skin.\n\n• Key technology: Triple Collagen Complex\n• Texture: Lightweight serum\n• Brand: Medicube',
      'How to Use':          'After cleansing and toning, apply 2–3 drops to face and press gently into skin. Follow with moisturiser. Use AM and PM.',
      'Ingredients':         '• Hydrolyzed Collagen — penetrates the skin\'s surface for plumping\n• Atelo Collagen — supports deeper collagen structure\n• Soluble Collagen — conditions and smooths skin surface',
      'Skin Concerns & Benefits': '• Loss of skin elasticity\n• Fine lines and wrinkles\n• Dull skin needing luminosity\n• Anti-ageing maintenance',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube Collagen Jelly Cream 110ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Badge':               'Coming Soon',
      'Product Description': 'A gel-cream moisturiser formulated with collagen and elastin for firmer, more elastic skin. Niacinamide brightens, while Hyaluronic Acid and Squalane strengthen the moisture barrier. The pink colour is natural — derived from vitamin-rich ingredients, with no artificial colorants.\n\n• Size: 110ml\n• Texture: Jelly-cream (lightweight but nourishing)\n• No artificial colorants\n• Brand: Medicube',
      'How to Use':          'Apply after serum as the final moisturiser step, morning and evening. Use a pea-sized amount, warming between fingertips before pressing into skin for better absorption.',
      'Ingredients':         '• Collagen + Elastin — improve firmness and elasticity\n• Niacinamide — brightens and minimises pores\n• Hyaluronic Acid — multi-level hydration\n• Squalane — strengthens moisture barrier\n• Blueberry Extract — antioxidant protection',
      'Skin Concerns & Benefits': '• Loss of firmness and elasticity\n• Fine lines and early signs of ageing\n• Dehydrated skin\n• Uneven tone and dullness',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube Zero Pore Blackhead Mud Mask',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Price (KES)':         3200,
      'Sale Price':          2880,
      'Badge':               'Coming Soon',
      'Product Description': 'A tri-acid mud mask (AHA + BHA + PHA) that absorbs blackheads, sebum, and dead skin cells in 3–5 minutes. Guaiazulene calms sensitive skin. Blue Peptide improves inner and outer hydration. Hypoallergenic tested, no alcohol, no heavy metals.\n\n• Active acids: AHA + BHA + PHA\n• Treatment time: 3–5 minutes\n• Brand: Medicube',
      'How to Use':          '1. Apply an appropriate amount to skin, avoiding the eye and mouth area.\n2. Leave for 3–5 minutes until the mask dries.\n3. Rinse thoroughly with lukewarm water.\n4. Follow with toner and moisturiser.\n\nUse 1–2 times per week.',
      'Ingredients':         '• AHA — surface exfoliation and brightening\n• BHA — deep pore cleansing\n• PHA — gentle exfoliation for sensitive skin\n• Guaiazulene — calms and soothes sensitive skin\n• Blue Peptide — hydration inside and out',
      'Skin Concerns & Benefits': '• Blackheads and sebum build-up\n• Clogged pores\n• Oily / combination skin\n• Dull, rough skin needing deep cleansing\n• Suitable for sensitive skin (Guaiazulene calms)',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube PDRN Pink Collagen Gel Mask',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Badge':               'Coming Soon',
      'Product Description': 'A luxury gel sheet mask infused with Salmon PDRN, Hydrolysed Collagen, and Peptides to improve skin elasticity, boost hydration, and promote a smoother, more youthful complexion. The soft gel texture adheres closely to the face while delivering intensive hydration.\n\n• Key ingredients: Salmon PDRN, Hydrolysed Collagen, Peptides\n• Format: Single-use gel mask\n• Brand: Medicube',
      'How to Use':          'After cleansing, unfold mask and apply to face, pressing gently to adhere. Leave on for 15–20 minutes. Remove and gently press remaining essence into skin — do not rinse. Follow with moisturiser.',
      'Ingredients':         '• Salmon PDRN (Polydeoxyribonucleotide) — regenerates and repairs skin\n• Hydrolysed Collagen — plumps and improves elasticity\n• Peptides — anti-ageing and firming complex',
      'Skin Concerns & Benefits': '• Loss of elasticity\n• Fine lines and wrinkles\n• Dehydrated skin needing intensive treatment\n• Post-procedure or stressed skin recovery\n• Dull, fatigued skin',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Medicube One Day Exosome Shot Pore Ampoule 7500',
      'Product Category':    'Skincare',
      'Sub-Category':        'Medicube',
      'Price (KES)':         3300,
      'Badge':               'Coming Soon',
      'Product Description': 'A potent, single-use ampoule with 7,500ppm of exosomes — plus Panthenol and Adenosine — for visible pore tightening in as little as 3 days.\n\nExosome technology penetrates the skin deeper than standard serums (262% enhanced absorption). Lightweight, non-sticky texture.\n\n• Concentration: 7,500ppm exosomes\n• Results visible in 3 days\n• Texture: Fresh ampoule serum\n• Brand: Medicube',
      'How to Use':          'Apply 1–2 drops to clean skin, pressing gently into areas of concern (pores, oily zones, T-zone). Allow to fully absorb before moisturiser. Use as a concentrated treatment 2–3 times per week, or as directed.',
      'Ingredients':         '• Exosomes 7,500ppm — penetrates 10 skin layers; 262% enhanced absorption\n• Panthenol (Pro-Vitamin B5) — soothes and repairs\n• Adenosine — anti-wrinkle and firming',
      'Skin Concerns & Benefits': '• Enlarged pores\n• Oily skin\n• Skin needing rapid visible results\n• Advanced pore care treatment',
      'Returns Override':    RETURNS,
    },
  },

  // ── ANUA ──────────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'ANUA Heartleaf 77% Soothing Toner',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Badge':               'Coming Soon',
      'Product Description': 'A hydrating toner formulated with 77% Heartleaf (Houttuynia Cordata) Extract and EWG Green-grade certified ingredients. Soothes sensitive, reactive skin while delivering lightweight hydration.\n\n• Heartleaf content: 77%\n• Suitable for: All skin types, especially sensitive and acne-prone\n• EWG Green-grade certified ingredients\n• Brand: ANUA',
      'How to Use':          'After cleansing, apply to a cotton pad or into palms and press gently into skin. Layer 2–3 times (the "7-skin method") for deeper hydration. Use AM and PM.',
      'Ingredients':         '• Heartleaf Extract 77% — soothes redness, calms inflammation\n• Centella Asiatica — repairs and strengthens skin barrier\n• Hyaluronic Acid — lightweight deep hydration\n• Niacinamide — brightens and minimises pores',
      'Skin Concerns & Benefits': '• Sensitive / reactive skin\n• Redness and inflammation\n• Dehydrated skin\n• Acne-prone skin prone to post-breakout redness\n• Strengthening a compromised skin barrier',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Heartleaf 70% Daily Relief Lotion 200ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Badge':               'Coming Soon',
      'Product Description': 'An award-winning ultra-lightweight moisturiser with 70% Heartleaf Extract. Deeply hydrates while calming redness and irritation. Non-greasy finish makes it ideal as a daily moisturiser for oily or sensitive skin types.\n\n• Size: 200ml\n• Heartleaf content: 70%\n• Texture: Ultra-lightweight lotion\n• Brand: ANUA',
      'How to Use':          'After toner and serum, apply to face and neck, patting gently into skin. Use morning and evening. Works well as a standalone moisturiser in humid climates or under SPF in the morning.',
      'Ingredients':         '• Heartleaf Extract 70% — calms redness, soothes irritation\n• Beta-Glucan — strengthens and hydrates skin barrier\n• Niacinamide — brightens and improves skin tone',
      'Skin Concerns & Benefits': '• Sensitive / redness-prone skin\n• Oily skin needing lightweight hydration\n• Daily hydration in humid climates\n• Calming post-breakout redness',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Peach 70% Niacinamide Serum 30ml',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Price (KES)':         2500,
      'Badge':               'Coming Soon',
      'Product Description': 'A brightening serum with 70% Peach fruit extract and 5% Niacinamide for glass-skin radiance. The natural light-pink colour comes from Vitamin B12, with no artificial colouring. Targets uneven tone, texture, and pores.\n\n• Size: 30ml\n• Actives: 70% Peach Extract, 5% Niacinamide, Hyaluronic Acid\n• Natural colour — no artificial dyes\n• Brand: ANUA',
      'How to Use':          'After toner, apply 2–3 drops to face and neck, pressing gently into skin. Use morning and/or evening before moisturiser.',
      'Ingredients':         '• Peach Fruit Extract 70% — antioxidant-rich, instantly brightens skin\n• Niacinamide 5% — evens tone, minimises pores, fades dark spots\n• Hyaluronic Acid — deep hydration\n• Vitamin B12 — natural pink pigment (no artificial dye)',
      'Skin Concerns & Benefits': '• Dull complexion\n• Uneven skin tone (PIH, dark spots)\n• Enlarged pores\n• Dehydrated skin\n• General brightening and glow',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Dark Spot Correcting Serum (10% Niacinamide + 4% Tranexamic Acid)',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Price (KES)':         4600,
      'Badge':               'Coming Soon',
      'Product Description': 'A concentrated dark spot treatment serum formulated with 10% Niacinamide, 4% Tranexamic Acid, and 2% Alpha-Arbutin — three of the most evidence-backed brightening actives available. Targets stubborn hyperpigmentation, post-acne marks, sun spots, and uneven skin tone.\n\n• Actives: Niacinamide 10%, Tranexamic Acid 4%, Alpha-Arbutin 2%\n• Texture: Lightweight watery serum\n• Brand: ANUA',
      'How to Use':          'Apply after cleansing and toning, before heavier serums and moisturiser. Use AM and PM. Always follow with SPF 30+ in the morning.\n\nStart with once daily if your skin is new to high-concentration Niacinamide.',
      'Ingredients':         '• Niacinamide 10% — fades dark spots, minimises pores, regulates sebum\n• Tranexamic Acid 4% — inhibits melanin transfer for stubborn pigmentation\n• Alpha-Arbutin 2% — limits melanin production; prevents new dark spots forming\n• Hyaluronic Acid — hydration support\n• Botanical Oils — soothe and nourish',
      'Skin Concerns & Benefits': '• Stubborn hyperpigmentation and dark spots (PIH)\n• Post-acne marks and scarring\n• Sun damage and uneven tone\n• Enlarged pores\n• All skin tones — particularly effective for melanin-rich skin',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Azelaic Acid 10% Redness Soothing Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Price (KES)':         2500,
      'Sale Price':          1500,
      'Badge':               'Coming Soon',
      'Product Description': 'A lightweight all-in-one serum with 10% Azelaic Acid — effective for redness, blemishes, and hyperpigmentation. Centella Asiatica and Green Tea Leaf Water soothe while Zinc PCA targets excess oil and breakouts.\n\n• Active: Azelaic Acid 10%\n• Suitable for sensitive and acne-prone skin\n• Brand: ANUA',
      'How to Use':          'Apply morning and/or evening to clean, dry skin after toning. Allow to absorb before moisturiser. A slight tingle on application is normal. Safe for use during pregnancy (consult physician).',
      'Ingredients':         '• Azelaic Acid 10% — brightens, reduces redness, treats acne and rosacea\n• Centella Asiatica — soothes and repairs skin barrier\n• Green Tea Leaf Water — antioxidant and anti-inflammatory\n• Zinc PCA — controls excess oil and breakouts',
      'Skin Concerns & Benefits': '• Redness and rosacea\n• Mild to moderate acne\n• Post-acne hyperpigmentation\n• Sensitive skin that cannot tolerate retinol or high-strength vitamin C\n• Pregnancy-safe brightening option',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Nano Retinol 0.3% + Niacin Renewing Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Badge':               'Coming Soon',
      'Product Description': 'A gentle retinol serum pairing Nano Retinol (0.3%) with Niacinamide for smoothing fine lines and improving hyperpigmentation with reduced irritation. Enriched with 8 types of Peptides, Tea Tree Leaf Oil, and Ceramide for barrier support.\n\n• Retinol: 0.3% Nano Retinol\n• PM use only\n• Brand: ANUA',
      'How to Use':          'Apply 2–3 drops to clean, dry skin in the evening after toning. Start 2 nights per week; build to nightly use over 6–8 weeks. Always use SPF 30+ the following morning.\n\n⚠ Not recommended during pregnancy or breastfeeding.',
      'Ingredients':         '• Nano Retinol 0.3% — gentle cell turnover and collagen support\n• Niacinamide — counteracts retinol irritation, fades dark spots\n• 8 Peptide Complex — anti-ageing and moisture support\n• Tea Tree Leaf Oil — calming for blemish-prone skin\n• Ceramide — barrier repair and hydration',
      'Skin Concerns & Benefits': '• Fine lines and wrinkles\n• Hyperpigmentation\n• Uneven texture\n• Sensitive skin needing gentle retinol introduction',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA Rice Enzyme Brightening Cleansing Powder',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Badge':               'Coming Soon',
      'Product Description': 'A multi-purpose exfoliating cleansing powder with Rice Powder, Rice Extract, Ceramide, and Papain. Brightens uneven tone, clears pores, and nourishes the barrier — used as a wash-off mask or powder cleanser.\n\n• Dual use: daily cleanser or wash-off mask\n• Key ingredients: Rice Powder, Ceramide, Papain (Enzyme)\n• Brand: ANUA',
      'How to Use':          'As a cleanser: Take a small amount into wet palms, work into foam, and massage over face. Rinse thoroughly.\n\nAs a mask: Apply the powder paste to dry face, leave for 5 minutes, then rinse. Use 1–2 times per week.',
      'Ingredients':         '• Rice Powder + Rice Extract — brightens dull skin with mild exfoliation\n• Ceramide — hydrates and reinforces skin barrier\n• Papain (Enzyme) — additional brightening and exfoliation',
      'Skin Concerns & Benefits': '• Dull, uneven skin tone\n• Dead skin cell build-up\n• Clogged pores\n• Blemish-prone skin\n• Dual cleanse + exfoliate in one product',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'ANUA 7 Rice Ceramide Hydrating Barrier Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'ANUA',
      'Badge':               'Coming Soon',
      'Product Description': 'A fragrance-free barrier repair serum with Oryza Sativa (Rice) Bran Water, Ceramide NP, Hyaluronic Acid, and Honey Extract. Hydrates, prevents moisture loss, and fades post-blemish redness with Alpha-Arbutin.\n\n• Fragrance-free\n• All skin types\n• Brand: ANUA',
      'How to Use':          'Apply after toning, pressing gently into skin. Layer under moisturiser. Use AM and PM. Particularly beneficial after exfoliation or when skin is feeling reactive or stripped.',
      'Ingredients':         '• Oryza Sativa (Rice) Bran Water — brightening, barrier-building\n• Ceramide NP — repairs and maintains skin barrier\n• Hyaluronic Acid — deep hydration\n• Honey Extract — soothes and softens\n• Alpha-Arbutin — fades post-blemish redness and dark marks',
      'Skin Concerns & Benefits': '• Compromised or damaged skin barrier\n• Dry, chapped, or reactive skin\n• Post-blemish marks and redness\n• General hydration maintenance',
      'Returns Override':    RETURNS,
    },
  },
];

async function run() {
  console.log(`Creating ${records.length} products (Part 2: Medicube + ANUA)…`);
  const created = await batchCreate(records);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
  console.log(`\n✓ Part 2 done. ${created.length} products created.`);
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
