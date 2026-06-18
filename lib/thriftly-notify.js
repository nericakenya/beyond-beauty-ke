// Notification stubs — log to console and send WhatsApp via Twilio if configured.
// Wire TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WA_FROM to activate.

const WA_FROM   = process.env.TWILIO_WA_FROM   || 'whatsapp:+14155238886';
const ADMIN_WA  = process.env.ADMIN_WHATSAPP   || (process.env.WHATSAPP_NUMBER ? `whatsapp:+${process.env.WHATSAPP_NUMBER}` : null);
const BASE_URL  = process.env.BASE_URL         || 'https://beyondbeauty.co.ke';

function fmt(kes) { return `KES ${Number(kes).toLocaleString()}`; }

function waTo(phone) {
  if (!phone) return null;
  const p = phone.toString().replace(/\s/g, '').replace(/^\+/, '');
  return `whatsapp:+${p.startsWith('254') ? p : '254' + p.slice(1)}`;
}

async function sendWA(to, body) {
  if (!to) return;
  console.log(`[Notify→WA] ${to}: ${body.slice(0, 80)}…`);
  if (!process.env.TWILIO_ACCOUNT_SID) return; // not wired yet
  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({ from: WA_FROM, to, body });
  } catch (err) {
    console.error('[Notify] WhatsApp send failed:', err.message);
  }
}

const TEMPLATES = {
  // Seller: payment received, please dispatch
  payment_received: ({ seller_phone, item_title, dispatch_url }) => ({
    to: waTo(seller_phone),
    body: `✅ *Thriftly — Payment Received*\n\nYour item *${item_title}* has been paid for and the funds are held securely by Beyond Beauty.\n\nPlease package and dispatch the item, then tap the link below to confirm:\n${dispatch_url}\n\n_Beyond Beauty KE_`,
  }),

  // Buyer: payment failed
  payment_failed: ({ buyer_phone }) => ({
    to: waTo(buyer_phone),
    body: `❌ *Thriftly — Payment Not Completed*\n\nYour M-Pesa payment was not completed. Please try again.\n\n_Beyond Beauty KE_`,
  }),

  // Buyer: item has been dispatched
  buyer_dispatched: ({ buyer_phone, item_title }) => ({
    to: waTo(buyer_phone),
    body: `📦 *Thriftly — Your Item Is On Its Way*\n\nYour item *${item_title}* has been dispatched by the seller. We'll ask you to confirm delivery in a couple of days.\n\n_Beyond Beauty KE_`,
  }),

  // Buyer: confirm delivery prompt (sent at T+48h)
  buyer_confirm_prompt: ({ buyer_phone, item_title, confirm_url }) => ({
    to: waTo(buyer_phone),
    body: `📬 *Thriftly — Has Your Item Arrived?*\n\nHas your *${item_title}* arrived? If it has, tap below to confirm — we'll release the seller's payment straight away. If something is not right, you can also raise a dispute.\n\n${confirm_url}\n\n_Beyond Beauty KE_`,
  }),

  // Buyer: confirmed delivery acknowledgement
  buyer_confirmed_ack: ({ buyer_phone, item_title }) => ({
    to: waTo(buyer_phone),
    body: `🎉 *Thriftly — Delivery Confirmed*\n\nThanks for confirming receipt of *${item_title}*! We're releasing payment to the seller now.\n\n_Beyond Beauty KE_`,
  }),

  // Seller: payout initiated
  seller_payout_initiated: ({ seller_phone, item_title }) => ({
    to: waTo(seller_phone),
    body: `💸 *Thriftly — Payout On Its Way*\n\nYour buyer has confirmed delivery of *${item_title}*. We're sending your M-Pesa payment now.\n\n_Beyond Beauty KE_`,
  }),

  // Seller: payout completed
  payout_completed: ({ seller_phone, amount, receipt, last4 }) => ({
    to: waTo(seller_phone),
    body: `✅ *Thriftly — Payment Sent*\n\n${fmt(amount)} has been sent to your M-Pesa${last4 ? ` (…${last4})` : ''}.\nM-Pesa ref: *${receipt}*\n\n_Beyond Beauty KE_`,
  }),

  // Buyer: dispute acknowledgement
  buyer_dispute_ack: ({ buyer_phone }) => ({
    to: waTo(buyer_phone),
    body: `🔍 *Thriftly — Dispute Received*\n\nWe've received your dispute. Our team will contact you within 24 hours via WhatsApp to resolve this.\n\n_Beyond Beauty KE_`,
  }),

  // Seller: dispute notification
  seller_dispute_ack: ({ seller_phone, item_title }) => ({
    to: waTo(seller_phone),
    body: `⚠️ *Thriftly — Dispute Raised*\n\nA dispute has been raised on your order for *${item_title}*. We'll be in touch shortly to resolve this.\n\n_Beyond Beauty KE_`,
  }),

  // Admin: dispute alert
  admin_dispute: ({ transaction_id, buyer_phone, seller_phone, amount, item_title, reason }) => ({
    to: ADMIN_WA,
    body: `🚨 *Thriftly Dispute — Admin Action Required*\n\nTx: ${transaction_id}\nItem: ${item_title}\nAmount: ${fmt(amount)}\nBuyer: ${buyer_phone}\nSeller: ${seller_phone}\nReason: ${reason || 'not specified'}\n\nReview at ${BASE_URL}/admin`,
  }),

  // Admin: auto-release pending
  admin_auto_release: ({ transaction_id, amount, item_title }) => ({
    to: ADMIN_WA,
    body: `⏰ *Thriftly — Auto-Release Review Required*\n\nTransaction ${transaction_id} (${item_title}, ${fmt(amount)}) has passed 7 days with no buyer confirmation.\n\nReview at ${BASE_URL}/admin`,
  }),

  // Admin: payout failed
  admin_payout_failed: ({ transaction_id, amount, seller_phone, error }) => ({
    to: ADMIN_WA,
    body: `❌ *Thriftly — Payout Failed*\n\nTx: ${transaction_id}\nAmount: ${fmt(amount)}\nSeller: ${seller_phone}\nError: ${error}\n\nManual payout required.`,
  }),
};

function notify(event, data) {
  const tpl = TEMPLATES[event];
  if (!tpl) { console.warn('[Notify] Unknown event:', event); return; }
  const { to, body } = tpl(data);
  sendWA(to, body).catch(() => {});
}

module.exports = { notify };
