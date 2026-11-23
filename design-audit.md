# Beyond Beauty KE — Design Audit

Audited 21 November 2026. No site files were changed. The numbers come from the styles inside the 10 customer-facing pages in `public/` (the admin page is excluded).

**Palette confirmed on 21 November 2026:** white, near-black `#0e0e0e`, grey `#6b6560`, gold `#b5853a`. This matches the "Beyond Beauty" design system, so its token names are used below. The taupe/beige palette in the earlier brief is dropped.

---

## 1. Summary

| Area | Today | Target |
|---|---|---|
| Where styles live | Inside each page, 10 separate copies | One shared stylesheet |
| Colours | 46 different hex values | 12 named tokens |
| Text sizes | 31 | 8 |
| Spacing values | 38 | 10 |
| Letter-spacing values | 17 | 5 |
| Font weights used / loaded | 6 used, 3 loaded | 3 used, 3 loaded |
| Corner radius values | 6 | 2 |
| Shadows | 6 | 0 or 1 |
| Stacking levels (z-index) | 14 | 7 |
| Breakpoints | 6, mixed directions | 2, mobile-first |
| Button styles | 12 class names | 3 variants |
| Product card | 2 versions that differ | 1 |

The five problems that cost sales on phones, in order:

1. **Checkout fields are 13px**, so iPhones zoom the page every time a field is tapped.
2. **There is no way to add to bag from the shop grid on a phone**, and the product page has no sticky buy bar. The Add to Bag button scrolls out of reach.
3. **The shop's product feed is 1.18MB** and loads every product, description and image link up front. Fetching it for this audit took 15 seconds and timed out once at 40 seconds (one connection, not a lab test).
4. **The hero image `slide-1.png` is 2MB.**
5. **Small text is very small and some of it is too faint.** 11px is the most common size, and seven colour pairs fail the contrast standard (section 3).

---

## 2. How the site is built

- Plain HTML pages served by Express. There is no build step and no template engine.
- Each page carries its own `<style>` block and its own copy of the colour variables. The copies have drifted: the policy pages add `--bronze`, `--sand` and `--blush`; checkout adds `--red` and `--wa`; checkout's page background is `#f7f7f5` while every other page is white.
- The header, menu drawer, bag panel, footer, WhatsApp button and toast are copied into five pages (home, collection, product, checkout, Thriftly item).
- Product cards and bag rows are built from text templates inside each page's script, so there are styles in three places: the `<style>` block, 94 `style="…"` attributes, and the script templates.

| Page | CSS size | Raw hex colours | Uses of variables | `style=""` attributes |
|---|---|---|---|---|
| `index.html` (home + shop grid) | 49KB | 79 | 248 | 35 |
| `product.html` | 27KB | 49 | 157 | 10 |
| `collection.html` | 19KB | 33 | 112 | 4 |
| `thriftly/item.html` | 17KB | 44 | 88 | 11 |
| `checkout.html` | 15KB | 26 | 100 | 7 |
| `policies/*.html` (3 pages) | 5–6KB each | 10 each | 33–40 | 2 each |
| `thriftly/confirm.html`, `dispatch.html` | 2–3KB | 24, 18 | 0 | 13, 8 |

The two Thriftly confirmation pages use no variables at all.

---

## 3. Colour

### What is in use

| Current value | Uses | Role today | Maps to token |
|---|---|---|---|
| `--black` `#0e0e0e` | 185 | Text, buttons, footer | `ink` |
| `--white` / `#fff` / `#ffffff` | 128 + 54 raw | Page, button text | `surface` |
| `--mid` `#6b6560` | 116 | Secondary text, prices | `ink-muted` |
| `--border` `#e8e4df` | 94 | Rules, field borders | `hairline` / `surface-stone` |
| `--accent` `#b5853a` | 64 + 11 raw | Sale, active nav, labels | `gold` |
| `--light` `#c8c4be` | 35 | Faint text, disabled | Retire as a text colour (fails contrast) |
| `#1a1a1a` | 32 | Badges, Thriftly buttons | `badge-sold-out` / `ink` |
| `#25d366`, `#128c7e` | 28, 6 | WhatsApp buttons | New token `whatsapp` (decision 1) |
| `#333` | 16 | Hover on black buttons | `ink` (hover inverts instead) |
| `#f9f7f5`, `#f8f5f2`, `#f0ede9`, `#f7f7f5`, `#f5f5f5`, `#fafafa`, `#f9f5f0`, `#fafbfb` | 39 in total | Eight near-identical off-whites | One token: `surface-soft` |
| `#c9956e`, `#a8733f`, `#b8946a` | 10, 7, 4 | Thriftly accents, New In and Coming Soon badges | `gold` or `gold-print` |
| `#c62828`, `#dc2626`, `#c0392b`, `#991b1b` | 13 in total | Errors | One token: `danger` |
| `#16a34a`, `#2e7d32`, `#166534` | 7 in total | Success, Selling Fast badge | One token: `success` |
| `#2563eb` | 5 | "Only X left" badge | `badge-low-stock` |
| `#444`–`#eee` (eight greys) | 26 in total | Assorted text and borders | `ink-muted` or `hairline` |
| `--sand`, `--blush`, `--bronze` | 17 | Policy pages only | Decision 4 |

### Contrast

The standard is 4.5:1 for normal text and 3:1 for text of 24px or more.

| Pair | Ratio | Result | Where |
|---|---|---|---|
| `#0e0e0e` on white | 19.3:1 | Pass | Body text |
| `#6b6560` on white | 5.7:1 | Pass | Prices, labels |
| Gold `#b5853a` on white | 3.3:1 | Fails for small text | Sale prices at 13px, step labels at 10px |
| White on gold | 3.3:1 | Fails | Sale badge at 9px |
| `#c8c4be` on white | 1.7:1 | Fails | Item condition, "coming soon" menu text |
| White on `#25d366` | 2.0:1 | Fails | Checkout's main button, "Open WhatsApp & Send Order" |
| White on `#16a34a` | 3.3:1 | Fails | Selling Fast badge |
| White on `#b8946a` | 2.8:1 | Fails | Coming Soon badge |
| White on `#a8733f` | 4.1:1 | Fails narrowly | New In badge |
| White on `#2563eb` | 5.2:1 | Pass | Only X Left badge |

**Fix for gold:** keep `#b5853a` for large text, underlines and marks, and use the design system's deeper `gold-print` `#916a2e` (4.9:1) wherever gold text is under 24px.

---

## 4. Type

### Sizes

| Size | Uses | Proposed |
|---|---|---|
| 9px, 10px | 19, 27 | 10px for badges only; everything else 12px |
| 11px | 111 | 12px (capitals labels, buttons, nav) |
| 12px, 13px | 58, 55 | 14px |
| 14px, 15px | 34, 23 | 14px for product names and prices; 16px for body copy and all form fields |
| 16px | 2 | 16px |
| 17px, 18px | 2, 13 | 18px |
| 20px, 22px | 3, 14 | 22px |
| 26px, 28px | 1, 1 | 28px |
| 32px, 48px | 1, 5 | 36px |
| 15 different `clamp()` formulas | 22 | 3 fluid steps: 22→28, 28→36, 36→48 |

Proposed scale: **10 / 12 / 14 / 16 / 18 / 22 / 28 / 36**. This departs from the design system, which records the live site's 9px badges and 11px nav. Those sizes are what the site does today and are too small on a phone; the system should be updated to match.

### Weights and fonts

- Weights 600, 700 and 800 are used 39 times, but only 300, 400 and 500 are loaded, so the browser draws a fake bold. Weight 300 is loaded and used 3 times.
- Five Cormorant Garamond styles load from Google Fonts on every page. The design system needs three: 400, 500 and 400 italic.
- **Fix:** load Jost 400/500/600 and Cormorant 400/500/400-italic, host them on the site, and replace 700 and 800 with 600.

### Letter-spacing and line-height

- 17 letter-spacing values. `.14em` (40 uses), `.1em` (25) and `.2em` (22) lead. Proposed set, from the design system: **0, 0.05em, 0.12em, 0.15em, 0.2em**.
- 12 line-height values. Proposed: **1** (buttons, badges), **1.3** (headings), **1.5** (body).

---

## 5. Spacing, shape and layers

**Spacing.** Top values: 16px (141 uses), 40px (72), 20px (67), 24px (65), 10px (64), 12px (60), 14px (51), 32px (45), 8px (44). Proposed scale: **4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64**. Values off the scale and where they go: 5–7px → 4 or 8; 9–11px → 8 or 12; 13–15px → 12 or 16; 18px → 16 or 20; 22px → 24; 28–30px → 32; 36px → 32 or 40; 56–60px → 64.

**Radius.** Square corners (the brand rule) and circles cover 34 of 53 uses. The 8px, 10px and 16px corners are all in the Thriftly pop-ups and payment box (decision 2).

**Shadows.** Six, used 20 times: the bag panel, pop-ups and a green glow on the WhatsApp button. The design system says no shadows (decision 3).

**Layers.** 14 z-index values (1, 2, 3, 10, 50, 89, 99, 100, 200, 300, 301, 400, 401, 500). Proposed named layers: base, sticky header, floating button, overlay, drawer, pop-up, toast.

**Motion.** `.2s` covers 130 of 170 transitions. Proposed: 150ms, 200ms, 300ms. The `.55s` image zoom on hover has no effect on phones.

---

## 6. Breakpoints

In use: `max-width` 480, 768, 900 and 1023; `min-width` 769 and 1024. Most pages are written desktop-first, then corrected for phones with `max-width` blocks. The product, collection and Thriftly item pages also switch layout at 900, while the rest switch only at 768.

Proposed: write the phone layout as the default, then add **`min-width: 768px`** and **`min-width: 1024px`**. Nothing else.

---

## 7. Components

| Component | What exists today | Problem |
|---|---|---|
| Button | `.btn-primary`, `.cart-checkout-btn`, `.load-more-btn`, `.quick-btn`, `.product-add-btn`, `.notify-btn`, `.buy-pay-btn`, `.buy-retry-btn`, `.btn-whatsapp`, `.quick-whatsapp`, `.btn-wa`, `.wa-fab-btn` | Padding ranges from 9px to 18px; text from 10px to 15px; three different blacks; letter-spacing from none to `.18em`. Three variants are enough: primary, outline, text. |
| Product card | One in `index.html`, one in `collection.html` | The shop card has a heart and a second image but no button on phones. The collection card has a button but no heart and no second image. |
| Badge | Seven colours | Four fail contrast. Shop and product pages each define the same seven classes separately. |
| Form field | `.form-input`, `.form-select`, `.form-textarea` | 13px text, 10px labels. |
| Quantity stepper | `.qty-btn` | 26×26px. The minimum comfortable tap size is 44×44px. |
| Other small tap targets | Gallery arrows 36px; the card heart (a small icon with 6px padding); the collection page's Add to Bag (9px padding around 10px text) | Under 44px. |
| Header, drawer, bag panel, footer, toast | Copied into five pages | Any change must be made five times. |
| Price | `fmt()` writes "KSh 2,450" | Consistent, but the function is redefined in each page. |

---

## 8. Phone experience and speed

- The second product photo on shop cards only appears on hover, so phone visitors never see it.
- Quick-add is hidden on phones (`.product-quick { display: none }`).
- The product page's two buttons sit in the page flow with no sticky bar.
- The WhatsApp floating button sits bottom-right on every page and will collide with a sticky buy bar unless the two are designed together.
- Product images carry no width and height, so the page jumps as they load.
- Static files are served with no cache or compression settings in `server.js`.
- Good things already in place: correct `tel` and `email` field types with autofill, 44px header and drawer buttons, reduced-motion support on every main page, and lazy-loaded card images.

---

## 9. Decisions needed

1. **WhatsApp green.** Keep `#25d366` as a named colour for WhatsApp actions only (with dark text, since white on it fails), or draw WhatsApp buttons as black outline as the design system does?
2. **Thriftly's rounded corners.** Square them to match the brand, or keep Thriftly visually separate?
3. **Shadows.** Remove them all, or keep one soft shadow for the bag panel and pop-ups?
4. **Policy pages' sand and blush.** Not in the confirmed palette. Replace with `surface-stone`?
5. **Type floor.** Agree to 12px minimum (10px for badges) and 16px form fields, and update the design system to match?

---

## 10. Order of work

Each step ships on its own and can be checked before the next.

| Step | What changes | Visible change |
|---|---|---|
| 0 | Add `public/css/tokens.css` with today's exact values under the new names. Link it from every page and delete the per-page variable blocks. | None |
| 1 | Quick fixes: 16px checkout fields, load the right font weights, compress the hero image, fix white-on-green button text. | Small |
| 2 | Add `public/css/components.css`: buttons, then badges, then one product card (with one shared card template in `public/js/`). | Cards and buttons become identical everywhere |
| 3 | One shared header, drawer, bag panel and footer. | None |
| 4 | Snap type and spacing to the scales, one page type at a time: product, shop and collection, checkout, home, Thriftly, policies. | Text gets larger |
| 5 | Rewrite each page's breakpoints mobile-first as it is touched in step 4. | None |
| 6 | New phone features on the clean base: swipeable card photos, quick-add sheet, sticky buy bar. | Yes |

A Node audit script (`scripts/design-audit.js`) should be written at step 0 and re-run after each step. It reports the counts in section 1, so progress is measurable.
