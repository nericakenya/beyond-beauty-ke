// Checks the "same style never side by side" rule against the live catalogue.
//
//   node scripts/check-shop-spacing.js
//
// Builds the colour cards exactly as the shop does, then for Shop All, Sale and every
// category / sub-category / secondary category (in catalogue order and both price
// sorts) runs the grid ordering and FAILS if two cards of the same style sit next to
// each other while a different style was still available to put between them.
// Also reports cards that touch above/below on the 2-column (mobile) and 4-column
// (desktop) grids — best effort only, so reported as info, not failures.
// Finally lists colours that have no photo of their own yet.
require('dotenv').config();
const { getProducts, toShopCards } = require('../routes/products');
const { spaceOutStyles } = require('../public/js/shop-order.js');

const key = c => c.style_key || c.id;

function checkList(label, list) {
  const out = spaceOutStyles(list);
  if (out.length !== list.length) return { label, fail: 'cards lost in re-ordering' };
  const counts = {};
  out.forEach(c => { counts[key(c)] = (counts[key(c)] || 0) + 1; });
  const feasible = Math.max(0, ...Object.values(counts)) <= Math.ceil(out.length / 2);
  let sideBySide = 0, stacked2 = 0, stacked4 = 0;
  out.forEach((c, i) => {
    if (i >= 1 && key(out[i - 1]) === key(c)) sideBySide++;
    if (i >= 2 && key(out[i - 2]) === key(c)) stacked2++;
    if (i >= 4 && key(out[i - 4]) === key(c)) stacked4++;
  });
  // When one style is more than half the page some pairs are unavoidable — but they
  // must then only appear once nothing else is left (i.e. at the very end).
  let fail = null;
  if (sideBySide && feasible) fail = `${sideBySide} same-style pair(s) side by side`;
  if (sideBySide && !feasible) {
    const first = out.findIndex((c, i) => i && key(out[i - 1]) === key(c));
    if (new Set(out.slice(first - 1).map(key)).size > 1) fail = 'same-style pair placed while other styles remained';
  }
  return { label, n: out.length, sideBySide, stacked2, stacked4, fail };
}

(async () => {
  const products = await getProducts();
  const cards = await toShopCards(products);
  const colourCards = cards.filter(c => c.card_key !== c.id);
  console.log(`${products.length} products → ${cards.length} shop cards (${colourCards.length} colour cards from ${new Set(colourCards.map(key)).size} styles)\n`);

  const views = { 'Shop All': cards, 'Sale': cards.filter(p => p.badges.includes('Sale') || p.original_price != null) };
  cards.forEach(c => {
    if (c.cat_slug) (views[`cat:${c.cat_slug}`] ||= []).push(c);
    if (c.sub_slug) (views[`sub:${c.sub_slug}`] ||= []).push(c);
    if (c.sec_slug) (views[`sec:${c.sec_slug}`] ||= []).push(c);
  });

  const results = [];
  for (const [name, list] of Object.entries(views)) {
    results.push(checkList(name, list));
    results.push(checkList(`${name} (price ↑)`, [...list].sort((a, b) => a.price - b.price)));
    results.push(checkList(`${name} (price ↓)`, [...list].sort((a, b) => b.price - a.price)));
  }

  const failures = results.filter(r => r.fail);
  const touching = results.filter(r => !r.fail && (r.sideBySide || r.stacked2 || r.stacked4));
  console.log(`Checked ${results.length} page/sort combinations.`);
  if (touching.length) {
    console.log('\nPages where a style has too few neighbours to be kept fully apart (info):');
    touching.forEach(r => console.log(`  ${r.label}: ${r.n} cards — side by side ${r.sideBySide}, stacked on mobile ${r.stacked2}, stacked on desktop ${r.stacked4}`));
  }

  const noPhoto = colourCards.filter(c => !(c.images[0] && c.images[0].name === c.colour));
  if (noPhoto.length) {
    console.log(`\nColours with no photo of their own (showing the product's main image):`);
    noPhoto.forEach(c => console.log(`  ${c.name}`));
  }

  if (failures.length) {
    console.log('\nFAILED:');
    failures.forEach(r => console.log(`  ${r.label}: ${r.fail}`));
    process.exit(1);
  }
  console.log('\nPASS — no same-style cards side by side where it could be avoided.');
})().catch(err => { console.error(err.response?.data || err.message); process.exit(1); });
