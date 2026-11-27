// Customers, Orders and Order Items in Airtable. Every price and fee here is worked out
// in code from live shop data — the model only says which codes and quantities.
const { config, business } = require('./config');
const airtable = require('./airtable');
const shop = require('./shop');
const promo = require('./promo');
const { deliveryFee } = require('./delivery');

const T = config.airtable.tables;
const ksh = n => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;

function nairobiStamp(now = new Date()) {
  return new Date(now.getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

const mapLink = ({ lat, lng }) => `https://www.google.com/maps?q=${lat},${lng}`; // team alert + Notes: full map preview is fine

function newRef(prefix = 'BB-J') {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `${prefix}${t}${r}`;
}

// "Mia Mini Bag" -> "MMB"; item name convention YYMMDD-FIRSTNAME-INITIALS[-COLOUR]
function itemName(customerName, productName, colour, now = new Date()) {
  const d = new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(2, 10).replace(/-/g, '');
  const first = (customerName || 'CUSTOMER').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '') || 'CUSTOMER';
  const initials = (productName || '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
  const col = colour ? `-${colour.toUpperCase().replace(/[^A-Z0-9]+/g, '')}` : '';
  return `${d}-${first}-${initials}${col}`;
}

// Item lines of a website checkout message: "• Name · Option × 2  —  KSh 4,200".
// (Copied from WhatsApp the bullet may arrive as "*" or "-".) Returns [{ name, product, qty, quoted_unit }].
function parseCheckoutLines(text) {
  if (!/I'd like to place an order/i.test(text || '')) return [];
  const out = [];
  for (const raw of String(text).split('\n')) {
    const m = raw.match(/^\s*[•*·-]\s*(.+?)\s*[×x]\s*(\d+)\s*[—–-]+\s*KSh\s*([\d,]+)/i);
    if (!m) continue;
    const name = m[1].trim(), qty = Number(m[2]), total = Number(m[3].replace(/,/g, ''));
    out.push({ name, product: productPart(name), qty, quoted_unit: qty ? Math.round(total / qty) : total });
  }
  return out;
}

// "Quilted Jewel Box · Blush Pink" / "Mosaic Ring (Gold)" → "quilted jewel box" / "mosaic ring"
function productPart(name) {
  return String(name || '').split(' · ')[0].replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const coversLine = (candidate, line) => {
  const c = productPart(candidate);
  return !!c && (c === line.product || c.startsWith(line.product) || line.product.startsWith(c));
};

// Checks that a checkout order call includes every line the customer sent, at the price they saw.
function checkoutProblems(checkoutLines, { requested, priced, removed = [], acceptedNewPrices = false }) {
  const problems = [];
  for (const line of checkoutLines) {
    const removedOk = removed.some(r => coversLine(r, line));
    const pricedLine = priced.find(p => coversLine(p.name, line));
    const requestedRaw = requested.some(r => r.name && coversLine(r.name, line));
    if (!pricedLine && !requestedRaw && !removedOk) {
      problems.push(`"${line.name} × ${line.qty}" from the checkout message is missing from this order. Include every line; if an item can't be supplied, tell the customer and only leave it out (removed_items) after they agree.`);
    }
    if (pricedLine && !acceptedNewPrices && line.quoted_unit && pricedLine.unit_price !== line.quoted_unit) {
      problems.push(`"${line.name}": the customer's message says KSh ${line.quoted_unit.toLocaleString('en-KE')} each, but the current price is KSh ${pricedLine.unit_price.toLocaleString('en-KE')}. Tell the customer the current price and ask before going ahead (then set customer_accepted_new_prices).`);
    }
  }
  return problems;
}

// Pure totals: lines [{ unit_price, qty }]
function totals(lines, zone, { discount = 0, promoUsed = false, freeDeliveryPromo = false } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const delivery = freeDeliveryPromo ? 0 : deliveryFee(zone, subtotal, { promoUsed });
  return { subtotal, discount, delivery_fee: delivery, total: subtotal - discount + delivery };
}

// Checks every requested line against live shop data. Returns { lines, problems }.
async function priceLines(requested) {
  const lines = [], problems = [];
  for (const { code, name, option, qty: q } of requested) {
    const qty = Math.max(1, Math.floor(Number(q) || 1));
    const label = code || [name, option].filter(Boolean).join(' · ');
    const hit = code ? await shop.resolveCode(code) : await shop.resolveByName(name, option);
    if (!hit) { problems.push(`${label}: no product found with this ${code ? 'code' : 'name'}`); continue; }
    if (hit.ambiguousProducts) { problems.push(`${label}: several products match — ${hit.ambiguousProducts.join(', ')}. Use get_product to find the right one and pass its code.`); continue; }
    if (hit.ambiguous) { problems.push(`${label}: "${hit.product.name}" has several options — ask which one, or use one of these codes: ${hit.ambiguous.map(a => `${a.code} (${a.option})`).join(', ')}`); continue; }
    const { product: p, variant: v } = hit;
    const { price, was_price } = shop.priceOf(p, v);
    const stock = shop.stockOf(p, v);
    if (!price) { problems.push(`${label}: "${p.name}" has no price — the team must quote it`); continue; }
    if (!stock.in_stock) { problems.push(`${label}: "${p.name}" (${v ? shop.variantLabel(v) : 'Standard'}) is out of stock`); continue; }
    if (stock.qty != null && stock.qty < qty) { problems.push(`${label}: only ${stock.qty} of "${p.name}" (${v ? shop.variantLabel(v) : 'Standard'}) in stock, ${qty} requested`); continue; }
    lines.push({ code: v?.sku || p.id, product_id: p.id, variant_id: v?.id || null, name: p.name, option: v ? shop.variantLabel(v) : 'Standard', colour: v?.colour || null, qty, unit_price: price, was_price, line_total: price * qty });
  }
  return { lines, problems };
}

const phoneDigits = p => String(p || '').replace(/\D/g, '').replace(/^0/, '254');
const intlPhone = p => `+${phoneDigits(p)}`;
const last9 = p => phoneDigits(p).slice(-9);

async function findCustomer(phone) {
  const recs = await airtable.list(T.customers, {
    formula: `RIGHT(REGEX_REPLACE({Phone} & '', '[^0-9]', ''), 9) = ${airtable.str(last9(phone))}`, maxRecords: 1,
  });
  return recs[0] || null;
}

async function upsertCustomer({ phone, name, address }) {
  const existing = await findCustomer(phone);
  if (existing) {
    const patch = {};
    if (address && address !== existing.fields['Delivery Address']) patch['Delivery Address'] = address;
    if (name && !existing.fields.Name) patch.Name = name;
    if (Object.keys(patch).length) await airtable.update(T.customers, existing.id, patch);
    return existing;
  }
  return airtable.create(T.customers, { Name: name || '', Phone: intlPhone(phone), 'Delivery Address': address || '', 'Customer Status': 'Active' });
}

async function findOrderByRef(ref) {
  const recs = await airtable.list(T.orders, { formula: `UPPER({Web Ref}) = UPPER(${airtable.str(ref)})`, maxRecords: 1 });
  return recs[0] || null;
}

function orderSummary(rec) {
  const f = rec.fields;
  return {
    ref: f['Web Ref'] || null, order_number: f['Order Number'] || null,
    status: f.Status, payment_status: f['Payment Status'],
    subtotal: f.Subtotal ?? null, discount: f.Discount || 0, delivery_fee: f['Delivery Fee'] ?? null, total: f.Total ?? null,
    delivery_address: f['Delivery Address'] || null,
    payment_claim: f['Payment claim'] || null,
  };
}

async function ordersForPhone(phone, limit = 5) {
  const c = await findCustomer(phone);
  const ids = (c?.fields.Orders || []).slice(-limit);
  const recs = await Promise.all(ids.map(id => airtable.get(T.orders, id)));
  return recs.map(orderSummary).reverse();
}

// Creates Customer (if new), Order and Order Items. Idempotent on the reference.
async function createOrder({ phone, customerName, phoneGiven, address, zone, requestedLines, promoCode, ref, notes, pin, checkoutText, removedItems = [], acceptedNewPrices = false }) {
  if (ref) {
    const dup = await findOrderByRef(ref);
    if (dup) return { ok: true, already_existed: true, order_record_id: dup.id, ...orderSummary(dup) };
  }
  const { lines, problems } = await priceLines(requestedLines);
  const checkoutLines = parseCheckoutLines(checkoutText);
  if (checkoutLines.length) problems.push(...checkoutProblems(checkoutLines, { requested: requestedLines, priced: lines, removed: removedItems, acceptedNewPrices }));
  if (problems.length) return { ok: false, problems, note: 'Nothing was created. Tell the customer about each problem in the Unfortunately… However… style, offer what is available (alternatives or a restock alert), and ask how they would like to go ahead.' };
  if (!lines.length) return { ok: false, problems: ['No items to order'] };

  let promoResult = null;
  if (promoCode) {
    promoResult = await promo.check(promoCode, lines.map(l => ({ product_id: l.product_id, line_total: l.line_total })));
    if (!promoResult.valid) return { ok: false, problems: [`Promo code ${promoCode}: ${promoResult.reason}`] };
  }
  const t = totals(lines, zone, {
    discount: promoResult?.discount || 0,
    promoUsed: !!promoResult,
    freeDeliveryPromo: !!promoResult?.free_delivery,
  });

  const customer = await upsertCustomer({ phone, name: customerName, address });
  const orderRef = ref || newRef();
  const z = business.delivery.zones[zone];
  const order = await airtable.create(T.orders, {
    Customer: [customer.id],
    Status: 'Pending',
    'Payment Status': 'Pending',
    'Payment Method': 'M-Pesa',
    'Delivery Fee': t.delivery_fee,
    Discount: t.discount || undefined,
    'Delivery Address': address || '',
    'Web Ref': orderRef,
    'Promo Code': promoResult ? [promoResult.record_id] : undefined,
    Notes: [
      phone.startsWith('2540000') ? 'TEST ORDER from the /test chat page — safe to delete.' : null,
      `Placed ${nairobiStamp()} via WhatsApp (Joy, agent). Area: ${z.label}; payment ${z.payment}.`,
      phoneGiven && last9(phoneGiven) !== last9(phone) ? `Phone given in order: ${phoneGiven} (WhatsApp ${intlPhone(phone)}).` : null,
      pin ? `Map: ${mapLink(pin)}` : null,
      notes || null,
    ].filter(Boolean).join('\n'),
  });
  await airtable.createMany(T.orderItems, lines.map(l => ({
    Item: itemName(customerName, l.name, l.colour),
    Product: [l.product_id],
    Variant: l.variant_id ? [l.variant_id] : undefined,
    Quantity: l.qty,
    'Unit Price': l.unit_price,
    Order: [order.id],
  })));
  if (promoResult) await promo.recordUse(promoResult.record_id, promoResult.usage_count);

  return {
    ok: true, order_record_id: order.id, ref: orderRef, status: 'Pending', payment_status: 'Pending',
    lines: lines.map(l => ({ name: l.name, option: l.option, qty: l.qty, unit_price: l.unit_price, line_total: l.line_total })),
    ...t, area: z.label, payment: z.payment, timing: z.eta,
    mpesa: { method: 'Lipa na M-Pesa → Buy Goods and Services', till: business.mpesa.till, name: business.mpesa.tillName },
    // Ready to paste into the reply (Joy adds the delivery address and payment details)
    text: [
      '*Your Order*',
      ...lines.map(l => `• ${l.name}${l.option !== 'Standard' ? ` (${l.option})` : ''} × ${l.qty}  —  ${ksh(l.line_total)}`),
      '',
      '*Order Summary*',
      `Subtotal: ${ksh(t.subtotal)}`,
      t.discount ? `Discount (${promoResult.code}): −${ksh(t.discount)}` : null,
      `Delivery: ${t.delivery_fee ? ksh(t.delivery_fee) : 'Free'}`,
      `*Total: ${ksh(t.total)}*`,
    ].filter(x => x !== null).join('\n'),
    // For the team's new-order alert: same lines, with each item's code
    admin_text: [
      ...lines.map(l => `• ${l.name}${l.option !== 'Standard' ? ` (${l.option})` : ''} × ${l.qty}  —  ${ksh(l.line_total)}  [${l.code}]`),
      `Subtotal ${ksh(t.subtotal)}${t.discount ? ` · discount ${promoResult.code} −${ksh(t.discount)}` : ''} · delivery ${t.delivery_fee ? ksh(t.delivery_fee) : 'free'} · *total ${ksh(t.total)}*`,
      `${z.label} · pay ${z.payment}`,
      `Address: ${address || '—'}`,
      pin ? `Map: ${mapLink(pin)}` : null,
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean).join('\n'),
    free_delivery_nudge: (() => {
      const freeFrom = z.freeFrom;
      return t.delivery_fee && freeFrom && !promoResult && freeFrom > t.subtotal
        ? `(Add ${ksh(freeFrom - t.subtotal)} to your order and enjoy *Free* delivery! 🚚)` : null;
    })(),
  };
}

async function logPaymentClaim({ phone, ref, mpesaCode, amount, payerName, paidAt }) {
  let rec = ref ? await findOrderByRef(ref) : null;
  if (!rec) {
    const c = await findCustomer(phone);
    const ids = c?.fields.Orders || [];
    if (ids.length) rec = await airtable.get(T.orders, ids[ids.length - 1]);
  }
  if (!rec) return { ok: false, problem: 'No order found for this customer — hand over to the team.' };
  const line = `${nairobiStamp()} · M-Pesa ${mpesaCode || '?'} · ${amount ? ksh(amount) : 'amount ?'} · payer ${payerName || '?'}${paidAt ? ` · paid ${paidAt}` : ''} · from WhatsApp ${intlPhone(phone)} — UNVERIFIED`;
  const prev = rec.fields['Payment claim'];
  await airtable.update(T.orders, rec.id, { 'Payment claim': prev ? `${prev}\n${line}` : line });
  const s = orderSummary(rec);
  const mismatch = amount && s.total != null && Number(amount) !== Number(s.total) ? `Amount ${ksh(amount)} differs from the order total ${ksh(s.total)}.` : null;
  return { ok: true, ref: s.ref, order_total: s.total, mismatch, note: 'Logged as unverified. The team confirms it against the till statement before marking the order paid.' };
}

module.exports = { createOrder, priceLines, totals, parseCheckoutLines, checkoutProblems, itemName, newRef, ordersForPhone, logPaymentClaim, findCustomer, upsertCustomer, intlPhone, phoneDigits, nairobiStamp };
