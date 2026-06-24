#!/usr/bin/env node
/**
 * Makes Categories the single source of truth:
 *   1. Expands the Categories table to include every item from the Menu table,
 *      using Menu's wording for all names.
 *   2. Updates existing Categories records whose names differ from Menu's wording.
 *   3. Adds a "Category Ref" linked-record field to the Menu table so each Menu
 *      item points to its authoritative Categories record.
 *   4. Adds "Category (Link)", "Sub-Category (Link)", "Secondary Sub-Category (Link)"
 *      linked-record fields to the Products table so staff pick from a preset list.
 *
 * Run once:  node scripts/sync-categories-menu.js
 * Safe to re-run: duplicate fields and existing records are skipped gracefully.
 */
require('dotenv').config();
const axios = require('axios');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const HDR     = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };
const META    = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
const at      = id => `https://api.airtable.com/v0/${BASE_ID}/${id}`;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// Menu Level → Categories Level vocabulary
const LEVEL = {
  'Category':               'Main Category',
  'Sub-Category':           'Sub Category',
  'Secondary Sub-Category': 'Secondary Sub Category',
};
const LEVEL_ORDER = { 'Category': 0, 'Sub-Category': 1, 'Secondary Sub-Category': 2 };

// Normalise slug for fuzzy matching (strips hyphens so "hair-care" ≡ "haircare")
const norm = s => (s || '').replace(/-/g, '').toLowerCase();

// ── Airtable helpers ──────────────────────────────────────────────────────────

async function fetchAll(tableId) {
  const records = []; let offset;
  do {
    const { data } = await axios.get(at(tableId), {
      headers: HDR, params: { pageSize: 100, ...(offset && { offset }) },
    });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function batchCreate(tableId, fieldsList) {
  const { data } = await axios.post(at(tableId),
    { records: fieldsList.map(f => ({ fields: f })) }, { headers: HDR });
  return data.records;
}

async function batchUpdate(tableId, updates) {
  const { data } = await axios.patch(at(tableId), { records: updates }, { headers: HDR });
  return data.records;
}

async function addField(tableId, body) {
  try {
    const { data } = await axios.post(
      `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`,
      body, { headers: HDR }
    );
    console.log(`    + Added field "${body.name}"`);
    return data;
  } catch (e) {
    if (e.response?.status === 422 || e.response?.data?.error?.type === 'DUPLICATE_FIELD_NAME') {
      console.log(`    ~ "${body.name}" already exists — skipped`);
      return null;
    }
    throw e;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // ── 1. Resolve table IDs ──────────────────────────────────────────────────
  console.log('🔍 Resolving table IDs…');
  const { data: { tables } } = await axios.get(META, { headers: HDR });
  const catTbl  = tables.find(t => t.name === 'Categories');
  const menuTbl = tables.find(t => t.name === 'Menu');
  const prodTbl = tables.find(t => t.name === 'Products');
  if (!catTbl || !menuTbl || !prodTbl) throw new Error('Could not find Categories / Menu / Products tables');
  console.log(`   Categories: ${catTbl.id}  Menu: ${menuTbl.id}  Products: ${prodTbl.id}`);

  // ── 2. Fetch existing records ─────────────────────────────────────────────
  console.log('\n📋 Fetching existing records…');
  const catRecs  = await fetchAll(catTbl.id);
  const menuRecs = await fetchAll(menuTbl.id);
  console.log(`   Categories: ${catRecs.length}  Menu: ${menuRecs.length}`);

  // Build index: normalisedSlug|CatLevel → record (for matching)
  const catIndex = {};
  catRecs.forEach(r => {
    const key = norm(r.fields.Slug || '') + '|' + (r.fields.Level || '');
    catIndex[key] = r;
  });

  // slug → record ID (used to set Parent Category links when creating children)
  const slugToId = {};
  catRecs.forEach(r => { if (r.fields.Slug) slugToId[r.fields.Slug] = r.id; });

  // ── 3. Sort Menu records: Categories → Sub-Categories → Secondary ─────────
  const sorted = [...menuRecs].sort((a, b) =>
    (LEVEL_ORDER[a.fields.Level] ?? 9) - (LEVEL_ORDER[b.fields.Level] ?? 9) ||
    (a.fields['Sort Order'] ?? 0)      - (b.fields['Sort Order'] ?? 0)
  );

  // ── 4. Match / create Categories records for each Menu item ───────────────
  console.log('\n🔄 Syncing Menu items → Categories table…');
  const menuToCat = {};   // Menu record ID → Categories record ID
  const toUpdate  = [];   // existing records that need a name fix
  const toCreate  = [];   // items with no matching Categories record yet

  for (const m of sorted) {
    const slug  = m.fields.Slug  || '';
    const name  = m.fields.Name  || '';
    const level = m.fields.Level || '';
    const catLevel = LEVEL[level];
    if (!slug || !catLevel) continue;

    const key      = norm(slug) + '|' + catLevel;
    const existing = catIndex[key];

    if (existing) {
      // Already in Categories — queue a name update if wording differs
      menuToCat[m.id] = existing.id;
      slugToId[slug]  = existing.id; // ensure new slug variant is indexed
      if (existing.fields['Category Name'] !== name || existing.fields.Slug !== slug) {
        toUpdate.push({ id: existing.id, fields: { 'Category Name': name, Slug: slug } });
        console.log(`   ✏️  "${existing.fields['Category Name']}" → "${name}"`);
      }
    } else {
      // Needs to be created — defer so we have IDs for parent links
      toCreate.push({ menuId: m.id, name, slug, catLevel, parentSlug: m.fields['Parent Slug'] || '' });
    }
  }

  // Apply name updates (batch of 10)
  if (toUpdate.length) {
    console.log(`\n   Applying ${toUpdate.length} name update(s)…`);
    for (let i = 0; i < toUpdate.length; i += 10) {
      await batchUpdate(catTbl.id, toUpdate.slice(i, i + 10));
      await sleep(220);
    }
  }

  // Create new records one at a time (need returned IDs for child parent links)
  if (toCreate.length) {
    console.log(`\n   Creating ${toCreate.length} new Categories record(s)…`);
    for (const item of toCreate) {
      const fields = {
        'Category Name': item.name,
        'Slug':          item.slug,
        'Level':         item.catLevel,
        'Active':        true,
      };
      const parentId = slugToId[item.parentSlug];
      if (parentId) fields['Parent Category'] = [parentId];

      const [created] = await batchCreate(catTbl.id, [fields]);
      menuToCat[item.menuId] = created.id;
      slugToId[item.slug]    = created.id;
      console.log(`   ➕ ${item.name} (${item.catLevel})`);
      await sleep(220);
    }
  }

  const totalCatRecords = catRecs.length + toCreate.length;
  console.log(`\n   ✓ Categories table: ${totalCatRecords} records`);

  // ── 5. Add "Category Ref" linked-record field to Menu ─────────────────────
  console.log('\n🔗 Adding "Category Ref" field to Menu table…');
  await addField(menuTbl.id, {
    name:    'Category Ref',
    type:    'multipleRecordLinks',
    options: { linkedTableId: catTbl.id },
  });
  await sleep(500);

  // ── 6. Link every Menu record to its Categories record ────────────────────
  console.log('\n🔗 Linking Menu → Categories…');
  const linkUpdates = Object.entries(menuToCat)
    .map(([menuId, catId]) => ({ id: menuId, fields: { 'Category Ref': [catId] } }));

  for (let i = 0; i < linkUpdates.length; i += 10) {
    await batchUpdate(menuTbl.id, linkUpdates.slice(i, i + 10));
    process.stdout.write(`   ${Math.min(i + 10, linkUpdates.length)}/${linkUpdates.length}\r`);
    await sleep(220);
  }
  console.log(`   ✓ Linked ${linkUpdates.length} Menu records`);

  // ── 7. Add linked-record fields to Products table ─────────────────────────
  console.log('\n🔗 Adding linked-record fields to Products table…');
  for (const name of ['Category (Link)', 'Sub-Category (Link)', 'Secondary Sub-Category (Link)']) {
    await addField(prodTbl.id, {
      name, type: 'multipleRecordLinks', options: { linkedTableId: catTbl.id },
    });
    await sleep(500);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Done!\n');
  console.log('What was set up:');
  console.log('  • Categories table expanded with Menu wording — it is now the master taxonomy');
  console.log('  • Every Menu record linked to its Categories record via "Category Ref"');
  console.log('  • Products table has 3 new linked-record fields for preset category dropdowns');
  console.log('\nNext steps in Airtable:');
  console.log('  • When adding a product, use the (Link) fields — they show a preset list from Categories');
  console.log('  • When adding a Menu item, set "Category Ref" to connect it to the correct Category');
})().catch(e => {
  const msg = e.response?.data || e.message;
  console.error('\n❌ Error:', JSON.stringify(msg, null, 2));
  process.exit(1);
});
