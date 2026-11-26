require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { initDb } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/products',      require('./routes/products'));
app.use('/api/homepage',      require('./routes/homepage'));
app.use('/api/newsletter',    require('./routes/newsletter'));
app.use('/api/menu',          require('./routes/menu'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/thriftly',      require('./routes/thriftly'));
app.use('/api/mpesa',         require('./routes/mpesa-thriftly'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/api/config/public', (req, res) => res.json({ mpesa_shortcode: process.env.MPESA_SHORTCODE || '174379' }));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
// Product page: inject per-product Open Graph tags server-side so WhatsApp/Facebook/iMessage
// link previews (their crawlers don't run JS) show the product photo, name and price.
const fs = require('fs');
const { getProducts } = require('./routes/products');
const escAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const siteOrigin = req => process.env.SITE_URL || `https://${req.get('host')}`;

app.get('/product', async (req, res) => {
  const file = path.join(__dirname, 'public/product.html');
  try {
    const p = (await getProducts()).find(x => x.id === req.query.id);
    if (!p) return res.sendFile(file);
    const origin = siteOrigin(req);
    const title = `${p.name} | Beyond Beauty KE`;
    const desc = (p.description || `Shop ${p.name} at Beyond Beauty KE.`).replace(/\s+/g, ' ').slice(0, 200);
    const tags = [
      ['og:type', 'product'], ['og:site_name', 'Beyond Beauty KE'], ['og:title', title],
      ['og:description', desc], ['og:url', `${origin}/product?id=${p.id}`],
      ['og:image', `${origin}/og/product/${p.id}.jpg`], ['og:image:width', '512'],
    ].map(([k, v]) => `<meta property="${k}" content="${escAttr(v)}">`).join('\n')
      + `\n<meta name="twitter:card" content="summary_large_image">`;
    let html = await fs.promises.readFile(file, 'utf8');
    html = html.replace('<title>Beyond Beauty KE</title>', `<title>${escAttr(title)}</title>\n${tags}`);
    res.type('html').send(html);
  } catch (e) {
    res.sendFile(file);
  }
});

// Stable image URL for link previews. Airtable attachment URLs expire after ~2h, so we
// fetch the current one on demand instead of putting it straight in og:image.
app.get('/og/product/:id.jpg', async (req, res) => {
  try {
    const p = (await getProducts()).find(x => x.id === req.params.id);
    if (!p?.image_url) return res.status(404).end();
    const img = await axios.get(p.image_url, { responseType: 'arraybuffer', timeout: 10000 });
    res.set('Content-Type', img.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(img.data);
  } catch (e) {
    res.status(404).end();
  }
});
// Map link used in WhatsApp order messages: people are sent to Google Maps; link-preview
// fetchers (WhatsApp, Facebook) get an empty page, so no preview card is added to the chat.
app.get('/map', (req, res) => {
  const ll = String(req.query.ll || '');
  if (!/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(ll)) return res.status(400).send('Invalid location');
  res.set('X-Robots-Tag', 'noindex');
  if (/whatsapp|facebookexternalhit|facebot|meta-externalagent/i.test(req.get('user-agent') || '')) {
    return res.status(204).end();
  }
  res.redirect(302, `https://www.google.com/maps?q=${ll}`);
});

app.get('/collections/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public/collection.html')));
app.get('/thriftly/item',     (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/item.html')));
app.get('/thriftly/dispatch', (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/dispatch.html')));
app.get('/thriftly/confirm',  (req, res) => res.sendFile(path.join(__dirname, 'public/thriftly/confirm.html')));

// Shop category pages — all serve index.html; JS reads pathname to activate the right category
['/bags', '/accessories', '/hair', '/skincare', '/beauty', '/home', '/sale', '/thriftly']
  .forEach(r => app.get(r, (req, res) => res.sendFile(path.join(__dirname, 'public/index.html'))));

// "Shop All" — every product, no category filter
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// New /shop/* routes — mega menu nav targets
app.get('/shop/:cat?/:sub?/:sec?', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.get('/policies/delivery-refund',  (req, res) => res.sendFile(path.join(__dirname, 'public/policies/delivery-refund.html')));
app.get('/policies/privacy-policy',   (req, res) => res.sendFile(path.join(__dirname, 'public/policies/privacy-policy.html')));
app.get('/policies/terms-of-service', (req, res) => res.sendFile(path.join(__dirname, 'public/policies/terms-of-service.html')));

const PORT = process.env.PORT || 3000;

// Back-in-stock alerts are sent by the WhatsApp agent (whatsapp-agent/src/restock.js)
// from the Airtable "Restock Requests" table — nothing to poll here.

initDb()
  .then(() => {
    console.log('✓ Database connected');
  })
  .catch(err => {
    console.warn('⚠️  Database unavailable:', err.message);
    console.warn('   Orders and payments will not work — Airtable features are unaffected.');
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`✨ Beyond Beauty KE running on port ${PORT}`);
    });
  });
