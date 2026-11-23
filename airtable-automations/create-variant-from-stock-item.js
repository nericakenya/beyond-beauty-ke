// Trigger: When a record matches conditions in Stock Items
//          — conditions: "List on website" is checked AND "Variant" is empty
// Input variable: recordId (Stock Items > Record ID from the trigger)
//
// Stock Items owns all variant information (SKU, colour, size, length, texture, price, stock).
// This creates the website Variant and links it; the Variant's fields then mirror the Stock Item read-only.

const { recordId } = input.config();

const stockTable    = base.getTable('Stock Items');
const variantsTable = base.getTable('Variants');

const item = await stockTable.selectRecordAsync(recordId, {
  fields: ['SKU', 'Variant', 'Product (website)', 'List on website'],
});
if (!item) { console.log('Stock Item not found.'); return; }
if (item.getCellValue('Variant')?.length) { console.log('Already has a website Variant.'); return; }

const product = item.getCellValue('Product (website)');
if (!product?.length) {
  throw new Error(`${item.getCellValueAsString('SKU')}: link "Product (website)" before ticking "List on website".`);
}

const variantId = await variantsTable.createRecordAsync({
  'SKU (old)': item.getCellValueAsString('SKU'), // primary label only — the live SKU field mirrors Stock Items
  Products: [{ id: product[0].id }],
  'Stock Items': [{ id: item.id }],
  Active: true,
});
console.log(`Created Variant ${variantId} for ${item.getCellValueAsString('SKU')}`);
