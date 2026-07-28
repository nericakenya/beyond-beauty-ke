const express = require('express');
const router = express.Router();
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');
const { getProducts } = require('./products');

const AIRTABLE_SECTIONS    = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Homepage%20Sections`;
const AIRTABLE_COLLECTIONS = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Collections`;
const AIRTABLE_HERO_SLIDER = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Hero%20Slider`;
const AIRTABLE_HEADERS     = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` });

const CACHE_TTL = 5 * 60 * 1000;
let cache            = { data: null, fetchedAt: 0 }; // built sections (homepage payload)
let collectionsCache = { data: null, fetchedAt: 0 }; // raw resolved collections, keyed by slug too
let heroSlidesCache  = { data: null, fetchedAt: 0 };

// Round-robin with a cooldown, using weighted-random (not greedy-max)
// selection among eligible categories at each step. Preserves each
// category's incoming relative order (bestseller rank, recency, manual
// curation order, etc.) — only position changes.
//
// Greedy-max (always picking the group with the most remaining items) looks
// right until one category heavily dominates the pool (e.g. Beauty at ~87%
// of this catalog): it always wins the instant its cooldown clears, which
// degenerates into a rigid period-2 alternation (Beauty, other, Beauty,
// other, …). In an N-column grid that lines the dominant category up in the
// same column every time. Plain linear weighting (by remaining count) doesn't
// fix this in practice: Beauty still outweighs any single competitor by
// 15-50x, so it keeps winning the instant it's eligible and the same rigid
// parity locks in almost immediately. Square-rooting the weight compresses
// that gap so minority categories get a real, frequent shot — still
// generally favouring the bigger category, but breaking the lockstep from
// early in the list rather than relying on rare late-list luck.
function weightedRandomPick(candidates) {
  const weights = candidates.map(c => Math.sqrt(c.remaining));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function diversifyByCategory(products, cooldown = 2) {
  if (products.length <= 1) return products;
  const groups = new Map();
  products.forEach(p => {
    const key = p.cat_slug || p.category || '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  if (groups.size <= 1) return products;

  const heap = [...groups.keys()].map(key => ({ key, remaining: groups.get(key).length }));
  const pointer = new Map();
  const lastUsedAt = new Map();
  const result = [];

  while (result.length < products.length) {
    const eligible = heap
      .filter(g => g.remaining > 0)
      .filter(g => {
        const last = lastUsedAt.get(g.key);
        return last === undefined || (result.length - last) >= cooldown;
      });

    // Fallback: one category exceeds 50% of the list — cooldown can't be
    // honored every slot, so pick from all remaining groups instead.
    const chosen = eligible.length
      ? weightedRandomPick(eligible)
      : weightedRandomPick(heap.filter(g => g.remaining > 0));

    const idx = pointer.get(chosen.key) || 0;
    const group = groups.get(chosen.key);
    result.push(group[idx]);
    pointer.set(chosen.key, idx + 1);
    lastUsedAt.set(chosen.key, result.length - 1);
    chosen.remaining -= 1;
  }

  return result;
}

async function fetchAllRecords(url) {
  const records = [];
  let offset = null;
  do {
    const params = { pageSize: 100 };
    if (offset) params.offset = offset;
    const { data } = await axios.get(url, { headers: AIRTABLE_HEADERS(), params });
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function mapCollection(record, productsById) {
  const f = record.fields;
  return {
    id: record.id,
    name: f['Collection Name'] || '',
    title: f['Title'] || f['Collection Name'] || '',
    eyebrow: f['Eyebrow'] || '',
    description: f['Description'] || '',
    slug: f['Slug'] || '',
    sort_order: f['Sort Order'] ?? 0,
    active: !!f['Active'],
    section_ids: f['Section'] || [],
    cover_image: (f['Cover Image'] || [])[0]?.url || null,
    products: (f['BB Shop Products'] || []).map(id => productsById[id]).filter(Boolean),
  };
}

// All Collections rows, resolved against the live product cache — shared by the homepage
// payload (grouped under their Section) and the standalone /collections/:slug page.
async function getResolvedCollections() {
  if (collectionsCache.data && Date.now() - collectionsCache.fetchedAt < CACHE_TTL) {
    return collectionsCache.data;
  }
  const [records, products] = await Promise.all([fetchAllRecords(AIRTABLE_COLLECTIONS), getProducts()]);
  const productsById = Object.fromEntries(products.map(p => [p.id, p]));
  const collections = records.map(r => mapCollection(r, productsById));
  collectionsCache = { data: collections, fetchedAt: Date.now() };
  return collections;
}

async function buildSections() {
  const [records, products, collections] = await Promise.all([
    fetchAllRecords(AIRTABLE_SECTIONS),
    getProducts(),
    getResolvedCollections(),
  ]);
  const productsById = Object.fromEntries(products.map(p => [p.id, p]));

  const sections = records
    .map(r => ({ record: r, f: r.fields }))
    .filter(({ f }) => f.Active && ['Product Carousel', 'Collection Carousel'].includes(f['Section Type']))
    .sort((a, b) => (a.f['Sort Order'] ?? 0) - (b.f['Sort Order'] ?? 0))
    .map(({ record, f }) => {
      const base = {
        id: record.id,
        name: f['Section Name'] || '',
        type: f['Section Type'],
        eyebrow: f['Eyebrow'] || '',
        headline: f['Headline'] || '',
        cta_label: f['CTA Label'] || '',
        cta_link: f['CTA Link'] || '',
      };

      if (f['Section Type'] === 'Collection Carousel') {
        const parts = collections
          .filter(c => c.active && c.section_ids.includes(record.id) && c.products.length > 0)
          .sort((a, b) => a.sort_order - b.sort_order);
        return { ...base, collections: parts };
      }

      const maxItems = f['Max Items'] || 8;
      let items;
      if (f['Selection Mode'] === 'Manual') {
        items = (f['Products'] || []).map(id => productsById[id]).filter(Boolean);
      } else {
        // Auto: Low Stock — oldest→newest among products still buyable and showing the low-stock badge
        // (excludes items whose stock has since hit 0 but haven't had the Airtable badge cleared yet)
        items = products
          .filter(p => p.badges.includes("Only 'X' Left") && !p.sold_out)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
      // Diversify across the full candidate pool before truncating to Max Items,
      // so a category-dominated pool (e.g. mostly Skincare) doesn't fill the
      // section's small visible slot count with one category.
      items = diversifyByCategory(items).slice(0, maxItems);
      return { ...base, products: items };
    })
    .filter(s => (s.type === 'Collection Carousel' ? s.collections.length > 0 : s.products.length > 0));

  return sections;
}

async function getSections() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
  const sections = await buildSections();
  cache = { data: sections, fetchedAt: Date.now() };
  return sections;
}

// GET /api/homepage/sections
router.get('/sections', async (req, res) => {
  try {
    res.json(await getSections());
  } catch (err) {
    console.error('[Homepage] Fetch error:', err.message);
    res.status(500).json({ error: 'Could not load homepage sections' });
  }
});

// GET /api/homepage/sections/refresh — bust the cache (admin only)
router.get('/sections/refresh', adminAuth, async (req, res) => {
  try {
    cache            = { data: null, fetchedAt: 0 };
    collectionsCache = { data: null, fetchedAt: 0 };
    heroSlidesCache  = { data: null, fetchedAt: 0 };
    const sections = await getSections();
    res.json({ refreshed: true, count: sections.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getHeroSlides() {
  if (heroSlidesCache.data && Date.now() - heroSlidesCache.fetchedAt < CACHE_TTL) {
    return heroSlidesCache.data;
  }
  const records = await fetchAllRecords(AIRTABLE_HERO_SLIDER);
  const slides = records
    .map(r => ({ record: r, f: r.fields }))
    .filter(({ f }) => f.Active)
    .sort((a, b) => (a.f['Sort Order'] ?? 0) - (b.f['Sort Order'] ?? 0))
    .map(({ record, f }) => ({
      id: record.id,
      img: (f['Image'] || [])[0]?.url || '',
      headline: f['Headline'] || '',
      cta: f['CTA Label'] || '',
      href: f['CTA Link'] || '',
    }))
    .filter(s => s.img);

  heroSlidesCache = { data: slides, fetchedAt: Date.now() };
  return slides;
}

// GET /api/homepage/hero-slides
router.get('/hero-slides', async (req, res) => {
  try {
    res.json(await getHeroSlides());
  } catch (err) {
    console.error('[Homepage] Hero slides fetch error:', err.message);
    res.status(500).json({ error: 'Could not load hero slides' });
  }
});

// GET /api/homepage/collections/:slug — powers the standalone collection page
router.get('/collections/:slug', async (req, res) => {
  try {
    const collections = await getResolvedCollections();
    const collection = collections.find(c => c.active && c.slug === req.params.slug);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json(collection);
  } catch (err) {
    console.error('[Homepage] Collection fetch error:', err.message);
    res.status(500).json({ error: 'Could not load collection' });
  }
});

module.exports = router;
