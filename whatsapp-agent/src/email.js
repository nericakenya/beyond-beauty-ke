// Emails through Resend (the email service chosen for Beyond Beauty's receipts).
// Off until RESEND_API_KEY and EMAIL_FROM are set; the sending domain must be verified in Resend.
const { config, business } = require('./config');

const enabled = () => !!(config.email.resendKey && config.email.from);

async function send({ to, subject, html, text }) {
  if (!enabled()) throw new Error('Email is not set up (RESEND_API_KEY / EMAIL_FROM)');
  if (config.dryRun) { console.log(`[DRY RUN email → ${to}] ${subject}\n${text}\n`); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.email.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.email.from, to: [to], subject, html, text, reply_to: config.email.replyTo || undefined }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function backInStockEmail({ firstName, label, link }) {
  const wa = `https://wa.me/${business.whatsapp.replace(/\D/g, '')}`;
  const subject = `Good news — ${label} is back in stock`;
  const text = `Hi ${firstName},\n\nGood news! ${label} is back in stock at Beyond Beauty.\n\nOrder it here: ${link}\nOr reply to us on WhatsApp: ${wa}\n\nJoy, Beyond Beauty`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f5f2;font-family:Jost,Helvetica,Arial,sans-serif;color:#0e0e0e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e4df">
<tr><td style="padding:28px 32px 8px;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;letter-spacing:2px">BEYOND BEAUTY</td></tr>
<tr><td style="padding:16px 32px;font-size:16px;line-height:1.6">
<p style="margin:0 0 14px">Hi ${esc(firstName)},</p>
<p style="margin:0 0 22px">Good news! <strong>${esc(label)}</strong> is back in stock.</p>
<p style="margin:0 0 22px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#0e0e0e;color:#ffffff;text-decoration:none;padding:12px 28px;font-size:14px;letter-spacing:1px">SHOP NOW</a></p>
<p style="margin:0 0 22px;color:#6b6560;font-size:14px">Prefer to order on WhatsApp? <a href="${wa}" style="color:#b5853a">Message us here</a>.</p>
<p style="margin:0">Joy, Beyond Beauty</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;color:#6b6560;font-size:12px;text-align:center">You asked us to let you know when this was back in stock.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

module.exports = { enabled, send, backInStockEmail };
