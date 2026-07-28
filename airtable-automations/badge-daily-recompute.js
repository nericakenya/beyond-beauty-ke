// Trigger: Scheduled — every day at 00:00 EAT
// Recomputes badges for every Active product

const NEW_IN_WINDOW_DAYS = 15;
const SELLING_FAST_DAYS  = 14;

const today = new Date();
today.setHours(0, 0, 0, 0);

const cutoff = new Date(today);
cutoff.setDate(cutoff.getDate() - SELLING_FAST_DAYS);

// Build variant → units sold map for the past 14 days
const orderItemsTable = base.getTable('Order Items');
const { records: orderItems } = await orderItemsTable.selectRecordsAsync({
  fields: ['Variant', 'Quantity'],
});

const variantSales = {};
for (const item of orderItems) {
  if (new Date(item.createdTime) < cutoff) continue;
  const links = item.getCellValue('Variant');
  if (!links?.length) continue;
  const qty = item.getCellValue('Quantity') ?? 0;
  for (const v of links) {
    variantSales[v.id] = (variantSales[v.id] ?? 0) + qty;
  }
}

const tbl = base.getTable('Products');
const { records } = await tbl.selectRecordsAsync({
  fields: [
    'Total Stock Quantity', 'Status',
    'Sale Price', 'Price (KES)', 'Sale Start Date', 'Sale End Date',
    'Reorder Threshold', 'Badge', 'Variants',
  ],
});

// Returns an ordered array of badge names for a product.
// Badge field is now multi-select — Part 1 change.
// Coming Soon is manual-only: preserved if already set, never auto-assigned or cleared.
// Out of Stock suppresses Sale (and all other auto badges).
// Sale appears first when present.
function computeBadges(p, soldIn14d, currentBadges) {
  const g          = f => p.getCellValue(f);
  const totalStock = g('Total Stock Quantity') ?? 0;
  const status     = g('Status')?.name;
  const salePrice  = g('Sale Price');
  const price      = g('Price (KES)');
  const saleStart  = g('Sale Start Date') ? new Date(g('Sale Start Date')) : null;
  const saleEnd    = g('Sale End Date')   ? new Date(g('Sale End Date'))   : null;
  const dateAdded  = new Date(p.createdTime);

  // Preserve Coming Soon if manually set — no other badges apply
  if (currentBadges.includes('Coming Soon')) return ['Coming Soon'];

  // Out of Stock — Sale and all urgency badges suppressed
  if (totalStock <= 0 && status === 'Active') return ['Out of Stock'];

  const badges = [];

  // Sale (always first) — price gate + optional date range
  const saleActive = salePrice && price && salePrice < price
    && (!saleStart || today >= saleStart)
    && (!saleEnd   || today <= saleEnd);
  if (saleActive) badges.push('Sale');

  // New In — within 15 days of record creation
  const daysSinceAdded = (today - dateAdded) / 864e5;
  if (daysSinceAdded <= NEW_IN_WINDOW_DAYS && totalStock > 0 && status === 'Active') {
    badges.push('New In');
  }

  // Selling Fast — any units sold in the past 14 days; auto-removed once window lapses
  if (soldIn14d > 0) badges.push('Selling Fast');

  // Only X Left — exactly 1 unit remaining
  if (totalStock > 0 && totalStock <= 2) badges.push("Only 'X' Left");

  return badges;
}

const updates = [];
for (const p of records) {
  // Multi-select returns [{id, name, color}] — Part 1 breaking change
  const currentBadges   = (p.getCellValue('Badge') ?? []).map(b => b.name);
  const productVariants = p.getCellValue('Variants') ?? [];
  const soldIn14d       = productVariants.reduce((sum, v) => sum + (variantSales[v.id] ?? 0), 0);
  const newBadges       = computeBadges(p, soldIn14d, currentBadges);

  if (JSON.stringify(newBadges) !== JSON.stringify(currentBadges)) {
    updates.push({ id: p.id, fields: { Badge: newBadges.map(name => ({ name })) } });
  }
}

const batches = [];
for (let i = 0; i < updates.length; i += 50) batches.push(updates.slice(i, i + 50));
for (const batch of batches) await tbl.updateRecordsAsync(batch);

console.log(`Recomputed ${records.length} products. ${updates.length} badge(s) changed.`);
