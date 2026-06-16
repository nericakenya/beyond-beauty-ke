require('dotenv').config();
const axios = require('axios');

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

const CAT   = 'Skincare';
const BADGE = 'Coming Soon';

async function batchCreate(records) {
  const BATCH = 10;
  const created = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { data } = await axios.post(BASE_URL, { typecast: true, records: chunk }, { headers: HEADERS });
    created.push(...data.records);
    if (i + BATCH < records.length) await new Promise(r => setTimeout(r, 260));
  }
  return created;
}

const products = [

  // ── CERAVE ──────────────────────────────────────────────────────────────────

  {
    fields: {
      'Product Name':     'CeraVe Moisturising Lotion 236ml',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Moisturising Lotion is a lightweight, non-greasy daily moisturiser developed with dermatologists. Formulated with three essential ceramides and hyaluronic acid, it helps restore and maintain the skin's protective barrier while providing lasting hydration.

Suitable for normal to dry skin, fragrance-free, and gentle enough for daily use on face and body.

• Size: 236ml
• Skin type: Normal to dry
• Fragrance-free
• Non-comedogenic
• Developed with dermatologists
• Brand: CeraVe`,
      'How to Use': `Apply liberally to face and/or body after cleansing, morning and evening. Smooth onto skin using gentle upward strokes until fully absorbed. Can be used as a standalone moisturiser or layered under SPF in the morning.

For best results, apply while skin is still slightly damp to lock in moisture.`,
      'Ingredients': `• Ceramides 1, 3 & 6-II – restore and maintain the skin's natural barrier
• Hyaluronic Acid – draws moisture to the skin and helps retain it
• Niacinamide – calms and helps strengthen the barrier
• MVE Technology – releases hydration gradually throughout the day
• Glycerin – humectant that attracts water to the skin

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Dry skin / dehydrated skin
• Sensitive skin
• Compromised skin barrier
• Post-procedure skin (after laser, peels or waxing)
• Eczema-prone skin
• Daily hydration maintenance`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Renewing Night Cream 48g',
      'Product Category': CAT,
      'Sub-Category':     'Night Creams',
      'Badge':            BADGE,
      'Product Description': `CeraVe Renewing Night Cream is a rich overnight moisturiser designed to restore the skin's natural barrier while you sleep, leaving skin soft, smooth and replenished by morning.

Formulated with niacinamide and peptides alongside the brand's signature ceramide complex, this cream repairs and renews with each use.

• Size: 48g
• Skin type: Normal to dry / combination
• Fragrance-free
• Non-comedogenic
• Use: PM only
• Brand: CeraVe`,
      'How to Use': `Apply evenly to face and neck as the final step in your evening skincare routine, after any serums or treatments have fully absorbed.

Use nightly for best results. Do not use in the morning – intended for PM use only.`,
      'Ingredients': `• Ceramides 1, 3 & 6-II – replenish and maintain the skin barrier overnight
• Niacinamide – calms redness and strengthens barrier function
• Peptides – support skin renewal and firmness
• Hyaluronic Acid – deep overnight hydration

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Dry / dehydrated skin
• Dull or fatigued skin
• Fine lines and early signs of ageing
• Overnight repair and barrier restoration
• Sensitive skin`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Healing Ointment 144g',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Healing Ointment is a lanolin-free, petrolatum-based balm designed to soothe and protect very dry, cracked or irritated skin. Unlike regular petroleum jelly, it is enriched with hyaluronic acid and ceramides for targeted barrier repair – not just occlusion.

Ideal for very dry patches, cracked heels, chapped lips, post-procedure skin, or as a protective nighttime treatment.

• Size: 144g
• Skin type: Very dry, cracked, irritated
• Fragrance-free, lanolin-free
• Non-comedogenic
• Face and body use
• Brand: CeraVe`,
      'How to Use': `Apply a thin layer to dry, cracked or irritated areas as needed. For very dry heels or elbows, apply at night and cover with socks or cotton gloves for intensive overnight repair.

Can be used on the face as a final occlusive layer (slugging) at night, applied after all other skincare steps. Not recommended as a standalone daytime face moisturiser.`,
      'Ingredients': `• White Petrolatum – forms a protective barrier to prevent moisture loss
• Ceramides 1, 3 & 6-II – repair and reinforce the skin's natural barrier
• Hyaluronic Acid – attracts and retains moisture within the skin
• Lanolin-free formula – suitable for those with lanolin sensitivities

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Very dry / severely dehydrated skin
• Cracked heels, elbows and knuckles
• Chapped lips
• Post-procedure or post-wax skin sensitivity
• Eczema and psoriasis-prone skin
• Protective barrier for environmental exposure`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Acne Foaming Cream Cleanser 150ml',
      'Product Category': CAT,
      'Sub-Category':     'Cleansers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Acne Foaming Cream Cleanser targets acne while maintaining the skin barrier – something most acne cleansers do not do. Formulated with 10% benzoyl peroxide alongside ceramides and hyaluronic acid, it clears blemishes without stripping the skin of essential moisture.

Dermatologist-tested. Suitable for acne-prone skin types including combination and oily.

• Size: 150ml
• Skin type: Acne-prone, oily, combination
• Active: 10% Benzoyl Peroxide
• Fragrance-free
• Non-comedogenic
• Brand: CeraVe`,
      'How to Use': `Wet face with lukewarm water. Apply a small amount to fingertips and massage gently onto face in circular motions for 20–30 seconds. Rinse thoroughly. Use once daily to start – increase to twice daily if skin tolerates well. Always follow with moisturiser.

⚠ Benzoyl peroxide can bleach fabrics and towels. Pat dry with a white or old towel after use.`,
      'Ingredients': `• Benzoyl Peroxide (10%) – kills acne-causing bacteria and unclogs pores
• Ceramides 1, 3 & 6-II – preserve the skin barrier during acne treatment
• Hyaluronic Acid – maintains hydration to prevent post-cleanse dryness
• Glycerin – humectant that supports moisture retention

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Active breakouts and blemishes
• Oily / combination skin
• Clogged pores
• Body acne (can be used on chest and back)
• Maintaining skin barrier during acne treatment`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Oil Control Moisturising Gel-Cream 52ml',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Oil Control Moisturising Gel-Cream is a lightweight, gel-textured moisturiser developed for oily to combination skin. It controls shine throughout the day while delivering the ceramide-based hydration the skin needs – without heaviness or a greasy finish.

The ideal everyday moisturiser for Nairobi's humid weather or for those who have historically avoided moisturiser due to oiliness.

• Size: 52ml
• Skin type: Oily to combination
• Fragrance-free
• Non-comedogenic
• Oil-free formula
• Brand: CeraVe`,
      'How to Use': `Apply to clean, dry face each morning and/or evening. Use alone or as a base before SPF in the morning. A pea-sized amount is typically sufficient for the full face.

Do not skip this step – oily skin still needs hydration to stay balanced.`,
      'Ingredients': `• Ceramides 1, 3 & 6-II – maintain barrier function without adding oil
• Niacinamide – reduces the appearance of pores and controls sebum
• Hyaluronic Acid – lightweight hydration without occlusion
• Oil-absorbing agents – control shine throughout the day

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Oily / combination skin
• Enlarged pores
• Excess shine / sebum control
• Lightweight hydration in humid climates
• Acne-prone skin needing non-comedogenic moisture`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Acne Control Cleanser 237ml',
      'Product Category': CAT,
      'Sub-Category':     'Cleansers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Acne Control Cleanser uses 2% salicylic acid (BHA) to exfoliate inside the pore and clear breakouts, while ceramides work to maintain the skin barrier throughout. A gentler acne cleanser than the Foaming Cream version – better suited to those with sensitive or combination skin.

• Size: 237ml
• Skin type: Acne-prone, sensitive, combination
• Active: 2% Salicylic Acid (BHA)
• Fragrance-free
• Non-comedogenic
• Brand: CeraVe`,
      'How to Use': `Wet face with lukewarm water. Apply to face and massage gently for 20–30 seconds, avoiding the eye area. Rinse thoroughly.

Use once daily, building to twice daily as skin adjusts. Follow with a non-comedogenic moisturiser. Not recommended for use alongside other BHA or AHA exfoliants in the same routine.`,
      'Ingredients': `• Salicylic Acid 2% (BHA) – exfoliates inside pores, reduces blackheads and whiteheads, and helps prevent future breakouts
• Ceramides 1, 3 & 6-II – protect barrier while actives work
• Niacinamide – calms post-acne redness and uneven tone
• Hyaluronic Acid – prevents the over-drying typical of salicylic cleansers

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Mild to moderate acne and breakouts
• Blackheads and clogged pores
• Oily / combination skin
• Post-acne dark marks (PIH – common on deeper skin tones)
• Uneven texture`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Skin Renewing Retinol Serum 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `CeraVe Skin Renewing Retinol Serum is one of the most accessible retinol serums on the market – formulated with encapsulated retinol for gradual, skin-friendly release, alongside ceramides and niacinamide to support the barrier as retinol works.

Ideal for retinol beginners or those who have had sensitisation reactions with other retinol formulas.

• Size: 30ml
• Skin type: All skin types (start slowly with sensitive skin)
• Active: Encapsulated Retinol
• Fragrance-free
• Non-comedogenic
• Use: PM only
• Brand: CeraVe`,
      'How to Use': `Use only at night, after cleansing and toning. Apply a pea-sized amount to the entire face, avoiding the eye area and lips. Follow with a moisturiser to buffer any initial sensitivity.

Start with 2–3 nights per week and build gradually to nightly use over 4–6 weeks. Always use SPF 30+ every morning when using retinol.

⚠ Not recommended during pregnancy or breastfeeding.`,
      'Ingredients': `• Encapsulated Retinol – triggers cell turnover and collagen synthesis; encapsulation reduces initial irritation compared to standard retinol
• Ceramides 1, 3 & 6-II – protect barrier during retinol adjustment period
• Niacinamide – calms redness and supports even tone
• Hyaluronic Acid – maintains hydration as retinol increases cell turnover

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Fine lines and early wrinkles
• Uneven skin texture
• Post-acne marks and hyperpigmentation
• Dull, ageing skin
• Retinol beginners needing a gentle entry point`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe Skin Renewing Day Cream SPF 30 50g',
      'Product Category': CAT,
      'Sub-Category':     'SPF & Day Moisturisers',
      'Badge':            BADGE,
      'Product Description': `CeraVe Skin Renewing Day Cream SPF 30 combines daily moisturisation with broad-spectrum sun protection. Formulated with peptides and ceramides to improve skin texture and elasticity over time, while the SPF 30 protects against UV-induced ageing and hyperpigmentation.

A streamlined AM routine in one step – particularly useful for anyone who finds sunscreen application an extra hurdle.

• Size: 50g
• Skin type: Normal to dry
• SPF: 30 broad spectrum
• Fragrance-free
• Non-comedogenic
• Use: AM only
• Brand: CeraVe`,
      'How to Use': `Apply as the final step of your morning skincare routine, after serum or treatment if applicable. Apply generously to face and neck and allow 1–2 minutes before makeup. Reapply every 2 hours if spending extended time outdoors.

Do not use at night – SPF formulas are designed for daytime use only.`,
      'Ingredients': `• SPF 30 Broad Spectrum – protects against UVA (ageing) and UVB (burning) rays
• Peptides – support skin firmness and smooth the appearance of fine lines
• Ceramides 1, 3 & 6-II – restore and maintain the skin's barrier
• Hyaluronic Acid – all-day hydration retention

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• UV protection for daily Nairobi sun exposure
• Anti-ageing and fine line reduction
• Dry / normal skin needing combined moisture + SPF
• Prevention of UV-induced hyperpigmentation (critical for melanin-rich skin)
• Simplifying the morning routine to fewer steps`,
    },
  },

  {
    fields: {
      'Product Name':     'CeraVe AM Facial Moisturising Lotion SPF 30 52ml',
      'Product Category': CAT,
      'Sub-Category':     'SPF & Day Moisturisers',
      'Badge':            BADGE,
      'Product Description': `CeraVe AM Facial Moisturising Lotion SPF 30 is a lightweight, oil-free daily moisturiser with sun protection – designed for oily and combination skin types who find the Day Cream too rich. The lotion texture absorbs quickly and leaves a non-greasy finish that works well under makeup.

• Size: 52ml
• Skin type: Oily to combination / all skin types
• SPF: 30 broad spectrum
• Oil-free
• Fragrance-free
• Non-comedogenic
• Use: AM only
• Brand: CeraVe`,
      'How to Use': `Apply generously to face and neck as the last step of your morning skincare routine. Allow to absorb for 1–2 minutes before applying makeup.

For adequate SPF protection, use approximately a full teaspoon for the face. Reapply every 2 hours outdoors.`,
      'Ingredients': `• SPF 30 Broad Spectrum – UVA/UVB protection
• Ceramides 1, 3 & 6-II – barrier maintenance
• Hyaluronic Acid – lightweight hydration without heaviness
• Niacinamide – minimises pores and controls sebum

Full INCI list: source from cerave.com before publishing.`,
      'Skin Concerns & Benefits': `• Daily UV protection
• Oily / combination skin needing lightweight SPF
• Prevention of sun-triggered hyperpigmentation
• Under-makeup SPF base
• Non-greasy finish in humid or warm climates`,
    },
  },

  // ── LA ROCHE-POSAY ───────────────────────────────────────────────────────────

  {
    fields: {
      'Product Name':     'La Roche-Posay Effaclar Duo(+) SPF 30 40ml',
      'Product Category': CAT,
      'Sub-Category':     'SPF & Day Moisturisers',
      'Badge':            BADGE,
      'Product Description': `La Roche-Posay Effaclar Duo(+) SPF 30 is a dual-action acne moisturiser that treats blemishes and excess oil while offering broad-spectrum sun protection. It targets post-acne marks and excess sebum simultaneously – making it ideal as a one-step morning moisturiser for acne-prone skin.

One of the most dermatologist-recommended acne moisturisers globally, and a staple for anyone managing breakouts in a humid climate.

• Size: 40ml
• Skin type: Oily, combination, acne-prone
• SPF: 30 broad spectrum
• Fragrance-free
• Non-comedogenic
• Use: AM only
• Brand: La Roche-Posay`,
      'How to Use': `Apply to clean, dry face each morning as your moisturiser and SPF step combined. Use a pea-sized amount – a little goes a long way with this formula.

Apply at least 15 minutes before sun exposure for full SPF efficacy. Always follow an evening routine that includes a gentle cleanser and separate targeted treatment or moisturiser.`,
      'Ingredients': `• Niacinamide – reduces redness, regulates sebum, fades post-acne marks
• Piroctone Olamine – antibacterial that targets acne-causing bacteria
• LHA (Lipo-Hydroxy Acid) – gentle chemical exfoliant derived from salicylic acid
• SPF 30 Broad Spectrum – UV protection without triggering breakouts
• La Roche-Posay Thermal Spring Water – soothes reactive skin

Full INCI list: source from laroche-posay.us before publishing.`,
      'Skin Concerns & Benefits': `• Active acne and blemishes
• Post-acne marks (PIH – particularly relevant for deeper skin tones)
• Oily / combination skin requiring non-comedogenic SPF
• Enlarged pores
• Excess shine in humid conditions
• Simplified AM routine combining treatment + SPF in one step`,
    },
  },

  {
    fields: {
      'Product Name':     'La Roche-Posay Pure Retinol B3 Serum 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `La Roche-Posay Pure Retinol B3 Serum combines 0.3% pure retinol with vitamin B3 (niacinamide) to target fine lines, wrinkles and uneven skin texture, while minimising the typical irritation associated with retinol.

The B3 component specifically counteracts retinol-induced redness and barrier disruption – making this an excellent choice for those who have previously found retinol too sensitising.

• Size: 30ml
• Skin type: All skin types, especially sensitive
• Actives: Pure Retinol 0.3% + Niacinamide (B3)
• Fragrance-free
• Use: PM only
• Brand: La Roche-Posay`,
      'How to Use': `Apply 3–4 drops to clean, dry face each evening. Avoid the eye contour and lip areas. Allow to fully absorb before applying a rich moisturiser to buffer sensitivity.

Begin with 2 nights per week, increasing gradually to every night over 6–8 weeks. Always apply SPF 30+ during the day when using retinol.

⚠ Not recommended during pregnancy or breastfeeding.`,
      'Ingredients': `• Pure Retinol (0.3%) – accelerates cell turnover and collagen production to reduce wrinkles and improve texture
• Niacinamide (Vitamin B3) – counteracts retinol irritation, fades dark spots
• La Roche-Posay Thermal Spring Water – soothes during active treatment
• Antioxidants – protect skin from oxidative stress

Full INCI list: source from laroche-posay.us before publishing.`,
      'Skin Concerns & Benefits': `• Fine lines and wrinkles
• Uneven skin texture
• Hyperpigmentation and dark spots
• Dull or ageing skin
• Sensitive skin types needing a tolerable retinol
• Post-acne scarring`,
    },
  },

  {
    fields: {
      'Product Name':     'La Roche-Posay Cicaplast Baume B5+',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Notes':            '⚠ Size TBC – confirm 40ml or 100ml SKU with Pharmaplus before publishing. No source URL yet.',
      'Product Description': `La Roche-Posay Cicaplast Baume B5+ is the brand's iconic multi-purpose repair balm – recommended by dermatologists worldwide for sensitive, irritated and compromised skin. It soothes, repairs and protects the skin barrier through a combination of panthenol, shea butter and madecassoside.

Used by dermatologists as a post-laser, post-peel and post-wax recovery treatment. Also excellent for dry patches, eczema flares, and daily protection for sensitive-skin babies and adults alike.

• Skin type: All, especially sensitive and reactive
• Fragrance-free
• Paraben-free
• Safe for use on face, body, and lips
• Brand: La Roche-Posay`,
      'How to Use': `Apply a thin layer to irritated, dry or compromised skin areas as needed. Can be used on face, body, hands and lips.

For post-procedure recovery: apply to the affected area immediately after treatment, 2–3 times daily until skin has healed. For daily use: apply morning and/or evening to sensitive or eczema-prone areas. Safe for use on infants and children under medical guidance.`,
      'Ingredients': `• Panthenol (Pro-Vitamin B5) – accelerates skin repair and reduces inflammation
• Madecassoside – derived from Centella Asiatica; calms irritated skin
• Shea Butter – rich emollient that soothes and protects dry skin
• Copper-Zinc-Manganese – purifying and soothing mineral complex
• La Roche-Posay Thermal Spring Water

Full INCI list: source from laroche-posay.us before publishing.`,
      'Skin Concerns & Benefits': `• Sensitive / reactive skin
• Eczema and atopic dermatitis
• Post-procedure recovery (laser, peel, wax, threading)
• Dry patches and cracked skin
• Redness and inflammation
• Protective barrier for harsh weather or air conditioning exposure`,
    },
  },

  {
    fields: {
      'Product Name':     'La Roche-Posay Lipikar Syndet AP+ Refill 400ml',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Product Description': `La Roche-Posay Lipikar Syndet AP+ is a gentle, soap-free cleansing cream for very dry to eczema-prone skin on the face and body. Unlike soap, it does not strip the natural skin barrier – it actively replenishes lipids and soothes irritation as it cleanses.

The 400ml refill format makes it an economical choice for those who use it daily on the body, or for families with children or babies with sensitive skin.

• Size: 400ml (refill)
• Skin type: Very dry, eczema-prone, sensitive
• Soap-free, fragrance-free
• pH-balanced
• Face and body use
• Brand: La Roche-Posay`,
      'How to Use': `Apply to wet skin, lather gently with hands, and rinse thoroughly. Can be used on the face and body, including for children and infants (under medical guidance for very young babies).

Use daily in the shower or bath as a soap replacement. Follow with a body moisturiser while skin is still slightly damp.`,
      'Ingredients': `• Syndet (Synthetic Detergent) base – cleanses without disrupting the acid mantle
• Niacinamide – calms sensitivity and supports barrier repair
• Shea Butter – nourishing emollient that soothes dry skin
• La Roche-Posay Thermal Spring Water – anti-inflammatory thermal water
• AP+ technology – soothes and reduces the frequency of eczema flares

Full INCI list: source from laroche-posay.us before publishing.`,
      'Skin Concerns & Benefits': `• Very dry / severely dehydrated skin
• Eczema and atopic dermatitis (face and body)
• Sensitive skin that reacts to standard soap or body wash
• Skin that feels tight or itchy after bathing
• Children and adults with reactive skin conditions`,
    },
  },

  {
    fields: {
      'Product Name':     'La Roche-Posay Anthelios Sunscreen (SKU TBC)',
      'Product Category': CAT,
      'Sub-Category':     'SPF & Day Moisturisers',
      'Badge':            BADGE,
      'Notes':            '⚠ Exact SKU TBC. Confirm with Pharmaplus: Anthelios UV-Mune 400 Invisible Fluid SPF 50+ or Anthelios Clear Skin Dry Touch SPF 60. Update product name, SPF, size, skin type and finish before publishing.',
      'Product Description': `La Roche-Posay Anthelios is a dermatologist-developed sunscreen with broad-spectrum protection. The formula absorbs quickly and leaves no white cast – addressing one of the biggest barriers to daily SPF use on melanin-rich skin tones.

SPF is the single most evidence-backed skincare product for preventing hyperpigmentation, premature ageing and skin cancer. The Anthelios range uses Mexoryl™ technology for superior UVA protection beyond what standard SPF filters provide.

• Size: TBC – confirm with Pharmaplus
• SPF: TBC – confirm with Pharmaplus
• Skin type: TBC
• Brand: La Roche-Posay`,
      'How to Use': `Apply generously to all exposed areas of face and neck 15–30 minutes before sun exposure. Reapply every 2 hours outdoors, or immediately after sweating or swimming.

For SPF to be fully effective, use approximately 1/4 teaspoon (1.2ml) for the face and neck alone. Most people underapply sunscreen by 50–75%.`,
      'Ingredients': `• Mexoryl™ SX & XL – proprietary UVA filters with superior broad-spectrum protection
• Tinosorb M/S – additional UV filters for complete spectrum coverage
• La Roche-Posay Thermal Spring Water – reduces sun-stress inflammation

Full INCI list: source from laroche-posay.us before publishing.`,
      'Skin Concerns & Benefits': `• Daily UV protection in high-altitude / equatorial Kenyan sun
• Prevention of UV-triggered hyperpigmentation (PIH)
• Anti-ageing UV protection
• SPF without white cast – important for medium to deep skin tones
• Acne-prone skin needing non-comedogenic sun protection`,
    },
  },

  // ── THE ORDINARY ─────────────────────────────────────────────────────────────

  {
    fields: {
      'Product Name':     'The Ordinary Niacinamide 10% + Zinc 1% 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Niacinamide 10% + Zinc 1% is one of the best-selling skincare serums in the world: it visibly reduces pore appearance, controls excess oil, and fades hyperpigmentation – all with a simple, affordable formula.

Niacinamide (Vitamin B3) at 10% is high-strength but well-tolerated by most skin types. The addition of Zinc PCA helps regulate sebum production. Particularly effective on Kenyan skin tones where post-inflammatory hyperpigmentation (PIH) is a primary skin concern.

• Size: 30ml
• Skin type: All skin types
• Actives: Niacinamide 10%, Zinc PCA 1%
• Water-based / layering serum
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to clean, dry skin morning and/or evening, before heavier creams and oils. Can be used daily. Pair with a moisturiser and SPF in the AM.

⚠ Do not layer directly with Vitamin C (ascorbic acid) formulas in the same routine – apply at separate times of day. Compatible with: hyaluronic acid, retinol, AHAs/BHAs (apply before).`,
      'Ingredients': `• Niacinamide 10% – reduces the appearance of pores, regulates oil, fades dark spots and post-acne marks (PIH)
• Zinc PCA 1% – controls sebum production; anti-inflammatory
• Tasmanian Pepperberry – reduces irritation that can occur with high-concentration niacinamide

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Hyperpigmentation and dark spots (PIH)
• Enlarged pores
• Oily / combination skin
• Uneven skin tone
• Post-acne marks
• Redness and inflammation`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Hyaluronic Acid 2% + B5 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Notes':            '⚠ Confirm this SKU is stocked at Pharmaplus before publishing.',
      'Product Description': `The Ordinary Hyaluronic Acid 2% + B5 is a multi-weight hydration serum that draws moisture from the environment and deeper skin layers to the surface. The addition of Vitamin B5 (panthenol) supports the skin barrier and enhances the hydrating effect.

A foundational serum that works under all other actives and all skin types.

• Size: 30ml
• Skin type: All skin types
• Water-based / layering serum
• Fragrance-free, vegan
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to clean, damp skin (applying to slightly damp skin enhances hyaluronic acid absorption). Use morning and/or evening before creams and oils.

Always follow with a moisturiser – hyaluronic acid needs to be sealed in or it can draw moisture from the skin rather than the environment in dry conditions.`,
      'Ingredients': `• Hyaluronic Acid (multi-weight: low, medium and high molecular weight) – hydrates at multiple skin depths simultaneously
• Vitamin B5 (Panthenol) – supports skin barrier and soothes irritation

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Dehydrated skin (all skin types)
• Dry / flaky skin
• Fine lines caused by dehydration
• Skin in need of a barrier-support boost
• Base hydration layer under actives`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Buffet Peptide Serum 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Buffet is a multi-technology peptide serum that targets multiple signs of ageing at once – hence the name. It combines a high concentration of peptide complexes with amino acids and hyaluronic acid to address fine lines, elasticity and skin firmness in a single formula.

A good entry point for anyone interested in anti-ageing but unsure which ingredient to start with.

• Size: 30ml
• Skin type: All skin types
• Water-based / layering serum
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to clean, dry skin morning and/or evening, before moisturiser. Can be used under retinol at night. Compatible with most other serums – layer from thinnest to thickest consistency.`,
      'Ingredients': `• Matrixyl 3000 – peptide complex that stimulates collagen synthesis
• Matrixyl Synthe'6 – newer peptide that targets deeper wrinkle structures
• Argireline – topical peptide that relaxes facial tension to reduce expression lines
• Leuphasyl – enhances the effect of Argireline
• Multiple Amino Acids – building blocks of collagen and elastin
• Hyaluronic Acid – baseline hydration

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Fine lines and wrinkles
• Loss of firmness and elasticity
• Ageing / mature skin
• Skin that needs general long-term renewal
• Complement to retinol regimens`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Azelaic Acid Suspension 10% 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Azelaic Acid Suspension 10% is a brightening and blemish-targeting treatment in a silky cream suspension. Azelaic acid is one of the safest brightening actives available – effective on hyperpigmentation and acne without the sensitisation associated with retinol or strong vitamin C.

It is also one of the only actives considered safe to use during pregnancy.

• Size: 30ml
• Skin type: All, especially sensitive and acne-prone
• Active: Azelaic Acid 10%
• Cream suspension (not water-based)
• Brand: The Ordinary`,
      'How to Use': `Apply a small amount to affected areas or entire face morning and/or evening, after water-based serums but before oils and creams. Can be used alongside most other actives. Compatible with: niacinamide, hyaluronic acid, moisturisers.

A slight tingle on application is normal.`,
      'Ingredients': `• Azelaic Acid 10% – brightens uneven tone, fades dark spots, treats mild acne and rosacea; anti-inflammatory
• Isododecane – lightweight skin-feel carrier for cream suspension

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Hyperpigmentation and dark spots (PIH)
• Rosacea and skin redness
• Mild to moderate acne
• Sensitive skin that cannot tolerate retinol or high-strength vitamin C
• Safe brightening option during pregnancy (consult physician)
• Uneven skin tone`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Ascorbic Acid 8% + Alpha Arbutin 2% 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Ascorbic Acid 8% + Alpha Arbutin 2% is a brightening treatment serum combining two of the most evidence-backed ingredients for fading dark spots and improving skin radiance – at an accessible price.

Pure ascorbic acid (Vitamin C) at 8% is an effective concentration for brightening without the high irritation potential of higher strengths. Alpha arbutin inhibits melanin production to prevent new dark marks forming.

• Size: 30ml
• Skin type: All, except very sensitive (patch test first)
• Actives: Ascorbic Acid 8%, Alpha Arbutin 2%
• Water-based suspension
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to clean, dry skin in the morning. Allow to absorb fully before applying moisturiser and SPF. Use once daily to begin – this formula can cause temporary tingling on sensitive skin (normal, but patch test before first use).

⚠ Do not combine with niacinamide in the same routine step – apply at different times of day. Always follow with SPF 30+ – Vitamin C is most effective when paired with daily sun protection.`,
      'Ingredients': `• Ascorbic Acid (Vitamin C) 8% – brightens, antioxidant protection, stimulates collagen synthesis, fades hyperpigmentation
• Alpha Arbutin 2% – inhibits melanin formation, preventing new dark spots
• Propanediol – enhances penetration and stability of ascorbic acid

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Hyperpigmentation and uneven skin tone
• Post-acne marks (PIH)
• Dull or lacklustre complexion
• Sun damage and UV-related dark spots
• Early signs of ageing`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Salicylic Acid 2% Solution 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Salicylic Acid 2% Solution is a targeted BHA (Beta Hydroxy Acid) exfoliant that penetrates inside the pore to clear oil, reduce blackheads and address congestion – delivered in a lightweight water-based formula.

Best used as a targeted spot treatment or all-over exfoliant for oily, acne-prone skin.

• Size: 30ml
• Skin type: Oily, combination, acne-prone
• Active: Salicylic Acid 2%
• Water-based
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to affected areas or across the full face in the evening, after cleansing. Start with 2–3 times per week and increase to nightly if well-tolerated. Follow with moisturiser. Always use SPF the following morning.

⚠ Do not use alongside other exfoliants (AHAs, retinol) in the same routine without allowing skin to acclimatise. Avoid the eye area.`,
      'Ingredients': `• Salicylic Acid 2% (BHA) – oil-soluble exfoliant that works inside pores; clears blackheads, whiteheads and congestion
• Witch Hazel – mild astringent that tones and minimises pore appearance

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Blackheads and whiteheads
• Clogged pores and congestion
• Oily / combination skin
• Mild to moderate acne
• Body acne (chest and back)`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Lactic Acid 5% + HA 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Lactic Acid 5% + HA is the gentlest AHA exfoliant in The Ordinary range. Lactic acid exfoliates at the skin's surface and has a larger molecular size than glycolic acid – meaning less penetration depth and lower irritation risk.

The addition of hyaluronic acid counteracts any potential dryness from the exfoliation. Ideal for sensitive skin types, dry skin with a dull texture, or as an AHA introduction for beginners.

• Size: 30ml
• Skin type: Sensitive, dry, all types (gentler AHA option)
• Active: Lactic Acid 5%
• Brand: The Ordinary`,
      'How to Use': `Apply a few drops to clean, dry skin in the evening. Leave on – do not rinse. Use 2–3 times per week initially. Follow with moisturiser. Always wear SPF 30+ the following morning as AHAs increase sun sensitivity.

⚠ Do not use at the same time as other exfoliants (BHAs, retinol, vitamin C).`,
      'Ingredients': `• Lactic Acid 5% (AHA) – gentle surface exfoliant that improves texture, brightness and moisture retention
• Hyaluronic Acid – replenishes hydration post-exfoliation
• Tasmanian Pepperberry – reduces irritation from acid exposure

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Dull, rough or uneven skin texture
• Dry skin needing gentle exfoliation
• Sensitive skin – gentler than glycolic acid
• Fine lines and surface congestion
• AHA beginners`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary Glycolic Acid 7% Toning Solution 240ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary Glycolic Acid 7% Toning Solution is an exfoliating toner that uses the smallest AHA molecule – glycolic acid – for effective surface exfoliation and skin renewal. At 7% it produces visible texture improvement and brightening with regular use.

A popular product for anyone transitioning from manual exfoliation (scrubs) to chemical exfoliation.

• Size: 240ml
• Skin type: Normal to oily / experienced AHA users (not for sensitive beginners)
• Active: Glycolic Acid 7%
• Toner format (liquid, applied with a cotton pad)
• Brand: The Ordinary`,
      'How to Use': `Apply to a cotton pad and sweep gently over the face and neck in the evening after cleansing. Avoid the eye area. Do not rinse. Use 2–3 times per week to begin. Build to nightly use if tolerated. Always use SPF 30+ in the morning – AHAs significantly increase photosensitivity.

⚠ Not recommended for sensitive or acne-broken skin. Do not combine with other exfoliants in the same routine.`,
      'Ingredients': `• Glycolic Acid 7% (AHA) – small-molecule exfoliant that resurfaces skin texture, fades dark spots and improves overall radiance
• Amino Acids, Aloe Vera, Ginseng, Tasmanian Pepperberry – soothing and antioxidant support

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Uneven skin texture
• Dull complexion
• Post-acne marks and hyperpigmentation
• Fine lines and superficial wrinkles
• Body use (backs of arms, chest)
• Experienced AHA users seeking stronger exfoliation than lactic acid`,
    },
  },

  {
    fields: {
      'Product Name':     'The Ordinary 100% Plant-Derived Squalane 30ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `The Ordinary 100% Plant-Derived Squalane is a lightweight, stable facial oil that hydrates without clogging pores. Squalane (derived from olives, not shark liver) mimics the skin's natural sebum, meaning it absorbs effortlessly and is non-comedogenic – unlike many facial oils.

It can be used as a standalone facial oil, a hair treatment for split ends, or mixed into any serum or moisturiser to boost hydration.

• Size: 30ml
• Skin type: All, including oily and acne-prone
• Fragrance-free, vegan, cruelty-free
• Oil-based (use as the final skincare step)
• Brand: The Ordinary`,
      'How to Use': `Apply 2–3 drops to face and neck as the last step in your skincare routine (after all water-based serums and creams), morning or evening. Can be mixed into your moisturiser.

Also excellent as a hair oil: apply 1–2 drops to the ends of dry or damp hair to reduce frizz and add shine.`,
      'Ingredients': `• 100% Plant-Derived Squalane – mimics skin's natural oils for non-comedogenic, deeply absorbing hydration; prevents moisture loss; improves skin softness and suppleness

Full INCI list: source from theordinary.com before publishing.`,
      'Skin Concerns & Benefits': `• Dry / dehydrated skin
• Oily skin needing oil-balancing hydration (non-comedogenic)
• Sensitive skin – no known irritants
• Dull or lacklustre complexion
• Dry hair ends and frizz
• Final barrier-sealing step in PM routine`,
    },
  },

  // ── COSRX ────────────────────────────────────────────────────────────────────

  {
    fields: {
      'Product Name':     'COSRX Advanced Snail 96 Mucin Power Essence 100ml',
      'Product Category': CAT,
      'Sub-Category':     'Serums & Treatments',
      'Badge':            BADGE,
      'Product Description': `COSRX Advanced Snail 96 Mucin Power Essence is a lightweight essence containing 96.3% snail secretion filtrate – the ingredient that put COSRX on the global skincare map. Snail mucin provides simultaneous hydration, repair and brightening in a formula that is gentle enough for daily use on the most sensitised skin.

One of the few "hero" products that genuinely works for almost every skin type and concern. A staple for anyone whose skin barrier has been compromised by over-exfoliation, acne treatments or environmental stress.

• Size: 100ml
• Skin type: All, especially sensitive and damaged-barrier skin
• Essence (lightweight, water-like consistency)
• Fragrance-free
• Brand: COSRX`,
      'How to Use': `After cleansing and toning, pour a small amount onto palms and press gently into skin – do not rub or use a cotton pad (the texture is best absorbed with light pressing motions).

Use morning and/or evening before moisturiser. Allow to absorb fully (approx. 30–60 seconds) before applying the next product.`,
      'Ingredients': `• Snail Secretion Filtrate 96.3% – a complex mix of hyaluronic acid, glycoprotein enzymes, antimicrobial peptides, copper peptides and zinc; repairs skin barrier, fades dark marks, hydrates and improves elasticity
• Sodium Hyaluronate – additional hydration support
• Betaine – humectant that draws and retains moisture

Full INCI list: source from cosrx.com before publishing.`,
      'Skin Concerns & Benefits': `• Compromised or damaged skin barrier
• Dehydrated skin (all types)
• Post-acne marks and PIH
• Sensitive / reactive skin
• Scarring and uneven texture
• Skin recovering from active acne treatment
• General skin repair and renewal`,
    },
  },

  {
    fields: {
      'Product Name':     'COSRX Advanced Snail 92 All-In-One Cream',
      'Product Category': CAT,
      'Sub-Category':     'Moisturisers',
      'Badge':            BADGE,
      'Notes':            '⚠ Confirm exact size with Pharmaplus before publishing (typically 100g).',
      'Product Description': `COSRX Advanced Snail 92 All-In-One Cream is a multi-purpose moisturising cream containing 92% snail secretion filtrate. Thicker than the 96 Mucin Essence, it combines moisturiser and repair treatment in a single product – ideal as a simplified routine for those who prefer fewer steps.

Can be used as a sole moisturiser for normal or combination skin, or layered under a richer cream for very dry skin.

• Size: Confirm with Pharmaplus (typically 100g)
• Skin type: All, especially combination and normal
• Cream consistency (richer than the essence)
• Fragrance-free
• Brand: COSRX`,
      'How to Use': `Apply to clean skin as your moisturiser step, morning and/or evening. Use after any water-based serums.

Can be used as a single-product routine on its own, or layered under SPF in the AM and under a richer cream in the PM for dry skin.`,
      'Ingredients': `• Snail Secretion Filtrate 92% – hydration, barrier repair, brightening, anti-inflammatory
• Niacinamide – brightening and pore-minimising support
• Allantoin – soothing and skin-conditioning

Full INCI list: source from cosrx.com before publishing.`,
      'Skin Concerns & Benefits': `• All-in-one hydration and repair
• Post-acne marks and uneven tone
• Dehydrated / normal to combination skin
• Simplified routine (fewer products needed)
• Sensitive skin`,
    },
  },

  {
    fields: {
      'Product Name':     'COSRX Salicylic Acid Daily Gentle Cleanser 150ml',
      'Product Category': CAT,
      'Sub-Category':     'Cleansers',
      'Badge':            BADGE,
      'Product Description': `COSRX Salicylic Acid Daily Gentle Cleanser uses low-pH BHA technology to gently unclog pores and prevent breakouts with daily use – without over-stripping the skin. This is a daily-use cleanser, not a treatment pad: the formula is mild enough for consistent AM and PM use.

One of COSRX's foundational products and an ideal first step for building an acne-focused routine.

• Size: 150ml
• Skin type: Acne-prone, oily, combination
• Active: Salicylic Acid (low-pH formula)
• Fragrance-free
• Brand: COSRX`,
      'How to Use': `Wet face with lukewarm water. Apply a small amount, lather gently using circular motions, and rinse thoroughly. Use morning and/or evening as your daily cleanser.

Follow with toner (if using), serums and moisturiser. Compatible with most other actives in the routine.`,
      'Ingredients': `• Salicylic Acid – BHA that exfoliates inside pores to prevent congestion and breakouts; low percentage for daily use
• Willow Bark Extract – natural source of salicin (BHA precursor); gentle anti-inflammatory support
• Centella Asiatica – calms and soothes the skin during cleansing

Full INCI list: source from cosrx.com before publishing.`,
      'Skin Concerns & Benefits': `• Daily acne prevention
• Oily / combination skin
• Blackheads and clogged pores
• Gentle enough for twice-daily use
• First step in a BHA-based skincare routine`,
    },
  },

];

async function run() {
  console.log(`Creating ${products.length} skincare products in Airtable…\n`);
  const created = await batchCreate(products.map(p => ({ fields: p.fields })));
  console.log(`\n✓ Created ${created.length} records:\n`);
  created.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
