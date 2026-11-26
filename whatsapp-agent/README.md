# Joy — Beyond Beauty KE's WhatsApp sales agent

Joy answers customers on WhatsApp day and night: product questions, prices and stock (live from the shop), delivery fees, promo codes, taking orders into Airtable, and logging M-Pesa payments for the team to verify. She hands a chat to the team when a person is needed.

```
Customer on WhatsApp ──► Meta WhatsApp Cloud API ──► POST /webhook (this app, on Railway)
                                                        │
                                Claude (claude-sonnet-5-5) + tools:
                                  search_products / get_product ─► beyondbeauty.co.ke/api/products
                                  quote_delivery                 ─► same zones & fees as checkout
                                  check_promo                    ─► Airtable Promotions
                                  create_order / my_orders       ─► Airtable Customers, Orders, Order Items
                                  log_payment_claim              ─► Orders."Payment claim" (unverified)
                                  handoff_to_human               ─► pauses Joy + WhatsApp alert to the team
                                                        │
                                   reply ◄──────────────┘     chat memory ─► Airtable Conversations
```

Prices, totals and delivery fees are always calculated in code from live data — never by the model.

**Handovers are silent.** When Joy needs you, she tells the customer "Let me check on this and get back to you in a few minutes", pauses herself in that chat and alerts you. You continue the chat as Joy; the customer is never told about a handover. (If a customer sincerely asks whether they're talking to a bot, Joy hands that question to you rather than claiming to be human.)

**Back-in-stock alerts.** Requests come from Joy (`restock_alert`) and from the website's "Notify me" button, and are stored in Airtable **Restock Requests**. Every 12 hours Joy checks stock and messages everyone waiting for something that's back. Customers who chatted in the last 24 hours get a normal message; others need the approved template below — until it is approved, Joy alerts you instead so you can message them yourself.

## What the team does

| You want to… | Do this |
|---|---|
| See chats waiting for you | Send `#status` to the business number from the admin phone, or filter Airtable **Conversations** by *Needs attention* |
| Take over a chat | Just reply from the WhatsApp Business app — Joy goes quiet in that chat for 12 hours. Or send `#pause 07XXXXXXXX` |
| Hand a chat back to Joy | Send `#release 07XXXXXXXX` (or untick *Bot paused* in Conversations) |
| Confirm a payment | Check the till statement against Orders → *Payment claim*, then set *Payment Status* = Paid, and send "Your payment is well received…" as Joy |
| See who's waiting for restocks | Airtable **Restock Requests** (Status = Waiting). Joy messages them automatically when stock is back |

New orders arrive in Airtable as **Pending**, with a *Web Ref* and no *Order Number* (number them as usual). Joy never marks anything paid.

## Setup

### 1. Meta (developers.facebook.com)
1. **My Apps → Create app** → use case *Connect with customers through WhatsApp* → link the *Urembo Luxe Ventures* business portfolio.
2. **WhatsApp → API Setup**: note the **test number's Phone number ID**. Under *To*, add the phones allowed to chat with the test number (up to 5) — include your own number (the one in ADMIN_WHATSAPP).
3. **App settings → Basic**: copy the **App secret**.
4. **Permanent token**: business.facebook.com → Settings → Users → **System users** → Add (Admin) → *Assign assets*: the app (full control) and the WhatsApp account (full control) → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`. (The token on the API Setup page expires after 24 hours.)
5. After Railway is running (step 2): **WhatsApp → Configuration → Webhook** → Callback URL `https://<your-railway-domain>/webhook`, Verify token = your `META_VERIFY_TOKEN` → Verify and save → **subscribe to `messages`** (later, when 0114 481515 is connected with coexistence, also `smb_message_echoes`).

6. **Back-in-stock template**: WhatsApp Manager → Message templates → Create → category **Marketing** (Meta treats back-in-stock as marketing; about US$0.02 per message in Kenya), name `back_in_stock`, language English, body:
   `Hi {{1}}, good news! {{2}} is back in stock at Beyond Beauty. You can order it here: {{3}} or simply reply to this message. Joy, Beyond Beauty`
   (sample values: Amina / Mia Mini Bag (Black) / https://beyondbeauty.co.ke/product?id=…). Once approved, set `RESTOCK_TEMPLATE_NAME=back_in_stock` on Railway.

⚠️ Do **not** add 0114 481515 on the API Setup page — that would take it off the WhatsApp Business app. It is connected later through the coexistence ("connect existing WhatsApp Business app") flow.

### 2. Railway (railway.com)
1. **New project → Deploy from GitHub repo** → `nericakenya/beyond-beauty-ke`.
2. Service **Settings**: *Root Directory* `whatsapp-agent`; *Region* EU West (closest to Kenya); *Healthcheck path* `/health`.
3. **Variables**: add every name in `.env.example` with real values (Raw Editor accepts the whole list).
4. **Networking → Generate domain** → use it in Meta step 5.
5. Open `https://<domain>/health` — `missing_settings` should be empty.

### 3. Test
From an allowed phone, message the test number: "Hi, is the Mia Mini Bag available?", then send a website checkout message, a location pin, and a screenshot of an M-Pesa message. Watch Airtable Orders and Conversations.

## Local development

```
cp .env.example .env    # only if .env doesn't exist — never overwrite a real one
npm install
npm test                # rules: zones, fees, promos, totals, parsing (no keys needed)
DRY_RUN=1 npm run dev   # replies are printed instead of sent
```

Settings live in `src/config.js` (delivery fees and thresholds must match `public/checkout.html` and the Delivery & Refund policy). Joy's business rules are in `src/prompt.js`; how she writes is in `prompt/tone.md` and `prompt/examples.md` — adapted from `JOY_TONE_OF_VOICE.md` and `JOY_EXAMPLE_CONVERSATIONS.md` in the project root (built from 113 real chats), corrected to today's fees and rules. Edit the files in `prompt/`, not the root originals, to change what Joy does.

## Not yet built
- M-Pesa STK push in the chat (Phase 2)
- Order status updates outside the 24-hour window (needs approved utility templates)
- "Join Thriftly" listing flow, website chat widget
