/**
 * server.js
 * Express server that receives WhatsApp messages from Twilio,
 * passes them through the Claude agent, and sends replies back.
 */

require('dotenv').config();

const express = require('express');
const twilio = require('twilio');
const { getAgentReply } = require('./agent');
const { getSession, appendMessage, clearSession } = require('./sessionStore');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded bodies
app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  PORT = 3000,
} = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ── Webhook signature validation middleware ─────────────────────────────────
// Protects your endpoint from spoofed requests. Disable only for local testing.
function validateTwilioSignature(req, res, next) {
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );

  if (!isValid) {
    console.warn('[security] Invalid Twilio signature from', req.ip);
    return res.status(403).send('Forbidden');
  }
  next();
}

// ── Helper: send a WhatsApp message via Twilio ──────────────────────────────
async function sendWhatsApp(to, body) {
  try {
    await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to,        // e.g. "whatsapp:+254712345678"
      body,
    });
  } catch (err) {
    console.error('[twilio] Failed to send message:', err.message);
    throw err;
  }
}

// ── Main webhook: POST /webhook/whatsapp ────────────────────────────────────
app.post(
  '/webhook/whatsapp',
  validateTwilioSignature,
  async (req, res) => {
    // Acknowledge Twilio immediately — must respond within 15 seconds
    res.status(200).send('<Response></Response>');

    const { From: customerNumber, Body: incomingText, NumMedia } = req.body;

    if (!customerNumber) return;

    const text = (incomingText || '').trim();
    const session = getSession(customerNumber);

    console.log(`[in]  ${customerNumber}: ${text || '[media]'}`);

    // ── Handle "cancel" / "stop" keywords ────────────────────────────────
    if (/^(cancel|stop|quit|exit)$/i.test(text)) {
      await sendWhatsApp(
        customerNumber,
        'No problem! Your session has been cleared. Feel free to message us again anytime. 👋'
      );
      clearSession(customerNumber);
      return;
    }

    // ── Build the message to send to Claude ──────────────────────────────
    let messageToAgent = text;

    // If the customer sent media (e.g. a product image), note it for context
    if (parseInt(NumMedia, 10) > 0) {
      messageToAgent = text
        ? `[Customer sent an image] ${text}`
        : '[Customer sent an image without a caption]';
    }

    // On first message, prepend a routing context so Claude greets appropriately
    if (!session.greeted) {
      messageToAgent =
        `[New customer routed from website to complete a purchase] ${messageToAgent}`.trim();
      session.greeted = true;
    }

    // ── Call Claude ───────────────────────────────────────────────────────
    let reply;
    try {
      reply = await getAgentReply(session.history, messageToAgent);
    } catch (err) {
      console.error('[claude] API error:', err.message);
      reply = "Sorry, I'm having trouble right now. Please try again in a moment.";
    }

    // ── Persist both sides of the conversation ────────────────────────────
    appendMessage(customerNumber, 'user', messageToAgent);
    appendMessage(customerNumber, 'assistant', reply);

    console.log(`[out] ${customerNumber}: ${reply.substring(0, 80)}…`);

    // ── Send reply back to the customer ───────────────────────────────────
    // WhatsApp has a 1600-char limit per message — split if needed
    const chunks = splitMessage(reply, 1500);
    for (const chunk of chunks) {
      await sendWhatsApp(customerNumber, chunk);
    }
  }
);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Utility: split long messages at paragraph boundaries ────────────────────
function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const parts = [];
  const paragraphs = text.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxLen) {
      if (current) parts.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) parts.push(current.trim());
  return parts;
}

// ── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ WhatsApp shopping agent running on port ${PORT}`);
  console.log(`   Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
});
