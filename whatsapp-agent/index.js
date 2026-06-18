require('dotenv').config();
const express        = require('express');
const twilio         = require('twilio');
const Anthropic      = require('@anthropic-ai/sdk');
const { buildSystemPrompt }                         = require('./src/agent');
const { handle: thriftlyHandle, hasActiveSession, isTrigger } = require('./src/thriftlyFlow');
const { initiateSTKPush }                           = require('./src/mpesa');

const app    = express();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const ai     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ── Conversation sessions ────────────────────────────────────────────────────
const sessions    = new Map();
const SESSION_TTL = parseInt(process.env.SESSION_TTL_MS || '3600000', 10);

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TTL) sessions.delete(key);
  }
}, 60 * 60 * 1000);

// In-memory STK Push payment tracking
const payments = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────
async function sendWA(to, body) {
  try {
    await client.messages.create({ from: process.env.TWILIO_WHATSAPP_NUMBER, to, body });
  } catch (err) {
    console.error('[Twilio send error]', err.message);
  }
}

function formatPhone(wa) {
  const digits = wa.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0'))   return '254' + digits.slice(1);
  return digits;
}

// ── Twilio signature validation ──────────────────────────────────────────────
function validateTwilio(req, res, next) {
  const sig = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  if (!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, sig, url, req.body)) {
    console.warn('[security] Invalid Twilio signature — request rejected');
    return res.status(403).send('Forbidden');
  }
  next();
}

// ── WhatsApp webhook ─────────────────────────────────────────────────────────
app.post('/webhook', validateTwilio, async (req, res) => {
  // Acknowledge Twilio immediately — must respond within 15 s
  res.set('Content-Type', 'text/xml').send('<Response></Response>');

  const from    = req.body.From;
  const message = (req.body.Body || '').trim();
  if (!from) return;

  // Extract image attachments
  const numMedia   = parseInt(req.body.NumMedia || '0');
  const mediaItems = [];
  for (let i = 0; i < numMedia; i++) {
    const url         = req.body[`MediaUrl${i}`];
    const contentType = req.body[`MediaContentType${i}`] || 'image/jpeg';
    if (url && contentType.startsWith('image/')) {
      mediaItems.push({ url, filename: `photo_${i + 1}.jpg`, contentType });
    }
  }

  console.log(`[IN]  ${from}: ${message}${numMedia ? ` (+${numMedia} media)` : ''}`);

  // ── THRIFTLY FLOW — intercepts when user is listing or sends trigger word ──
  if (hasActiveSession(from) || isTrigger(message)) {
    try {
      const result = await thriftlyHandle(from, message, mediaItems);
      if (result) {
        console.log(`[TL]  ${from}: ${result.reply.slice(0, 80)}…`);
        await sendWA(from, result.reply);
        return;
      }
    } catch (err) {
      console.error('[ThriftlyFlow error]', err.message);
      await sendWA(from, 'Something went wrong with your listing. Please try again or type CANCEL to start over.');
      return;
    }
  }

  if (!message) return;

  // ── STK PUSH — customer types "pay 4500" ────────────────────────────────
  const payMatch = message.match(/^pay\s+([\d,]+)/i);
  if (payMatch) {
    const amount  = parseInt(payMatch[1].replace(/,/g, ''), 10);
    const phone   = formatPhone(from);
    const orderId = 'BB-' + Date.now();

    if (!process.env.MPESA_CONSUMER_KEY) {
      await sendWA(from,
        `Please pay manually:\n\n` +
        `• Till Number: *${process.env.MPESA_TILL_NUMBER}*\n` +
        `• Business: *${process.env.BUSINESS_NAME}*\n` +
        `• Amount: *KSh ${amount.toLocaleString('en-KE')}*\n` +
        `• Reference: Your phone number\n\n` +
        `Then send me your M-Pesa confirmation code 🌸`
      );
      return;
    }

    try {
      const checkoutId = await initiateSTKPush({ phone, amount, orderId });
      payments.set(checkoutId, { from, amount, orderId, status: 'PENDING' });
      await sendWA(from,
        `✅ M-Pesa prompt sent to *${phone}*!\n\n` +
        `Enter your PIN to pay *KSh ${amount.toLocaleString('en-KE')}* to *${process.env.BUSINESS_NAME}*.\n\n` +
        `I'll confirm your order as soon as payment comes through 🌸`
      );
    } catch (err) {
      console.error('[STK Push error]', err.response?.data || err.message);
      await sendWA(from,
        `Sorry, I couldn't send the M-Pesa prompt right now.\n\n` +
        `Please pay manually:\n` +
        `• Till Number: *${process.env.MPESA_TILL_NUMBER}*\n` +
        `• Amount: *KSh ${amount.toLocaleString('en-KE')}*\n` +
        `• Reference: Your phone number\n\n` +
        `Then send me your M-Pesa confirmation code 🌸`
      );
    }
    return;
  }

  // ── AISHA AI AGENT ───────────────────────────────────────────────────────
  let session = sessions.get(from);
  const now   = Date.now();
  if (!session || now - session.lastActive > SESSION_TTL) {
    session = { history: [], lastActive: now, greeted: false };
  }
  session.lastActive = now;

  let messageToAgent = message;
  if (!session.greeted) {
    messageToAgent  = `[New customer routed from Beyond Beauty KE website to complete a purchase] ${message}`;
    session.greeted = true;
  }

  session.history.push({ role: 'user', content: messageToAgent });

  let reply = '';
  try {
    const response = await ai.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     buildSystemPrompt(),
      messages:   session.history,
    });
    reply = response.content[0].text.trim();
    session.history.push({ role: 'assistant', content: reply });
    sessions.set(from, session);
  } catch (err) {
    console.error('[Claude error]', err.message);
    reply = `Hi! Aisha here from ${process.env.BUSINESS_NAME} 🌸\nI'm having a moment — please resend your message or WhatsApp us directly and our team will help you.`;
  }

  console.log(`[OUT] ${from}: ${reply.slice(0, 80)}…`);
  await sendWA(from, reply);
});

// ── Daraja M-Pesa callback ───────────────────────────────────────────────────
// Safaricom POSTs here when an STK Push payment completes or fails
app.post('/api/mpesa/callback', async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const callback = req.body?.Body?.stkCallback;
  if (!callback) return;

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
  const payment = payments.get(CheckoutRequestID);
  if (!payment) {
    console.warn('[Mpesa] Unknown CheckoutRequestID:', CheckoutRequestID);
    return;
  }

  if (ResultCode === 0) {
    const items   = CallbackMetadata?.Item || [];
    const get     = (name) => items.find(i => i.Name === name)?.Value;
    const receipt = get('MpesaReceiptNumber');
    const amount  = get('Amount');

    payment.status  = 'SUCCESS';
    payment.receipt = receipt;
    console.log(`[Mpesa] ✅ ${receipt} | KSh ${amount} | order ${payment.orderId}`);

    await sendWA(payment.from,
      `🎉 Payment confirmed — asante sana!\n\n` +
      `*M-Pesa Receipt:* ${receipt}\n` +
      `*Amount Paid:* KSh ${parseInt(amount).toLocaleString('en-KE')}\n\n` +
      `Your order *${payment.orderId}* is confirmed and being processed.\n` +
      `We'll send you an update when it ships 🛍️\n\n` +
      `— Aisha, ${process.env.BUSINESS_NAME} 🌸`
    );
  } else {
    payment.status = ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
    console.log(`[Mpesa] ❌ ${payment.status}: ${ResultDesc}`);

    await sendWA(payment.from,
      `It looks like the M-Pesa payment wasn't completed.\n\n` +
      `No worries! You can:\n` +
      `• Type *pay ${payment.amount}* for a new phone prompt\n` +
      `• Or pay manually to Till *${process.env.MPESA_TILL_NUMBER}* and send me the confirmation code 🌸`
    );
  }

  payments.set(CheckoutRequestID, payment);
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({
  status: 'Beyond Beauty WA Agent running',
  business: process.env.BUSINESS_NAME,
  till: process.env.MPESA_TILL_NUMBER,
  mpesa_env: process.env.MPESA_ENV || 'not configured',
}));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Beyond Beauty WhatsApp Agent running on port ${PORT}`);
  console.log(`   Business:  ${process.env.BUSINESS_NAME}`);
  console.log(`   Till:      ${process.env.MPESA_TILL_NUMBER}`);
  console.log(`   WhatsApp:  ${process.env.TWILIO_WHATSAPP_NUMBER}`);
  console.log(`   Daraja:    ${process.env.MPESA_ENV || '⚠️  not configured'}`);
  console.log(`   Webhook:   http://localhost:${PORT}/webhook\n`);
});
