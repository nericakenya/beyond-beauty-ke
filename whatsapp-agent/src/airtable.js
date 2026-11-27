// Minimal Airtable REST client (records only — no schema changes).
const { config } = require('./config');

const API = 'https://api.airtable.com/v0';

async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/${config.airtable.baseId}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.airtable.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    // Airtable allows 5 requests/second per base; back off on 429
    if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Airtable ${method} ${path.split('?')[0]} failed (${res.status}): ${JSON.stringify(data.error || data).slice(0, 300)}`);
    return data;
  }
}

async function list(table, { formula, fields, maxRecords, sort } = {}) {
  const records = [];
  let offset;
  do {
    const p = new URLSearchParams();
    if (formula) p.set('filterByFormula', formula);
    if (maxRecords) p.set('maxRecords', String(maxRecords));
    (fields || []).forEach(f => p.append('fields[]', f));
    (sort || []).forEach((s, i) => { p.set(`sort[${i}][field]`, s.field); p.set(`sort[${i}][direction]`, s.direction || 'asc'); });
    if (offset) p.set('offset', offset);
    const data = await call('GET', `${table}?${p}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset && (!maxRecords || records.length < maxRecords));
  return records;
}

const get = (table, id) => call('GET', `${table}/${id}`);
const create = (table, fields) => call('POST', table, { fields, typecast: true });
const update = (table, id, fields) => call('PATCH', `${table}/${id}`, { fields, typecast: true });

async function createMany(table, fieldsList) {
  const out = [];
  for (let i = 0; i < fieldsList.length; i += 10) {
    const data = await call('POST', table, { records: fieldsList.slice(i, i + 10).map(fields => ({ fields })), typecast: true });
    out.push(...data.records);
  }
  return out;
}

// For formulas: quote a string value safely
const str = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const del = (table, id) => call('DELETE', `${table}/${id}`);

module.exports = { list, get, create, update, createMany, del, str };
