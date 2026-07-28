// Trigger: When a record is created in Inventory Movements
// Input variable: recordId  (set to Inventory Movements > Record ID from the trigger)

const NEW_IN_WINDOW_DAYS = 15;
const SELLING_FAST_DAYS  = 14;

const today = new Date();
today.setHours(0, 0, 0, 0);

const cutoff = new Date(today);
cutoff.setDate(cutoff.getDate() - SELLING_FAST_DAYS);

// Navigate: Inventory Movement → Variant → Product
const { recordId } = input.config();

const invTable      = base.getTable('Inventory Movements');
const variantsTable = base.getTable('Variants');
const productsTable = base.getTable('Products');

const movement = await invTable.selectRecordAsync(recordId, { fields: ['Variant'] });
if (!movement) { console.log('Movement record not found.'); return; }

const variantLinks = movement.getCellValue('Variant');
if (!variantLinks?.length) { console.log('No variant linked to this movement.'); return; }

const variant = await variantsTable.selectRecordAsync(variantLinks[0].id, { fields: ['Products'] });
if (!variant) { console.log('Variant not found.'); return; }

const productLinks = variant.getCellValue('Products');
if (!productLinks?.length) { console.log('No product linked to this variant.'); return; }

const product = await productsTable.selectRecordAsync(productLinks[0].id, {
  fields: [
    'Total Stock Quantity', 'Status',
    'Sale Price', 'Price (KES)', 'Sale Start Date', 'Sale End Date',
    'Reorder Threshold', 'Badge', 'Variants',
  ],
});
if (!product) { console.log('Product not found.'); return; }

// Count units sold in the past 14 days across this product's variants
const productVariantLinks = product.getCellValue('Variants') ?? [];
const variantIds          = new Set(productVariantLinks.map(v => v.id));

const orderItemsTable = base.getTable('Order Items');
const { records: orderItems } = await orderItemsTable.selectRecordsAsync({
  fields: ['Variant', 'Quantity'],
});

let soldIn14d = 0;
for (const item of orderItems) {
  if (new Date(item.createdTime) < cutoff) continue;
  const links = item.getCellValue('Variant');
  if (!links?.length) continue;
  if (links.some(v => variantIds.has(v.id))) {
    soldIn14d += item.getCellValue('Quantity') ?? 0;
  }
}

function computeBadges(p, soldIn14d, currentBadges) {
  const g          = f => p.getCellValue(f);
  const totalStock = g('Total Stock Quantity') ?? 0;
  const status     = g('Status')?.name;
  const salePrice  = g('Sale Price');
  const price      = g('Price (KES)');
  const saleStart  = g('Sale Start Date') ? new Date(g('Sale Start Date')) : null;
  const saleEnd    = g('Sale End Date')   ? new Date(g('Sale End Date'))   : null;
  const dateAdded  = new Date(p.createdTime);

  if (currentBadges.includes('Coming Soon')) return ['Coming Soon'];

  if (totalStock <= 0 && status === 'Active') return ['Out of Stock'];

  const badges = [];

  const saleActive = salePrice && price && salePrice < price
    && (!saleStart || today >= saleStart)
    && (!saleEnd   || today <= saleEnd);
  if (saleActive) badges.push('Sale');

  const daysSinceAdded = (today - dateAdded) / 864e5;
  if (daysSinceAdded <= NEW_IN_WINDOW_DAYS && totalStock > 0 && status === 'Active') {
    badges.push('New In');
  }

  if (soldIn14d > 0) badges.push('Selling Fast');

  if (totalStock > 0 && totalStock <= 2) badges.push("Only 'X' Left");

  return badges;
}

// Multi-select returns [{id, name, color}] — Part 1 breaking change
const currentBadges = (product.getCellValue('Badge') ?? []).map(b => b.name);
const newBadges     = computeBadges(product, soldIn14d, currentBadges);

if (JSON.stringify(newBadges) !== JSON.stringify(currentBadges)) {
  await productsTable.updateRecordAsync(product.id, {
    Badge: newBadges.map(name => ({ name })),
  });
  console.log(`${product.id}: [${currentBadges.join(', ') || 'none'}] → [${newBadges.join(', ') || 'none'}]`);
} else {
  console.log(`Badges unchanged: [${currentBadges.join(', ') || 'none'}]`);
}
