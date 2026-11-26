// Tools Joy can call. Each runs in code; prices and totals never come from the model.
const shop = require('./shop');
const orders = require('./orders');
const promo = require('./promo');
const delivery = require('./delivery');
const conversations = require('./conversations');
const { notifyAdmins } = require('./notify');
const restock = require('./restock');
const airtable = require('./airtable');
const { config } = require('./config');

const itemsSchema = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Exact option code from get_product (a SKU like "MNB-004-BLAC"); a style code like "RNG-002" or a product ID "rec…" also works when the product has only one option' },
      qty: { type: 'integer', minimum: 1 },
    },
    required: ['code', 'qty'],
    additionalProperties: false,
  },
};

const TOOLS = [
  {
    name: 'search_products',
    description: 'Search the shop catalogue by words in the product name or category (e.g. "black shoulder bag", "snail mucin", "body wave 22"). Returns matching products with starting price, sale price and whether any option is in stock. Use get_product for exact options, stock and details.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'integer', minimum: 1, maximum: 15 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_product',
    description: 'Full details for one product: every option (colour/size/length) with its order code, current price, was-price when on sale, and stock; plus description, materials, dimensions, how to use, ingredients and care. Pass product_id from search_products, or an option code the customer sent.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID starting with "rec"' },
        code: { type: 'string', description: 'An option code (SKU), e.g. from a "Code:" line in the customer message' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'quote_delivery',
    description: 'Delivery area, fee, free-delivery threshold, timing and payment rule for a place in Kenya. Pass what the customer typed (estate, road, landmark, town) or the latitude/longitude of a location pin they shared.',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'check_promo',
    description: 'Checks a promo code against the Promotions list for the given items and returns whether it is valid and the discount in KSh. Remember: free delivery does not apply when a promo code is used.',
    input_schema: {
      type: 'object',
      properties: { code: { type: 'string' }, items: itemsSchema },
      required: ['code', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_order',
    description: 'Creates the order (status Pending) with live prices, delivery fee, any promo discount and the total, and returns the reference and a ready summary. Use the reference ("Ref: BB-W…") from a checkout message when there is one. Safe to call again with the same ref — it returns the existing order.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        delivery_area: { type: 'string', enum: ['nairobi', 'metro', 'outside'], description: 'nairobi = Nairobi, metro = Greater Nairobi, outside = Rest of Kenya' },
        delivery_address: { type: 'string', description: 'Address, estate, building or landmark, as the customer gave it' },
        items: itemsSchema,
        phone_given: { type: 'string', description: 'Phone number written in the order, if different from their WhatsApp number' },
        promo_code: { type: 'string' },
        ref: { type: 'string', description: 'Reference from the checkout message, e.g. BB-W1A2B3C' },
        notes: { type: 'string', description: 'Anything the team should know (e.g. preferred delivery time)' },
      },
      required: ['customer_name', 'delivery_area', 'delivery_address', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'my_orders',
    description: "The customer's most recent orders (by their WhatsApp number): reference, status, payment status and totals.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'log_payment_claim',
    description: 'Records M-Pesa payment details the customer sent (from an SMS or screenshot) against their order, as UNVERIFIED, and alerts the team to check it. Does not mark anything paid.',
    input_schema: {
      type: 'object',
      properties: {
        mpesa_code: { type: 'string', description: 'Transaction code, e.g. SLK4H7Q2XE' },
        amount: { type: 'number' },
        payer_name: { type: 'string' },
        paid_at: { type: 'string', description: 'Date/time as shown in the message' },
        ref: { type: 'string', description: 'Order reference, if known' },
      },
      required: ['mpesa_code', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_contact_details',
    description: "Saves the customer's email and whether they agreed to hear about new arrivals and offers. Use only with details the customer gave in this chat, after a sale.",
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        marketing_consent: { type: 'boolean', description: 'true only if the customer agreed to receive news and offers' },
      },
      required: ['email', 'marketing_consent'],
      additionalProperties: false,
    },
  },
  {
    name: 'restock_alert',
    description: "Adds this customer to the back-in-stock list for a sold-out product or option (and, if they give one, their email for an email alert); Joy messages them automatically when it is back. Calling it again with an email updates the same request. Use when the customer says yes to hearing when it's back.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID starting with "rec"' },
        code: { type: 'string', description: 'Option code (SKU) of the sold-out option, if there is one' },
        email: { type: 'string', description: 'Customer email for an email alert too, only if they gave one' },
      },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'handoff_to_human',
    description: 'Quietly passes this chat to Janet, who continues it herself as Joy: the AI stops replying here and Janet is alerted. The customer is never told. Before calling it, give the customer a short holding line in your own voice (e.g. "Let me check on this and get back to you in a few minutes."). Use for complaints, refunds/exchanges, payment problems, a customer asking if they are talking to a person or a bot, or anything the tools cannot answer.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['customer_asked', 'complaint', 'refund_or_exchange', 'payment_issue', 'cannot_answer', 'order_change', 'other'] },
        summary: { type: 'string', description: 'One or two lines for Janet: who, what they need, what you already told them, any order reference' },
      },
      required: ['reason', 'summary'],
      additionalProperties: false,
    },
  },
];

const ksh = n => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;

// ctx: { phone, profileName, conv }
async function runTool(name, input, ctx) {
  switch (name) {
    case 'search_products': {
      const results = await shop.search(input.query, input.max_results || 8);
      return results.length ? results : { results: [], note: 'Nothing matched. Try other words, or ask the customer for a photo or the product link.' };
    }
    case 'get_product': {
      let id = input.product_id;
      if (!id && input.code) {
        const hit = await shop.resolveCode(input.code);
        id = hit?.product?.id;
      }
      if (!id) return { error: 'No product found for that ID or code.' };
      return (await shop.product(id)) || { error: 'No product with that ID.' };
    }
    case 'quote_delivery': {
      if (!input.location && (input.latitude == null || input.longitude == null)) return { error: 'Give a location or a latitude/longitude.' };
      return delivery.quote({ location: input.location, lat: input.latitude, lng: input.longitude });
    }
    case 'check_promo': {
      const { lines, problems } = await orders.priceLines(input.items);
      if (problems.length) return { valid: false, problems };
      return promo.check(input.code, lines.map(l => ({ product_id: l.product_id, line_total: l.line_total })))
        .then(({ record_id, usage_count, ...r }) => r);
    }
    case 'create_order': {
      const result = await orders.createOrder({
        phone: ctx.phone,
        customerName: input.customer_name || ctx.profileName,
        phoneGiven: input.phone_given,
        address: input.delivery_address,
        zone: input.delivery_area,
        requestedLines: input.items,
        promoCode: input.promo_code,
        ref: input.ref,
        notes: input.notes,
      });
      if (result.ok && !result.already_existed) {
        await conversations.setFields(ctx.conv, {
          'Web Ref': result.ref,
          Orders: [...new Set([...(ctx.conv.fields.Orders || []), result.order_record_id])],
        });
        await notifyAdmins(`🛍️ New order ${result.ref} — ${input.customer_name} (+${ctx.phone})\n${result.text}\nArea: ${result.area} · pay ${result.payment}\nAddress: ${input.delivery_address}`);
      }
      const { order_record_id, ...forModel } = result;
      return forModel;
    }
    case 'my_orders':
      return { orders: await orders.ordersForPhone(ctx.phone) };
    case 'log_payment_claim': {
      const r = await orders.logPaymentClaim({ phone: ctx.phone, ref: input.ref, mpesaCode: input.mpesa_code, amount: input.amount, payerName: input.payer_name, paidAt: input.paid_at });
      if (r.ok) await notifyAdmins(`💳 Payment to verify — order ${r.ref || '?'} (+${ctx.phone})\nM-Pesa ${input.mpesa_code} · ${ksh(input.amount)} · ${input.payer_name || 'payer ?'}${r.mismatch ? `\n⚠️ ${r.mismatch}` : ''}\nCheck the till statement, then set Payment Status in Airtable.`);
      return r;
    }
    case 'save_contact_details': {
      const email = String(input.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That does not look like an email address — ask the customer to check it.' };
      const customer = await orders.upsertCustomer({ phone: ctx.phone, name: ctx.conv.fields.Name || ctx.profileName });
      await airtable.update(config.airtable.tables.customers, customer.id, { Email: email, 'Marketing Consent': input.marketing_consent === true });
      return { ok: true };
    }
    case 'restock_alert': {
      const p = await shop.product(input.product_id);
      if (!p) return { error: 'No product with that ID.' };
      const hit = input.code ? await shop.resolveCode(input.code) : null;
      const option = hit?.variant ? shop.variantLabel(hit.variant) : null;
      const mail = input.email ? String(input.email).trim() : null;
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: 'That does not look like an email address — ask the customer to check it.' };
      const r = await restock.add({ phone: ctx.phone, name: ctx.conv.fields.Name || ctx.profileName, productId: p.product_id, variantId: hit?.variant?.id || null, option, email: mail, source: 'WhatsApp' });
      return { ok: true, note: r.already_waiting ? 'They were already on the list.' : 'Saved. Stock is checked twice a day; Joy messages them on WhatsApp once it is back.' };
    }
    case 'handoff_to_human': {
      await conversations.pause(ctx.conv, `${input.reason}: ${input.summary}`);
      await conversations.setFields(ctx.conv, { 'Needs attention': true });
      await notifyAdmins(`🙋 Chat needs you (${input.reason.replace(/_/g, ' ')}) — +${ctx.phone}${ctx.profileName ? ` (${ctx.profileName})` : ''}\n${input.summary}\nJoy told them she'd get back to them in a few minutes, and the AI is paused in this chat. Reply as Joy from the WhatsApp Business app. Send "#release ${ctx.phone}" here to hand it back to Joy.`);
      return { ok: true, note: 'Chat passed to Janet, who will continue as Joy; the AI is now paused in this chat. Your reply must only be a short holding line in your own voice (e.g. "Let me check on this and get back to you in a few minutes.") — never mention Janet, a team or a handover.' };
    }
    default:
      return { error: `Unknown tool "${name}". Available: ${TOOLS.map(t => t.name).join(', ')}` };
  }
}

module.exports = { TOOLS, runTool };
