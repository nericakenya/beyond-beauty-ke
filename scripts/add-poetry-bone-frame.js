require('dotenv').config();
const axios = require('axios');

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS  = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

const CARE = `Handle with care – frames are fragile and should be kept away from heat, direct sunlight and humidity to preserve finish and glass integrity.

• Wipe frame surfaces with a soft, dry or slightly damp cloth.
• Do not use chemical or abrasive cleaning products on the frame.
• Clean glass with a lint-free glass cloth – avoid paper towels which can scratch.
• Store in original packaging if not in use.`;

const RETURNS = `• Free delivery on orders over KSh 5,000
• Standard delivery within Nairobi: KSh 250 – 1 to 3 hours
• We deliver nationwide across Kenya: KSh 500 – 1 to 3 working days
• Exchanges accepted within 24 hours of delivery

For full details, see our Delivery & Refund Policy at beyondbeauty.co.ke/policies/delivery-refund`;

const record = {
  fields: {
    'Product Name':        'Poetry Bone Two-Tone & Tier Frame',
    'Product Description': 'This distinctive tier frame features a two-tone bone finish – an easy way to elevate your space and display your cherished memories with style.\n\n• Frame size: 10 cm (W) × 15 cm (L)\n• Photo size: 10 × 15 cm (4" × 6")\n• Colour: Milk\n• Style: Tiered design with two-tone finish\n• Brand: Poetry',
    'Product Category':    'Home',
    'Sub-Category':        'Frames',
    'Price (KES)':         3150,
    'Materials':           'TBC – confirm with supplier',
    'Care Instructions':   CARE,
    'Returns Override':    RETURNS,
    'Badge':               'Coming Soon',
    'Dimensions':          '10 cm (W) × 15 cm (L)',
  },
};

async function run() {
  const { data } = await axios.post(BASE_URL, { typecast: true, records: [record] }, { headers: HEADERS });
  const r = data.records[0];
  console.log(`✓ Created: ${r.id}  "${r.fields['Product Name']}"`);
  console.log(`\n⚠  No image added — Poetry's site is a PWA and image URLs couldn't be extracted.`);
  console.log(`   Add the product image manually in Airtable record ${r.id}.`);
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
