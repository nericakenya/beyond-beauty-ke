require('dotenv').config();
const express        = require('express');
const Anthropic      = require('@anthropic-ai/sdk');
const twilio         = require('twilio');
const { buildSystemPrompt }               = require('./src/agent');
const { handle: thriftlyHandle, hasActiveSession, isTrigger } = require('./src/thriftlyFlow');

const app    = express();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const ai     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Per-customer Aisha conversation history (in-memory; resets on restart)
const sessions    = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

async function sendWA(to, body) {
  try {
    await client.messages.create({ from: process.env.TWILIO_WHATSAPP_NUMBER, to, body });
  } catch (err) {
    console.error('[Twilio send error]', err.message);
  }
}

app.post('/webhook', async (req, res) => {
  const from    = req.body.From;   // e.g. whatsapp:+254712345678
  const message = (req.body.Body || '').trim();

  if (!from) return res.sendStatus(200);

  // Extract any media attachments (photos sent via WhatsApp)
  const numMedia  = parseInt(req.body.NumMedia || '0');
  const mediaItems = [];
  for (let i = 0; i < numMedia; i++) {
    const url         = req.body[`MediaUrl${i}`];
    const contentType = req.body[`MediaContentType${i}`] || 'image/jpeg';
    if (url && contentType.startsWith('image/')) {
      mediaItems.push({ url, filename: `photo_${i + 1}.jpg`, contentType });
    }
  }

  console.log(`[IN]  ${from}: ${message}${numMedia ? ` (+${numMedia} media)` : ''}`);

  // ── THRIFTLY FLOW — intercepts messages when user is in a listing session
  //    or when they send a trigger word (SELL / THRIFTLY / etc.)
  if (hasActiveSession(from) || isTrigger(message)) {
    try {
      const result = await thriftlyHandle(from, message, mediaItems);
      if (result) {
        console.log(`[TL]  ${from}: ${result.reply.slice(0, 80)}…`);
        await sendWA(from, result.reply);
        return res.set('Content-Type', 'text/xml').send('<Response></Response>');
      }
    } catch (err) {
      console.error('[ThriftlyFlow error]', err.message);
      await sendWA(from, 'Something went wrong with your listing. Please try again or type CANCEL to start over.');
      return res.set('Content-Type', 'text/xml').send('<Response></Response>');
    }
  }

  // ── AISHA AI AGENT — handles all non-Thriftly messages
  if (!message) return res.sendStatus(200);

  let session = sessions.get(from);
  const now   = Date.now();
  if (!session || now - session.lastActive > SESSION_TTL) {
    session = { history: [], lastActive: now };
  }
  session.lastActive = now;
  session.history.push({ role: 'user', content: message });

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
    reply = "Sorry, I'm having a moment! Please try again or WhatsApp us directly and our team will help you.";
  }

  console.log(`[OUT] ${from}: ${reply}`);
  await sendWA(from, reply);
  res.set('Content-Type', 'text/xml').send('<Response></Response>');
});

// Health check
app.get('/', (req, res) => res.json({ status: 'Beyond Beauty WA Agent running' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nBeyond Beauty WhatsApp Agent running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`Set this as your Twilio webhook: https://YOUR-NGROK-URL/webhook\n`);
});
