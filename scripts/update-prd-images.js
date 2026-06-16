// Patch Primary Image URL for all PRD products where images were confirmed
// 32 of 55 products confirmed; 23 (Medicube, Dr. Althea, Estée Lauder, Laneige) need manual images
require('dotenv').config();
const axios = require('axios');

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const HEADERS  = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Record ID → image URL mapping
// Field: "Primary Image URL" (attachment field — pass as array of {url} objects)
const imageMap = [

  // ── SOL DE JANEIRO (3) ──────────────────────────────────────────
  { id: 'recfIYEHXthKd8y7S', url: 'https://cdn.shopify.com/s/files/1/2826/2250/files/Brazilian_Bum_Bum_Cream_Sol_de_Janeiro_0.webp?v=1713788113' },
  { id: 'recLmMJjzm3pQay3F', url: 'https://cdn.shopify.com/s/files/1/2826/2250/files/Beija_flor_elasti_Cream_Sol_de_janeiro_0.webp?v=1712946593' },
  { id: 'receINlC7uTm9l9tx', url: 'https://cdn.shopify.com/s/files/1/2826/2250/files/Cheirosa68_perfume_Mist_240mL_Sol_de_Janeiro_0-webp.webp?v=1720730188' },

  // ── ANUA (8) ────────────────────────────────────────────────────
  { id: 'recR0ZcUXCNxai6oD', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-heartleaf-77-soothing-toner-1239193744.jpg?v=1779181932' },
  { id: 'recbjOoPSVlHTJLQ7', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-moisturizer-heartleaf-70-daily-lotion-1239193746.jpg?v=1779177548' },
  { id: 'recLGWEiG2y376u3a', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-global-ampoule-serum-peach-70-niacinamide-serum-1239193727.jpg?v=1779177611' },
  { id: 'recarv7DAhv4NPoDk', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-global-ampoule-serum-niacinamide-10-txa-4-serum-for-brightening-and-dark-spots-1239193722.jpg?v=1779177130' },
  { id: 'rec1QG09u51DVW1kk', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-azelaic-acid-10-hyaluron-redness-soothing-serum-1239193732.jpg?v=1779177969' },
  { id: 'recASjqUVfpxpR6Zk', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-nano-retinol-0-3-niacin-renewing-serum-1239193724.jpg?v=1779181751' },
  { id: 'recvrk5f8YyfM1df7', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-rice-enzyme-brightening-cleansing-powder-1239193705.jpg?v=1779178092' },
  { id: 'recjixnfKtzrmpdGl', url: 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-rice-ceramide-7-hydrating-barrier-serum-1239193730.jpg?v=1779178029' },

  // ── NATURIUM (8) ────────────────────────────────────────────────
  { id: 'recz6WRrjiWx7TEoA', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_VitaminC_Complex_Cleanser_Front_bonebkgd.webp?v=1774296858' },
  { id: 'recqYjNvoJbiCsgiO', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/Naturium_Tranexamic_Acid_Front_CapOn_Bone_1.webp?v=1774294545' },
  { id: 'recPZOb88kg9bFTK2', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-Multi-Peptide_Serum_Front_capoff_primary_bone.webp?v=1774292955' },
  { id: 'recrT2yQOcEDsK2wO', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-10065_Multi-Peptide-Moisturizer-Front-CapOn-bonebkgd.jpg?v=1777319292' },
  { id: 'recHPj4PvNmK7s1Dk', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_NiaGelCream_tube_front_CapOn_bonebkgd.webp?v=1774294431' },
  { id: 'reca0016Uy1Y5j2k8', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_DewGlow_SPF50_Front_CapOn_bonebkgd.webp?v=1774295804' },
  { id: 'recS9XkH6HS9DHKqS', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-40002_The-Smoother_bonebkgd_front.webp?v=1776370953' },
  { id: 'recVg1tc5szHgKIt7', url: 'https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-KP_Scrub_Front.webp?v=1774290427' },

  // ── BEAUTY OF JOSEON (4) ────────────────────────────────────────
  { id: 'recGAZHH0girpkfYx', url: 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/ginseng-essence-water-1-front.webp?v=1770618733' },
  { id: 'recNsxL4beQfjmICZ', url: 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/relief-sunscreen-1-front.webp?v=1770603160' },
  { id: 'recT4N9dxClqwLqJU', url: 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-serum-propolis-niacinamide-1-front.webp?v=1770278801' },
  { id: 'recrqAaf1GbN0GBRo', url: 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/dynasty-cream-1-front.webp?v=1770618339' },

  // ── ADVANCED CLINICALS (3) ──────────────────────────────────────
  { id: 'recrTLZPFth3YctYs', url: 'https://cdn.shopify.com/s/files/1/0096/1842/3887/files/CL10059-R6_RetinolBodyCream_Main_100725.jpg?v=1760986119' },
  { id: 'recquUFc6REsrEZcP', url: 'https://cdn.shopify.com/s/files/1/0096/1842/3887/files/AC049_VitaminCFaceSerum_Main_6ebf7dc9-a478-4ee9-addc-f8d30d8591fe.jpg?v=1760984841' },
  { id: 'recZeecKcn6qqx1Z3', url: 'https://cdn.shopify.com/s/files/1/0096/1842/3887/files/AC213_10_Glycolic_LacticAcidBodyCream_Main_v2.jpg?v=1760986475' },

  // ── OLAPLEX (5) ─────────────────────────────────────────────────
  { id: 'rec3JeJWAI3Psobmv', url: 'https://cdn.shopify.com/s/files/1/0434/1661/files/2025_No3_100ml_ProductPackshot_01_GBL_1440x1440_b192a316-fc69-463d-ae4e-0b9e0d99d8a6.png?v=1762277776' },
  { id: 'rec8APEwdLaDE5mqX', url: 'https://cdn.shopify.com/s/files/1/0434/1661/files/2025_No4_250ml_Product_Packshot_01_GBL_1440x1440_1_8bd8f43c-86fd-4ca1-a39f-bf17f6734a94.png?v=1740499372' },
  { id: 'recSzv4f38qaGA9P6', url: 'https://cdn.shopify.com/s/files/1/0434/1661/files/2025_No5_250ml_Product_Packshot_01_GBL_1440x1440_622d30f9-640f-4df4-b33e-97cd3d5ed514.png?v=1762274328' },
  { id: 'recNLAr6gVIwK645F', url: 'https://cdn.shopify.com/s/files/1/0434/1661/files/2025_No0_155ml_Product_Packshot_01_ENG_1440x1440_14087a58-37bb-4e0b-b4d4-79694e772522.png?v=1762273698' },
  { id: 'recoc6YrtR1ayG6kq', url: 'https://cdn.shopify.com/s/files/1/0434/1661/files/1-N8_product_1440.png' },

  // ── SALTAIR (1) ─────────────────────────────────────────────────
  { id: 'rec96uZ13Ze2VGRML', url: 'https://cdn.shopify.com/s/files/1/0549/3286/5231/files/1-SLTR_PDP_SerumDeo_FF_ByrdieAward.jpg?v=1750263919' },

];

// ── STILL NEEDS IMAGES (manual) ────────────────────────────────────────────
// Medicube (7):   recbjGqP3bmxZGSNf, recS57fwRuOJYbeoj, recyf7FIGue8Xnq4U,
//                 recH21ji6ydWBQ0UU, recnYUT1FuDUHHghe, recplmY2Vidtw6JvJ, recLPU5M4qyDZ4g97
// Dr. Althea (4): rec6b426z7NMwzorO, recOF5eaUSG8NFhTL, recIULTRL6LoccCtl, rec4XddkfqB9iK9iy
// Estée Lauder (8): recMOARvUoPQLCQW6, recWWC0cTuHvi7drv, recOIqRYbP9SRVP56, recFUPXuAC0Ox83pH,
//                   recCouv9AIOjWkk4e, rec13ksRb7b2NKqWA, recXHkXRGc5JUwrho, recPIAAhsBaXA5fhv
// Laneige (4):    recokNrm7lT2K3xmN, recOF2HeEH63Br8se, recvvFTlcy20PbwCg, rec643fNI8dV5bhjU

async function run() {
  const BATCH = 10;
  let updated = 0;

  for (let i = 0; i < imageMap.length; i += BATCH) {
    const chunk = imageMap.slice(i, i + BATCH);
    const records = chunk.map(({ id, url }) => ({
      id,
      fields: { 'Primary Image URL': [{ url }] },
    }));

    const { data } = await axios.patch(BASE_URL, { records }, { headers: HEADERS });
    data.records.forEach(r => {
      const att = r.fields['Primary Image URL'];
      const ok  = Array.isArray(att) && att.length > 0;
      console.log(`  ${ok ? '✓' : '✗'} ${r.id}  ${r.fields['Product Name'] || ''}`);
      if (ok) updated++;
    });

    if (i + BATCH < imageMap.length) await sleep(260);
  }

  console.log(`\n✓ Patched ${updated} / ${imageMap.length} records`);
  console.log('\n⚠ Still needs images (add manually in Airtable):');
  console.log('  • Medicube (7 products)');
  console.log('  • Dr. Althea (4 products)');
  console.log('  • Estée Lauder (8 products)');
  console.log('  • Laneige (4 products)');
}

run().catch(err => {
  console.error('✗ Error:', err.response?.data || err.message);
  process.exit(1);
});
