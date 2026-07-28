/**
 * sessionStore.js
 * In-memory store for per-customer conversation history.
 * For production, swap this out for Redis or a database.
 */

const TTL = parseInt(process.env.SESSION_TTL_MS || '86400000', 10); // default 24h

const sessions = new Map();

/**
 * Returns the session object for a customer phone number.
 * Creates a fresh session if none exists.
 */
function getSession(phone) {
  if (sessions.has(phone)) {
    const session = sessions.get(phone);
    session.lastActive = Date.now();
    return session;
  }

  const session = {
    phone,
    history: [],          // Claude message history [{role, content}]
    greeted: false,       // Whether agent has sent the opening greeting
    orderState: 'idle',   // idle | product_shared | awaiting_address | confirmed
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  sessions.set(phone, session);
  return session;
}

/**
 * Appends a message to the customer's conversation history.
 */
function appendMessage(phone, role, content) {
  const session = getSession(phone);
  session.history.push({ role, content });
  session.lastActive = Date.now();
}

/**
 * Clears a customer's session (e.g. after order confirmed or on reset).
 */
function clearSession(phone) {
  sessions.delete(phone);
}

/**
 * Periodically evict sessions that have been idle longer than TTL.
 */
function evictExpired() {
  const now = Date.now();
  for (const [phone, session] of sessions.entries()) {
    if (now - session.lastActive > TTL) {
      sessions.delete(phone);
    }
  }
}

setInterval(evictExpired, 60 * 60 * 1000); // run every hour

module.exports = { getSession, appendMessage, clearSession };
