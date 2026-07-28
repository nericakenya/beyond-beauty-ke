/**
 * Beyond Beauty — Tracking Helper
 *
 * Pushes events to the GTM dataLayer, which fires Meta Pixel + GA4 events.
 * Single source of truth for client-side event tracking.
 *
 * Usage:
 *   bbTrack('view_content', { product_id: 'sku-123', value: 4500 });
 *   bbTrack('add_to_cart',  { product_id: 'sku-123', value: 4500, item_name: 'The Crescent' });
 *   bbTrack('whatsapp_lead', { source: 'product_page' });
 *   bbTrack('initiate_checkout', { value: 9450, num_items: 2 });
 *   bbTrack('purchase', { transaction_id: 'BB-12345', value: 9450 });
 */

window.dataLayer = window.dataLayer || [];

window.bbTrack = function (eventName, eventData) {
  if (!eventName) {
    console.warn('[bbTrack] called without an event name');
    return;
  }

  var payload = Object.assign(
    { event: eventName, currency: 'KES' },
    eventData || {}
  );

  window.dataLayer.push(payload);

  // Helpful local debug — only logs in dev / Console
  if (window.console && console.log) {
    console.log('[bbTrack]', eventName, payload);
  }
};
