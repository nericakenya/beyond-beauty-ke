# WhatsApp Shopping Agent — Twilio + Claude

A production-ready WhatsApp shopping agent that greets customers, handles product enquiries, collects delivery details, and provides M-Pesa payment instructions — powered by Claude AI and Twilio.

---

## Architecture

```
Customer WhatsApp
      │
      ▼
  Twilio API  ──── POST /webhook/whatsapp ────►  Express server
                                                      │
                                              sessionStore.js
                                              (conversation history)
                                                      │
                                               agent.js
                                          (Claude claude-sonnet-4-20250514)
                                                      │
                                              Reply sent back
                                            via Twilio REST API
```

---

## Prerequisites

- Node.js 18+
- A [Twilio account](https://www.twilio.com) with a WhatsApp-enabled number (Sandbox works for testing)
- An [Anthropic API key](https://console.anthropic.com)
- A public HTTPS URL for the webhook (use [ngrok](https://ngrok.com) during development)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | From your Twilio Console dashboard |
| `TWILIO_AUTH_TOKEN` | From your Twilio Console dashboard |
| `TWILIO_WHATSAPP_NUMBER` | Your Twilio WhatsApp sender, e.g. `whatsapp:+14155238886` |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `BUSINESS_NAME` | Your shop name, e.g. `Zawadi Boutique` |
| `MPESA_TILL_NUMBER` | Your M-Pesa till number |
| `DELIVERY_NOTES` | Delivery timelines and any logistics info |

### 3. Start the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

---

## Exposing your local server for testing

Twilio needs a public HTTPS URL to send webhooks to. Use ngrok during development:

```bash
# Install ngrok if you haven't
npm install -g ngrok

# Expose port 3000
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL — you'll need it in the next step.

---

## Configuring Twilio

### Option A — WhatsApp Sandbox (quickest for testing)

1. In the Twilio Console, go to **Messaging → Try it out → Send a WhatsApp message**
2. Follow the sandbox join instructions on your phone
3. Set the **"When a message comes in"** webhook to:
   ```
   https://your-ngrok-url.ngrok.io/webhook/whatsapp
   ```
   Method: **HTTP POST**
4. Save.

### Option B — Production WhatsApp Business number

1. In the Twilio Console, go to **Messaging → Senders → WhatsApp Senders**
2. Add your approved WhatsApp Business number
3. Under the number settings, set the incoming message webhook to:
   ```
   https://yourdomain.com/webhook/whatsapp
   ```
   Method: **HTTP POST**

---

## Conversation flow

```
Customer arrives (routed from website)
         │
         ▼
  Agent greets warmly
         │
  Customer shares product link or asks about item
         │
         ▼
  Agent replies with:
  • Product name & price
  • M-Pesa till number + exact amount to send
  • Request for full name & delivery address
         │
  Customer provides address
         │
         ▼
  Agent confirms order summary and awaits payment
```

Customer can type **cancel**, **stop**, **quit**, or **exit** at any time to clear their session.

---

## Extending the agent

### Add a product catalogue

Edit `src/agent.js` → `buildSystemPrompt()` to inject product data:

```js
const products = await db.getProducts(); // fetch from your database
const productList = products.map(p => `- ${p.name}: KES ${p.price}`).join('\n');

return `...You carry the following products:\n${productList}\n...`;
```

### Persist sessions to Redis

Replace `src/sessionStore.js` with a Redis client:

```js
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);

async function getSession(phone) {
  const data = await client.get(`session:${phone}`);
  return data ? JSON.parse(data) : { phone, history: [], greeted: false };
}

async function saveSession(phone, session) {
  await client.set(`session:${phone}`, JSON.stringify(session), 'EX', 86400);
}
```

### Add order tracking

When the agent confirms an order, write it to your database:

```js
// In server.js, after getting the reply:
if (session.orderState === 'confirmed') {
  await db.createOrder({ phone: customerNumber, ...session.orderDetails });
}
```

---

## Deployment

Any Node.js host works. Recommended options:

| Platform | Notes |
|---|---|
| **Railway** | `railway up` — zero config, free tier available |
| **Render** | Free tier, auto-deploys from GitHub |
| **Fly.io** | Global edge, great for low-latency |
| **AWS / GCP** | Full control, use for high volume |

Make sure to set all `.env` variables as environment variables in your hosting platform's dashboard.

---

## Project structure

```
whatsapp-agent/
├── src/
│   ├── server.js        ← Express server + Twilio webhook handler
│   ├── agent.js         ← Claude API integration
│   └── sessionStore.js  ← Per-customer conversation history
├── .env.example         ← Environment variable template
├── package.json
└── README.md
```

---

## Security notes

- Twilio signature validation is enabled by default — do not disable in production
- Never commit your `.env` file (add it to `.gitignore`)
- Rotate your `TWILIO_AUTH_TOKEN` immediately if it's ever exposed
- Consider rate-limiting the webhook endpoint to prevent abuse
