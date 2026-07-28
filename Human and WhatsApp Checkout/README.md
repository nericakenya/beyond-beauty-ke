# Kenyan E-Commerce Checkout — Two Options

Both options solve the same problem: Kenyan consumers prefer not to enter card details on a website. Here's how they differ and exactly how to set each up.

---

## Quick comparison

| | Option 1 — M-Pesa STK Push | Option 2 — WhatsApp redirect |
|---|---|---|
| Customer stays on website | ✅ Yes | ❌ No (moves to WhatsApp) |
| Human feel | Low | High |
| Requires backend server | ✅ Yes | ❌ No (frontend only) |
| Daraja API needed | ✅ Yes | ❌ No |
| Payment confirmed automatically | ✅ Yes | Manual (Claude agent) |
| Best for | High-volume, fast checkout | High-touch, trust-first brands |

---

## Option 1 — M-Pesa STK Push

Customer fills cart → enters phone → receives USSD PIN prompt on phone → approves → order auto-confirmed.

### Files
```
option1-stk-push/
├── checkout.html    ← Drop-in checkout page with phone input + status UI
├── server.js        ← Express: STK Push, Daraja callback, status polling
├── package.json
└── .env.example
```

### Setup

#### Step 1 — Get Daraja credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke) and create an account
2. Create a new app — tick **Lipa Na M-Pesa Sandbox**
3. Copy your **Consumer Key** and **Consumer Secret**
4. Under **Lipa Na M-Pesa Online**, note your **Passkey**
5. Sandbox shortcode: `174379` | Sandbox passkey: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`

#### Step 2 — Configure environment

```bash
cd option1-stk-push
cp .env.example .env
```

Fill in `.env`:
```
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9...
MPESA_CALLBACK_URL=https://YOUR_PUBLIC_URL/api/mpesa/callback
MPESA_ENV=sandbox
```

#### Step 3 — Expose your local server

Safaricom needs to POST the payment result to a public HTTPS URL. Use **ngrok** for development:

```bash
npm install -g ngrok
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL and set it as `MPESA_CALLBACK_URL`.

#### Step 4 — Run the server

```bash
npm install
npm run dev
```

#### Step 5 — Test with sandbox

In the Safaricom sandbox, use test phone number `254708374149` — it auto-approves the STK push without needing a real PIN.

#### Step 6 — Go live

1. Apply for a production Lipa Na M-Pesa account at the Daraja portal
2. Replace sandbox credentials with production ones in `.env`
3. Set `MPESA_ENV=production`
4. Point `MPESA_CALLBACK_URL` to your live domain

### How the payment flow works (technical)

```
Browser                 Your server              Safaricom Daraja
   │                        │                          │
   │──POST /stk-push────────►│                          │
   │                        │──POST /processrequest────►│
   │                        │◄── CheckoutRequestID ─────│
   │◄── checkoutRequestId ──│                          │
   │                        │                    [USSD on phone]
   │──GET /status/:id ──────►│  (polls every 3s)        │
   │◄── PENDING ────────────│                          │
   │                        │◄── POST /callback ────────│
   │                        │   (ResultCode: 0 = paid)  │
   │──GET /status/:id ──────►│                          │
   │◄── SUCCESS ────────────│                          │
```

### Connecting to your cart

In `checkout.html`, replace the hardcoded order summary with your real cart data. The key lines to update:

```javascript
// Replace this line with your actual cart total
const totalText = document.getElementById('order-total').textContent;
const amount = parseInt(totalText.replace(/\D/g, ''), 10);
```

In `server.js`, inside the callback handler, add your order creation logic:

```javascript
if (ResultCode === 0) {
  // Payment confirmed — create the order
  await db.orders.create({
    id:        payment.orderId,
    phone:     payment.phoneUsed,
    amount:    payment.paidAmount,
    receipt:   payment.mpesaReceiptNo,
    status:    'paid',
  });
  await notifyCustomer(payment.phone, payment.orderId);
}
```

---

## Option 2 — WhatsApp cart redirect

Customer fills cart → clicks "Order via WhatsApp" → WhatsApp opens with a pre-filled message containing all cart items and the total → your Claude agent greets them, confirms M-Pesa details, collects address.

### Files
```
option2-whatsapp/
├── checkout.html          ← Example checkout page with the button
└── whatsapp-checkout.js   ← Drop-in script — the only file you really need
```

### Setup

This option has almost no backend setup — it's a URL generator.

#### Step 1 — Add your details to `whatsapp-checkout.js`

Open the file and update the config block at the top:

```javascript
const WHATSAPP_NUMBER = '254712345678'; // Your WhatsApp Business number
const BUSINESS_NAME   = 'Zawadi Boutique';
const MPESA_TILL      = '522522';
const CURRENCY        = 'KES';
const DELIVERY_FEE    = 300;
```

#### Step 2 — Include the script in your checkout page

```html
<script src="whatsapp-checkout.js"></script>
```

#### Step 3 — Add the button

```html
<button onclick="WACheckout.open()">Order via WhatsApp</button>
```

#### Step 4 — Connect your cart data

The script can read cart data in several ways. The easiest is a JSON data attribute:

```html
<div id="cart-data" data-cart='[
  {"name":"Silk Wrap Dress","qty":1,"price":4500},
  {"name":"Leather Belt","qty":2,"price":1200}
]'></div>
```

Or pass items directly when calling open:

```javascript
WACheckout.open([
  { name: 'Silk Wrap Dress', qty: 1, price: 4500 },
  { name: 'Leather Belt',    qty: 2, price: 1200 },
]);
```

#### Step 5 — Set up the WhatsApp agent (already done!)

Point your Twilio WhatsApp number at the Claude agent built earlier (`whatsapp-agent/`). The pre-filled message from the customer will include their cart — the agent will read it and respond with M-Pesa payment details, then ask for a delivery address.

### The pre-filled message it generates

```
Hi Zawadi Boutique! 👋 I'd like to order the following:

• Silk Wrap Dress — KES 4,500
• Leather Belt ×2 — KES 2,400

Subtotal: KES 6,900
Delivery: KES 300
*Total: KES 7,200*

Please send me the M-Pesa payment details and let me know the delivery options.
```

---

## Which option should you choose?

**Go with Option 1 (STK Push) if:**
- Your customers are tech-comfortable and want fast, one-step checkout
- You need automatic order confirmation without human involvement
- You're processing high volumes

**Go with Option 2 (WhatsApp) if:**
- You're selling high-value or complex items where trust matters
- Your brand is built on personal service
- You're just starting out and want zero infrastructure overhead
- Your customers are already messaging you on WhatsApp

**Use both together:**
Many Kenyan businesses offer both options side by side on checkout:
- "Pay directly with M-Pesa →" (Option 1)
- "Or order via WhatsApp 💬" (Option 2)

This gives tech-savvy customers a fast path and less-confident customers a human path.
