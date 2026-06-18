const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TOKEN             = process.env.AIRTABLE_TOKEN;
const BASE_ID           = 'appr0NVsuTjdOAfzz';
const VARIANTS_TABLE    = 'tblnUje4pZyI53p2C';
const MOVEMENTS_TABLE   = 'tblQ7JNyChQuSay0a';
const PRODUCT_RECORD_ID = 'recvvFTlcy20PbwCg';

const VARIANTS = [
  {
    recordId: 'recmyjhOLALqeGEgA', // already created
    colour: 'Cinnamon Sugar (Mauve Pink)',
    qty: 2,
    image: '/Users/nericakuguru/Downloads/Laneige-CINNAMON SUGAR-MAUVE PINK.png',
  },
  {
    colour: 'Chocolate Frosting (Warm Brown)',
    qty: 2,
    image: '/Users/nericakuguru/Downloads/Laneige-CHOCOLATE FROSTING-WARM BROWN.png',
  },
  {
    colour: 'Peach Glaze (Peachy Coral)',
    qty: 0,
    image: '/Users/nericakuguru/Downloads/Laneige-PEACH GLAZE-PEACHY CORAL.png',
  },
  {
    colour: 'Raspberry Jam (Sheer Red)',
    qty: 0,
    image: '/Users/nericakuguru/Downloads/Laneige-RASPBERRY JAM-SHEER RED.png',
  },
  {
    colour: 'Sugar Glaze (Nude Beige)',
    qty: 1,
    image: '/Users/nericakuguru/Downloads/Laneige-SUGAR GLAZE-NUDE BEIGE.png',
  },
];

const TODAY   = new Date().toISOString().slice(0, 10);
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function uploadToCatbox(imagePath) {
  const result = execFileSync('curl', [
    '-s',
    '-F', 'reqtype=fileupload',
    '-F', `fileToUpload=@${imagePath}`,
    'https://catbox.moe/user/api.php',
  ]).toString().trim();
  if (!result.startsWith('https://')) throw new Error(`Catbox upload failed: ${result}`);
  return result;
}

async function createVariant(colour) {
  const { data } = await axios.post(
    `https://api.airtable.com/v0/${BASE_ID}/${VARIANTS_TABLE}`,
    { fields: { 'Colour': colour, 'Active': true, 'Products': [PRODUCT_RECORD_ID] }, typecast: true },
    { headers: HEADERS }
  );
  return data.id;
}

async function createStockMovement(variantId, qty, colour) {
  await axios.post(
    `https://api.airtable.com/v0/${BASE_ID}/${MOVEMENTS_TABLE}`,
    {
      fields: {
        'Movement':      `Initial stock — Laneige Glaze Craze Tinted Lip Serum — ${colour}`,
        'Date':          TODAY,
        'Movement Type': 'Stock In',
        'Quantity':      qty,
        'Reason':        'Opening stock — initial catalogue load',
        'Reference':     'INITIAL',
        'Variant':       [variantId],
      },
    },
    { headers: HEADERS }
  );
}

async function attachImage(recordId, imageUrl) {
  await axios.patch(
    `https://api.airtable.com/v0/${BASE_ID}/${VARIANTS_TABLE}/${recordId}`,
    { fields: { 'Variant Image': [{ url: imageUrl }] } },
    { headers: HEADERS }
  );
}

async function run() {
  for (const v of VARIANTS) {
    let recordId = v.recordId;

    if (recordId) {
      console.log(`"${v.colour}" — already created (${recordId}), patching image only`);
    } else {
      process.stdout.write(`Creating "${v.colour}"... `);
      recordId = await createVariant(v.colour);
      console.log(`created (${recordId})`);

      if (v.qty > 0) {
        process.stdout.write(`  Adding stock movement (qty ${v.qty})... `);
        await createStockMovement(recordId, v.qty, v.colour);
        console.log('done');
      } else {
        console.log(`  Skipping stock movement (qty 0)`);
      }
    }

    process.stdout.write(`  Uploading image to catbox... `);
    const imageUrl = uploadToCatbox(v.image);
    console.log(imageUrl);

    process.stdout.write(`  Attaching image to Airtable record... `);
    await attachImage(recordId, imageUrl);
    console.log('done');
  }
  console.log('\nAll 5 variants complete.');
}

run().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
