require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const path = require('path');
const { createListing, uploadPhotoFromUrl } = require(path.join(__dirname, '../../thriftly/airtable'));

const LISTING_FEE  = Number(process.env.THRIFTLY_LISTING_FEE) || 250;
const SHORTCODE    = process.env.MPESA_SHORTCODE || '174379';
const MIN_PHOTOS   = Number(process.env.THRIFTLY_MIN_PHOTOS) || 3;
const MAX_PHOTOS   = Number(process.env.THRIFTLY_MAX_PHOTOS) || 5;

const CATEGORIES = ['Bags', 'Shoes', 'Clothing', 'Jewellery', 'Accessories', 'Hair', 'Skincare & Beauty', 'Other'];

const CONDITIONS = [
  'New with Tags',
  'New with Defects',
  'Like New / Mint Condition',
  'Used in Good Condition',
  'Used Condition',
  'Heavily Used Condition',
  'Used and Needs Repair',
];

const TRIGGERS = ['sell', 'list', 'thriftly', 'thrift'];

const STATES = [
  'COLLECT_NAME', 'COLLECT_PHONE', 'COLLECT_ID', 'COLLECT_LOCATION',
  'COLLECT_TITLE', 'COLLECT_CONDITION', 'COLLECT_DESC', 'COLLECT_CATEGORY', 'COLLECT_PRICE',
  'COLLECT_PHOTOS', 'AWAIT_PAYMENT', 'COMPLETE',
];

// ── Active sessions: from -> { state, data, photos: [{url, filename}] }
const tlSessions = new Map();

function isTrigger(text) {
  return TRIGGERS.includes(text.toLowerCase().trim());
}

function hasActiveSession(from) {
  return tlSessions.has(from);
}

function normalisePhone(raw) {
  let p = raw.replace(/\s|-/g, '').replace(/^\+/, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);
  return p;
}

function prompt(state, data) {
  switch (state) {
    case 'COLLECT_NAME':
      return `Welcome to *Thriftly* by Beyond Beauty KE!\n\nYou can list a preloved fashion or beauty item and reach thousands of shoppers.\n\nListing fee: *KES ${LISTING_FEE}* (paid at the end)\n\nLet's get started. What is your *full name*?`;

    case 'COLLECT_PHONE':
      return `Thanks ${data.seller_name}! What is your *M-Pesa phone number*? (This is where buyers' payments will be confirmed)`;

    case 'COLLECT_ID':
      return `What is your *National ID number*? (Required for seller verification)`;

    case 'COLLECT_LOCATION':
      return `Which area are you located in?\n_(e.g. Westlands Nairobi, Mombasa CBD, Kisumu)_`;

    case 'COLLECT_TITLE':
      return `Great! Now tell me — what are you selling?\n\nGive it a short *item title* (e.g. _Black Leather Tote Bag_, _Nike Air Max Size 42_)`;

    case 'COLLECT_CONDITION':
      return `What is the *condition* of your item? Reply with a number:\n\n${CONDITIONS.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    case 'COLLECT_DESC':
      return `Describe your item in detail — *condition*, brand, size, colour, any flaws. The more detail, the faster it sells!`;

    case 'COLLECT_CATEGORY':
      return `Which *category* does it fall under? Reply with the number:\n\n${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    case 'COLLECT_PRICE':
      return `What is your *asking price in KES*?\n_(e.g. 1500)_`;

    case 'COLLECT_PHOTOS':
      return `Almost there! Please send your item photos — *at least ${MIN_PHOTOS}*, up to ${MAX_PHOTOS}.\n\nSend them *one at a time*. When you're done, type *DONE*.`;

    case 'AWAIT_PAYMENT':
      return `Your listing is saved! Last step — pay the *KES ${LISTING_FEE} listing fee*:\n\n*Paybill:* ${SHORTCODE}\n*Account:* THRIFTLY\n*Amount:* KES ${LISTING_FEE}\n\nOnce paid, send your *M-Pesa confirmation code* here (e.g. _QBR7X2ABCD_) and your listing will go live within 24 hours.`;

    default:
      return null;
  }
}

// ── Main handler — returns { reply, done } or null if not a thriftly message
async function handle(from, messageText, mediaItems) {
  const text = (messageText || '').trim();

  // Exit command (any state)
  if (['cancel', 'quit', 'stop', 'exit'].includes(text.toLowerCase())) {
    if (tlSessions.has(from)) {
      tlSessions.delete(from);
      return { reply: 'No problem! Your Thriftly session has been cancelled. Type *SELL* any time to start again.' };
    }
    return null;
  }

  // Start new session
  if (!tlSessions.has(from) && isTrigger(text)) {
    const session = { state: 'COLLECT_NAME', data: {}, photos: [] };
    tlSessions.set(from, session);
    return { reply: prompt('COLLECT_NAME', {}) };
  }

  // Not in session — not our message
  if (!tlSessions.has(from)) return null;

  const session = tlSessions.get(from);
  const state   = session.state;

  // ── PHOTO COLLECTION STATE ─────────────────────────────────────────────────
  if (state === 'COLLECT_PHOTOS') {
    // User typed DONE
    if (text.toLowerCase() === 'done') {
      if (session.photos.length < MIN_PHOTOS) {
        return { reply: `You've added ${session.photos.length} photo${session.photos.length === 1 ? '' : 's'}. Please send at least ${MIN_PHOTOS} before typing DONE.` };
      }
      session.state = 'AWAIT_PAYMENT';
      // Create Airtable record now
      try {
        const record = await createListing({
          seller_name:        session.data.seller_name,
          seller_phone:       session.data.seller_phone,
          seller_id_number:   session.data.seller_id,
          seller_location:    session.data.seller_location,
          whatsapp_number:    from.replace('whatsapp:', ''),
          item_title:         session.data.item_title,
          item_condition:     session.data.item_condition,
          item_description:   session.data.item_desc,
          item_category:      session.data.item_category,
          item_price_kes:     session.data.item_price,
          submission_channel: 'whatsapp',
          listing_fee_paid:   false,
          status:             'pending_review',
        }, session.photos.map((p, i) => ({ url: p.url, filename: `photo_${i + 1}.jpg` })));
        session.data.recordId = record.id;
      } catch (err) {
        console.error('[ThriftlyFlow] Airtable create failed:', err.message);
        return { reply: 'Sorry, there was an issue saving your listing. Please try again later or contact us directly.' };
      }
      return { reply: prompt('AWAIT_PAYMENT', session.data) };
    }

    // Incoming photo
    if (mediaItems && mediaItems.length > 0) {
      if (session.photos.length >= MAX_PHOTOS) {
        return { reply: `You've already added ${MAX_PHOTOS} photos (the maximum). Type *DONE* to continue.` };
      }
      session.photos.push(...mediaItems.slice(0, MAX_PHOTOS - session.photos.length));
      const count = session.photos.length;
      if (count >= MIN_PHOTOS) {
        return { reply: `Photo ${count} received! You can send up to ${MAX_PHOTOS - count} more, or type *DONE* to continue.` };
      } else {
        return { reply: `Photo ${count} received! Send ${MIN_PHOTOS - count} more (minimum ${MIN_PHOTOS} required).` };
      }
    }

    return { reply: `Please send a photo, or type *DONE* if you've finished (minimum ${MIN_PHOTOS} required — you have ${session.photos.length} so far).` };
  }

  // ── PAYMENT WAIT STATE ─────────────────────────────────────────────────────
  if (state === 'AWAIT_PAYMENT') {
    // Expect an M-Pesa confirmation code (uppercase alphanumeric, 10 chars)
    const mpesaCode = text.match(/\b([A-Z0-9]{10})\b/)?.[1] || (text.length >= 8 && text.length <= 14 && /^[A-Z0-9]+$/i.test(text) ? text.toUpperCase() : null);
    if (!mpesaCode) {
      return { reply: `Please send your *M-Pesa confirmation code* (e.g. _QBR7X2ABCD_) to activate your listing.\n\nIf you haven't paid yet:\n*Paybill:* ${SHORTCODE}\n*Account:* THRIFTLY\n*Amount:* KES ${LISTING_FEE}` };
    }
    // Update Airtable
    try {
      const { updateListingStatus } = require(path.join(__dirname, '../../thriftly/airtable'));
      await updateListingStatus(session.data.recordId, 'pending_review', {
        listing_fee_paid:        true,
        mpesa_confirmation_code: mpesaCode,
        mpesa_phone_used:        session.data.seller_phone,
      });
    } catch (err) {
      console.error('[ThriftlyFlow] payment update failed:', err.message);
      return { reply: `Got your code *${mpesaCode}*! We'll verify it manually and activate your listing within 24 hours. Thank you!` };
    }
    session.state = 'COMPLETE';
    tlSessions.delete(from);
    return {
      reply: `Your listing is submitted! We'll review it and have it live within *24 hours*.\n\nYou'll get a WhatsApp notification when it goes live.\n\nThank you for listing on *Thriftly* — Beyond Beauty KE`,
    };
  }

  // ── DATA COLLECTION STATES ─────────────────────────────────────────────────
  switch (state) {
    case 'COLLECT_NAME': {
      if (text.length < 2) return { reply: 'Please enter your full name.' };
      session.data.seller_name = text;
      session.state = 'COLLECT_PHONE';
      return { reply: prompt('COLLECT_PHONE', session.data) };
    }
    case 'COLLECT_PHONE': {
      const digits = text.replace(/\s|-/g, '');
      if (!/^\+?0?[17]\d{8,}$/.test(digits) && !/^\d{9,12}$/.test(digits)) {
        return { reply: 'Please enter a valid Kenyan phone number (e.g. 0712 345 678).' };
      }
      session.data.seller_phone = normalisePhone(text);
      session.state = 'COLLECT_ID';
      return { reply: prompt('COLLECT_ID', session.data) };
    }
    case 'COLLECT_ID': {
      if (!/^\d{7,9}$/.test(text.replace(/\s/g, ''))) {
        return { reply: 'Please enter a valid National ID number (7–9 digits).' };
      }
      session.data.seller_id = text.replace(/\s/g, '');
      session.state = 'COLLECT_LOCATION';
      return { reply: prompt('COLLECT_LOCATION', session.data) };
    }
    case 'COLLECT_LOCATION': {
      if (text.length < 3) return { reply: 'Please enter your location (e.g. Westlands, Nairobi).' };
      session.data.seller_location = text;
      session.state = 'COLLECT_TITLE';
      return { reply: prompt('COLLECT_TITLE', session.data) };
    }
    case 'COLLECT_TITLE': {
      if (text.length < 3) return { reply: 'Please give your item a short title (at least 3 characters).' };
      session.data.item_title = text;
      session.state = 'COLLECT_CONDITION';
      return { reply: prompt('COLLECT_CONDITION', session.data) };
    }
    case 'COLLECT_CONDITION': {
      const n = parseInt(text);
      if (isNaN(n) || n < 1 || n > CONDITIONS.length) {
        return { reply: `Please reply with a number between 1 and ${CONDITIONS.length}:\n\n${CONDITIONS.map((c, i) => `${i + 1}. ${c}`).join('\n')}` };
      }
      session.data.item_condition = CONDITIONS[n - 1];
      session.state = 'COLLECT_DESC';
      return { reply: prompt('COLLECT_DESC', session.data) };
    }
    case 'COLLECT_DESC': {
      if (text.length < 10) return { reply: 'Please describe your item in more detail (condition, brand, size, etc.).' };
      session.data.item_desc = text;
      session.state = 'COLLECT_CATEGORY';
      return { reply: prompt('COLLECT_CATEGORY', session.data) };
    }
    case 'COLLECT_CATEGORY': {
      const n = parseInt(text);
      if (isNaN(n) || n < 1 || n > CATEGORIES.length) {
        return { reply: `Please reply with a number between 1 and ${CATEGORIES.length}:\n\n${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}` };
      }
      session.data.item_category = CATEGORIES[n - 1];
      session.state = 'COLLECT_PRICE';
      return { reply: prompt('COLLECT_PRICE', session.data) };
    }
    case 'COLLECT_PRICE': {
      const price = parseInt(text.replace(/[^0-9]/g, ''));
      if (isNaN(price) || price < 100) {
        return { reply: 'Please enter a valid price in KES (minimum KES 100). e.g. 1500' };
      }
      session.data.item_price = price;
      session.state = 'COLLECT_PHOTOS';
      return { reply: prompt('COLLECT_PHOTOS', session.data) };
    }
  }

  return null;
}

module.exports = { handle, hasActiveSession, isTrigger };
