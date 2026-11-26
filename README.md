# Beyond Beauty KE — website

The shop at [beyondbeauty.co.ke](https://beyondbeauty.co.ke): a Node.js / Express server that serves the pages in `public/` and reads products, menus and collections from Airtable.

## Layout

| Path | What it is |
|---|---|
| `server.js` | Express entry point, page routes, product link previews |
| `routes/` | API routes: products, menu, homepage, orders, payments (M-Pesa Daraja), Thriftly, notifications |
| `public/` | Shop pages (home, product, collection, checkout, policies, Thriftly) |
| `airtable-automations/` | Scripts that run inside Airtable automations |
| `scripts/` | One-off maintenance and export scripts |
| `whatsapp-agent/` | WhatsApp sales agent ("Joy") — separate app, hosted separately |

## Checkout

Checkout sends the order to WhatsApp (+254 114 481515). Delivery fees and free-delivery thresholds are set in `public/checkout.html` and `routes/orders.js` — keep them in step with `public/policies/delivery-refund.html`.

## Running locally

```
npm install
cp .env.example .env   # only if .env does not exist yet — never overwrite a real .env
npm start
```

See `SETUP.md` for environment variables.

## Deploying

Pushing to `main` on GitHub deploys to Truehost by FTP within seconds (`.github/workflows/deploy.yml`). Static files go live at once; changes to `server.js` or `routes/` need one app restart in cPanel → Setup Node.js App.
