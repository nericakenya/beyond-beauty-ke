// Run with: npm test   (no network, no keys needed)
process.env.META_APP_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const delivery = require('../src/delivery');
const promo = require('../src/promo');
const orders = require('../src/orders');
const wa = require('../src/whatsapp');
const conversations = require('../src/conversations');
const agent = require('../src/agent');

test('delivery zones match the website rules', () => {
  // Kilimani ~3 km, Karen ~17 km, Ruiru ~22 km, Thika ~42 km, Nakuru ~140 km from the centre
  assert.equal(delivery.zoneFor({ lat: -1.2921, lng: 36.7856 }).zone, 'nairobi');
  assert.equal(delivery.zoneFor({ lat: -1.36, lng: 36.70, inNairobiCounty: true, text: 'Karen, Nairobi' }).zone, 'nairobi');
  assert.equal(delivery.zoneFor({ lat: -1.36, lng: 36.70, inNairobiCounty: true, text: 'Lang\'ata' }).zone, 'metro');
  assert.equal(delivery.zoneFor({ lat: -1.1466, lng: 36.9609 }).zone, 'metro');
  assert.equal(delivery.zoneFor({ lat: -1.0333, lng: 37.0693 }).zone, 'metro');
  assert.equal(delivery.zoneFor({ lat: -0.3031, lng: 36.0800 }).zone, 'outside');
});

test('delivery fees and free-delivery thresholds', () => {
  assert.equal(delivery.deliveryFee('nairobi', 7499), 350);
  assert.equal(delivery.deliveryFee('nairobi', 7500), 0);
  assert.equal(delivery.deliveryFee('metro', 10499), 450);
  assert.equal(delivery.deliveryFee('metro', 10500), 0);
  assert.equal(delivery.deliveryFee('outside', 50000), 500);
  // no free delivery when a promo code is used
  assert.equal(delivery.deliveryFee('nairobi', 9000, { promoUsed: true }), 350);
  assert.equal(delivery.zoneFromLabel('Greater Nairobi'), 'metro');
  assert.equal(delivery.zoneFromLabel('Rest of Kenya'), 'outside');
});

test('order totals', () => {
  const lines = [{ unit_price: 2100, qty: 2 }, { unit_price: 1600, qty: 1 }];
  assert.deepEqual(orders.totals(lines, 'nairobi'), { subtotal: 5800, discount: 0, delivery_fee: 350, total: 6150 });
  assert.deepEqual(orders.totals(lines, 'metro', { discount: 580, promoUsed: true }), { subtotal: 5800, discount: 580, delivery_fee: 450, total: 5670 });
  assert.deepEqual(orders.totals([{ unit_price: 8000, qty: 1 }], 'nairobi', { discount: 800, promoUsed: true }), { subtotal: 8000, discount: 800, delivery_fee: 350, total: 7550 });
  assert.deepEqual(orders.totals([{ unit_price: 8000, qty: 1 }], 'outside', { promoUsed: true, freeDeliveryPromo: true }), { subtotal: 8000, discount: 0, delivery_fee: 0, total: 8000 });
});

test('order item name convention', () => {
  const name = orders.itemName('Janet Kuguru', 'Mia Mini Bag', 'Light Pink', new Date('2026-11-26T08:00:00Z'));
  assert.equal(name, '261126-JANET-MMB-LIGHTPINK');
});

test('promo rules', () => {
  const lines = [{ product_id: 'recA', line_total: 4000 }, { product_id: 'recB', line_total: 2000 }];
  const base = { 'Promo Code': 'KARIBU10', Active: true, Type: 'Percentage', Value: 10 };
  assert.deepEqual(promo.evaluate(base, lines, {}, '2026-11-26'), { valid: true, code: 'KARIBU10', type: 'Percentage', discount: 600, free_delivery: false });
  assert.equal(promo.evaluate({ ...base, Active: false }, lines, {}, '2026-11-26').valid, false);
  assert.equal(promo.evaluate({ ...base, 'End Date': '2026-11-25' }, lines, {}, '2026-11-26').valid, false);
  assert.equal(promo.evaluate({ ...base, 'Start Date': '2026-11-27' }, lines, {}, '2026-11-26').valid, false);
  assert.equal(promo.evaluate({ ...base, 'Min Order Value': 7000 }, lines, {}, '2026-11-26').valid, false);
  assert.equal(promo.evaluate({ ...base, 'Usage Limit': 5, 'Usage Count': 5 }, lines, {}, '2026-11-26').valid, false);
  // only some products qualify
  assert.equal(promo.evaluate({ ...base, 'Applicable Products': ['recB'] }, lines, {}, '2026-11-26').discount, 200);
  // category restriction via product links
  assert.equal(promo.evaluate({ ...base, 'Applicable Categories': ['recCat'] }, lines, { recA: new Set(['recCat']) }, '2026-11-26').discount, 400);
  assert.equal(promo.evaluate({ ...base, Type: 'Fixed Amount', Value: 9999 }, lines, {}, '2026-11-26').discount, 6000);
  assert.equal(promo.evaluate({ ...base, Type: 'BOGO' }, lines, {}, '2026-11-26').needs_team, true);
});

test('webhook signature check', () => {
  const body = Buffer.from('{"entry":[]}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.equal(wa.validSignature(body, sig), true);
  assert.equal(wa.validSignature(body, 'sha256=' + '0'.repeat(64)), false);
  assert.equal(wa.validSignature(body, undefined), false);
});

test('webhook parsing: text, image, location and app echoes', () => {
  const body = { entry: [{ changes: [{ value: {
    contacts: [{ wa_id: '254700000001', profile: { name: 'Amina' } }],
    messages: [
      { from: '254700000001', id: 'm1', timestamp: '1764144000', type: 'text', text: { body: 'Hi' } },
      { from: '254700000001', id: 'm2', type: 'image', image: { id: 'media1', mime_type: 'image/jpeg', caption: 'paid' } },
      { from: '254700000001', id: 'm3', type: 'location', location: { latitude: -1.29, longitude: 36.78, name: 'Yaya' } },
      { from: '254700000001', id: 'm4', type: 'reaction', reaction: { emoji: '❤️' } },
    ],
    message_echoes: [{ from: '254114481515', to: '254700000001', id: 'e1', type: 'text', text: { body: 'Hi Amina, Joy here' } }],
  } }] }] };
  const ev = wa.parseWebhook(body);
  assert.equal(ev.length, 4);
  assert.deepEqual([ev[0].kind, ev[0].name, ev[0].text], ['message', 'Amina', 'Hi']);
  assert.deepEqual([ev[1].mediaId, ev[1].text], ['media1', 'paid']);
  assert.equal(ev[2].location.lat, -1.29);
  assert.deepEqual([ev[3].kind, ev[3].to, ev[3].text], ['echo', '254700000001', 'Hi Amina, Joy here']);
});

test('long replies split on paragraph breaks', () => {
  const para = 'word '.repeat(200).trim();
  const parts = wa.splitMessage([para, para, para].join('\n\n'), 1500);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every(p => p.length <= 1500));
  assert.equal(parts.join(' ').split(/\s+/).length, 600);
});

test('saved history drops thinking blocks and images, and trims at a clean customer message', () => {
  const history = [
    { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'xx' } }, { type: 'text', text: 'paid' }] },
    { role: 'system', content: 'Context…' },
    { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 't1', name: 'my_orders', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(5000) }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Asante!' }] },
  ];
  const c = conversations.compact(history);
  assert.equal(c[0].content[0].text, '[The customer sent a photo here.]');
  assert.ok(!JSON.stringify(c).includes('"thinking"'));
  assert.ok(c[3].content[0].content.length < 1600);
  // a history that starts with a tool result is trimmed to the next clean user message
  const t = conversations.trim([c[3], c[4], { role: 'user', content: 'next' }]);
  assert.equal(t[0].content, 'next');
});

test('message source detection and business hours', () => {
  assert.equal(agent.messageSource("Hi Beyond Beauty, I'd like to place an order:"), 'website checkout');
  assert.equal(agent.messageSource("I'm interested in:\n*Mia Mini Bag*"), 'website product page');
  assert.equal(agent.messageSource('Hello'), 'direct WhatsApp message');
  assert.equal(agent.withinBusinessHours({ day: 3, hour: 10 }), true);   // Wednesday 10:00
  assert.equal(agent.withinBusinessHours({ day: 3, hour: 20 }), false);  // Wednesday 20:00
  assert.equal(agent.withinBusinessHours({ day: 6, hour: 11.5 }), true); // Saturday 11:30
  assert.equal(agent.withinBusinessHours({ day: 0, hour: 15 }), true);   // Sunday 15:00
  assert.equal(agent.withinBusinessHours({ day: 0, hour: 16.5 }), false); // Sunday 16:30
  assert.equal(agent.dispatchDay({ day: 3, hour: 10 }), 'today');
  assert.equal(agent.dispatchDay({ day: 3, hour: 7 }), 'today, from 8am');
  assert.equal(agent.dispatchDay({ day: 3, hour: 19 }), 'tomorrow (Thursday)');
  assert.equal(agent.dispatchDay({ day: 5, hour: 19 }), 'tomorrow (Saturday)');
  assert.equal(agent.dispatchDay({ day: 6, hour: 15 }), 'today');
  assert.equal(agent.dispatchDay({ day: 6, hour: 16.5 }), 'tomorrow (Sunday)');
  assert.equal(agent.dispatchDay({ day: 0, hour: 17 }), 'tomorrow (Monday)');
});

test('checkout lines are parsed and every line must be in the order, at the quoted price', () => {
  const msg = "Hi Beyond Beauty, I'd like to place an order:\nRef: BB-WX\n\n*My Order*\n* Quilted Jewel Box · Blush Pink × 1  —  KSh 2,100\n• Mosaic Multi-Gem Ring (Gold) × 1  —  KSh 1,700\n• Seoul1988 Serum × 2  —  KSh 5,000\n\n*Order Summary*\nSubtotal: KSh 8,800";
  const lines = orders.parseCheckoutLines(msg);
  assert.deepEqual(lines.map(l => [l.product, l.qty, l.quoted_unit]), [['quilted jewel box', 1, 2100], ['mosaic multi-gem ring', 1, 1700], ['seoul1988 serum', 2, 2500]]);
  const priced = [{ name: 'Quilted Jewel Box', unit_price: 2100 }, { name: 'Seoul1988 Serum', unit_price: 2500 }];
  // ring left out without the customer agreeing → refused
  let p = orders.checkoutProblems(lines, { requested: [{ name: 'Quilted Jewel Box · Blush Pink', qty: 1 }], priced });
  assert.equal(p.length, 1); assert.match(p[0], /Mosaic Multi-Gem Ring/);
  // ring requested (it will fail as out of stock elsewhere) → no "missing" problem
  p = orders.checkoutProblems(lines, { requested: [{ name: 'Mosaic Multi-Gem Ring (Gold)', qty: 1 }], priced });
  assert.equal(p.length, 0);
  // customer agreed to drop it → fine
  p = orders.checkoutProblems(lines, { requested: [], priced, removed: ['Mosaic Multi-Gem Ring · Gold'] });
  assert.equal(p.length, 0);
  // price changed since the message → must ask first
  p = orders.checkoutProblems(lines, { requested: [], priced: [{ name: 'Quilted Jewel Box', unit_price: 2300 }, { name: 'Seoul1988 Serum', unit_price: 2500 }], removed: ['Mosaic Multi-Gem Ring'] });
  assert.equal(p.length, 1); assert.match(p[0], /current price is KSh 2,300/);
  p = orders.checkoutProblems(lines, { requested: [], priced: [{ name: 'Quilted Jewel Box', unit_price: 2300 }, { name: 'Seoul1988 Serum', unit_price: 2500 }], removed: ['Mosaic Multi-Gem Ring'], acceptedNewPrices: true });
  assert.equal(p.length, 0);
  assert.deepEqual(orders.parseCheckoutLines('Hi, is the bag available?'), []);
});
