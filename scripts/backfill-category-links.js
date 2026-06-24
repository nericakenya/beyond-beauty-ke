#!/usr/bin/env node
/**
 * Backfills Category (Link), Sub-Category (Link), Secondary Sub-Category (Link)
 * for Products records where those fields are empty.
 *
 * Strategy (applied in order until a match is found):
 *   A. Match old `Sub-Category` text → Categories "Secondary Sub Category" level
 *      (In the old 2-level taxonomy, Sub-Category = what is now Secondary Sub-Category)
 *   B. Match old `Secondary Sub-Category` text → Categories "Secondary Sub Category" level
 *   C. Match old `Sub-Category` text → Categories "Sub Category" level (direct sub match)
 *   D. Match old `Product Category` text → Categories "Main Category" level (category-only fill)
 *
 * When multiple candidates share a name (e.g., "Multi-packs"), the old Product Category
 * value is used to pick the ancestor whose Main Category name is closest.
 *
 * Products where ANY link field is already set are skipped entirely.
 *
 * Run:      node scripts/backfill-category-links.js
 * Re-run:   safe — already-filled products are skipped.
 */
require('dotenv').config();
const axios = require('axios');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const HDR     = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const norm    = s  => (s || '').trim().toLowerCase();

// ── Airtable helpers ──────────────────────────────────────────────────────────

async function fetchAll(tableId) {
  const records = [];
  let offset;
  do {
    const { data } = await axios.get(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      headers: HDR,
      params: { pageSize: 100, ...(offset && { offset }) },
    });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function batchUpdate(tableId, updates) {
  const { data } = await axios.patch(
    `https://api.airtable.com/v0/${BASE_ID}/${tableId}`,
    { records: updates },
    { headers: HDR }
  );
  return data.records;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Resolve table IDs
  console.log('🔍 Resolving table IDs…');
  const { data: { tables } } = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
    { headers: HDR }
  );
  const catTbl  = tables.find(t => t.name === 'Categories');
  const prodTbl = tables.find(t => t.name === 'Products');
  if (!catTbl || !prodTbl) throw new Error('Could not find Categories or Products table');
  console.log(`   Categories: ${catTbl.id}   Products: ${prodTbl.id}`);

  // 2. Fetch all Categories records
  console.log('\n📋 Fetching Categories…');
  const catRecs = await fetchAll(catTbl.id);
  console.log(`   ${catRecs.length} records`);

  // Build fast lookup by record ID
  const catById = {};
  catRecs.forEach(r => { catById[r.id] = r; });

  // Build name indexes per level: norm(name) → [record, ...]
  const byLevel = {
    'Main Category':           {},
    'Sub Category':            {},
    'Secondary Sub Category':  {},
  };
  catRecs.forEach(r => {
    const level = r.fields.Level;
    const name  = norm(r.fields['Category Name'] || '');
    if (!level || !name || !byLevel[level]) return;
    (byLevel[level][name] = byLevel[level][name] || []).push(r);
  });

  // Walk a record's Parent Category chain to return { mainId, subId, secId }
  function resolveChain(recId) {
    const rec = catById[recId];
    if (!rec) return null;
    const level = rec.fields.Level;
    if (level === 'Secondary Sub Category') {
      const subId  = (rec.fields['Parent Category'] || [])[0] || null;
      const sub    = catById[subId];
      const mainId = sub ? (sub.fields['Parent Category'] || [])[0] || null : null;
      return { secId: rec.id, subId, mainId };
    }
    if (level === 'Sub Category') {
      const mainId = (rec.fields['Parent Category'] || [])[0] || null;
      return { secId: null, subId: rec.id, mainId };
    }
    if (level === 'Main Category') {
      return { secId: null, subId: null, mainId: rec.id };
    }
    return null;
  }

  // Disambiguate when multiple records share a name:
  // prefer the one whose Main Category name is closest to the old Product Category value.
  function pickBest(candidates, oldCatHint) {
    if (candidates.length === 1) return candidates[0];
    const hint = norm(oldCatHint);
    const scored = candidates.map(c => {
      const ch = resolveChain(c.id);
      const mainName = norm(catById[ch?.mainId]?.fields['Category Name'] || '');
      const score = mainName === hint ? 2 : (mainName.includes(hint) || hint.includes(mainName)) ? 1 : 0;
      return { c, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0].c;
  }

  // 3. Fetch all Products (raw, unfiltered)
  console.log('\n📦 Fetching Products…');
  const prodRecs = await fetchAll(prodTbl.id);
  console.log(`   ${prodRecs.length} records`);

  // 4. Filter: skip any product that already has at least one link field set
  const toFill = prodRecs.filter(r => {
    const f = r.fields;
    const hasCat = Array.isArray(f['Category (Link)'])               && f['Category (Link)'].length > 0;
    const hasSub = Array.isArray(f['Sub-Category (Link)'])           && f['Sub-Category (Link)'].length > 0;
    const hasSec = Array.isArray(f['Secondary Sub-Category (Link)']) && f['Secondary Sub-Category (Link)'].length > 0;
    return !hasCat && !hasSub && !hasSec;
  });

  console.log(`\n🎯 Products to backfill: ${toFill.length} of ${prodRecs.length}`);
  if (toFill.length === 0) {
    console.log('✅ All products already have link fields — nothing to do.');
    return;
  }

  // 5. Match each product to Categories records
  const updates   = [];
  const unmatched = [];

  for (const prod of toFill) {
    const f      = prod.fields;
    const oldCat = f['Product Category'] || '';
    const oldSub = norm(f['Sub-Category'] || '');
    const oldSec = norm(f['Secondary Sub-Category'] || '');
    const name   = f['Product Name'] || prod.id;

    let chain = null;

    // Strategy A — old Sub-Category → Secondary Sub-Category level
    if (!chain && oldSub) {
      const candidates = byLevel['Secondary Sub Category'][oldSub] || [];
      if (candidates.length) chain = resolveChain(pickBest(candidates, oldCat).id);
    }

    // Strategy B — old Secondary Sub-Category → Secondary Sub-Category level
    if (!chain && oldSec) {
      const candidates = byLevel['Secondary Sub Category'][oldSec] || [];
      if (candidates.length) chain = resolveChain(pickBest(candidates, oldCat).id);
    }

    // Strategy C — old Sub-Category → Sub-Category level (direct sub, no secondary)
    if (!chain && oldSub) {
      const candidates = byLevel['Sub Category'][oldSub] || [];
      if (candidates.length) chain = resolveChain(pickBest(candidates, oldCat).id);
    }

    // Strategy D — old Product Category → Main Category level (category-only)
    if (!chain && oldCat) {
      const candidates = byLevel['Main Category'][norm(oldCat)] || [];
      if (candidates.length) chain = resolveChain(pickBest(candidates, oldCat).id);
    }

    if (chain && (chain.mainId || chain.subId || chain.secId)) {
      const fields = {};
      if (chain.mainId) fields['Category (Link)']               = [chain.mainId];
      if (chain.subId)  fields['Sub-Category (Link)']           = [chain.subId];
      if (chain.secId)  fields['Secondary Sub-Category (Link)'] = [chain.secId];
      updates.push({ id: prod.id, fields });

      const mainName = catById[chain.mainId]?.fields['Category Name'] || '—';
      const subName  = catById[chain.subId]?.fields['Category Name']  || '—';
      const secName  = catById[chain.secId]?.fields['Category Name']  || '—';
      console.log(`   ✓ "${name}" → ${mainName} > ${subName} > ${secName}`);
    } else {
      unmatched.push({ name, oldCat, oldSub: f['Sub-Category'] || '', oldSec: f['Secondary Sub-Category'] || '' });
      console.log(`   ⚠ "${name}" — no match (Cat:"${oldCat}" Sub:"${f['Sub-Category']}" Sec:"${f['Secondary Sub-Category']}")`);
    }
  }

  // 6. Apply updates in batches of 10
  if (updates.length) {
    console.log(`\n🔗 Writing ${updates.length} updates to Airtable…`);
    for (let i = 0; i < updates.length; i += 10) {
      await batchUpdate(prodTbl.id, updates.slice(i, i + 10));
      process.stdout.write(`   ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
      await sleep(220);
    }
    console.log(`\n   ✅ ${updates.length} products updated`);
  }

  // 7. Summary
  console.log('\n─────────────────────────────────────────');
  console.log(`Matched:   ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  if (unmatched.length) {
    console.log('\n⚠️  These products need manual review in Airtable:');
    unmatched.forEach(u => {
      console.log(`   • "${u.name}"`);
      console.log(`     Old values — Category: "${u.oldCat}"  Sub: "${u.oldSub}"  Secondary: "${u.oldSec}"`);
    });
  }

  console.log('\n✅ Done!');
})().catch(e => {
  const msg = e.response?.data || e.message;
  console.error('\n❌ Error:', JSON.stringify(msg, null, 2));
  process.exit(1);
});
