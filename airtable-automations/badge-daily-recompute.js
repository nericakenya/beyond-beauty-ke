// Trigger: Scheduled — every day at 00:00 EAT
// Recomputes badge for every Active product

const NEW_IN_WINDOW_DAYS = 30;
const SELLING_FAST_DAYS  = 5;

const today = new Date();
today.setHours(0, 0, 0, 0);

const cutoff = new Date(today);
cutoff.setDate(cutoff.getDate() - SELLING_FAST_DAYS);

// Build variant → units sold map for the past 5 days
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
    'Launch Date', 'Total Stock Quantity', 'Status',
    'Sale Price', 'Price (KES)', 'Sale Start Date', 'Sale End Date',
    'Reorder Threshold', 'Badge', 'Variants',
  ],
});

function computeBadge(p) {
  const g          = f => p.getCellValue(f);
  const launchDate = g('Launch Date')     ? new Date(g('Launch Date'))     : null;
  const saleStart  = g('Sale Start Date') ? new Date(g('Sale Start Date')) : null;
  const saleEnd    = g('Sale End Date')   ? new Date(g('Sale End Date'))   : null;
  const totalStock = g('Total Stock Quantity') ?? 0;
  const status     = g('Status')?.name;
  const salePrice  = g('Sale Price');
  const price      = g('Price (KES)');
  const threshold  = 2;
  const dateAdded  = new Date(p.createdTime);

  const productVariants = g('Variants') ?? [];
  const soldIn5d = productVariants.reduce((sum, v) => sum + (variantSales[v.id] ?? 0), 0);

  if (launchDate && launchDate > today)
    return 'Coming Soon';

  if (totalStock <= 0 && status === 'Active')
    return 'Out of Stock';

  if (totalStock > 0 && totalStock <= threshold)
    return "Only 'X' Left";

  if (salePrice && price && salePrice < price && saleStart && saleEnd
      && today >= saleStart && today <= saleEnd)
    return 'Sale';

  if (soldIn5d > 0)
    return 'Selling Fast';

  const daysSinceAdded = (today - dateAdded) / 864e5;
  if (daysSinceAdded <= NEW_IN_WINDOW_DAYS && totalStock > 0 && status === 'Active')
    return 'New In';

  return null;
}

const updates = [];
for (const p of records) {
  const newBadge     = computeBadge(p);
  const currentBadge = p.getCellValue('Badge')?.name ?? null;
  if (newBadge !== currentBadge) {
    updates.push({ id: p.id, fields: { Badge: newBadge ? { name: newBadge } : null } });
  }
}

const batches = [];
for (let i = 0; i < updates.length; i += 50) batches.push(updates.slice(i, i + 50));
for (const batch of batches) await tbl.updateRecordsAsync(batch);

console.log(`Recomputed ${records.length} products. ${updates.length} badge(s) changed.`);
