const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_ID   = process.env.AIRTABLE_BASE_ID;
const MENU_URL  = () => `https://api.airtable.com/v0/${BASE_ID}/Menu`;
const HEADERS   = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` });
const CACHE_TTL = 5 * 60 * 1000;
let   cache     = { data: null, fetchedAt: 0 };

async function fetchAll() {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100 };
    if (offset) params.offset = offset;
    const { data } = await axios.get(MENU_URL(), { headers: HEADERS(), params });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function buildTree(records) {
  const visible = records
    .filter(r => (r.fields.Status || 'Enabled') !== 'Disabled')
    .sort((a, b) => (a.fields['Sort Order'] || 0) - (b.fields['Sort Order'] || 0));

  return visible
    .filter(r => r.fields.Level === 'Category')
    .map(cat => {
      const catSlug = cat.fields.Slug || '';
      const img     = cat.fields.Image;
      const image   = Array.isArray(img) && img[0]
        ? (img[0].thumbnails?.large?.url || img[0].url) : '';

      const subs = visible
        .filter(r => r.fields.Level === 'Sub-Category' && r.fields['Parent Slug'] === catSlug)
        .map(sub => {
          const subSlug = sub.fields.Slug || '';
          const sec = visible
            .filter(r => r.fields.Level === 'Secondary Sub-Category' && r.fields['Parent Slug'] === subSlug && r.fields['Category Slug'] === catSlug)
            .map(s => ({
              name:   s.fields.Name   || '',
              slug:   s.fields.Slug   || '',
              status: s.fields.Status || 'Enabled',
            }));
          return {
            name:   sub.fields.Name   || '',
            slug:   subSlug,
            status: sub.fields.Status || 'Enabled',
            sec,
          };
        });

      return {
        name:   cat.fields.Name   || '',
        slug:   catSlug,
        image,
        status: cat.fields.Status || 'Enabled',
        subs,
      };
    });
}

async function getMenu() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
  const records = await fetchAll();
  const tree    = buildTree(records);
  cache = { data: tree, fetchedAt: Date.now() };
  console.log(`[Menu] ${records.length} records → ${tree.length} categories`);
  return tree;
}

router.get('/', async (req, res) => {
  try {
    res.json(await getMenu());
  } catch (err) {
    console.error('[Menu] fetch error:', err.message);
    res.status(500).json({ error: 'Could not load menu' });
  }
});

router.get('/refresh', async (req, res) => {
  cache = { data: null, fetchedAt: 0 };
  try {
    res.json(await getMenu());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
