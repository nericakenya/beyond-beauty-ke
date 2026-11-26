// One Conversations row per customer phone: chat memory for Joy, and whether Joy is paused.
const { config } = require('./config');
const airtable = require('./airtable');

const T = config.airtable.tables.conversations;
const MAX_HISTORY_CHARS = 60000;  // Airtable long text holds 100k; keep well under
const MAX_TOOL_RESULT_CHARS = 1500;

async function load(phone) {
  const recs = await airtable.list(T, { formula: `{Phone} = ${airtable.str(phone)}`, maxRecords: 1 });
  const rec = recs[0] || await airtable.create(T, { Phone: phone });
  let history = [];
  try { history = JSON.parse(rec.fields.History || '[]'); } catch { history = []; }
  return { id: rec.id, fields: rec.fields, history };
}

function isPaused(conv, now = Date.now()) {
  if (!conv.fields['Bot paused']) return false;
  const until = conv.fields['Paused until'];
  return !until || new Date(until).getTime() > now;
}

// What is stored between messages: text, tool calls and (shortened) tool results.
// Thinking blocks are left out on purpose: they are only valid inside the reply that made
// them, and this history gets trimmed — so it never replays a thinking block after an edit.
function compact(messages) {
  return messages.map(m => {
    if (typeof m.content === 'string') return m;
    const content = m.content
      .filter(b => b.type !== 'thinking' && b.type !== 'redacted_thinking')
      .map(b => {
        if (b.type === 'image') return { type: 'text', text: '[The customer sent a photo here.]' };
        if (b.type === 'tool_result') {
          const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
          return { ...b, content: text.length > MAX_TOOL_RESULT_CHARS ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}…[shortened]` : text };
        }
        if (b.type === 'text') return { type: 'text', text: b.text };
        if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
        return b;
      });
    return content.length ? { ...m, content } : null;
  }).filter(Boolean);
}

// Drops the oldest exchanges until the history fits, always starting at a plain customer message
// (never at a tool result, which would be orphaned).
function trim(history) {
  let h = history;
  const startsClean = m => m.role === 'user' && (typeof m.content === 'string' || !m.content.some(b => b.type === 'tool_result'));
  while (JSON.stringify(h).length > MAX_HISTORY_CHARS && h.length > 2) {
    let i = 1;
    while (i < h.length && !startsClean(h[i])) i++;
    if (i >= h.length) break;
    h = h.slice(i);
  }
  while (h.length && !startsClean(h[0])) h = h.slice(1);
  return h;
}

async function save(conv, history, extra = {}) {
  const kept = trim(compact(history));
  conv.history = kept;
  await airtable.update(T, conv.id, { History: JSON.stringify(kept), ...extra });
}

async function setFields(conv, fields) {
  await airtable.update(T, conv.id, fields);
  Object.assign(conv.fields, fields);
}

async function pause(conv, reason, hours = null) {
  await setFields(conv, {
    'Bot paused': true,
    'Paused reason': reason,
    'Paused until': hours ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null,
  });
}

async function release(conv) {
  await setFields(conv, { 'Bot paused': false, 'Paused until': null, 'Needs attention': false });
}

async function findByPhone(phone) {
  const recs = await airtable.list(T, { formula: `{Phone} = ${airtable.str(phone)}`, maxRecords: 1 });
  return recs[0] ? { id: recs[0].id, fields: recs[0].fields } : null;
}

// Messages for the same phone are handled one at a time, in order.
const queues = new Map();
function enqueue(phone, task) {
  const prev = queues.get(phone) || Promise.resolve();
  const next = prev.then(task, task).catch(e => console.error(`[queue ${phone}]`, e));
  queues.set(phone, next);
  next.finally(() => { if (queues.get(phone) === next) queues.delete(phone); });
  return next;
}

// Meta re-sends a webhook if it doesn't get a quick 200; skip message IDs already handled.
const seen = new Map();
function alreadySeen(id) {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 24 * 3600 * 1000) seen.delete(k); else break;
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

module.exports = { load, save, setFields, pause, release, isPaused, findByPhone, enqueue, alreadySeen, compact, trim };
