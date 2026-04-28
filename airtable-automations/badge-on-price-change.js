// Trigger: When a record is updated in Products
// Watch fields: Price (KES), Sale Price, Sale Start Date, Sale End Date
// Input variable: recordId  (set to Products > Record ID from the trigger)

const NEW_IN_WINDOW_DAYS = 30;
const SELLING_FAST_DAYS  = 5;

const today = new Date();
today.setHours(0, 0, 0, 0);

const cutoff = new Date(today);
cutoff.setDate(cutoff.getDate() - SELLING_FAST_DAYS);

const { recordId } = input.config();
const tbl = base.getTable('Products');

const product = await tbl.selectRecordAsync(recordId, {
  fields: [
    'Launch Date', 'Total Stock Quantity', 'Status',
    'Sale Price', 'Price (KES)', 'Sale Start Date', 'Sale End Date',
    'Reorder Threshold', 'Badge', 'Variants',
  ],
});
if (!product) { console.log('Product not found.'); return; }

// Count units sold in the past 5 days across this product's variants
const variantLinks = product.getCellValue('Variants') ?? [];
const variantIds   = new Set(variantLinks.map(v => v.id));

const orderItemsTable = base.getTable('Order Items');
const { records: orderItems } = await orderItemsTable.selectRecordsAsync({
  fields: ['Variant', 'Quantity'],
});

let soldIn5d = 0;
for (const item of orderItems) {
  if (new Date(item.createdTime) < cutoff) continue;
  const links = item.getCellValue('Variant');
  if (!links?.length) continue;
  if (links.some(v => variantIds.has(v.id))) {
    soldIn5d += item.getCellValue('Quantity') ?? 0;
  }
}

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

  if (launchDate && launchDate > today)                                          return 'Coming Soon';
  if (totalStock <= 0 && status === 'Active')                                    return 'Out of Stock';
  if (totalStock > 0 && totalStock <= threshold)                                 return "Only 'X' Left";
  if (salePrice && price && salePrice < price && saleStart && saleEnd
      && today >= saleStart && today <= saleEnd)                                 return 'Sale';
  if (soldIn5d > 0)                                                              return 'Selling Fast';
  const daysSince = (today - dateAdded) / 864e5;
  if (daysSince <= NEW_IN_WINDOW_DAYS && totalStock > 0 && status === 'Active') return 'New In';
  return null;
}

const newBadge     = computeBadge(product);
const currentBadge = product.getCellValue('Badge')?.name ?? null;

if (newBadge !== currentBadge) {
  await tbl.updateRecordAsync(product.id, {
    Badge: newBadge ? { name: newBadge } : null,
  });
  console.log(`${product.getCellValue('Product Name') || product.id}: ${currentBadge || 'none'} → ${newBadge || 'none'}`);
} else {
  console.log(`Badge unchanged: ${currentBadge || 'none'}`);
}
