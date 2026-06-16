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

const W = 'https://static.wixstatic.com/media';

// Each entry: { fields: {...product fields...}, variants: [{colour, img}] }
// colour: null and img: null = single variant, no shade selector shown
const products = [

  // ── P1 — Shake N' Play Liquid Blush ─────────────────────────────────────────
  {
    fields: {
      'Product Name':     "Fenty Beauty Shake N' Play Liquid Blush",
      'Product Category': 'Beauty',
      'Sub-Category':     'Face',
      'Price (KES)':      4750,
      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_779b2cd65a664312adf6373b970410dc~mv2.jpg` }],
      'Product Description': `Shake up your colour game. The Shake N' Play Liquid Blush gives you a natural, blurred-finish flush — from a whisper of colour to full-on bold, in seconds. Just shake to load the perfect dose onto the mess-free squish-tip sponge and dot where you want it.

• Size: 4g
• Finish: Natural, blurred
• Wear: Transfer-proof, waterproof, 12-hour wear
• Resists sweat, humidity + fading
• Hydrates all day with Cucumber Extract
• 5 shades for a range of skin tones
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `1. Shake to mix — the shaker beads load the perfect dose onto the squish-tip.
2. Dot your desired look: 1 dot for a subtle pop, 2+ for a bolder flush.
3. Stipple upward and blend with fingers or the Face Shaping Brush 125 for a diffused, skin-like finish.

Pro tip: Layer from the apples of the cheeks upward and outward toward the temples for the most natural-looking placement.`,
      'Ingredients': `All shades share the same base formula — colourant section differs per shade.

Shared base: ISODODECANE, AQUA/WATER/EAU, DIMETHICONE, PENTYLENE GLYCOL, PEG-10 DIMETHICONE, CETYL PEG/PPG-10/1 DIMETHICONE, PROPANEDIOL, HDI/TRIMETHYLOL HEXYLLACTONE CROSSPOLYMER, CAPRYLIC/CAPRIC TRIGLYCERIDE, CUCUMIS SATIVUS (CUCUMBER) FRUIT EXTRACT, SILICA, DISTEARDIMONIUM HECTORITE, SYNTHETIC WAX, DIMETHICONE/VINYL DIMETHICONE CROSSPOLYMER, ALUMINUM HYDROXIDE, TRIETHOXYCAPRYLYLSILANE, SORBITAN TRIOLEATE, SODIUM BENZOATE, LACTIC ACID, APIUM GRAVEOLENS (CELERY) SEED EXTRACT, LINUM USITATISSIMUM (LINSEED) SEED EXTRACT, [+ shade-specific colourants below]

BOW'PEEP: + TITANIUM DIOXIDE (CI 77891), IRON OXIDES (CI 77491, CI 77492), RED 7 LAKE (CI 15850)
FIYA PAPAYA: + TITANIUM DIOXIDE (CI 77891), IRON OXIDES (CI 77492), RED 7 LAKE (CI 15850)
WILD'BERRY WHIP: + ULTRAMARINES (CI 77007), TITANIUM DIOXIDE (CI 77891), IRON OXIDES (CI 77491), RED 7 LAKE (CI 15850)
QUIT WINE'IN: + IRON OXIDES (CI 77491), ULTRAMARINES (CI 77007), RED 7 LAKE (CI 15850), TITANIUM DIOXIDE (CI 77891)
VIOLET VICE$: + ULTRAMARINES (CI 77007), RED 7 LAKE (CI 15850), TITANIUM DIOXIDE (CI 77891), IRON OXIDES (CI 77491)`,
      'Skin Concerns & Benefits': `✓ All skin tones — shade range designed for diverse complexions
✓ Natural flush without looking cakey or powdery
✓ Oily / combination skin — transfer-proof and long-lasting
✓ Humid climates — sweat and humidity resistant
✓ Dry skin — Cucumber Extract provides all-day hydration
✓ Buildable from everyday sheer to full weekend drama`,
    },
    variants: [
      { colour: "BOW'PEEP",        img: `${W}/8832f2_779b2cd65a664312adf6373b970410dc~mv2.jpg` },
      { colour: 'FIYA PAPAYA',     img: `${W}/8832f2_9c17b86f36554c9daad136d6ca03607f~mv2.jpg` },
      { colour: "WILD'BERRY WHIP", img: `${W}/8832f2_826e880931e0481c87c2cec305831f7e~mv2.jpg` },
      { colour: "QUIT WINE'IN",    img: `${W}/8832f2_e44dd6162d254fa5894aeab42938c4b8~mv2.jpg` },
      { colour: 'VIOLET VICE$',    img: `${W}/8832f2_991644309ccd420e9b294743f576ca22~mv2.jpg` },
    ],
  },

  // ── P2 — Sun Stalk'R Soufflé Bronzer ────────────────────────────────────────
  {
    fields: {
      'Product Name':     "Fenty Beauty Sun Stalk'R Soufflé Bronzer",
      'Product Category': 'Beauty',
      'Sub-Category':     'Face',
      'Price (KES)':      7150,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_0b0bc99d381147f9843cc4a520b4f249~mv2.png` }],
      'Product Description': `Bronzer just got a glow-up. The Sun Stalk'R Soufflé is a pressed mousse bronzer with a uniquely soft, bouncy texture that melts into skin on contact. No streaks, no patches — just a sun-kissed glow that builds without heaviness.

Available in 5 sunlit shades designed to flex across a wide range of complexions, from a light golden tan (Biscotti 02) to a deep rich bronze (Hot Fudge 08).

• Finish: Soft, velvety sun-kissed glow
• Wear: Longwear, sweat- and humidity-resistant
• Texture: Pressed mousse — blurs and blends effortlessly
• Blurring powders prevent a patchy finish
• Shade range designed for all skin tones
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `Tap your brush gently into the soufflé, then dust off excess. Apply with a light circular or sweeping motion to the areas where the sun naturally hits: cheekbones, temples, nose bridge, and chin.

For a deeper, more sculpted bronze: build in layers, concentrating product on the outer face and sweeping upward.

Pairs beautifully with the Fenty Beauty Blush Brush 155 (also available here).

Pro tip: Press the product lightly and build — the mousse texture is richer than it looks and a little goes a long way.`,
      'Ingredients': `Full INCI list: source from fentybeauty.com per shade before publishing.

Key ingredients: Blurring Powders, Skin-Tone Flexible Pigments, Longwear + Humidity-Resistant Complex.`,
      'Skin Concerns & Benefits': `✓ All skin tones — 5 shades spanning light golden to deep rich bronze
✓ Humid / tropical climates — sweat and humidity resistant
✓ Buildable coverage — sheer glow to full sculpted bronze
✓ Oily skin — lightweight mousse texture doesn't sit on top of skin
✓ Natural finish seekers — blurred, no-patch application
✓ Year-round bronzing without sun exposure`,
    },
    variants: [
      { colour: 'Biscotti',      img: `${W}/8832f2_0b0bc99d381147f9843cc4a520b4f249~mv2.png` },
      { colour: "Brown Butt'R",  img: `${W}/8832f2_22d068339fa246dda0f7f7ca458cb4bf~mv2.png` },
      { colour: 'Sweet Truffle', img: `${W}/8832f2_e35b7c07109740cb8248be2a37cfdb66~mv2.png` },
      { colour: 'Coffee Toffee', img: `${W}/8832f2_120b964b1d9245308091f776f4d7679b~mv2.png` },
      { colour: 'Hot Fudge',     img: `${W}/8832f2_cb474078b3c14096bb11a508f51f3899~mv2.png` },
    ],
  },

  // ── P3 — Soft'lit Foundation ─────────────────────────────────────────────────
  {
    fields: {
      'Product Name':     "Fenty Beauty Soft'lit Naturally Luminous Longwear Foundation",
      'Product Category': 'Beauty',
      'Sub-Category':     'Face',
      'Price (KES)':      7850,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_0f4aa958e4fd48e28b73e3f894049d74~mv2.jpg` }],
      'Product Description': `Soft'lit delivers what every foundation should: a natural, skin-like glow that lasts all day without looking like makeup. The lightweight, medium-coverage formula hydrates as it wears — brightening and improving skin tone instantly and over time.

Color-true pigments are designed to resist oxidation, so the shade you apply stays true throughout the day. Available in 50 shades globally; we currently stock shades 225 and 385 — contact us if you need a different shade.

• Coverage: Medium, buildable
• Finish: Natural, skin-like luminous glow
• Wear: Longwear, waterproof
• Resists creasing, fading, sweat, humidity + transfer
• Suitable for: Balanced to dry skin types
• 50 shades available globally (2 in stock — enquire for others)
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `Prep: Moisturise skin before applying. Always shake the bottle before use.

For medium coverage: Apply 1 pump to the back of your hand. Dip a damp Precision Makeup Sponge into the product and press into skin, starting at the centre of the face and blending outward.

For fuller coverage: Apply 1–2 pumps directly to a Foundation Brush and blend. Build in layers to your desired coverage.

Pro tip: The formula is designed for balanced to dry skin. If you have oily skin, set with a translucent powder for extended wear.`,
      'Ingredients': `Full INCI list: source from fentybeauty.com for each shade before publishing.

Key ingredients: Skin-Brightening Complex, Longwear + Waterproof Formula, Color-True Oxidation-Resistant Pigments, Hydrating Base.`,
      'Skin Concerns & Benefits': `✓ Dry / balanced skin needing hydrating foundation
✓ Natural-finish seekers — skin-like, not cakey
✓ All-day wear in Nairobi's heat — waterproof and transfer-resistant
✓ Uneven skin tone — brightens and improves over time
✓ Oxidation-resistant formula — shade stays true all day`,
    },
    variants: [
      { colour: '225', img: `${W}/8832f2_0f4aa958e4fd48e28b73e3f894049d74~mv2.jpg` },
      { colour: '385', img: `${W}/8832f2_8492212d9b284bdbb712b80b30fd4f59~mv2.jpg` },
    ],
  },

  // ── P4 — Stunna Lip Paint ────────────────────────────────────────────────────
  {
    fields: {
      'Product Name':     'Fenty Beauty Stunna Lip Paint Longwear Fluid Lip Color',
      'Product Category': 'Beauty',
      'Sub-Category':     'Lips',
      'Price (KES)':      5800,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_0c32c846430b4263846e443698fe717d~mv2.jpg` }],
      'Product Description': `One stroke. Full impact. The Stunna Lip Paint is a weightless, longwear liquid lipstick with a soft matte finish — in shades Rihanna designed to look incredible on every skin tone. The precision wand lets you define and fill in a single pass.

• Size: 4ml
• Finish: Soft matte
• Wear: Longwear — no immediate feathering
• Precision applicator wand for clean, defined application
• Shake before use to activate the formula
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `Shake before use — the formula performs best when activated.

1. Hold the precision wand upright to define the lip line.
2. Flip wand to fill in the lips with the angled side.
3. For a softer, glossy finish: top with Gloss Bomb Stix or Gloss Bomb Universal Lip Luminizer (both available here).

No topping-up needed — the longwear formula stays put.`,
      'Ingredients': `ISODODECANE, DIMETHICONE, TRIMETHYLSILOXYSILICATE, HYDROGENATED POLYCYCLOPENTADIENE, DISTEARDIMONIUM HECTORITE, TRIETHOXYCAPRYLYLSILANE, PROPYLENE CARBONATE, ALUMINUM HYDROXIDE, RED 7 (CI 15850), RED 6 (CI 15850), YELLOW 5 LAKE (CI 19140), YELLOW 6 LAKE (CI 15985), BLUE 1 LAKE (CI 42090), TITANIUM DIOXIDE (CI 77891), RED 7 LAKE (CI 15850), RED 28 LAKE (CI 45410), IRON OXIDES (CI 77491, CI 77492, CI 77499).

Note: Ingredient list above reflects the Riri shade. Confirm per-shade colourant variation from fentybeauty.com before publishing Uninterested and Unlawful variants.`,
      'Skin Concerns & Benefits': `✓ All skin tones — shades designed to look universally flattering
✓ Transfer-resistant finish for long events, meetings, or nights out
✓ Dry lips — weightless formula doesn't feel drying despite matte finish
✓ Bold lip wearers — one-stroke, full-coverage pigment
✓ Pairs with Stunna Lip Paint Liner for extended wear`,
    },
    variants: [
      { colour: 'Riri',         img: `${W}/8832f2_0c32c846430b4263846e443698fe717d~mv2.jpg` },
      { colour: 'Uninterested', img: `${W}/8832f2_37b36e0b543f4ebcbd7aa3d208a8f486~mv2.jpg` },
      { colour: 'Unlawful',     img: `${W}/8832f2_77155601af6640959bc6bf332a5a7dcb~mv2.jpg` },
    ],
  },

  // ── P5 — Trace'd Out Lip Liner ───────────────────────────────────────────────
  {
    fields: {
      'Product Name':     "Fenty Beauty Trace'd Out Longwear Waterproof Pencil Lip Liner",
      'Product Category': 'Beauty',
      'Sub-Category':     'Lips',
      'Price (KES)':      4100,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_10aa188456404aa5a9b6a19e51e95840~mv2.jpg` }],
      'Product Description': `The lip liner that delivers — finally. Trace'd Out is a longwear, creamy pencil liner made with pure pigments that lay down true-cast colour without looking ashy, lasting up to 8 hours. It glides on smooth, blends when you want it to, then locks down to resist transfer, feathering and fading.

The universal shade range is designed to read true on every complexion — from nudes that work across skin tones to bold shades that land with impact. Sharpenable for precise definition.

• Wear: Up to 8 hours
• Finish: Velvet-matte
• Waterproof, transfer-resistant, feather-resistant
• Sharpenable pencil format
• No-drag, blendable application
• Extends lipstick wear when used underneath
• 100% cruelty-free
• Brand: Fenty Beauty
• Winner: Refinery29 Beauty Innovator Awards 2024`,
      'How to Use': `1. Sharpen to your preferred point — fine for precise definition, slightly blunted for a fuller, softer line.
2. Line the natural lip edge for definition, or slightly overdraw for a fuller-looking lip.
3. Fill in entirely for a base that extends the wear of any lipstick or gloss applied on top.
4. Blend the inner edge with a fingertip or small brush for a naturally diffused effect.

Pro tip: Pair with Stunna Lip Paint for a full-coverage matte look that won't move, or with Gloss Bomb Stix for a glossy editorial pout.`,
      'Ingredients': `Full INCI list: source from fentybeauty.com per shade before publishing.

Key ingredients: Pure Pigments (true-cast, non-ashy colour), Longwear Complex (transfer and feather-resistant), Blendable Cream Base.`,
      'Skin Concerns & Benefits': `✓ All skin tones — shade range built for true-cast colour across complexions
✓ Longevity — lasts up to 8 hours, extends lipstick wear
✓ Precise definition for any lip shape
✓ Buildable — can line or fully fill depending on desired look
✓ Waterproof — suitable for humid conditions and long days`,
    },
    variants: [
      { colour: 'RIRI',        img: `${W}/8832f2_10aa188456404aa5a9b6a19e51e95840~mv2.jpg` },
      { colour: 'Satin Panty', img: `${W}/8832f2_107aa44a0af84504ad97162ff2a4de17~mv2.jpg` },
      { colour: 'Pnut Butta',  img: `${W}/8832f2_d5e20100ed984a6e985db7c99d6fa86a~mv2.jpg` },
      { colour: 'Rose Amber',  img: `${W}/8832f2_d99343cb88c74f90a4d2cccdb151efc1~mv2.jpg` },
      { colour: 'Whiskey',     img: `${W}/8832f2_e139fbc5f9f441059230875676de8437~mv2.jpg` },
      { colour: 'Bored Heaux', img: `${W}/8832f2_71a9b55c8fc646f486f16aa8903736b0~mv2.jpg` },
    ],
  },

  // ── P6 — Gloss Bomb Stix ─────────────────────────────────────────────────────
  {
    fields: {
      'Product Name':     'Fenty Beauty Gloss Bomb Stix High-Shine Gloss Stick',
      'Product Category': 'Beauty',
      'Sub-Category':     'Lips',
      'Price (KES)':      5000,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_6c6ebfbecabe4b559ea04503b57bebc6~mv2.jpg` }],
      'Product Description': `Gloss Bomb's explosive shine — now in a colour-packed stick format. The Gloss Bomb Stix is the hybrid your lip drawer has been missing: the high-shine payoff of a gloss with the easy, no-mess application of a lipstick.

Nourishing and non-sticky, with medium pigment and the kind of shine that gets noticed. Formulated with Squalane, Vitamin E, Shea Butter and Kiwi Oil to lock moisture in for up to 8 hours.

• Size: 3.6g
• Finish: Luscious high-shine
• Wear: Moisture-lock for up to 8 hours
• Non-sticky feel
• Medium pigment, buildable coverage
• Key ingredients: Squalane, Vitamin E, Shea Butter, Kiwi Oil
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `For a sheer wash of colour and shine: apply with a light tapping motion. For fuller, more opaque coverage: swipe directly onto lips.

Can be worn alone or layered over any Fenty lip liner or Stunna Lip Paint for a glossy finish.

Pro tip: Apply to the centre of the lips and press together to naturally distribute for a plumping effect.`,
      'Ingredients': `Key ingredients: Squalane, Vitamin E (Tocopherol), Shea Butter (Butyrospermum Parkii), Kiwi Oil (Actinidia Chinensis Seed Oil).

Full INCI list: source from fentybeauty.com per shade before publishing.`,
      'Skin Concerns & Benefits': `✓ Dry / dehydrated lips — Squalane + Shea Butter provide lasting moisture
✓ All skin tones — shade range designed to be universally flattering
✓ Those who prefer non-sticky glosses
✓ Layering over matte lipsticks or liners for a glossy dimension
✓ Everyday shine without commitment — easy stick application`,
    },
    variants: [
      { colour: 'Rose Amber', img: `${W}/8832f2_6c6ebfbecabe4b559ea04503b57bebc6~mv2.jpg` },
      { colour: 'Peach Nude', img: `${W}/8832f2_64244f4cc97c490d9b44686be26f43e8~mv2.jpg` },
    ],
  },

  // ── P7 — Hella Thicc Volumizing Mascara ─────────────────────────────────────
  {
    fields: {
      'Product Name':     'Fenty Beauty Hella Thicc Volumizing Mascara',
      'Product Category': 'Beauty',
      'Sub-Category':     'Eyes',
      'Price (KES)':      4350,

      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_67bf2cd2324a4197a682842a1f4ee1d8~mv2.jpg` }],
      'Product Description': `Big, bold, impossibly thick lashes — without the weight. Hella Thicc's ultra-creamy formula and tapered brush coat, curl and lift every lash for a dramatically full effect that looks outrageous but feels weightless on the eye.

Sweat-, humidity- and transfer-resistant — made for Nairobi's climate.

• Size: 10ml
• Finish: Voluptuous, curvaceous lash effect
• Wear: Longwear, sweat-, humidity- and transfer-resistant
• Tapered brush for coating and lifting every lash
• Removable with Fenty Melt Awf Jelly Oil Cleanser
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `Before application: gently wipe excess product from the tip of the mascara wand to prevent clumping.

1. Wiggle the brush at the base of the lashes to build volume.
2. Work the product upward to the tips.
3. Layer as needed for your desired effect.

Pro technique: Brush inner lashes inward toward the nose, centre lashes upward toward the brow, and outer lashes outward toward the ear — for a full, fanned-out effect.

Apply one eye at a time and allow to dry between layers for best results.`,
      'Ingredients': `AQUA/WATER/EAU, CERA ALBA/BEESWAX/CIRE D'ABEILLE, PARAFFIN, GLYCERYL STEARATE, ORYZA SATIVA CERA/ORYZA SATIVA (RICE) BRAN WAX, BUTYLENE GLYCOL, PALMITIC ACID, ACACIA SENEGAL GUM, POLYBUTENE, VP/EICOSENE COPOLYMER, AMINOMETHYL PROPANOL, CERA CARNAUBA/COPERNICIA CERIFERA (CARNAUBA) WAX/CIRE DE CARNAUBA, STEARIC ACID, PHENOXYETHANOL, HYDROXYETHYLCELLULOSE, POTASSIUM SORBATE, HYDROLYZED PEA PROTEIN, HYDROLYZED VEGETABLE PROTEIN, ETHYLHEXYLGLYCERIN, POLYESTER-4, SODIUM BENZOATE, DISODIUM PHOSPHATE, SODIUM PHOSPHATE, TOCOPHEROL, IRON OXIDES (CI 77499).

Note: Ingredient list above is for the Cuz I'm Black shade. Confirm colourant variation from fentybeauty.com before adding Let's Be Blunt or Elec'Trip Blue variants.`,
      'Skin Concerns & Benefits': `✓ Sparse or short lashes needing volume and lift
✓ Straight lashes — tapered brush curls as it coats
✓ Humid climates — sweat and transfer resistant
✓ Dramatic eye looks without false lashes
✓ Ultra-black formula for maximum impact`,
    },
    variants: [
      { colour: "Cuz I'm Black", img: `${W}/8832f2_67bf2cd2324a4197a682842a1f4ee1d8~mv2.jpg` },
    ],
  },

  // ── P8 — Blush Brush 155 (no colour variants) ────────────────────────────────
  {
    fields: {
      'Product Name':     'Fenty Beauty Blush Brush 155',
      'Product Category': 'Beauty',
      'Sub-Category':     'Tools',
      'Price (KES)':      7000,
      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_d11aa0484fa84d2ebd49c4bdee359c46~mv2.jpg` }],
      'Product Description': `The Fenty Beauty Blush Brush 155 is an angled bristle brush engineered for precise application and easy blending of powder and liquid blush. Airy-light bristles create an airbrushed effect on the cheeks, and the angled shape targets exactly where you want colour to land.

Ideal companion for the Fenty Beauty Shake N' Play Liquid Blush (also available on this site).

• Bristle type: Airy-light, angled
• Effect: Airbrushed, precise, blended
• Works with: Powder and liquid blush
• Brand: Fenty Beauty`,
      'How to Use': `Gently tap the brush into blush and dust off any excess before applying. Start your first swipe where you want the most colour concentration — a little goes a long way with this brush.

For liquid blush (Shake N' Play): after dotting product onto cheeks, use this brush in stippling motions to diffuse and blend outward for a seamless, natural finish.

For powder blush: sweep upward from the apple of the cheek toward the temples with light, circular strokes.`,
      'Ingredients': `Not applicable — this is a makeup tool, not a formulated product.`,
      'Skin Concerns & Benefits': `✓ Precise, mess-free blush application
✓ Compatible with both powder and liquid blush textures
✓ Airbrushed finish without harsh lines
✓ Ideal for beginners — angled shape is self-guiding
✓ Professional quality for the everyday makeup routine`,
    },
    variants: [
      { colour: null, img: null },
    ],
  },

  // ── P9 — Gloss Bomb Universal Lip Luminizer — Wattabrat (no colour variants) ─
  {
    fields: {
      'Product Name':     'Fenty Beauty Gloss Bomb Universal Lip Luminizer — Wattabrat',
      'Product Category': 'Beauty',
      'Sub-Category':     'Lips',
      'Price (KES)':      4350,
      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_cd16ee614e5646a4bd7f8333e83a787e~mv2.jpg` }],
      'Product Description': `The iconic Gloss Bomb — now in Wattabrat, a pink shade made for lips that speak for themselves. A sheer-to-medium coverage gloss with an unmatched high-shine finish, comfortable wear and non-sticky feel.

The Gloss Bomb Universal Lip Luminizer is Fenty Beauty's most iconic lip product — a universally flattering formula that delivers explosive shine without the stickiness of traditional glosses.

• Size: 9ml
• Shade: Wattabrat (shimmer pink)
• Finish: High-shine
• Non-sticky feel
• Part of the Wattamoment Collection
• 100% cruelty-free
• Brand: Fenty Beauty`,
      'How to Use': `Apply directly from the wand to the centre of the lips and press together to distribute for a plumping gloss effect.

Layer over any lip colour for added shine and dimension. Wear alone over bare lips for an effortless every-day luminous look.`,
      'Ingredients': `Full INCI list: source from fentybeauty.com before publishing.

Key characteristics: Non-sticky, high-shine formula with universal lip-luminizing pigments.`,
      'Skin Concerns & Benefits': `✓ All skin tones — universally flattering pink shimmer
✓ Dry lips — comfortable, non-drying formula
✓ Those who want shine without stickiness
✓ Everyday wear — no-fuss application and removal
✓ Layering over any lip colour for a glossy finish`,
    },
    variants: [
      { colour: null, img: null },
    ],
  },

  // ── P10 — Iconic Lip Trio — Lips that Blush (no colour variants) ─────────────
  {
    fields: {
      'Product Name':     'Fenty Beauty Iconic Lip Trio — Lips that Blush',
      'Product Category': 'Beauty',
      'Sub-Category':     'Gifts',
      'Price (KES)':      9850,
      'Badge':            'Coming Soon',
      'Primary Image URL': [{ url: `${W}/8832f2_3f5c2da53c3e4dfca666641b87312bfb~mv2.jpg` }],
      'Product Description': `Three Fenty lip heroes — one box. The Iconic Lip Trio — Lips that Blush gives you everything you need to line, colour and plump your pout, in shades designed to work beautifully together.

Set includes:
• Trace'd Out Pencil Lip Liner — for precise definition and lasting liner
• Gloss Bomb Stix High-Shine Gloss Stick — for juicy, colour-packed shine
• Gloss Bomb Heat Universal Lip Luminizer + Plumper — for a fuller, luminous finish with a gentle plumping sensation

A complete lip routine in a gift-ready trio — ideal as a gift or as a self-purchase starting kit for the Fenty lip range.

• Brand: Fenty Beauty
• 100% cruelty-free`,
      'How to Use': `Step 1 — Trace'd Out Lip Liner: Line and sculpt the lip edge with the sharpenable pencil for definition and to extend the wear of the products layered on top.

Step 2 — Gloss Bomb Stix: Apply the high-shine gloss stick over the liner for juicy, colour-packed coverage. Use a tapping motion for sheer colour or swipe for fuller coverage.

Step 3 — Gloss Bomb Heat: Finish with the Gloss Bomb Heat plumper on the centre of the lips for a luminous, fuller-looking pout and a gentle warming plumping sensation.`,
      'Ingredients': `This set contains three individual Fenty Beauty products. Full INCI lists for each component are available from fentybeauty.com. See individual product entries for Trace'd Out Liner and Gloss Bomb Stix ingredient information.`,
      'Skin Concerns & Benefits': `✓ Complete lip routine in one purchase
✓ Ideal gift set — defined, glossy, plumped lip look
✓ All skin tones — universal shades in the Lips that Blush palette
✓ Fenty Beauty beginners — three entry products that work as a system
✓ Longwear through definition (liner) + layered gloss`,
    },
    variants: [
      { colour: null, img: null },
    ],
  },

];

async function run() {
  // 1. Create product records
  console.log('1/3  Creating Fenty Beauty product records…');
  const productPayload = products.map(p => ({ fields: p.fields }));
  const createdProducts = await batchCreate(PRODUCTS_URL, productPayload);
  createdProducts.forEach((r, i) =>
    console.log(`     ✓ ${products[i].fields['Product Name']} — KES ${products[i].fields['Price (KES)'].toLocaleString()}`)
  );

  // 2. Create variant records
  console.log('\n2/3  Creating variants…');
  const variantPayload = [];
  const variantMeta   = [];

  createdProducts.forEach((product, pi) => {
    products[pi].variants.forEach(v => {
      const fields = { 'Active': true, 'Products': [product.id] };
      if (v.colour) fields['Colour']        = v.colour;
      if (v.img)    fields['Variant Image'] = [{ url: v.img }];
      variantPayload.push({ fields });
      variantMeta.push({
        productName: products[pi].fields['Product Name'],
        label: v.colour || '(no shade)',
      });
    });
  });

  const createdVariants = await batchCreate(VARIANTS_URL, variantPayload);
  createdVariants.forEach((v, i) =>
    console.log(`     ✓ ${v.id} → ${variantMeta[i].productName} — ${variantMeta[i].label}`)
  );

  // 3. Create inventory movements (qty 3, Stock In)
  console.log('\n3/3  Creating inventory movements (qty 3)…');
  const today = new Date().toISOString().slice(0, 10);
  const movementPayload = createdVariants.map((v, i) => ({
    fields: {
      'Movement':      `Initial stock — ${variantMeta[i].productName}${variantMeta[i].label !== '(no shade)' ? ` — ${variantMeta[i].label}` : ''}`,
      'Date':          today,
      'Movement Type': 'Stock In',
      'Quantity':      3,
      'Variant':       [v.id],
    },
  }));

  const createdMovements = await batchCreate(MOVEMENTS_URL, movementPayload);
  createdMovements.forEach((m, i) =>
    console.log(`     ✓ ${m.id} → qty 3 — ${variantMeta[i].label !== '(no shade)' ? variantMeta[i].label + ' · ' : ''}${variantMeta[i].productName}`)
  );

  const totalV = createdVariants.length;
  const totalM = createdMovements.length;
  console.log(`\n✓ Done. ${products.length} products · ${totalV} variants · ${totalM} movements created.\n`);
  console.log("⚠  Soft'lit Foundation shade 385 is sold out at Lintons — verify restock with supplier before publishing.");
  console.log("⚠  Hella Thicc Mascara: only Cuz I'm Black added — confirm other shade availability before adding Let's Be Blunt / Elec'Trip Blue.");
  console.log('⚠  Iconic Lip Trio: confirm with supplier it\'s available as ongoing stock, not a limited seasonal set.');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
