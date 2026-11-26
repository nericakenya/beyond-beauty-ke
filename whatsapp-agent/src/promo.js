// Promo codes: only codes in the Airtable Promotions table, applied by these rules.
// Joy never invents or stretches a discount.
const { config, business } = require('./config');
const airtable = require('./airtable');

const T = config.airtable.tables;

function todayNairobi(now = new Date()) {
  return new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// Pure rule check on a Promotions record's fields. lines: [{ product_id, line_total }]
// productLinks: product_id -> Set of linked category/collection record IDs.
function evaluate(fields, lines, productLinks, today = todayNairobi()) {
  const code = fields['Promo Code'];
  const fail = reason => ({ valid: false, code, reason });
  if (!fields.Active) return fail('This code is not active.');
  if (fields['Start Date'] && fields['Start Date'] > today) return fail('This code has not started yet.');
  if (fields['End Date'] && fields['End Date'] < today) return fail('This code has expired.');
  if (fields['Usage Limit'] != null && (fields['Usage Count'] || 0) >= fields['Usage Limit']) return fail('This code has been fully used.');

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const min = fields['Min Order Value'] || 0;
  if (subtotal < min) return fail(`This code needs an order of at least KSh ${min.toLocaleString('en-KE')} (items only).`);

  const onlyProducts = new Set(fields['Applicable Products'] || []);
  const onlyGroups = new Set([...(fields['Applicable Categories'] || []), ...(fields['Applicable Collections'] || [])]);
  const restricted = onlyProducts.size > 0 || onlyGroups.size > 0;
  const eligible = restricted
    ? lines.filter(l => onlyProducts.has(l.product_id) || [...(productLinks[l.product_id] || [])].some(id => onlyGroups.has(id)))
    : lines;
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.line_total, 0);
  if (!eligibleSubtotal) return fail('None of the items in this order are included in this code.');

  const value = Number(fields.Value) || 0;
  switch (fields.Type) {
    case 'Percentage':
      return { valid: true, code, type: 'Percentage', discount: Math.round(eligibleSubtotal * value / 100), free_delivery: false };
    case 'Fixed Amount':
      return { valid: true, code, type: 'Fixed Amount', discount: Math.min(value, eligibleSubtotal), free_delivery: false };
    case 'Free Shipping':
      return { valid: true, code, type: 'Free Shipping', discount: 0, free_delivery: true };
    default: // BOGO and anything new: a person applies it
      return { valid: false, code, needs_team: true, reason: `${fields.Type || 'This'} codes are applied by the team.` };
  }
}

async function findPromotion(code) {
  const recs = await airtable.list(T.promotions, { formula: `UPPER(TRIM({Promo Code})) = UPPER(${airtable.str(String(code).trim())})`, maxRecords: 1 });
  return recs[0] || null;
}

async function productLinksFor(productIds) {
  const out = {};
  for (const id of new Set(productIds)) {
    const { fields: f } = await airtable.get(T.products, id);
    out[id] = new Set([...(f['Category (Link)'] || []), ...(f['Sub-Category (Link)'] || []), ...(f['Secondary Sub-Category (Link)'] || []), ...(f.Collections || [])]);
  }
  return out;
}

// lines: [{ product_id, line_total }]
async function check(code, lines) {
  const rec = await findPromotion(code);
  if (!rec) return { valid: false, code, reason: 'There is no promo code with that name.' };
  const f = rec.fields;
  const needsLinks = (f['Applicable Categories'] || []).length || (f['Applicable Collections'] || []).length;
  const links = needsLinks ? await productLinksFor(lines.map(l => l.product_id)) : {};
  const result = evaluate(f, lines, links);
  return { ...result, record_id: rec.id, usage_count: f['Usage Count'] || 0, cancels_free_delivery: business.delivery.promoCancelsFreeDelivery };
}

async function recordUse(recordId, usageCount) {
  await airtable.update(T.promotions, recordId, { 'Usage Count': (usageCount || 0) + 1 });
}

module.exports = { evaluate, check, recordUse, todayNairobi };
