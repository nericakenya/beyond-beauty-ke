// All settings in one place. Secrets come from the environment (.env locally,
// Railway variables in production) — never write them into code.
require('dotenv').config({ quiet: true });

const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

const config = {
  port: Number(env('PORT', 3000)),

  // Meta WhatsApp Cloud API
  meta: {
    graphVersion: env('META_GRAPH_VERSION', 'v25.0'),
    accessToken: env('META_ACCESS_TOKEN'),          // permanent System User token
    phoneNumberId: env('META_PHONE_NUMBER_ID'),     // test number ID until 0114 481515 is connected
    appSecret: env('META_APP_SECRET'),              // checks the X-Hub-Signature-256 header
    verifyToken: env('META_VERIFY_TOKEN'),          // any string; also typed into the Meta webhook form
    restockTemplate: env('RESTOCK_TEMPLATE_NAME'),  // approved template for back-in-stock alerts (blank until approved)
    restockTemplateLang: env('RESTOCK_TEMPLATE_LANG', 'en_US'),
  },

  // Claude
  claude: {
    model: env('CLAUDE_MODEL', 'claude-sonnet-5-5'),
    effort: env('CLAUDE_EFFORT', 'medium'),
    maxToolRounds: Number(env('CLAUDE_MAX_TOOL_ROUNDS', 8)),
  },

  // Airtable (same base as the shop)
  airtable: {
    token: env('AIRTABLE_TOKEN'),
    baseId: env('AIRTABLE_BASE_ID'),
    tables: {
      conversations: 'tblWzpsllIBx12681',
      customers: 'tbl4kIGQ4LP0uZNGl',
      orders: 'tbl12vYylCAoPJMnX',
      orderItems: 'tblpswAq35mO9IC4L',
      promotions: 'tblwzdanJ3LFbH6GO',
      products: 'tbleE0hPVfKi0xVLA',
      restock: 'tblLxLD6A1xDe6Qnc',
    },
  },

  // The shop's own product API — the agent reads the same prices and stock customers see
  shopUrl: env('SHOP_URL', 'https://beyondbeauty.co.ke').replace(/\/$/, ''),

  // Who gets handoff alerts and may send #commands to the business number
  adminNumbers: env('ADMIN_WHATSAPP', '')
    .split(',').map(s => s.replace(/\D/g, '')).filter(Boolean),

  // After a person replies from the WhatsApp Business app, Joy stays quiet in that chat for this long
  humanTakeoverHours: Number(env('HUMAN_TAKEOVER_HOURS', 12)),

  // Emails (Resend) — back-in-stock alerts by email; off until both are set
  email: {
    resendKey: env('RESEND_API_KEY'),
    from: env('EMAIL_FROM'),          // e.g. Joy at Beyond Beauty <hello@beyondbeauty.co.ke> (domain verified in Resend)
    replyTo: env('EMAIL_REPLY_TO', 'hello@beyondbeauty.co.ke'),
  },

  paymentCheckMinutes: Number(env('PAYMENT_CHECK_MINUTES', 3)), // thank-you after an order is set to Paid; 0 = off

  restockCheckMinutes: Number(env('RESTOCK_CHECK_MINUTES', 720)), // every 12 hours; 0 = off

  testChatKey: env('TEST_CHAT_KEY'), // password for the /test chat page; page is off when blank

  dryRun: env('DRY_RUN', '0') === '1', // log outgoing WhatsApp messages instead of sending
};

// Business rules — keep in step with public/checkout.html and the Delivery & Refund policy
const business = {
  name: 'Beyond Beauty KE',
  persona: 'Joy',
  website: 'https://beyondbeauty.co.ke',
  whatsapp: '+254 114 481515',
  mpesa: { till: '3481515', storeNumber: '4227291', tillName: 'Urembo Luxe Ventures' },
  timezone: 'Africa/Nairobi',
  delivery: {
    cityCentre: { lat: -1.2847, lng: 36.820284 }, // I&M Bank Tower, Kenyatta Avenue
    nairobiKm: 13.5,
    metroKm: 45,
    karenMaxKm: 22,
    zones: {
      nairobi: { label: 'Nairobi', fee: 350, freeFrom: 7500, eta: '1–3 hours during business hours', payment: 'on delivery' },
      metro:   { label: 'Greater Nairobi', fee: 450, freeFrom: 10500, eta: 'same day', payment: 'on delivery' },
      outside: { label: 'Rest of Kenya', fee: 500, freeFrom: null, eta: 'processed within 48 hours', payment: 'full amount before dispatch' },
    },
    promoCancelsFreeDelivery: true,
  },
  // Business hours (Nairobi time), confirmed 2026-11-26: weekdays 8am–6pm, weekends 8am–4pm.
  // Orders within hours are processed the same day; after hours, the next day.
  hours: { weekdayOpen: 8, weekdayClose: 18, weekendOpen: 8, weekendClose: 16 },
  exchangeWindowHours: 24,
  policyUrl: 'https://beyondbeauty.co.ke/policies/delivery-refund',
};

function missingSettings() {
  const required = {
    META_ACCESS_TOKEN: config.meta.accessToken,
    META_PHONE_NUMBER_ID: config.meta.phoneNumberId,
    META_APP_SECRET: config.meta.appSecret,
    META_VERIFY_TOKEN: config.meta.verifyToken,
    AIRTABLE_TOKEN: config.airtable.token,
    AIRTABLE_BASE_ID: config.airtable.baseId,
    ADMIN_WHATSAPP: config.adminNumbers.length ? 'set' : '',
  };
  return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
}

module.exports = { config, business, missingSettings };
