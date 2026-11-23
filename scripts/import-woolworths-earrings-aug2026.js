// One-off importer: 6 Woolworths SA earrings, Aug 2026 batch.
// ZAR -> KES converted at ~8.0 KES/ZAR (mid-market ≈8.025 on import day), rounded to nearest KES 50.
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

// Categories table links (existing Accessories > Jewellery > Earrings chain)
const CATEGORY_LINK      = ['recPaJBie31v5nkRa']; // Accessories
const SUBCATEGORY_LINK   = ['reczZ1seNKiKEphIF']; // Jewellery
const SEC_SUBCATEGORY_LINK = ['recw2RiFRQJq9CMjz']; // Earrings

const ZAR_TO_KES = 8.0;
const toKES = (zar) => Math.round((zar * ZAR_TO_KES) / 50) * 50;

const products = [
  {
    code: '511393168',
    name: 'Freshwater Pearl Drop Earrings',
    zar: 199,
    intro: 'Designed with a delicate drop silhouette, these freshwater pearl earrings add shine and lustre to your look. An effortless choice that pairs beautifully with tailoring, dresses or eveningwear.',
    details: ['50% zinc alloy and 50% freshwater pearl', 'Hypoallergenic for sensitive skin', 'Nickel-free', 'Lead-free'],
    size: '2.3cm',
    care: 'Freshwater pearls can easily be cleaned with hand soap and water.',
    colour: null,
    url: 'https://www.woolworths.co.za/prod/Women/Accessories/Woolworths-Freshwater-Pearl-Drop-Earrings/_/A-511393168',
    hero: 'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-511393168.jpg?V=ut7I&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA2LTI0LzUxMTM5MzE2OF9YQ1JFQU1faGVyby5qcGcifQ&',
    images: [
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-511393168.jpg?V=ut7I&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA2LTI0LzUxMTM5MzE2OF9YQ1JFQU1faGVyby5qcGcifQ&',
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-511393168-detail.jpg?V=wxlG&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDEtMTQvNTExMzkzMTY4X1hDUkVBTV9kZXRhaWwuanBnIn0&',
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-511393168-detail1.jpg?V=Y4Vb&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDEtMTQvNTExMzkzMTY4X1hDUkVBTV9kZXRhaWwxLmpwZyJ9&',
    ],
  },
  {
    code: '512004560',
    name: "Tiger's Eye Drop Earrings",
    zar: 179,
    intro: 'Make a sophisticated statement with these drop earrings. The rich, natural stone is beautifully suspended to create gentle movement, adding warmth and effortless elegance to every look.',
    details: ['70% zinc, 20% natural stone, 10% steel', 'Hypo-allergenic for sensitive skin', 'Nickel-free', 'Lead-free'],
    size: '24mm',
    care: null,
    colour: 'Gold',
    url: 'https://www.woolworths.co.za/prod/Online-Feature/Women/New-In/Accessories/Woolworths-Tiger-s-Eye-Drop-Earrings/_/A-512004560',
    hero: 'https://assets.woolworthsstatic.co.za/Tiger-s-Eye-Drop-Earrings-GOLD-512004560.jpg?V=Lec1&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTA3LzUxMjAwNDU2MF9HT0xEX2hlcm8uanBnIn0&',
    images: [
      'https://assets.woolworthsstatic.co.za/Tiger-s-Eye-Drop-Earrings-GOLD-512004560.jpg?V=Lec1&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTA3LzUxMjAwNDU2MF9HT0xEX2hlcm8uanBnIn0&',
      'https://assets.woolworthsstatic.co.za/Tiger-s-Eye-Drop-Earrings-GOLD-512004560-detail1.jpg?V=ckb9&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDYtMjMvNTEyMDA0NTYwX0dPTERfZGV0YWlsMS5qcGcifQ&',
    ],
  },
  {
    code: '512051400',
    name: 'Faux Pearl Hoop Earrings',
    zar: 149,
    intro: 'Elevate your jewellery collection with these earrings, accented with luminous glass pearls for a timeless finish. The classic hoop silhouette is complemented by a secure snap closure, making it an elegant choice for both everyday wear and special occasions.',
    details: ['50% zinc alloy, 50% glass pearl', 'Hypo-allergenic for sensitive skin', 'Nickel-free', 'Lead-free'],
    size: null,
    care: null,
    colour: null,
    notesExtra: ' Listing has two colourway SKUs (Silver / X-Cream pearl-tone); imaged/priced as the pearl-tone default — colour left unset.',
    url: 'https://www.woolworths.co.za/prod/Online-Feature/Women/New-In/Accessories/Woolworths-Faux-Pearl-Hoop-Earrings/_/A-512051400',
    hero: 'https://assets.woolworthsstatic.co.za/Faux-Pearl-Hoop-Earrings-X-CREAM-512051400.jpg?V=j239&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTMwLzUxMjA1MTQwMF9YQ1JFQU1faGVyby5qcGcifQ&',
    images: [
      'https://assets.woolworthsstatic.co.za/Faux-Pearl-Hoop-Earrings-X-CREAM-512051400.jpg?V=j239&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTMwLzUxMjA1MTQwMF9YQ1JFQU1faGVyby5qcGcifQ&',
      'https://assets.woolworthsstatic.co.za/Faux-Pearl-Hoop-Earrings-X-CREAM-512051400-detail1.jpg?V=HhMr&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDctMDIvNTEyMDUxNDAwX1hDUkVBTV9kZXRhaWwxLmpwZyJ9&',
      'https://assets.woolworthsstatic.co.za/Faux-Pearl-Hoop-Earrings-X-CREAM-512051400-detail2.jpg?V=fM6t&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDctMDIvNTEyMDUxNDAwX1hDUkVBTV9kZXRhaWwyLmpwZyJ9&',
    ],
  },
  {
    code: '512044688',
    // Source page title duplicates "Freshwater Pearl Drop Earrings" (A-511393168) — renamed to disambiguate.
    name: 'Freshwater Pearl & Gold Stud Drop Earrings',
    zar: 199,
    intro: 'A sculptural gold-tone stud and lustrous freshwater pearl come together in these elegant drop earrings. Contemporary yet timeless, they bring an effortlessly refined finish to both everyday and occasion looks.',
    details: ['Freshwater pearl', 'Gold-tone stud', 'Hypo-allergenic for sensitive skin', 'Nickel-free', 'Lead-free'],
    size: '7-8mm',
    care: 'Freshwater pearls can easily be cleaned with hand soap and water.',
    colour: 'Gold',
    url: 'https://www.woolworths.co.za/prod/Online-Feature/Women/New-In/Accessories/Woolworths-Freshwater-Pearl-Drop-Earrings/_/A-512044688',
    hero: 'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-512044688.jpg?V=Mqkn&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTMwLzUxMjA0NDY4OF9YQ1JFQU1faGVyby5qcGcifQ&',
    images: [
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-512044688.jpg?V=Mqkn&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTMwLzUxMjA0NDY4OF9YQ1JFQU1faGVyby5qcGcifQ&',
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-512044688-detail1.jpg?V=JbRN&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDctMjMvNTEyMDQ0Njg4X1hDUkVBTV9kZXRhaWwxLmpwZyJ9&',
      'https://assets.woolworthsstatic.co.za/Freshwater-Pearl-Drop-Earrings-X-CREAM-512044688-detail2.jpg?V=R2nL&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDctMjMvNTEyMDQ0Njg4X1hDUkVBTV9kZXRhaWwyLmpwZyJ9&',
    ],
  },
  {
    code: '512051602',
    name: 'Assorted Studs & Hoop Earrings 6 Pack',
    zar: 179,
    intro: 'Refresh your jewellery collection with this assorted six-pack of stud and hoop earrings. Featuring a versatile mix of sparkling diamante and elegant faux pearl detailing, each pair offers a timeless finish.',
    details: ['50% zinc casings, 20% iron, 20% acrylic, 10% glass', 'Hypo-allergenic for sensitive skin', 'Nickel-free', 'Lead-free'],
    size: '2 x 4mm, 18mm, 2 x 20mm, 21mm',
    care: null,
    colour: 'Gold',
    url: 'https://www.woolworths.co.za/prod/Online-Feature/Women/New-In/Accessories/Woolworths-Assorted-Studs-Hoop-Earrings-6-Pack/_/A-512051602',
    hero: 'https://assets.woolworthsstatic.co.za/Assorted-Studs-Hoop-Earrings-6-Pack-GOLD-512051602.jpg?V=EfA4&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTAyLzUxMjA1MTYwMl9HT0xEX2hlcm8uanBnIn0&',
    images: [
      'https://assets.woolworthsstatic.co.za/Assorted-Studs-Hoop-Earrings-6-Pack-GOLD-512051602.jpg?V=EfA4&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI2LTA3LTAyLzUxMjA1MTYwMl9HT0xEX2hlcm8uanBnIn0&',
      'https://assets.woolworthsstatic.co.za/Assorted-Studs-Hoop-Earrings-6-Pack-GOLD-512051602-detail1.jpg?V=6CA5&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjYtMDctMDIvNTEyMDUxNjAyX0dPTERfZGV0YWlsMS5qcGcifQ&',
    ],
  },
  {
    code: '510986234',
    name: 'Stainless Steel Huggie Hoop Earrings',
    zar: 249,
    intro: 'An understated essential, these durable stainless steel huggie hoops feature a clean silhouette and secure clasp for easy, comfortable wear. A versatile piece that complements any outfit.',
    details: ['100% stainless steel', 'Hypoallergenic for sensitive skin', 'Nickel-free', 'Lead-free', 'Waterproof coating for lasting finish'],
    size: '1.5cm',
    care: null,
    colour: 'Gold',
    url: 'https://www.woolworths.co.za/prod/Valentines-Day/Outfit-Inspiration/Date-Night-Outfits-for-Her/Accessories/Woolworths-Stainless-Steel-Huggie-Hoop-Earrings/_/A-510986234',
    hero: 'https://assets.woolworthsstatic.co.za/Stainless-Steel-Huggie-Hoop-Earrings-GOLD-510986234.jpg?V=IzG6&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI1LTExLTA1LzUxMDk4NjIzNF9HT0xEX2hlcm8uanBnIn0&',
    images: [
      'https://assets.woolworthsstatic.co.za/Stainless-Steel-Huggie-Hoop-Earrings-GOLD-510986234.jpg?V=IzG6&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvaGVyby8yMDI1LTExLTA1LzUxMDk4NjIzNF9HT0xEX2hlcm8uanBnIn0&',
      'https://assets.woolworthsstatic.co.za/Stainless-Steel-Huggie-Hoop-Earrings-GOLD-510986234-detail.jpg?V=5Tfu&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjUtMTAtMTcvNTEwOTg2MjM0X0dPTERfZGV0YWlsLmpwZyJ9&',
      'https://assets.woolworthsstatic.co.za/Stainless-Steel-Huggie-Hoop-Earrings-GOLD-510986234-detail1.jpg?V=sKhE&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjUtMTAtMTcvNTEwOTg2MjM0X0dPTERfZGV0YWlsMS5qcGcifQ&',
      'https://assets.woolworthsstatic.co.za/Stainless-Steel-Huggie-Hoop-Earrings-GOLD-510986234-detail2.jpg?V=0nXC&o=eyJidWNrZXQiOiJ3dy1vbmxpbmUtaW1hZ2UtcmVzaXplIiwia2V5IjoiaW1hZ2VzL2VsYXN0aWNlcmEvcHJvZHVjdHMvYWx0ZXJuYXRlLzIwMjUtMTAtMTcvNTEwOTg2MjM0X0dPTERfZGV0YWlsMi5qcGcifQ&',
    ],
  },
];

function buildDescription(p) {
  let desc = p.intro + '\n\nDETAILS:\n' + p.details.join('\n');
  if (p.size) desc += '\n\nSIZE:\n' + p.size;
  if (p.care) desc += '\n\nCARE:\n' + p.care;
  return desc;
}

function buildMaterials(p) {
  const compLine = p.details[0];
  const rest = p.details.slice(1).join(', ');
  return `${compLine}. ${rest}.`;
}

async function run() {
  console.log(`Importing ${products.length} Woolworths earrings (ZAR→KES @ ${ZAR_TO_KES}, rounded to nearest 50)…\n`);

  // 1. Create products
  const productRecords = products.map(p => {
    const priceKES = toKES(p.zar);
    const fields = {
      'Product Name':        p.name,
      'Product Category':    'Accessories',
      'Category (Link)':     CATEGORY_LINK,
      'Sub-Category (Link)': SUBCATEGORY_LINK,
      'Secondary Sub-Category (Link)': SEC_SUBCATEGORY_LINK,
      'Product Description': buildDescription(p),
      'Materials':           buildMaterials(p),
      'Price (KES)':         priceKES,
      'Status':               'Active',
      'Active':               true,
      'Notes':                `Sourced from Woolworths SA: ${p.url} — product code ${p.code}. ZAR price was R${p.zar} (converted @ ~${ZAR_TO_KES} KES/ZAR, rounded to nearest KES 50).${p.notesExtra || ''}`,
      'Primary Image URL':    [{ url: p.hero }],
    };
    if (p.size) fields['Dimensions'] = p.size;
    return fields;
  });

  const { data: pData } = await axios.post(PRODUCTS_URL, { typecast: true, records: productRecords.map(fields => ({ fields })) }, { headers: HEADERS });
  pData.records.forEach((r, i) => console.log(`  ✓ Product ${r.id} — ${products[i].name} — KES ${toKES(products[i].zar).toLocaleString()}`));

  // 2. Create variants (one per product)
  console.log('\nCreating variants…');
  const variantRecords = products.map((p, i) => {
    const fields = {
      'Active':       true,
      'Products':     [pData.records[i].id],
      'Variant Image': p.images.map(url => ({ url })),
    };
    if (p.colour) fields['Colour'] = p.colour;
    return { fields };
  });
  const { data: vData } = await axios.post(VARIANTS_URL, { typecast: true, records: variantRecords }, { headers: HEADERS });
  vData.records.forEach((r, i) => console.log(`  ✓ Variant ${r.id} → ${products[i].name}`));

  // 3. Create initial stock-in movements (qty 2 each, matching prior earrings imports)
  console.log('\nCreating inventory movements (qty 2)…');
  const movementRecords = vData.records.map((r, i) => ({
    fields: {
      'Movement':      `Initial stock — ${products[i].name}`,
      'Date':          new Date().toISOString().slice(0, 10),
      'Movement Type': 'Stock In',
      'Quantity':      2,
      'Variant':       [r.id],
    },
  }));
  const { data: mData } = await axios.post(MOVEMENTS_URL, { records: movementRecords }, { headers: HEADERS });
  mData.records.forEach((r, i) => console.log(`  ✓ Movement ${r.id} → ${products[i].name}`));

  console.log('\nDone.');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
