// Alerts to the team (ADMIN_WHATSAPP). WhatsApp only delivers a free-form message to a
// number that has messaged the business number in the last 24 hours, so an alert can fail;
// every alert is also kept in Airtable (Conversations → "Needs attention" / Orders), and
// failures are logged.
const { config } = require('./config');
const wa = require('./whatsapp');

async function notifyAdmins(text) {
  for (const admin of config.adminNumbers) {
    try {
      await wa.sendText(admin, text);
    } catch (e) {
      const hint = e.code === 131047 || /24 hours|re-engagement/i.test(e.message)
        ? ' (the admin has not messaged the business number in the last 24 hours — send it any message to reopen alerts)'
        : '';
      console.error(`[notify] alert to ${admin} failed: ${e.message}${hint}`);
    }
  }
}

module.exports = { notifyAdmins };
