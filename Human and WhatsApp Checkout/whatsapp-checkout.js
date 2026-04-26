/**
 * whatsapp-checkout.js — Option 2: WhatsApp Cart Redirect
 *
 * Drop this script into any webpage. It reads the cart, builds a pre-filled
 * WhatsApp message, and opens wa.me when the customer clicks checkout.
 *
 * Usage:
 *   <script src="whatsapp-checkout.js"></script>
 *   <button onclick="WACheckout.open()">Order via WhatsApp</button>
 *
 * Or trigger programmatically: WACheckout.open(cartItems, deliveryFee)
 */

const WACheckout = (() => {

  // ── Config — edit these ────────────────────────────────────────────────────
  const WHATSAPP_NUMBER = '254712345678'; // Your business WhatsApp number (no + or spaces)
  const BUSINESS_NAME   = 'Zawadi Boutique';
  const MPESA_TILL      = '522522';
  const CURRENCY        = 'KES';
  const DELIVERY_FEE    = 300; // Standard delivery — set 0 if you quote it in chat

  // ── Cart reader ───────────────────────────────────────────────────────────
  // Replace this with your actual cart data source.
  // It should return an array of: { name, qty, price }
  function readCartFromPage() {
    // ── Example: reading from a JSON data attribute ──────────────────────────
    // <div id="cart-data" data-cart='[{"name":"Silk Wrap Dress","qty":1,"price":4500}]'></div>
    const el = document.getElementById('cart-data');
    if (el?.dataset?.cart) {
      try { return JSON.parse(el.dataset.cart); } catch (_) {}
    }

    // ── Example: reading from global JS cart variable ───────────────────────
    if (window.CART_ITEMS?.length) return window.CART_ITEMS;

    // ── Fallback: scrape DOM cart rows ──────────────────────────────────────
    // Assumes: <tr class="cart-item" data-name="..." data-qty="..." data-price="...">
    const rows = document.querySelectorAll('.cart-item');
    if (rows.length) {
      return Array.from(rows).map(r => ({
        name:  r.dataset.name,
        qty:   parseInt(r.dataset.qty, 10)  || 1,
        price: parseFloat(r.dataset.price)  || 0,
      }));
    }

    return [];
  }

  // ── Message builder ───────────────────────────────────────────────────────
  function buildMessage(items, deliveryFee) {
    if (!items.length) return null;

    const subtotal  = items.reduce((s, i) => s + i.price * i.qty, 0);
    const total     = subtotal + (deliveryFee ?? DELIVERY_FEE);

    const lines = items.map(i => {
      const lineTotal = (i.price * i.qty).toLocaleString('en-KE');
      const qty = i.qty > 1 ? ` ×${i.qty}` : '';
      return `• ${i.name}${qty} — ${CURRENCY} ${lineTotal}`;
    });

    const message = [
      `Hi ${BUSINESS_NAME}! 👋 I'd like to order the following:`,
      '',
      ...lines,
      '',
      `Subtotal: ${CURRENCY} ${subtotal.toLocaleString('en-KE')}`,
      deliveryFee > 0
        ? `Delivery: ${CURRENCY} ${deliveryFee.toLocaleString('en-KE')}`
        : null,
      `*Total: ${CURRENCY} ${total.toLocaleString('en-KE')}*`,
      '',
      `Please send me the M-Pesa payment details and let me know the delivery options.`,
    ].filter(l => l !== null).join('\n');

    return message;
  }

  // ── Deep link builder ─────────────────────────────────────────────────────
  function buildWhatsAppURL(message) {
    const encoded = encodeURIComponent(message);
    // wa.me works on mobile (opens app) and desktop (opens web.whatsapp.com)
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function open(customItems, customDeliveryFee) {
    const items = customItems || readCartFromPage();

    if (!items.length) {
      alert('Your cart is empty. Please add items before checking out.');
      return;
    }

    const message = buildMessage(items, customDeliveryFee);
    if (!message) return;

    const url = buildWhatsAppURL(message);

    // Open in new tab — WhatsApp will prompt to switch to the app on mobile
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Expose a preview method for debugging
  function preview(customItems) {
    const items = customItems || readCartFromPage();
    return buildMessage(items, DELIVERY_FEE);
  }

  return { open, preview, buildMessage, buildWhatsAppURL };
})();
