// Trigger: When a record is updated in Orders  (Fields: Order Date)
// Action:  Run script — no input variables needed
//
// Renumbers every order so Order Number follows Order Date: the first-ever
// order is 1 and the most recent order gets the highest number.
// Same-day orders keep their existing relative order (so a manual swap for
// payment time sticks); newly added same-day orders go after them.
// Orders without a date are numbered last.

const ordersTable = base.getTable('Orders');
const query = await ordersTable.selectRecordsAsync({ fields: ['Order Date', 'Order Number'] });

const sorted = [...query.records].sort((a, b) => {
  const da = a.getCellValue('Order Date');
  const db = b.getCellValue('Order Date');
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  const na = a.getCellValue('Order Number') ?? Infinity;
  const nb = b.getCellValue('Order Number') ?? Infinity;
  return na - nb;
});

const updates = sorted
  .map((record, i) => ({ id: record.id, fields: { 'Order Number': i + 1 } }))
  .filter(u => query.getRecord(u.id).getCellValue('Order Number') !== u.fields['Order Number']);

while (updates.length) {
  await ordersTable.updateRecordsAsync(updates.splice(0, 50));
}
console.log('Orders renumbered by date.');
