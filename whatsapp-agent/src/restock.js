// Back-in-stock alerts: requests live in Airtable "Restock Requests" (from Joy and from the
// website's "Notify me" button); Joy checks stock every few minutes and messages customers
// through the WhatsApp Cloud API.
//
// WhatsApp rule: a free-form message only reaches someone who messaged us in the last 24
// hours. Anyone else needs an approved message template (RESTOCK_TEMPLATE_NAME).
const { config } = require('./config');
const airtable = require('./airtable');
const shop = require('./shop');
const wa = require('./whatsapp');
const conversations = require('./conversations');
const { notifyAdmins } = require('./notify');
const email = require('./email');

const T = config.airtable.tables.restock;
const WINDOW_MS = 23.5 * 3600 * 1000;
const NEEDS_TEMPLATE_NOTE = 'Back in stock — waiting for the WhatsApp template to be approved';

async function add({ phone, name, productId, variantId, option, email: emailAddress, source = 'WhatsApp' }) {
  // One waiting request per phone + product + option (linked IDs are compared in code)
  const existing = (await airtable.list(T, { formula: `AND({Phone} = ${airtable.str(phone)}, {Status} = 'Waiting')`, fields: ['Product', 'Variant'] }))
    .find(r => (r.fields.Product || []).includes(productId) && ((r.fields.Variant || [])[0] || null) === (variantId || null));
  if (existing) {
    if (emailAddress) await airtable.update(T, existing.id, { Email: emailAddress });
    return { ok: true, already_waiting: true, email_saved: !!emailAddress };
  }
  const product = await shop.product(productId);
  await airtable.create(T, {
    Request: `${name || phone} — ${product?.name || productId}${option ? ` (${option})` : ''}`,
    Phone: phone,
    Name: name || '',
    Product: [productId],
    Variant: variantId ? [variantId] : undefined,
    Option: option || '',
    Email: emailAddress || undefined,
    Status: 'Waiting',
    Source: source,
    'Requested at': new Date().toISOString(),
  });
  return { ok: true };
}

// Is the wanted product (or exact option) in stock now?
async function backInStock(productId, variantId) {
  const p = await shop.product(productId).catch(() => null);
  if (!p || p.badges?.includes('Coming Soon')) return null;
  // Match the wanted option by its Variants record ID
  const res = await fetch(`${config.shopUrl}/api/products/${encodeURIComponent(productId)}/variants`, { signal: AbortSignal.timeout(20000) });
  const variants = res.ok ? await res.json() : [];
  if (variantId) {
    const v = variants.find(x => x.id === variantId);
    return v && v.active !== false && (v.stock_quantity || 0) > 0 ? { product: p, option: shop.variantLabel(v) } : null;
  }
  const anyInStock = variants.length ? variants.some(v => v.active !== false && (v.stock_quantity || 0) > 0) : p.options.some(o => o.in_stock);
  return anyInStock ? { product: p, option: null } : null;
}

function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'there';
}

async function lastCustomerMessageAt(phone) {
  const c = await conversations.findByPhone(phone);
  const t = c?.fields['Last message at'];
  return t ? new Date(t).getTime() : 0;
}

async function notifyOne(rec, found) {
  const f = rec.fields;
  const label = `${found.product.name}${found.option ? ` (${found.option})` : ''}`;
  const link = found.product.link;
  const inWindow = Date.now() - await lastCustomerMessageAt(f.Phone) < WINDOW_MS;

  const channels = [];
  let sentText = null;
  if (inWindow) {
    sentText = `Good news ${firstName(f.Name)} ✨ the *${label}* is back in stock.\n${link}\n\nWould you like me to reserve one for you?`;
    await wa.sendText(f.Phone, sentText);
    channels.push('WhatsApp');
  } else if (config.meta.restockTemplate) {
    const params = [firstName(f.Name), label, link];
    await wa.sendTemplate(f.Phone, config.meta.restockTemplate, config.meta.restockTemplateLang, params);
    sentText = `[Back-in-stock template "${config.meta.restockTemplate}": ${params.join(' | ')}]`;
    channels.push('WhatsApp template');
  }
  if (f.Email && email.enabled()) {
    try {
      await email.send({ to: f.Email, ...email.backInStockEmail({ firstName: firstName(f.Name), label, link }) });
      channels.push('email');
    } catch (e) {
      console.error(`[restock] email to ${f.Email} failed:`, e.message);
    }
  }
  if (!channels.length) {
    // Nothing could reach them yet (no template, no email): keep it waiting, tell Janet once
    if ((f.Notes || '').includes(NEEDS_TEMPLATE_NOTE)) return false;
    await airtable.update(T, rec.id, { Notes: [f.Notes, NEEDS_TEMPLATE_NOTE].filter(Boolean).join('\n') });
    await notifyAdmins(`🔔 ${label} is back in stock, but +${f.Phone} (${f.Name || 'customer'}) can't be reached automatically yet (no chat in the last 24 hours, no approved template${f.Email ? ', email not set up' : ', no email'}). Message them yourself as Joy.`);
    return false;
  }

  await airtable.update(T, rec.id, { Status: 'Notified', 'Notified at': new Date().toISOString(), Notes: [f.Notes, `Sent by ${channels.join(' + ')}`].filter(Boolean).join('\n') });
  if (!sentText) return true; // email only — nothing to add to the WhatsApp chat
  // Joy remembers she sent it, so a reply like "yes please" makes sense to her
  const conv = await conversations.load(f.Phone);
  await conversations.save(conv, [...conv.history,
    { role: 'user', content: '[System: no new customer message — automatic back-in-stock alert sent below.]' },
    { role: 'assistant', content: sentText }]);
  return true;
}

let running = false;
async function checkAll() {
  if (running) return;
  running = true;
  try {
    const waiting = await airtable.list(T, { formula: `{Status} = 'Waiting'`, fields: ['Phone', 'Name', 'Email', 'Product', 'Variant', 'Notes'] });
    const stockCache = new Map();
    let sent = 0;
    for (const rec of waiting) {
      const productId = rec.fields.Product?.[0];
      if (!productId || !rec.fields.Phone) continue;
      const variantId = rec.fields.Variant?.[0] || null;
      const key = `${productId}:${variantId}`;
      if (!stockCache.has(key)) stockCache.set(key, await backInStock(productId, variantId));
      const found = stockCache.get(key);
      if (!found) continue;
      try {
        if (await notifyOne(rec, found)) sent++;
      } catch (e) {
        console.error(`[restock] could not message +${rec.fields.Phone}:`, e.message);
      }
    }
    if (sent) console.log(`[restock] sent ${sent} back-in-stock message(s)`);
  } catch (e) {
    console.error('[restock] check failed:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  const minutes = config.restockCheckMinutes;
  if (!minutes) return;
  setTimeout(checkAll, 60 * 1000);
  setInterval(checkAll, minutes * 60 * 1000);
  console.log(`Restock alerts: checking every ${minutes} min`);
}

module.exports = { add, checkAll, start, backInStock };
