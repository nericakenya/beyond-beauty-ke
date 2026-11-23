# Beyond Beauty KE — SEO/Technical Audit: Plan of Action

Audited 2026-08-09. No files were modified during this audit. All line references are current as of this commit.

## Summary table (ranked by SEO impact)

| # | Finding | Severity | Status | Effort (hrs) | Depends on |
|---|---|---|---|---|---|
| 1 | Products/categories are 100% client-side rendered — no crawlable content in initial HTML, no slug URLs | Critical | Confirmed | 24–32 | — |
| 2 | No `<meta description>`, OG tags, or canonical URLs anywhere; `<title>` identical across every route | Critical | Confirmed | *(bundled with #1 Phase 1, see below)* | — |
| 3 | No `robots.txt` in the repo at all | Critical | Confirmed | 1 | — |
| 4 | `sitemap.xml` is static, hand-authored, only 4 URLs — no products/categories, never auto-updates | High | Confirmed | 6 | #1 (needs stable URLs) |
| 5 | No IndexNow (or any) ping on product change | Medium | Not found | 4–6 | #1, #4 (needs stable URLs) |
| 6 | No HTTPS-enforcing / www-canonicalizing middleware in the app | Medium | Partially confirmed | 2 | Clarify hosting first |
| 7 | Broken `href="#"` links (How to Order, Size Guide, TikTok) + `placehold.co` fallback images | Medium | Confirmed | 3–5 | Content decisions |
| 8 | Performance: no image dimensions/inconsistent lazy-load, no WebP, weak cache headers, GTM duplicated 8×, large inline JS/CSS | Medium | Confirmed | 6–10 (quick wins) + 8–16 (WebP, separate project) | — |

**Total estimated effort: ~52–70 hours** for everything except the optional WebP/image-proxy project.

---

## Finding-by-finding detail

### 1 & 2. Client-side rendering + missing title/meta/OG/canonical

**Current state:** `public/index.html`, `product.html`, `collection.html` ship an empty shell; all content and `document.title` are injected by JS after `fetch()`. No route in `server.js` is slug- or ID-aware server-side — `/product` and `/collections/:slug` always return the same static file.

**Recommended fix for this stack:** Server-side templating inside the existing Express routes — no framework change needed.
- The product/category data is already fetched and cached server-side (`getProducts()` in [routes/products.js](routes/products.js), 5-min TTL). Reuse that same function directly inside `server.js`'s route handlers.
- Replace `res.sendFile(...)` for `/`, `/product`, `/collections/:slug`, and the category routes with a small render step: read the HTML file into a string once at boot, and on each request do string replacement (or a minimal templating lib like `ejs`/`mustache` — no build step required) to inject: `<title>`, `<meta description>`, OG tags, `<link rel="canonical">`, and — for Phase 2 — the actual product-card / product-detail HTML markup, so the page is meaningful even with JS disabled. The existing client-side JS keeps working for interactivity (filtering, cart, etc.) — this is progressive enhancement, not a rewrite.
- Add a `Slug` field to the Airtable Products table (mirrors the existing `Slug` field already used on Categories, per `routes/products.js:61`) and switch product URLs from `/product?id=recXXXX` to `/product/<slug>` (Express: `app.get('/product/:slug', ...)`). Keep the old `?id=` query working as a redirect for any already-shared links.

**Phasing (do in two passes so value lands early):**
- *Phase 1 (~8 hrs):* Server-inject unique `<title>`, meta description, OG tags, canonical URL per route (homepage, each category, each product, each collection), using data already available server-side. This alone fixes Check #2 in full and gives crawlers/social previews a real signal even before full content SSR lands.
- *Phase 2 (~16–24 hrs):* Server-render the actual product grid / product detail HTML into the page (not just meta tags), plus slug-based URLs. This is the piece that fixes Check #1 — a bot with JS disabled sees real product names, prices, and descriptions.

**Alternatives considered:**
| Approach | Trade-off |
|---|---|
| **Server-side templating in Express (recommended)** | Reuses existing Airtable cache, no new framework, no build step, matches the fact that Truehost is already running a persistent `server.js` process (not static-only hosting) | Some hand-rolled templating discipline needed since there's no framework doing this for you |
| **Build-time static snapshot** (generate `public/products/<slug>.html` files in CI before the FTP deploy) | Zero runtime rendering cost; works even if the Node process weren't reliably live | Deploys are triggered by *git push*, but product data changes happen in *Airtable* — snapshots would go stale unless you also wire an Airtable→GitHub Action trigger (e.g. `repository_dispatch` from an Airtable automation) to rebuild+redeploy on every product edit. More moving parts than the app already has. |
| **Third-party prerendering service** (e.g. Prerender.io — serves a pre-rendered snapshot to bots only, via `User-Agent` sniffing) | Fastest to stand up (hours, not days), no code changes to rendering logic | Ongoing subscription cost, another external dependency, doesn't fix the "no meta tags in real HTML" problem for anyone using view-source or a non-whitelisted crawler; treat as a stop-gap at best |

Given the app already runs a live Node process on Truehost (confirmed by working `/api/*` routes), server-side templating is the natural fit — recommend it over the static-snapshot or third-party options.

---

### 3. robots.txt

**Current state:** File doesn't exist anywhere in the repo or (implied) on the live site.

**Recommended fix:** Add `public/robots.txt` — it will be served automatically at `/robots.txt` via the existing `express.static(public/)` call ([server.js:11](server.js#L11)), no route code needed.

Suggested content (allow all the named crawlers, point at the sitemap, keep `/admin` and `/checkout` out of the index):
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: OAI-SearchBot
Allow: /

Sitemap: https://beyondbeauty.co.ke/sitemap.xml
```
**Effort:** ~1 hr (mostly deciding on Disallow scope — recommend also confirming `/admin` requires the `ADMIN_KEY` at the route level, not just for API calls; currently `app.get('/admin', ...)` in `server.js:25` has no auth guard on the HTML shell itself).

**Alternative:** None meaningful — this is a static file, there's no real alternative approach.

---

### 4. Sitemap automation

**Current state:** `public/sitemap.xml` is a static, 4-URL file with no generator.

**Recommended fix:** Add a small Express route `GET /sitemap.xml` that generates the XML on request from the same cached `getProducts()` / `getResolvedCollections()` data already used by the homepage API, including every product (via its new slug URL from Fix #1), every category, and the 3 policy pages. Cache it in-memory with the same 5-min TTL pattern already used elsewhere in the codebase (`routes/products.js`, `routes/homepage.js`) so it doesn't add Airtable load. This naturally stays in sync — no separate "regenerate on change" step needed since it's built fresh (or from cache) on every crawler request.

**Effort:** ~6 hrs (mostly the XML-building function + wiring in URLs from Fix #1/#3).

**Alternative:** Pre-generate a static `sitemap.xml` file on a schedule (cron / `setInterval`, similar to `pollRestock()`) and write it to `public/`. Trade-off: slightly less "always fresh" than generating on-request, but avoids any per-request Airtable dependency risk. Given the site already has a working in-memory cache pattern, the on-request route is simpler and just as reliable — recommend that over a cron file-writer.

---

### 5. IndexNow readiness

**Current state:** No implementation. Best available trigger points are the Airtable automations in `airtable-automations/` (`badge-on-inventory-change.js`, `badge-on-price-change.js`) which already fire on every product create/update — they just don't make outbound HTTP calls today.

**Recommended fix:** Extend those existing Airtable automation scripts to POST the product's canonical URL (from Fix #1's slug scheme) to the IndexNow API (`https://api.indexnow.org/indexnow`) whenever a record is created, updated, or archived. Requires: (a) generating an IndexNow key and hosting the key file at `https://beyondbeauty.co.ke/<key>.txt` (drop it in `public/`, same static-serving mechanism as robots.txt), (b) adding the `fetch`/HTTP call to the automation scripts.

**Effort:** ~4–6 hrs (mostly Airtable automation scripting + testing).

**Alternative:** Trigger the ping from the Node app instead — e.g. inside `/api/products/refresh` ([routes/products.js:311](routes/products.js#L311)) or a new webhook endpoint that Airtable calls. Trade-off: `/refresh` today is manually triggered by an admin, not automatic, so this would need Airtable to call *out* to a new Node webhook anyway (extra endpoint + auth to build) — no real advantage over pinging IndexNow directly from Airtable, which is simpler and has one fewer hop. Recommend the direct Airtable→IndexNow route.

**Note:** This only becomes valuable once Fix #1/#4 give products stable, real URLs — sequence it after those.

---

### 6. HTTPS and redirects

**Current state:** No hardcoded `http://` URLs found in the current repo (worth re-checking the *live* site directly, since the version you observed may differ from what's in this repo, or may be cached). No HTTPS-enforcing or www-canonicalizing middleware in `server.js`. No `.htaccess`. Enforcement, if any, lives entirely at the Truehost hosting-panel level — unverifiable from code alone.

**Recommended fix:** Add a small Express middleware near the top of `server.js` (after `app.use(cors())`, before the static middleware) that checks `req.headers['x-forwarded-proto']` (Truehost likely proxies through Apache/LiteSpeed) and redirects `http→https` and `www→non-www` (or vice versa, per your canonical choice) with a 301. This is cheap, framework-independent, and acts as a safety net even if/when the host-level config is also fixed.

**Effort:** ~2 hrs, but **blocked on a clarifying question** — see below, since redirect logic differs depending on whether Truehost already terminates TLS and sets `x-forwarded-proto`, or whether the Node process sees raw HTTP.

**Alternative:** Configure the redirect purely at the Truehost/cPanel level (Force HTTPS toggle + `.htaccess` `RewriteRule` for www). Trade-off: keeps the concern out of application code (arguably cleaner), but it's invisible to this repo and to future contributors, and cPanel panels vary in reliability. Recommend doing **both** — host-level as the primary, Express middleware as a defense-in-depth fallback — given the low cost of the latter.

---

### 7. Broken links and placeholder content

**Current state:** 28 `href="#"` instances; "How to Order," "Size Guide," and "TikTok" footer links are dead on every page; checkout.html additionally has two dead links that work correctly elsewhere in the site. `placehold.co` is used only as an `onerror` image fallback (6 files), not primary content, but still signals an unfinished asset pipeline.

**Recommended fix:** This is a content/asset task, not really an engineering one — the code paths (footer template, repeated across every HTML file since there's no shared partial) are trivial to fix once content exists:
- "How to Order" / "Size Guide": either write the copy as new sections/modals, or link to existing content if it lives somewhere else already (see clarifying questions).
- "TikTok": needs the real handle URL.
- Replace `placehold.co` fallback with a locally-hosted branded placeholder image (`public/images/...`) so the fallback doesn't depend on a third-party service's uptime.

**Effort:** ~3–5 hrs of engineering (once content/URLs are supplied) — mostly repetitive edits across 5–8 files since there's no shared header/footer partial. **Worth noting as a side-effect of Fix #1's templating work:** once you introduce server-side rendering, extracting a shared footer partial (rendered once, injected everywhere) removes this "same fix in 8 files" problem going forward.

**Alternative:** None — these need real content, not a different technical approach.

---

### 8. Performance basics

**Current state:** No `width`/`height` on `<img>` tags (layout shift risk), inconsistent `loading="lazy"`, raw Airtable image URLs (no WebP/AVIF), GTM snippet hand-duplicated in 8 files, `express.static` has no explicit cache headers, large inline `<script>`/`<style>` blocks (~85KB/~48KB in index.html alone), no minification/build step.

**Recommended fix (quick wins, ~6–10 hrs):**
- Add `width`/`height` (or `aspect-ratio` CSS) to all product images — the dimensions are already known from Airtable attachment metadata, just not being passed through in `routes/products.js:193-199`.
- Make `loading="lazy"` consistent (add to product.html's hero gallery image and any other gaps); keep it *off* only for above-the-fold hero images per best practice.
- Add `express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true })` (or similar) in `server.js:11` for basic HTTP caching — cheap, immediate.
- Move `<script src="/js/tracking.js">` to end of `<body>` or add `defer`, and move the GTM snippet after `<meta charset>` (currently first thing in `<head>`, which is a minor HTML-spec ordering issue).

**Recommended fix (larger, optional, ~8–16 hrs):** WebP/AVIF conversion needs an image-processing step somewhere, since Airtable doesn't serve resized/re-encoded formats. Cheapest option: put a free image CDN/proxy in front of the Airtable URLs (e.g. Cloudflare Images, or `images.weserv.nl` as a zero-infra proxy) — swap `image_url`/`images[].thumb` in `routes/products.js` to route through the proxy with `?output=webp`. Trade-off: adds a third-party dependency and a network hop, but requires no new infrastructure of your own and is close to a one-line change in `mapRecord()`.

**GTM duplication:** Once Fix #1's server-side templating/shared-partial work lands, the GTM snippet becomes one include instead of 8 copies — sequence this cleanup after Fix #1 rather than doing it twice.

---

## Suggested implementation order

1. **robots.txt** (Fix #3) — trivial, immediate, unblocks/directs crawlers today. *(1 hr)*
2. **Title/meta/OG/canonical injection — Phase 1 of Fix #1/#2** — highest SEO leverage per hour, doesn't require the URL-scheme change yet. *(8 hrs)*
3. **Full content SSR + slug-based product URLs — Phase 2 of Fix #1** — the core structural fix. *(16–24 hrs)*
4. **Dynamic sitemap.xml** (Fix #4) — needs the stable slugs from step 3. *(6 hrs)*
5. **IndexNow via Airtable automations** (Fix #5) — needs stable URLs from steps 3–4. *(4–6 hrs)*
6. **HTTPS/www middleware** (Fix #6) — independent, but confirm hosting behavior first (see questions below). *(2 hrs)*
7. **Broken links + placeholder image** (Fix #7) — independent, content-gated. *(3–5 hrs)*
8. **Performance quick wins** (Fix #8) — do alongside/after step 3, since the shared-partial refactor naturally fixes GTM duplication too. *(6–10 hrs, +8–16 optional for WebP)*

---

## Clarifying questions

1. **Hosting reality check:** `README.md`/`SETUP.md` describe deploying to Render.com with SQLite, but `.github/workflows/deploy.yml` shows a plain FTP push to a Truehost host. Which is actually live in production today? Specifically: is Truehost running `server.js` as a persistent Node process (e.g. via cPanel's "Setup Node.js App"/Passenger), or is only `public/` being served as static files with `/api/*` failing? This determines whether server-side rendering (Fix #1's recommended approach) is even possible as designed.
2. **HTTPS/www at the host level:** Does Truehost/cPanel already force HTTPS and canonicalize www↔non-www today? (Can't be verified from code — no `.htaccess` in the repo.)
3. **Product slugs:** Is there already a `Slug` field on the Airtable Products table (there is one on Categories, per `routes/products.js:61`), or does one need to be added and backfilled for existing products?
4. **Content for dead links:** Does "How to Order" / "Size Guide" content already exist somewhere (a doc, a page on another platform) that just needs linking, or does it need to be written from scratch? What's the correct TikTok URL?
5. **Search Console / Bing Webmaster Tools:** Is the domain already verified in Google Search Console and Bing Webmaster Tools? (Needed to submit the new sitemap and to get a baseline on current indexing/impact.)
6. **IndexNow key hosting:** Any preference between generating the IndexNow key file via the Node app vs. just dropping a static `<key>.txt` into `public/` (simpler, recommended above)?
7. **Deploy cadence:** Since `deploy.yml` only fires on `git push` to `main`, and product content changes happen in Airtable (no code push), does that raise any concern for you beyond what's already covered by Fix #1's server-rendering-on-request approach (which sidesteps this entirely by not needing a redeploy per product change)?
