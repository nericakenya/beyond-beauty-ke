// Joy's reply loop: Claude with tools, until there is a text reply for the customer.
const Anthropic = require('@anthropic-ai/sdk');
const { config, business } = require('./config');
const { SYSTEM_PROMPT } = require('./prompt');
const { TOOLS, runTool } = require('./tools');

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const toolNames = new Map(TOOLS.map(t => [t.name.toLowerCase(), t.name]));

// ── Context for each reply (sent as a mid-conversation system message, so the cached
//    system prompt never changes) ──────────────────────────────────────────────────────
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nairobiNow(now = new Date()) {
  const d = new Date(now.getTime() + 3 * 3600 * 1000); // Nairobi is UTC+3 all year
  return { day: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60, label: `${DAYS[d.getUTCDay()]} ${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}` };
}

// Weekdays 8–18, weekends 8–16 (Nairobi time).
function withinBusinessHours({ day, hour }) {
  const h = business.hours;
  return day >= 1 && day <= 5 ? hour >= h.weekdayOpen && hour < h.weekdayClose : hour >= h.weekendOpen && hour < h.weekendClose;
}

// When an order placed now is processed: within hours today; after closing, the next day
// (Friday evening → Saturday, Sunday evening → Monday).
function dispatchDay(now) {
  const h = business.hours;
  const weekend = now.day === 0 || now.day === 6;
  const open = weekend ? h.weekendOpen : h.weekdayOpen;
  const close = weekend ? h.weekendClose : h.weekdayClose;
  if (now.hour < open) return 'today, from 8am';
  if (now.hour < close) return 'today';
  return `tomorrow (${DAYS[(now.day + 1) % 7]})`;
}

function messageSource(text) {
  if (/I['’]d like to place an order/i.test(text || '')) return 'website checkout';
  if (/I'm interested in/i.test(text || '')) return 'website product page';
  return 'direct WhatsApp message';
}

function contextNote({ phone, profileName, conv, text }) {
  const now = nairobiNow();
  return [
    'Context for this reply (from the system, not from the customer):',
    `• Time in Nairobi: ${now.label} — ${withinBusinessHours(now) ? 'within business hours' : 'outside business hours'}. An order placed now is processed ${dispatchDay(now)}.`,
    `• Customer WhatsApp number: +${phone}${profileName ? `; WhatsApp name: ${profileName}` : ''}.`,
    `• ${conv.history.length ? 'Returning chat (earlier messages above).' : 'First message in this chat — end your reply with the sign-off "Joy, Beyond Beauty".'}`,
    `• This message looks like: ${messageSource(text)}.`,
    conv.fields['Web Ref'] ? `• Latest order reference in this chat: ${conv.fields['Web Ref']} (use my_orders for its status).` : null,
  ].filter(Boolean).join('\n');
}

// ── The loop ────────────────────────────────────────────────────────────────────────
async function reply({ conv, phone, profileName, userContent, text }) {
  // The most recent website checkout message in this chat (this message or an earlier one)
  const lastCheckout = [{ content: text }, ...[...conv.history].reverse()].map(m => typeof m.content === 'string' ? m.content : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
    .find(t => /I['’]d like to place an order/i.test(t || '')) || null;
  const ctx = { phone, profileName, conv, checkoutText: lastCheckout };
  const messages = [
    ...conv.history,
    { role: 'user', content: userContent },
    { role: 'system', content: contextNote({ phone, profileName, conv, text }) },
  ];

  for (let round = 0; round < config.claude.maxToolRounds; round++) {
    const res = await client.beta.messages.create({
      model: config.claude.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: config.claude.effort },
      cache_control: { type: 'ephemeral' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    });

    if (res.stop_reason === 'refusal') {
      console.warn(`[agent] refusal (${res.stop_details?.category || 'no category'}) for +${phone}`);
      return { text: null, refused: true, messages };
    }

    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason === 'pause_turn') continue;
    if (res.stop_reason === 'tool_use') {
      const calls = res.content.filter(b => b.type === 'tool_use');
      const results = await Promise.all(calls.map(async call => {
        const name = toolNames.get(call.name.toLowerCase()) || call.name;
        try {
          const out = await runTool(name, call.input || {}, ctx);
          return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out) };
        } catch (e) {
          console.error(`[tool ${name}]`, e.message);
          return { type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Tool failed: ${e.message}. If it keeps failing, tell the customer "Let me check on this and get back to you in a few minutes." and use handoff_to_human.` };
        }
      }));
      messages.push({ role: 'user', content: results });
      continue;
    }

    const textOut = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n\n').trim();
    if (res.stop_reason === 'max_tokens' && !textOut) throw new Error('Reply hit max_tokens with no text');
    return { text: textOut, messages, usage: res.usage };
  }
  throw new Error(`No reply after ${config.claude.maxToolRounds} tool rounds`);
}

module.exports = { reply, contextNote, messageSource, withinBusinessHours, dispatchDay, nairobiNow };
