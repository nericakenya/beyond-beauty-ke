// Meta WhatsApp Cloud API: signature check, parsing webhooks, sending replies, media download.
const crypto = require('crypto');
const { config } = require('./config');

const graph = path => `https://graph.facebook.com/${config.meta.graphVersion}/${path}`;
const authHeaders = () => ({ Authorization: `Bearer ${config.meta.accessToken}` });

// Meta signs each webhook body with the app secret (header X-Hub-Signature-256: sha256=<hex>)
function validSignature(rawBody, header) {
  if (!config.meta.appSecret || !header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', config.meta.appSecret).update(rawBody).digest('hex');
  const given = header.slice('sha256='.length);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Turns a webhook body into a flat list of events:
//   { kind: 'message', from, name, id, type, text, mediaId, mimeType, location, timestamp }
//   { kind: 'echo', to, id, type, text }   (a person replied from the WhatsApp Business app — coexistence)
function parseWebhook(body) {
  const events = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile?.name]));
      for (const m of v.messages || []) {
        const ev = { kind: 'message', from: m.from, name: names[m.from] || null, id: m.id, type: m.type, timestamp: Number(m.timestamp) || null, text: null };
        if (m.type === 'text') ev.text = m.text?.body || '';
        else if (m.type === 'image' || m.type === 'document' || m.type === 'sticker') { ev.mediaId = m[m.type]?.id; ev.mimeType = m[m.type]?.mime_type; ev.text = m[m.type]?.caption || ''; }
        else if (m.type === 'location') ev.location = { lat: m.location?.latitude, lng: m.location?.longitude, name: m.location?.name, address: m.location?.address };
        else if (m.type === 'button') ev.text = m.button?.text || '';
        else if (m.type === 'interactive') ev.text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
        else if (m.type === 'reaction') continue; // ignore emoji reactions
        events.push(ev);
      }
      for (const e of v.message_echoes || []) {
        events.push({ kind: 'echo', to: e.to, id: e.id, type: e.type, text: e.text?.body || `[${e.type}]` });
      }
    }
  }
  return events;
}

async function post(path, body) {
  const res = await fetch(graph(path), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`WhatsApp API error ${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 200)}`);
    err.code = data.error?.code;
    throw err;
  }
  return data;
}

// WhatsApp allows 4,096 characters; shorter chunks read better on a phone. Splits on blank lines.
function splitMessage(text, max = 1500) {
  const parts = [];
  let cur = '';
  for (const para of String(text).split(/\n{2,}/)) {
    const next = cur ? `${cur}\n\n${para}` : para;
    if (next.length <= max) { cur = next; continue; }
    if (cur) parts.push(cur);
    if (para.length <= max) { cur = para; continue; }
    // A single very long paragraph: cut at line breaks, then spaces
    let rest = para;
    while (rest.length > max) {
      let cut = rest.lastIndexOf('\n', max);
      if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
      if (cut < max / 2) cut = max;
      parts.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    cur = rest;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function sendText(to, text) {
  for (const body of splitMessage(text)) {
    if (config.dryRun) { console.log(`[DRY RUN → ${to}]\n${body}\n`); continue; }
    await post(`${config.meta.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text',
      text: { body, preview_url: true },
    });
  }
}

// An approved message template (needed to message someone who hasn't chatted in 24 hours).
// bodyParams fill {{1}}, {{2}}, … in the template body.
async function sendTemplate(to, name, language, bodyParams = []) {
  if (config.dryRun) { console.log(`[DRY RUN template ${name} → ${to}] ${bodyParams.join(' | ')}`); return; }
  await post(`${config.meta.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp', to, type: 'template',
    template: {
      name, language: { code: language },
      components: bodyParams.length ? [{ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text: String(text) })) }] : [],
    },
  });
}

// Blue ticks + "typing…" while Joy works on the reply
async function markReadAndTyping(messageId) {
  if (config.dryRun) return;
  try {
    await post(`${config.meta.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' },
    });
  } catch (e) {
    console.warn('[wa] mark-read failed:', e.message);
  }
}

// Downloads an image the customer sent; returns { base64, mimeType } (max ~5 MB for Claude)
async function downloadMedia(mediaId) {
  const metaRes = await fetch(graph(mediaId), { headers: authHeaders(), signal: AbortSignal.timeout(15000) });
  if (!metaRes.ok) throw new Error(`Media lookup failed (${metaRes.status})`);
  const meta = await metaRes.json();
  const fileRes = await fetch(meta.url, { headers: authHeaders(), signal: AbortSignal.timeout(30000) });
  if (!fileRes.ok) throw new Error(`Media download failed (${fileRes.status})`);
  const buf = Buffer.from(await fileRes.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error('Image too large');
  return { base64: buf.toString('base64'), mimeType: meta.mime_type || 'image/jpeg' };
}

module.exports = { validSignature, parseWebhook, sendText, sendTemplate, markReadAndTyping, downloadMedia, splitMessage };
