// The /test chat page: talk to Joy in a browser. Same agent, tools and data as WhatsApp;
// her replies (and the team alerts) come back to the page instead of being sent.
module.exports = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Joy — test chat</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#efeae2;color:#111}
  header{background:#0e0e0e;color:#fff;padding:12px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  header b{font-size:16px;margin-right:auto} header input{padding:6px 8px;border-radius:6px;border:0;width:150px}
  header button,form button{background:#25D366;border:0;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:600}
  header button.secondary{background:#555}
  #chat{max-width:760px;margin:0 auto;padding:16px 12px 120px;display:flex;flex-direction:column;gap:8px}
  .msg{max-width:85%;padding:8px 10px;border-radius:8px;white-space:pre-wrap;line-height:1.4;font-size:15px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
  .me{align-self:flex-end;background:#d9fdd3} .joy{align-self:flex-start;background:#fff}
  .janet{align-self:center;background:#fff6d6;border:1px solid #e9c46a;font-size:13px;max-width:95%}
  .janet::before{content:"Alert to Janet";display:block;font-weight:700;font-size:11px;color:#8a6d1a;margin-bottom:4px;text-transform:uppercase}
  .note{align-self:center;color:#666;font-size:12px}
  form{position:fixed;bottom:0;left:0;right:0;background:#f0f2f5;padding:10px;display:flex;gap:8px;max-width:100%}
  form textarea{flex:1;resize:none;height:48px;padding:10px;border-radius:8px;border:1px solid #ccc;font:inherit}
  label.admin{font-size:12px;display:flex;align-items:center;gap:4px;color:#333}
</style></head>
<body>
<header>
  <b>Joy — test chat</b>
  <input id="key" type="password" placeholder="Test key">
  <input id="name" placeholder="Customer name" value="Test Customer">
  <button class="secondary" id="reset" type="button">New customer</button>
</header>
<div id="chat"><div class="note">Messages here go to the real Joy (same prices, stock and rules). Nothing is sent on WhatsApp. Orders made here are marked TEST in Airtable.</div></div>
<form id="f">
  <label class="admin"><input type="checkbox" id="asAdmin">as Janet</label>
  <textarea id="text" placeholder="Type a message (Enter to send, Shift+Enter for a new line)"></textarea>
  <button>Send</button>
</form>
<script>
const $ = id => document.getElementById(id);
$('key').value = localStorage.joyTestKey || '';
const newPhone = () => '2540000' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0');
let phone = localStorage.joyTestPhone || (localStorage.joyTestPhone = newPhone());
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const fmt = s => esc(s).replace(/\\*([^*\\n]+)\\*/g, '<b>$1</b>').replace(/(^|\\s)_([^_\\n]+)_/g, '$1<i>$2</i>');
function add(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = fmt(text); $('chat').appendChild(d); scrollTo(0, document.body.scrollHeight); return d; }
function note(text) { const d = document.createElement('div'); d.className = 'note'; d.textContent = text; $('chat').appendChild(d); scrollTo(0, document.body.scrollHeight); return d; }
note('Customer number for this test: +' + phone);
async function post(path, body) {
  localStorage.joyTestKey = $('key').value;
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: $('key').value, phone, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
$('f').onsubmit = async e => {
  e.preventDefault();
  const text = $('text').value.trim(); if (!text) return;
  const asAdmin = $('asAdmin').checked;
  add('me', (asAdmin ? '[as Janet] ' : '') + text); $('text').value = '';
  const typing = note('Joy is typing…');
  try {
    const { messages } = await post('/test/message', { text, name: $('name').value, asAdmin });
    typing.remove();
    if (!messages.length) note('(Joy sent nothing — e.g. she is paused in this chat)');
    for (const m of messages) add(m.to === 'customer' ? 'joy' : 'janet', m.text);
  } catch (err) { typing.textContent = 'Error: ' + err.message; }
};
$('text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('f').requestSubmit(); } });
$('reset').onclick = async () => {
  try { await post('/test/reset', {}); } catch (err) { /* ignore */ }
  phone = localStorage.joyTestPhone = newPhone();
  $('chat').innerHTML = ''; note('New test customer: +' + phone);
};
</script></body></html>`;
