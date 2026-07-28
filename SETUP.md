# Beyond Beauty KE — Setup Guide

## Project Structure

```
Beyond Beauty KE/
├── server.js           ← Express backend (entry point)
├── database.js         ← SQLite database + seeding
├── package.json
├── .env                ← Your secrets (never commit this)
├── routes/
│   ├── products.js     ← GET/POST/PUT/DELETE /api/products
│   ├── orders.js       ← POST /api/orders, GET /api/orders/:id
│   └── payments.js     ← Mpesa STK Push + callback
├── middleware/
│   └── adminAuth.js    ← API key protection for admin routes
└── public/
    ├── index.html      ← Main shop (fetches products from API)
    ├── checkout.html   ← Checkout + Mpesa payment
    └── admin.html      ← Admin dashboard (products + orders)
```

---

## Step 1 — Install Node.js

Download from https://nodejs.org (choose LTS version)

---

## Step 2 — Install dependencies

```bash
cd "Beyond Beauty KE"
npm install
```

---

## Step 3 — Configure .env

Edit the `.env` file:

```env
PORT=3000
BASE_URL=http://localhost:3000      # Change to your Render URL in production

ADMIN_KEY=pick-a-strong-secret-here

# Mpesa — get from https://developer.safaricom.co.ke
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=174379              # Sandbox shortcode
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline

WHATSAPP_NUMBER=254712345678        # Your actual WhatsApp number
```

---

## Step 4 — Run locally

```bash
npm start
# or for auto-restart on changes:
npm run dev
```

Open: http://localhost:3000

- **Shop** → http://localhost:3000/
- **Checkout** → http://localhost:3000/checkout
- **Admin** → http://localhost:3000/admin  (use your ADMIN_KEY)

---

## Step 5 — Mpesa Daraja Setup

1. Register at https://developer.safaricom.co.ke
2. Create an app → get Consumer Key & Consumer Secret
3. For **sandbox testing**:
   - Shortcode: `174379`
   - Passkey: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
   - Test phone: use any Safaricom number in sandbox simulator
4. For the **callback URL** to work locally, use ngrok:
   ```bash
   ngrok http 3000
   # Copy the HTTPS URL → set as BASE_URL in .env
   ```
5. For **production**, switch `MPESA_ENV=production` and use your real credentials

---

## Step 6 — Deploy to Render.com (free hosting)

1. Push this folder to a GitHub repo (exclude `.env` and `*.db`)
2. Go to https://render.com → New → Web Service
3. Connect your repo
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node server.js`
6. Add all your `.env` variables under **Environment**
7. Set `BASE_URL` to your Render URL (e.g. `https://beyond-beauty-ke.onrender.com`)

**Database persistence on Render free tier:** The SQLite `.db` file resets on redeploy.
To keep data between deploys, upgrade to Render's paid plan (adds a persistent disk) or
migrate to a free PostgreSQL service like Supabase (https://supabase.com).

---

## Admin Dashboard

Go to `/admin` and enter your `ADMIN_KEY` to:
- Add, edit, and delete products
- View all orders and update their status (pending → confirmed → dispatched → delivered)
- See revenue and order stats

---

## Mpesa Payment Flow

1. Customer adds items to cart → goes to checkout
2. Fills name, phone, delivery address, M-Pesa number
3. Clicks "Pay via M-Pesa"
4. Server creates the order → calls Safaricom STK Push
5. Customer receives a payment prompt on their phone
6. Customer enters M-Pesa PIN
7. Safaricom POSTs to `/api/payments/mpesa/callback`
8. Order is marked as paid
9. Checkout page polls every 3 seconds and shows confirmation

---

## WhatsApp Number

Update `WHATSAPP_NUMBER` in `.env` with your real number (format: `254712345678`).
Also update the links in `public/index.html` if running without the backend.
