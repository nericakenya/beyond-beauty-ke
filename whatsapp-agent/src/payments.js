// Payment thank-you: when Janet sets an order's Payment Status to "Paid" in Airtable (after
// checking the till), Joy sends the customer our closing line on WhatsApp.
// Only orders with a Web Ref (made by Joy / the website) are included, so older manual
// orders are never messaged. "Thank-you sent" is ticked so nothing is sent twice.
const { config } = require('./config');
const airtable = require('./airtable');
const wa = require('./whatsapp');
const conversations = require('./conversations');
const { notifyAdmins } = require('./notify');

const T = config.airtable.tables;
const WINDOW_MS = 23.5 * 3600 * 1000;
const THANK_YOU = 'Your payment is well received, Thank you for shopping with us! ✨';

async function checkPaid() {
  const orders = await airtable.list(T.orders, {
    formula: `AND({Payment Status} = 'Paid', {Web Ref} != '', NOT({Thank-you sent}))`,
    fields: ['Web Ref', 'Customer'],
    maxRecords: 20,
  });
  for (const o of orders) {
    try {
      const customerId = o.fields.Customer?.[0];
      const customer = customerId ? (await airtable.get(T.customers, customerId)).fields : null;
      const phone = String(customer?.Phone || '').replace(/\D/g, '').replace(/^0/, '254');
      if (!phone) continue;
      const conv = await conversations.load(phone);
      const last = conv.fields['Last message at'] ? new Date(conv.fields['Last message at']).getTime() : 0;
      if (Date.now() - last < WINDOW_MS) {
        await wa.sendText(phone, THANK_YOU);
        await conversations.save(conv, [...conv.history,
          { role: 'user', content: `[System: no new customer message — Janet confirmed payment for order ${o.fields['Web Ref']} on the till; the thank-you below was sent.]` },
          { role: 'assistant', content: THANK_YOU }]);
      } else {
        await notifyAdmins(`💳 Order ${o.fields['Web Ref']} is marked Paid, but +${phone} hasn't chatted in 24 hours, so WhatsApp won't let Joy send the thank-you. Please send it yourself as Joy.`);
      }
      await airtable.update(T.orders, o.id, { 'Thank-you sent': true });
    } catch (e) {
      console.error(`[payments] order ${o.fields['Web Ref']}:`, e.message);
    }
  }
}

let running = false;
function start() {
  const minutes = config.paymentCheckMinutes;
  if (!minutes) return;
  const run = async () => {
    if (running) return;
    running = true;
    try { await checkPaid(); } catch (e) { console.error('[payments] check failed:', e.message); }
    finally { running = false; }
  };
  setInterval(run, minutes * 60 * 1000);
  console.log(`Payment thank-yous: checking every ${minutes} min`);
}

module.exports = { checkPaid, start, THANK_YOU };
