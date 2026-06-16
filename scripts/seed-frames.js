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
• For silver-plated finishes (Paton range): do not use silver polish or metal cleaners. A dry microfibre cloth is sufficient for routine care.
• For timber frames (Adler range): avoid prolonged exposure to moisture or direct sunlight, which may cause warping or fading over time.
• Store in original packaging if not in use.`;

const RETURNS = `• Free delivery on orders over KSh 5,000
• Standard delivery within Nairobi: KSh 250 – 1 to 3 hours
• We deliver nationwide across Kenya: KSh 500 – 1 to 3 working days
• Exchanges accepted within 24 hours of delivery

For full details, see our Delivery & Refund Policy at beyondbeauty.co.ke/policies/delivery-refund`;

const records = [
  {
    fields: {
      'Product Name':        'Country Road Paton Medium Frame',
      'Product Description': 'The Paton has a fine, modern shallow box frame with a sleek silver-plated finish.\nA considered piece for hanging a favourite photograph or a piece of art.\n\n• Frame size: 15.6 × 20.7 × 1.6 cm\n• Photo size: 4" × 6" (10 × 15 cm)\n• Finish: Silver plated\n• Mounting: Wall hanging (portrait or landscape)\n• Brand: Country Road',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           '100% Silver Plated Steel',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
  {
    fields: {
      'Product Name':        'Country Road Paton Small Frame',
      'Product Description': 'The Paton has a fine, modern shallow box frame with a sleek silver-plated finish.\nThe small size is ideal for a desk, bedside table or a gallery wall of memories.\n\n• Frame size: 12.6 × 12.6 × 1.6 cm\n• Photo size: 3" × 4" (7.5 × 10 cm)\n• Finish: Silver plated\n• Mounting: Wall hanging (portrait or landscape)\n• Brand: Country Road',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           '100% Silver Plated Steel',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
  {
    fields: {
      'Product Name':        'Country Road Adler Medium Frame',
      'Product Description': 'The Adler features a slim, modern rectangular timber profile – clean lines\nthat sit as well in a gallery cluster as they do standing alone.\nMix scales and finishes, or group in the same finish for a considered wall.\n\n• Frame size: 28 × 22 cm\n• Photo size: 5" × 7" (12.7 × 17.8 cm)\n• Composition: Timber and glass\n• Mounting: Wall hanging (portrait or landscape)\n• Brand: Country Road',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           'Timber and glass',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
  {
    fields: {
      'Product Name':        'Country Road Adler Certificate Frame',
      'Product Description': 'The Adler Certificate Frame does double duty – desk-standing or wall-hung,\nwith a metal clip hook and mount board included.\nThe slim timber profile makes it as at home with a diploma as with an art print.\n\n• Frame size: 36 × 31 cm\n• Photo/certificate size: 8" × 10" (20.3 × 25.4 cm)\n• Composition: Timber\n• Mounting: Desk and wall mountable\n• Includes: Metal clip hook and mount board\n• Brand: Country Road',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           'Timber',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
  {
    fields: {
      'Product Name':        'Olivia Square Frame',
      'Product Description': 'The Olivia Square Frame lends contemporary style to any shelf or surface.\nThe square silhouette and squiggle design make it a small statement piece\nfor a favourite photo, a polaroid or a postcard.\n\n• Frame size: 10 × 10 cm\n• Colour: Milk\n• Style: Square with squiggle design detail\n• Brand: Poetry',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           'TBC – confirm with supplier',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
  {
    fields: {
      'Product Name':        'Olivia Oval Frame',
      'Product Description': 'The Olivia Oval Frame brings a softer, more sculptural presence to your shelf.\nThe oval silhouette and squiggle design pair naturally with the Square version –\nor stand beautifully on their own.\n\n• Frame size: 10 cm (W) × 15 cm (L)\n• Colour: Milk\n• Style: Oval with squiggle design detail\n• Brand: Poetry',
      'Product Category':    'Home',
      'Sub-Category':        'Frames',
      'Materials':           'TBC – confirm with supplier',
      'Care Instructions':   CARE,
      'Returns Override':    RETURNS,
      'Badge':               'Coming Soon',
    },
  },
];

async function run() {
  console.log(`Creating ${records.length} frame products in Airtable…`);
  const { data } = await axios.post(BASE_URL, { typecast: true, records }, { headers: HEADERS });
  console.log(`✓ Created ${data.records.length} records:`);
  data.records.forEach(r => console.log(`  ${r.id}  ${r.fields['Product Name']}`));
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
