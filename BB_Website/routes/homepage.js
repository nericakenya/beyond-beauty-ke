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
        items = (f['Products'] || []).map(id => productsById[id]).filter(Boolean).slice(0, maxItems);
      } else {
        // Auto: Low Stock — oldest→newest among products still buyable and showing the low-stock badge
        // (excludes items whose stock has since hit 0 but haven't had the Airtable badge cleared yet)
        items = products
          .filter(p => p.badges.includes("Only 'X' Left") && !p.sold_out)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .slice(0, maxItems);
      }
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
