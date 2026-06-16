// Part 4: Olaplex (5) + Naturium (8) = 13 products
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

  // ── OLAPLEX ───────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Olaplex Nº.0 Intensive Bond Builder 155ml',
      'Product Category':    'Haircare',
      'Sub-Category':        'Olaplex',
      'Badge':               'Coming Soon',
      'Product Description': 'The first step in the Olaplex at-home treatment system. Nº.0 primes hair to receive the maximum benefit from Nº.3 Hair Perfector. Clinically proven to deliver 3× stronger hair when used with Nº.3.\n\n• Size: 155ml\n• Use: Before Nº.3 treatment (not a standalone product)\n• For all hair types\n• Brand: Olaplex',
      'How to Use':          'Apply evenly throughout dry or towel-dried hair from root to tip. Leave on for 10 minutes, then apply Nº.3 Hair Perfector on top without rinsing. Leave both products on for a further 10 minutes minimum. Rinse, then shampoo and condition as normal.\n\nUse weekly or 2–3 times per week for very damaged hair.',
      'Ingredients':         '• Bis-Aminopropyl Diglycol Dimaleate (patented) — repairs broken hair bonds at molecular level\n• Conditioning agents — prepare hair for maximum bond repair absorption',
      'Skin Concerns & Benefits': '• Chemically processed hair (relaxed, coloured, permed)\n• Heat-damaged hair\n• Breakage and split ends\n• Maximising Nº.3 Hair Perfector results',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Olaplex Nº.3 Hair Perfector',
      'Product Category':    'Haircare',
      'Sub-Category':        'Olaplex',
      'Badge':               'Coming Soon',
      'Product Description': 'The #1 bestselling Olaplex product and the anchor of the at-home repair system. Nº.3 Hair Perfector reduces breakage and visibly strengthens hair — not a conditioner but an at-home treatment.\n\nUsed weekly as a pre-shampoo treatment. Available in 100ml and 250ml sizes.\n\n• Use: Weekly pre-shampoo treatment\n• For all hair types\n• Color-safe\n• Brand: Olaplex',
      'How to Use':          'Apply to damp hair from scalp to ends. Leave on for 10 minutes minimum (or longer for very damaged hair). Rinse, then shampoo and condition.\n\nFor best results, use Nº.0 before Nº.3 as a two-step treatment. Use weekly for maintenance; 2–3 times per week for damaged hair.',
      'Ingredients':         '• Bis-Aminopropyl Diglycol Dimaleate — reconnects broken hair bonds\n• Conditioning base — improves manageability and shine during treatment',
      'Skin Concerns & Benefits': '• Breakage and split ends\n• Chemically processed, bleached, or relaxed hair\n• Heat-damaged hair\n• All hair types and textures',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Olaplex Nº.4 Bond Maintenance Shampoo 250ml',
      'Product Category':    'Haircare',
      'Sub-Category':        'Olaplex',
      'Badge':               'Coming Soon',
      'Product Description': 'A highly nourishing, reparative shampoo that protects and maintains the bond repair delivered by Nº.3. Re-links broken bonds while cleansing, leaving hair shinier, stronger, and more manageable.\n\n• Size: 250ml\n• Color-safe\n• For all hair types\n• Brand: Olaplex',
      'How to Use':          'Massage into wet hair, work into lather, then rinse thoroughly. Follow with Nº.5 Bond Maintenance Conditioner. Use as your regular shampoo for ongoing bond maintenance.',
      'Ingredients':         '• Bis-Aminopropyl Diglycol Dimaleate — continues bond repair in the shower\n• Antioxidant blend — protects hair from environmental damage\n• Conditioning agents — leave hair softer and more manageable',
      'Skin Concerns & Benefits': '• All hair types and textures\n• Colour-treated and chemically processed hair\n• Everyday use for ongoing bond maintenance\n• Damaged, dry, or brittle hair',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Olaplex Nº.5 Bond Maintenance Conditioner 250ml',
      'Product Category':    'Haircare',
      'Sub-Category':        'Olaplex',
      'Badge':               'Coming Soon',
      'Product Description': 'A reparative, highly moisturising conditioner for all hair types. Leaves hair easier to manage, shinier, and healthier with each use. Protects and repairs damaged hair by re-linking broken bonds.\n\n• Size: 250ml\n• Color-safe\n• For all hair types\n• Brand: Olaplex',
      'How to Use':          'After shampooing with Nº.4, apply to hair and leave on for 3–5 minutes. Rinse thoroughly. For deeper conditioning, leave on for up to 10 minutes.',
      'Ingredients':         '• Bis-Aminopropyl Diglycol Dimaleate — bond repair and protection\n• Moisturising agents — leave hair soft, detangled, and manageable',
      'Skin Concerns & Benefits': '• Dry, damaged, or brittle hair\n• Colour-treated or chemically processed hair\n• Frizzy hair needing smoothing\n• Regular repair and maintenance',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Olaplex Nº.8 Bond Intense Moisture Mask 100ml',
      'Product Category':    'Haircare',
      'Sub-Category':        'Olaplex',
      'Badge':               'Coming Soon',
      'Product Description': 'An ultra-nourishing bond-building hair mask for deep weekly treatment. 4× more moisturising than Nº.5, it repairs, hydrates, and strengthens while adding brilliant shine.\n\n• Size: 100ml\n• Use: Weekly deep treatment (not daily)\n• For all hair types\n• Brand: Olaplex',
      'How to Use':          'Apply a generous amount to clean, towel-dried hair. Leave on for 10 minutes (or longer for very damaged hair). Rinse thoroughly. Use weekly instead of Nº.5 Conditioner for maximum moisture.',
      'Ingredients':         '• Bis-Aminopropyl Diglycol Dimaleate — bond repair at molecular level\n• Ultra-rich moisturising complex — 4× more hydrating than conditioner\n• Argan Oil and Coconut Oil — shine and manageability',
      'Skin Concerns & Benefits': '• Very dry or severely damaged hair\n• Bleached or double-processed hair\n• Weekly deep treatment for ongoing repair\n• Hair needing intense moisture and shine',
      'Returns Override':    RETURNS,
    },
  },

  // ── NATURIUM ──────────────────────────────────────────────────
  {
    fields: {
      'Product Name':        'Naturium Vitamin C Complex Cleanser',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A brightening gel cleanser formulated with two forms of Vitamin C, Phytic Acid, and fruit enzymes (Papain + Bromelain) that gently exfoliate while dissolving makeup, oil, and impurities.\n\n• Actives: Two forms of Vitamin C, Phytic Acid, Papain, Bromelain\n• Vegan, fragrance-free, paraben-free, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply to wet face and massage gently for 30 seconds. Rinse thoroughly. Use morning and/or evening. A mild tingling from the enzymes is normal.',
      'Ingredients':         '• Two forms of Vitamin C — brightening and antioxidant protection\n• Phytic Acid — gentle brightening and tone-evening\n• Papain + Bromelain (Fruit Enzymes) — gentle enzymatic exfoliation',
      'Skin Concerns & Benefits': '• Dull complexion\n• Dark spots and hyperpigmentation\n• Makeup removal and daily cleansing\n• Gentle brightening without harsh scrubbing',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium Tranexamic Acid Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Price (KES)':         2500,
      'Sale Price':          1500,
      'Badge':               'Coming Soon',
      'Product Description': 'A brightening treatment serum formulated with Tranexamic Acid, Kojic Acid, and Niacinamide — three of the most evidence-backed pigmentation-fighters. Visually evens skin tone, targets hyperpigmentation, and calms the skin barrier.\n\n• Actives: Tranexamic Acid + Kojic Acid + Niacinamide\n• Fragrance-free, vegan, paraben-free, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply after cleansing and toning, before moisturiser. Use morning and/or evening. Always follow with SPF in the morning.',
      'Ingredients':         '• Tranexamic Acid — inhibits melanin transfer for stubborn hyperpigmentation\n• Kojic Acid — additional melanin-inhibiting brightening active\n• Niacinamide — fades dark spots, evens tone, calms inflammation',
      'Skin Concerns & Benefits': '• Stubborn hyperpigmentation and dark spots\n• Post-acne marks (PIH)\n• Sun damage and uneven tone\n• Sensitive skin — calming formula\n• Multiple skin tones — particularly for medium to deep complexions',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium Multi-Peptide Advanced Serum',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'An advanced anti-ageing serum with multi-peptide blend, encapsulated Ferulic Acid, and Hydrolyzed Vegan Collagen. Encapsulation technology ensures optimal delivery and extended-release absorption.\n\n• Key technology: Encapsulation for bioavailability\n• Fragrance-free, vegan, paraben-free, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply 2–3 drops to clean face, pressing into skin. Use morning and/or evening before moisturiser. Compatible with SPF in the morning.',
      'Ingredients':         '• Encapsulated Copper Peptides — reduce appearance of fine lines\n• Argireline Amplified Peptide — improves texture and promotes firmer skin\n• Encapsulated Ferulic Acid — antioxidant and firmness support\n• Hydrolyzed Vegan Collagen — reduces appearance of fine lines',
      'Skin Concerns & Benefits': '• Fine lines and wrinkles\n• Loss of firmness\n• Uneven texture\n• Skin needing long-term anti-ageing support',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium Multi-Peptide Moisturizer',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A mid-weight peptide moisturiser for all skin types. Multi-peptide blend with encapsulated ethylated Vitamin C and Panthenol targets fine lines and texture for a more youthful-looking complexion.\n\n• Fragrance-free, vegan, paraben-free, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply as your moisturiser step, morning and/or evening. A small amount is sufficient for the full face and neck.',
      'Ingredients':         '• Multi-Peptide Blend — smooths and firms skin appearance\n• Encapsulated Ethylated Vitamin C — brightening\n• Panthenol (Pro-Vitamin B5) — soothing and barrier support',
      'Skin Concerns & Benefits': '• Fine lines and wrinkles\n• Uneven texture\n• All skin types\n• Anti-ageing daily moisturiser',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium Niacinamide Gel Cream 5% 50g',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A gel-cream moisturiser combining 5% Niacinamide with Coconut Fruit Juice and marine-derived Polysaccharides to help maintain the skin\'s Natural Moisturizing Factor (NMF). Lightweight, non-greasy.\n\n• Size: 50g\n• Fragrance-free, vegan, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply morning and/or evening as the moisturiser step. Ideal for oily to combination skin types as a standalone moisturiser, or layered under richer creams for drier skin.',
      'Ingredients':         '• Niacinamide 5% — regulates sebum, minimises pores, fades dark spots\n• Coconut Fruit Juice — lightweight hydration\n• Marine Polysaccharides — maintain skin\'s Natural Moisturizing Factor',
      'Skin Concerns & Benefits': '• Oily / combination skin\n• Enlarged pores\n• Uneven skin tone\n• Lightweight daily hydration',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium Dew-Glow Moisturizer SPF 50',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A daily moisturising sunscreen with SPF 50 PA++++ that applies invisibly on all skin tones for broad-spectrum protection with a dewy, radiant finish. Niacinamide and Ethyl Ascorbic Acid improve complexion over time.\n\n• SPF: 50 PA++++\n• Finish: Dewy, radiant — no white cast\n• Active Ingredients: Homosalate 10%, Octisalate 5%, Avobenzone 3%\n• Fragrance-free, vegan, cruelty-free\n• Brand: Naturium',
      'How to Use':          'Apply as the final step of your morning routine. Use generously — approximately 1/4 teaspoon for the full face and neck. Reapply every 2 hours outdoors.',
      'Ingredients':         '• SPF 50 PA++++ — broad-spectrum UVA and UVB protection\n• Niacinamide — pore-minimising and tone-evening\n• Ethyl Ascorbic Acid (stable Vitamin C) — brightening\n• Chemical filters — invisible on all skin tones',
      'Skin Concerns & Benefits': '• Daily UV protection\n• No white cast — key for all skin tones\n• Dewy finish for dry to normal skin\n• Combined moisturiser and SPF for simplified routine\n• Prevention of UV-triggered hyperpigmentation',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium The Smoother Glycolic Acid Exfoliating Body Wash',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A multi-AHA body wash (Glycolic, Lactic, Pyruvic, and Tartaric Acids) with Red Algae for hydration. Exfoliates and resurfaces rough, bumpy skin texture — and works as a facial cleanser too. Fragrance-free, vegan.\n\n• Actives: AHA blend — Glycolic, Lactic, Pyruvic, Tartaric Acids\n• Multi-use: body wash and facial cleanser\n• Fragrance-free, vegan, gluten-free, cruelty-free\n• Brand: Naturium',
      'How to Use':          'As a body wash: Apply to wet skin in the shower and rinse thoroughly. Use daily or every other day.\n\nAs a facial cleanser: Use in place of or after a cleansing balm.\n\nAlways use SPF on any exfoliated skin exposed to the sun.',
      'Ingredients':         '• Glycolic Acid — strongest AHA for texture resurfacing\n• Lactic + Pyruvic + Tartaric Acids — additional gentler exfoliation\n• Red Algae — hydration to counter post-exfoliation dryness',
      'Skin Concerns & Benefits': '• Rough, bumpy body skin (keratosis pilaris)\n• Uneven body texture\n• Dull skin on body and face\n• Ingrown hairs (post-shaving or waxing)\n• A gentle body exfoliant safe for daily use',
      'Returns Override':    RETURNS,
    },
  },
  {
    fields: {
      'Product Name':        'Naturium KP Body Scrub & Mask',
      'Product Category':    'Skincare',
      'Sub-Category':        'Naturium',
      'Badge':               'Coming Soon',
      'Product Description': 'A 3-in-1 KP (Keratosis Pilaris) treatment: body scrub, chemical exfoliant, and mask in one formula. Pumice and Jojoba Esters provide physical exfoliation; AHA/BHA/PHA provide chemical exfoliation.\n\n• Dual use: scrub in the shower or as an in-shower mask\n• Fragrance-free, vegan, cruelty-free\n• Brand: Naturium',
      'How to Use':          'As a scrub: Apply to damp skin, massage in circular motions, rinse.\nAs a mask: Apply to damp skin, leave 5 minutes, then rinse.\nUse 2–3 times per week.',
      'Ingredients':         '• Pumice + Jojoba Esters — physical exfoliation for rough, bumpy skin\n• AHA + BHA + PHA — chemical exfoliation for lasting smoothness',
      'Skin Concerns & Benefits': '• Keratosis pilaris (bumpy arm/leg skin)\n• Rough body texture\n• Body hyperpigmentation\n• Dry, flaky skin needing deep exfoliation',
      'Returns Override':    RETURNS,
    },
  },
];

async function run() {
  console.log(`Creating ${records.length} products (Part 4: Olaplex + Naturium)…`);
  const created = await batchCreate(records);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
  console.log(`\n✓ Part 4 done. ${created.length} products created.`);
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
