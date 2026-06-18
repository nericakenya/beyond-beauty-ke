require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

function baseUrl() {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const creds = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');
  const { data } = await axios.get(
    `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  return cachedToken;
}

function timestamp() {
  return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

async function initiateSTKPush({ phone, amount, orderId }) {
  const ts        = timestamp();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  const password  = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64');
  const token     = await getToken();

  const { data } = await axios.post(
    `${baseUrl()}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         ts,
      TransactionType:   'CustomerBuyGoodsOnline',
      Amount:            Math.ceil(amount),
      PartyA:            phone,
      PartyB:            shortcode,
      PhoneNumber:       phone,
      CallBackURL:       process.env.MPESA_CALLBACK_URL,
      AccountReference:  orderId,
      TransactionDesc:   `Order ${orderId}`,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.CheckoutRequestID;
}

module.exports = { initiateSTKPush };
