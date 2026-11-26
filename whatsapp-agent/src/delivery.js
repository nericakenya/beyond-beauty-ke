// Delivery zones and fees — the same rules as the website checkout (public/checkout.html):
// straight-line distance from the city centre, with Karen charged the Nairobi rate.
const { business } = require('./config');

const D = business.delivery;

function kmFromCentre(lat, lng) {
  const rad = d => d * Math.PI / 180;
  const c = D.cityCentre;
  const dLat = rad(lat - c.lat), dLng = rad(lng - c.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(c.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function zoneFor({ lat, lng, inNairobiCounty = false, text = '' }) {
  const km = kmFromCentre(lat, lng);
  if (km <= D.nairobiKm) return { zone: 'nairobi', km };
  if (inNairobiCounty && km <= D.karenMaxKm && /\bkaren\b/i.test(text)) return { zone: 'nairobi', km };
  return { zone: km <= D.metroKm ? 'metro' : 'outside', km };
}

// Delivery fee for a subtotal. A promo code cancels free delivery.
function deliveryFee(zone, subtotal, { promoUsed = false } = {}) {
  const z = D.zones[zone];
  if (!z) throw new Error(`Unknown delivery zone "${zone}"`);
  const free = z.freeFrom != null && subtotal >= z.freeFrom && !(promoUsed && D.promoCancelsFreeDelivery);
  return free ? 0 : z.fee;
}

function zoneSummary(zone) {
  const z = D.zones[zone];
  return {
    zone, area: z.label, fee: z.fee,
    free_delivery: z.freeFrom == null ? 'not available for this area' : `on orders over KSh ${z.freeFrom.toLocaleString('en-KE')} (not when a promo code is used)`,
    timing: z.eta,
    payment: z.payment,
  };
}

// Matches the label the website puts in the checkout message, e.g. "Delivery (Greater Nairobi): KSh 450"
function zoneFromLabel(label) {
  const l = (label || '').toLowerCase().trim();
  if (l === 'greater nairobi') return 'metro';
  if (l === 'nairobi') return 'nairobi';
  if (l === 'rest of kenya') return 'outside';
  return null;
}

// Looks a place up on OpenStreetMap (Nominatim). Low volume only: Nominatim allows ~1 request/second.
let lastGeocode = 0;
async function geocode(place) {
  const wait = 1100 - (Date.now() - lastGeocode);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeocode = Date.now();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: place, countrycodes: 'ke', format: 'jsonv2', limit: '1', addressdetails: '1' });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BeyondBeautyKE-WhatsAppAgent/2.0 (+https://beyondbeauty.co.ke)', 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const [hit] = await res.json();
  if (!hit) return null;
  const a = hit.address || {};
  return {
    lat: Number(hit.lat), lng: Number(hit.lon),
    name: hit.display_name,
    inNairobiCounty: /nairobi/i.test(`${a.state || ''} ${a.county || ''} ${a.city || ''}`),
  };
}

// Quote for a typed place name, or for a pin (lat/lng) the customer shared.
async function quote({ location, lat, lng }) {
  let place;
  if (lat != null && lng != null) {
    place = { lat, lng, name: location || 'shared location', inNairobiCounty: kmFromCentre(lat, lng) <= D.karenMaxKm };
  } else {
    place = await geocode(location);
    if (!place) return { found: false, message: `Couldn't find "${location}" on the map. Ask for a nearby landmark, estate or road, or a shared WhatsApp location pin.` };
  }
  const { zone, km } = zoneFor({ ...place, text: `${location || ''} ${place.name}` });
  return { found: true, matched_place: place.name, km_from_city_centre: Math.round(km * 10) / 10, ...zoneSummary(zone) };
}

module.exports = { kmFromCentre, zoneFor, deliveryFee, zoneSummary, zoneFromLabel, quote };
