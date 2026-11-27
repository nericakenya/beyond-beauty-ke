// Joy — Beyond Beauty KE's WhatsApp sales agent.
// Meta WhatsApp Cloud API webhook → Claude (with shop/Airtable tools) → reply in WhatsApp.
const express = require('express');
const { config, missingSettings } = require('./src/config');
const wa = require('./src/whatsapp');
const conversations = require('./src/conversations');
const agent = require('./src/agent');
const { notifyAdmins } = require('./src/notify');
const { phoneDigits } = require('./src/orders');
const restock = require('./src/restock');
const payments = require('./src/payments');

const app = express();
app.set('trust proxy', true);

app.get('/health', (_req, res) => res.json({ ok: true, agent: 'Joy', model: config.claude.model, missing_settings: missingSettings() }));

// Meta's one-time webhook check (Webhooks → Callback URL + Verify token)
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && config.meta.verifyToken && req.query['hub.verify_token'] === config.meta.verifyToken) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Incoming messages. Raw body is needed to check Meta's signature.
app.post('/webhook', express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
  if (!wa.validSignature(req.body, req.get('x-hub-signature-256'))) {
    console.warn('[webhook] bad signature — ignored');
    return res.sendStatus(401);
  }
  res.sendStatus(200); // answer Meta at once; work happens after
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { return; }
  for (const ev of wa.parseWebhook(body)) {
    const phone = ev.kind === 'echo' ? ev.to : ev.from;
    if (!phone || conversations.alreadySeen(ev.id)) continue;
    conversations.enqueue(phone, () => handle(ev));
  }
});

// ── Test chat page (/test) ─────────────────────────────────────────────────────────
// Same handlers as WhatsApp, but everything Joy would send is collected and returned.
const crypto = require('crypto');
const testPage = require('./src/testpage');
const keyOk = k => {
  const want = config.testChatKey || '';
  return !!want && typeof k === 'string' && k.length === want.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(want));
};
const testPhoneOk = p => /^2540000\d{5}$/.test(String(p || ''));

app.get('/test', (_req, res) => {
  if (!config.testChatKey) return res.status(404).send('Test chat is switched off (set TEST_CHAT_KEY).');
  res.type('html').send(testPage);
});

app.post('/test/message', express.json(), async (req, res) => {
  const { key, phone, text, name, asAdmin } = req.body || {};
  if (!keyOk(key)) return res.status(401).json({ error: 'Wrong test key' });
  if (!testPhoneOk(phone) || !String(text || '').trim()) return res.status(400).json({ error: 'Bad request' });
  const store = { outbox: [] };
  try {
    await wa.testCapture.run(store, () => {
      const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (asAdmin) return handleAdmin({ kind: 'message', from: config.adminNumbers[0] || 'admin', id, type: 'text', text: String(text) });
      return conversations.enqueue(phone, () => handleCustomer({ kind: 'message', from: phone, name: name || 'Test Customer', id, type: 'text', text: String(text), timestamp: Date.now() / 1000 }));
    });
    res.json({ messages: store.outbox.map(m => ({ to: m.to === phone ? 'customer' : 'janet', text: m.text })) });
  } catch (e) {
    console.error('[test chat]', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/test/reset', express.json(), async (req, res) => {
  const { key, phone } = req.body || {};
  if (!keyOk(key)) return res.status(401).json({ error: 'Wrong test key' });
  if (!testPhoneOk(phone)) return res.status(400).json({ error: 'Bad request' });
  const c = await conversations.findByPhone(phone);
  if (c) await require('./src/airtable').del(config.airtable.tables.conversations, c.id);
  res.json({ ok: true });
});

async function handle(ev) {
  if (ev.kind === 'echo') return handleEcho(ev);
  if (config.adminNumbers.includes(ev.from) && /^#\w/.test(ev.text || '')) return handleAdmin(ev);
  return handleCustomer(ev);
}

// A person replied from the WhatsApp Business app: Joy steps back for a while and
// remembers what was said, so she has the full picture if she picks the chat up again.
async function handleEcho(ev) {
  const conv = await conversations.load(ev.to);
  const history = [...conv.history, { role: 'assistant', content: `[Sent as Joy by Janet from the WhatsApp Business app]: ${ev.text}` }];
  const pausedForGood = conv.fields['Bot paused'] && !conv.fields['Paused until'];
  await conversations.save(conv, history, pausedForGood ? {} : {
    'Bot paused': true,
    'Paused reason': 'The team replied from the WhatsApp Business app',
    'Paused until': new Date(Date.now() + config.humanTakeoverHours * 3600 * 1000).toISOString(),
  });
}

async function handleAdmin(ev) {
  const [cmd, arg] = ev.text.trim().split(/\s+/);
  const target = arg ? phoneDigits(arg) : null;
  const say = t => wa.sendText(ev.from, t);
  switch (cmd.toLowerCase()) {
    case '#release':
    case '#resume': {
      if (!target) return say('Usage: #release 07XXXXXXXX');
      const c = await conversations.findByPhone(target);
      if (!c) return say(`No chat found for +${target}.`);
      await conversations.release(c);
      return say(`✓ Joy is back on in the chat with +${target}.`);
    }
    case '#pause':
    case '#takeover': {
      if (!target) return say('Usage: #pause 07XXXXXXXX');
      const c = await conversations.load(target);
      await conversations.pause(c, 'Paused by the team (#pause)');
      return say(`✓ Joy is paused in the chat with +${target}. Send #release ${target} to hand it back.`);
    }
    case '#status': {
      const airtable = require('./src/airtable');
      const recs = await airtable.list(config.airtable.tables.conversations, { formula: 'OR({Bot paused}, {Needs attention})', fields: ['Phone', 'Name', 'Paused reason', 'Paused until', 'Needs attention'], maxRecords: 20 });
      if (!recs.length) return say('All chats are with Joy. Nothing needs you right now ✓');
      return say(recs.map(r => `• +${r.fields.Phone}${r.fields.Name ? ` (${r.fields.Name})` : ''}${r.fields['Needs attention'] ? ' ⚠️' : ''}\n  ${r.fields['Paused reason'] || ''}${r.fields['Paused until'] ? ` — until ${r.fields['Paused until'].slice(0, 16).replace('T', ' ')} UTC` : ''}`).join('\n'));
    }
    default:
      return say('Commands:\n#status — chats waiting for you\n#pause 07XXXXXXXX — Joy stops replying to that number\n#release 07XXXXXXXX — hand the chat back to Joy');
  }
}

async function buildUserContent(ev) {
  const text = ev.text || '';
  switch (ev.type) {
    case 'text':
    case 'button':
    case 'interactive':
      return { content: text, logText: text };
    case 'image':
      try {
        const img = await wa.downloadMedia(ev.mediaId);
        return {
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } },
            { type: 'text', text: text ? `[Photo with caption]: ${text}` : '[The customer sent this photo.]' },
          ],
          logText: `[photo] ${text}`.trim(),
        };
      } catch (e) {
        console.error('[media]', e.message);
        return { content: `[The customer sent a photo that could not be opened.] ${text}`.trim(), logText: '[photo — failed to open]' };
      }
    case 'location': {
      const l = ev.location || {};
      const t = `[The customer shared a location pin: latitude ${l.lat}, longitude ${l.lng}${l.name ? `, "${l.name}"` : ''}${l.address ? `, ${l.address}` : ''}]`;
      return { content: t, logText: t };
    }
    case 'audio':
      return { content: '[The customer sent a voice note. Voice notes cannot be played here — kindly ask them to type their message.]', logText: '[voice note]' };
    default:
      return { content: `[The customer sent a ${ev.type} message that can't be shown here.] ${text}`.trim(), logText: `[${ev.type}]` };
  }
}

async function handleCustomer(ev) {
  const conv = await conversations.load(ev.from);
  const { content, logText } = await buildUserContent(ev);
  await conversations.setFields(conv, {
    'Last message at': new Date((ev.timestamp || Date.now() / 1000) * 1000).toISOString(),
    'Last customer message': logText.slice(0, 5000),
    ...(ev.name && !conv.fields.Name ? { Name: ev.name } : {}),
  });

  // Paused (a person is handling this chat): remember the message, stay quiet.
  if (conversations.isPaused(conv)) {
    await conversations.save(conv, [...conv.history, { role: 'user', content }]);
    return;
  }
  if (conv.fields['Bot paused']) await conversations.release(conv); // a timed pause has run out

  await wa.markReadAndTyping(ev.id);
  try {
    const out = await agent.reply({ conv, phone: ev.from, profileName: ev.name || conv.fields.Name, userContent: content, text: ev.text });
    if (out.refused) {
      await conversations.save(conv, [...conv.history, { role: 'user', content }]);
      await wa.sendText(ev.from, "Let me check on this and get back to you in a few minutes.");
      await conversations.pause(conv, 'Joy could not answer this message (model declined)');
      await conversations.setFields(conv, { 'Needs attention': true });
      await notifyAdmins(`🙋 Chat needs you — +${ev.from}: Joy couldn't answer "${logText.slice(0, 200)}". Joy is paused there; send #release ${ev.from} to hand it back.`);
      return;
    }
    if (out.text) await wa.sendText(ev.from, out.text);
    await conversations.save(conv, out.messages);
  } catch (e) {
    console.error(`[agent +${ev.from}]`, e);
    await conversations.save(conv, [...conv.history, { role: 'user', content }]).catch(() => {});
    await wa.sendText(ev.from, "Let me check on this and get back to you in a few minutes.").catch(() => {});
    await notifyAdmins(`⚠️ Joy hit an error replying to +${ev.from}: ${e.message.slice(0, 200)}\nTheir message: "${logText.slice(0, 200)}"`);
  }
}

if (require.main === module) {
  const missing = missingSettings();
  if (missing.length) console.warn(`⚠️  Missing settings: ${missing.join(', ')}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY is not set');
  app.listen(config.port, () => console.log(`Joy is listening on port ${config.port} (model ${config.claude.model}${config.dryRun ? ', DRY RUN' : ''})`));
  if (config.airtable.token && config.airtable.baseId) { restock.start(); payments.start(); }
}

module.exports = { app, handle };
