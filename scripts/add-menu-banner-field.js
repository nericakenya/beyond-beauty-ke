#!/usr/bin/env node
/**
 * Adds a "Banner Image" attachment field to the Menu table.
 * Safe to re-run — skips if the field already exists.
 *
 * Run: node scripts/add-menu-banner-field.js
 */
require('dotenv').config();
const axios = require('axios');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const HDR     = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

(async () => {
  const { data: { tables } } = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
    { headers: HDR }
  );
  const menuTbl = tables.find(t => t.name === 'Menu');
  if (!menuTbl) throw new Error('Menu table not found');

  try {
    await axios.post(
      `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${menuTbl.id}/fields`,
      { name: 'Banner Image', type: 'multipleAttachments' },
      { headers: HDR }
    );
    console.log('✅ "Banner Image" field added to Menu table');
  } catch (e) {
    if (e.response?.data?.error?.type === 'DUPLICATE_FIELD_NAME') {
      console.log('~ "Banner Image" already exists — skipped');
    } else {
      throw e;
    }
  }
})().catch(e => {
  console.error('❌', e.response?.data || e.message);
  process.exit(1);
});
