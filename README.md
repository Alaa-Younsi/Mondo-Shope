# Mondo Shope

Cash-on-delivery e-commerce storefront + admin dashboard for the Algerian
market. Bun + Vite + React 18 + TypeScript (strict), Tailwind, Supabase,
deployed on Vercel.

- **Storefront** — FR default, full Arabic RTL, dark/light theme, COD checkout
  with per-wilaya delivery pricing.
- **Admin dashboard** — products, categories, orders, delivery prices, reviews,
  store settings, Meta pixels, account, and a **landing-page builder**.
- **Landing pages** — the owner builds a campaign page for a chosen product out
  of ordered blocks and publishes it at `/lp/<slug>`, with no redeploy.

---

## Quick start

```bash
bun install
cp .env.example .env      # then fill in real Supabase credentials
bun run dev
```

| Script            | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `bun run dev`     | Vite dev server                                 |
| `bun run build`   | Regenerates the sitemap, typechecks, then builds |
| `bun run typecheck` | `tsc --noEmit`                                |
| `bun run lint`    | ESLint, zero warnings tolerated                 |

> A `.env` with **placeholder** Supabase values is committed to your working
> copy so the app boots before the project exists. Replace both values or
> nothing will load. `.env` is gitignored.

---

## Architecture notes worth knowing

**Theming.** No Tailwind `dark:` variants anywhere. Colours are RGB triplets in
CSS variables swapped by a `data-theme` attribute on `<html>`
(`src/theme/ThemeProvider.tsx`), mapped into Tailwind in `tailwind.config.ts`.
Every component just uses `bg-panel`, `text-ink`, `border-line`, `text-brand`.

**Prices must never render raw.** Always `<Price value={n} />`
(`src/components/ui/Price.tsx`). `formatPrice()` produces `"4 500 DA"` — digits,
a space, a Latin suffix — which the Unicode Bidi Algorithm reorders into
`"DA 500 4"` under the Arabic layout. The component pins `dir="ltr"`.

**RTL.** Prefer logical Tailwind properties (`ms-*`, `ps-*`, `start-*`) — they
flip automatically. Physical CSS (`left`/`right`) and framer-motion offsets
(`x: "-100%"`) do **not**; every slide-in panel branches on `dir` explicitly.

**Server-side pricing.** The browser never sends a price. `place_order()`
(`supabase/migrations/0003_functions.sql`) re-looks up every product, applies
quantity offers, prices shipping from `delivery_prices`, and computes the total
itself. `src/lib/offers.ts` mirrors the offer math for optimistic UI totals
only — **if one changes, change both.**

**One shipping rule.** `resolveShipping()` in `src/hooks/useStoreSettings.ts` is
used by every checkout surface and mirrors the server exactly. "No wilaya
picked" renders as `—`; genuinely free shipping renders as "Offerte". They must
never collapse into the same dash.

**One checkout engine.** `src/components/checkout/CheckoutForm.tsx` is shared by
the cart checkout, the product page's buy-now, and the landing-page order form.
Built once on purpose: a guard can't be fixed in one and forgotten in another.

**Admin writes.** Every `supabase.from(...)` write checks `error` and reports it
through `useAdminToast()` — an unchecked failure leaves the form closed and the
stale value on screen looking saved. Write payloads are built by explicit column
mappers (`toFormState`), never by spreading a row loaded with `select("*")`;
PostgREST rejects the whole update if the body names an embedded relation, which
makes every edit a silent no-op while creation keeps working.

---

## Security model

Read `supabase/migrations/0002_rls.sql` before changing anything here.

- Writes are gated on an explicit **`admin_users` allow-list**, checked by a
  `SECURITY DEFINER is_admin()` helper in every policy — not on the blanket
  "any authenticated user" pattern. The anon key ships in the public JS bundle,
  so if Supabase sign-up were ever left on, a blanket policy would hand full
  store-owner write access to anyone who self-registered. The client-side route
  guard is UI convenience, never the boundary.
- `orders` / `order_items` have **no anon policy at all** — they hold every
  customer's phone number. Orders are placed through `place_order()` and the
  guest confirmation page reads through `get_order_by_number()`, which returns
  only what that page needs (no phone, address or notes).
- `place_order()` validates the customer server-side (name length, Algerian
  mobile format, whitelisted language and delivery type), **rate-limits by phone**
  (3 per 10 min, 10 per 24 h), caps cart shape and per-line quantity, locks the
  product row with `FOR UPDATE` before the stock check, rejects rather than
  clamps insufficient stock, rejects unknown or disabled wilayas, and truncates
  every free-text passthrough. The honeypot and zod schema in the browser are
  convenience only — a bot posting straight at the RPC skips both.
- Draft products and draft landing pages are invisible to anon.
- The Excel export escapes leading `= + - @` in every customer-controlled field
  (`excelSafe`) — otherwise a customer-supplied name executes as a formula for
  whoever opens the file.
- Cancelling an order restocks automatically (trigger on the transition into
  `cancelled`). **Deleting an order does not.**
- Landing-page **draft preview** (`/lp/<slug>?preview=1`) is gated by RLS, not by
  the query string: it reads `landing_pages` through the normal table policies,
  so an admin session resolves the draft and everyone else falls through to the
  published-only RPC. The URL carries no token and grants nothing.
- The landing **video block** rebuilds its embed URL from a matched YouTube /
  Vimeo id (`src/lib/video.ts`) rather than passing the pasted string to an
  `<iframe src>`, and rejects any scheme other than http(s).
- `vercel.json` sets `base-uri` / `object-src` / `frame-ancestors` /
  `form-action` via CSP. `script-src` and `connect-src` are deliberately absent:
  the Meta Pixel bootstraps inline and its origins would have to be maintained
  by hand, so a stale list would break tracking or checkout. Adding them is a
  worthwhile follow-up *with* a staging deploy to test against.

**Residual risk, accepted:** `get_order_by_number()` is unauthenticated by
design (guests must reach their confirmation page) and returns name, wilaya,
city and items for a known order number. The number is
`MS-YYYYMMDD-XXXXX`, so a determined attacker has ~1M guesses per day to
enumerate one day's orders. Nothing sensitive enough to lose sleep over
(no phone, address or notes are returned) but if you want it closed, widen the
random suffix in `place_order()` from 5 to 8 characters — that is a targeted
one-line change to a function the migration comments warn against re-declaring
casually, so do it deliberately and test order placement afterwards.

---

## Variants and stock

A product has three variant axes, all optional, all editable per product:

| Axis | Shape | Per-option photo | Per-option stock |
| --- | --- | --- | --- |
| Colours | `[{ hex, label_fr, label_ar, image_url, stock }]` | yes — picking the swatch jumps the gallery to it | yes |
| Sizes | `[{ value, stock }]` | no | yes |
| Custom | `[{ name_fr, name_ar, values: [{ value, image_url, stock }] }]` | yes | yes |

**`stock` empty = untracked.** That option then sells against the product's own
`stock`, which is exactly how every product written before `0011` behaves —
nothing was rewritten in place, and both shapes (`["S","M"]` and
`[{value:"S"}]`) are read correctly by `normalizeProduct` and by `place_order()`.

**A number makes it its own pool.** `place_order()` checks it, decrements it on
purchase, and the restock trigger puts it back when an order is cancelled. The
storefront greys the option out and strikes it through at zero, the quantity
stepper is capped by the smallest selected pool, and Add to cart / the landing
order form stay disabled until every axis with stock left has been answered.

### The colour × size grid

Independent pools oversell one exact pairing: 10 Red and 8 M in stock can still
be only 3 real Red-M, and nothing in the per-axis model knows that. `0013` adds
an optional grid that does.

```
stock_matrix  [{ "color": "<hex>", "size": "<value>", "stock": <int> }]
```

One cell per offered pairing, edited as a table in the product form — colours
down the side, sizes across the top. Set it up under **Stock par couleur et
taille**.

- **Empty `stock_matrix` = no grid**, and every product written before `0013`
  has exactly that. Those keep the independent-pool behaviour above, unchanged.
- **A cell that is unticked is NOT OFFERED** — different from a cell at zero,
  which stays listed and struck through. Retiring a combination does not bring
  it back on cancel; restocking a retired cell would silently return it to sale.
- **The grid only governs colour and size.** Custom variant axes keep their own
  independent pools; folding them in too would make the form grow
  multiplicatively (3 colours × 3 sizes × 2 materials = 18 boxes).
- **`products.stock` becomes derived.** The `products_sync_matrix_stock` trigger
  overwrites it with the sum of the cells on every write, and the admin's stock
  box goes read-only, so the total can never drift from the grid.
- **Colour stays open, size narrows under it.** Picking Red greys out an L that
  Red never had; picking L does *not* grey out the other colours. Filtering both
  ways strands a shopper who wants to switch colour. A size invalidated by a
  colour change is dropped, not silently kept.
- Deleting a colour or size prunes its cells server-side (`matrix_prune`), so an
  orphaned row cannot keep counting toward the total.

`place_order()` resolves the shopper's colour **label** back to the hex the grid
is keyed on — labels are bilingual and the order stores whichever language was
being browsed, so the hex is the only stable key.

**No stock count is ever shown to a shopper.** Not per option, not as an "only N
left" badge. An option is selectable or visibly disabled with "épuisé"; the
numbers exist only to cap the quantity stepper. Note that raw counts are still
present in the products API response — see *Known gaps*.

`place_order()` also now **rejects an unanswered or unknown option** rather than
storing whatever string the client sent, so an order can no longer arrive for a
size the product does not offer.

---

## Landing page builder

`/admin/pages` → create → pick a product → add blocks → publish.

Blocks available: hero, bullets, offer, order form, features, gallery, video,
free text, reviews, FAQ, countdown, trust badges, CTA, spacer. Each block is
reorderable, individually hideable, and carries FR + AR copy. Per-page controls
cover accent colour, background, width, corner style, whether the site header
and footer show, SEO title/description/share image, and extra Meta pixels to
force on that page.

Orders placed from a landing page are tagged `lp:<slug>` in `orders.source`.

A landing page may point at a product deliberately kept **out** of `/shop` (a
`draft`): `product_is_orderable()` lets it be ordered only while a published
landing page targets it.

Adding a new block type is frontend-only — the renderer ignores unknown types,
so no migration is needed. Add it to `src/types/landing.ts`, `createBlock()` in
`src/lib/landing.ts`, `BlockEditor.tsx`, and `LandingBlocks.tsx`.

---

## Meta pixels

`/admin/pixels`. Multiple pixels, each scoped to all pages / specific paths /
product pages / landing pages, with per-event toggles. Everything is
database-driven — no snippet in `index.html`, no redeploy to change a campaign.

Every event is sent with `trackSingle`, never bare `track`: `track` broadcasts
to every initialised pixel and cross-contaminates campaigns. `/admin/*` is
skipped entirely so staff traffic never enters campaign data. An empty match
list on a scoped pixel means "every page of that kind", not "no pages".

---

## Assets

| Script | Purpose |
| --- | --- |
| `python scripts/prepare-logo.py` | Crops the supplied `logo.png` (it ships with a 3px frame and wide margins) into the transparent `public/logo.png` the site uses. |
| `python scripts/make-light-logo.py` | Re-inks `public/logo.png` into `public/logo-light.png` for the light theme. **Re-run this whenever `public/logo.png` changes**, or light mode keeps showing the old wordmark. |
| `powershell -ExecutionPolicy Bypass -File scripts/gen-og-image.ps1` | Generates the 1200×630 `public/og-image.png` share card. |

The logo is two *light* marks — `#FFAB40` "MONDO" over `#EBEFF2` "SHOPE" — drawn
for the near-black dark theme, so the pale half vanishes on any light ground.
There is no palette that fixes it: every background dark enough to show
`#EBEFF2` at 3:1 drops dark body text below 4.5:1. Hence two files, picked by
theme in `Wordmark.tsx`.

Both are one-off; neither is wired into the build. Once real product photos
exist, prefer replacing the OG card with a straight 1200×630 crop of the best
product photo — social platforms already render the site name, title and
description as text above the image, so a logo card is largely redundant.

---

## Go-live checklist

1. **Create the Supabase project**, then put its URL + anon key in `.env`.
2. **Run the migrations in order**, `0001` → `0006`, in the SQL editor.
3. **Create the owner's auth user** (Authentication → Users → Add user, with
   auto-confirm), then **edit the email at the bottom of `0002_rls.sql`** and run
   that block. Until you do, nobody can write anything.
4. **Turn off public sign-up** (Authentication → Sign In / Providers). The
   allow-list already blocks self-registered admins, but there is no reason to
   let strangers create auth rows at all.
5. **The production domain is `https://www.mondoshope.shop`** and is already
   baked in: `index.html` (canonical, `og:url`, `og:image`, JSON-LD),
   `public/robots.txt`, and the *defaults* in `useSeo.ts`, `middleware.ts` and
   `scripts/generate-sitemap.mjs`. `VITE_SITE_URL` still overrides all three, so
   set it only on a preview deploy that must canonicalise to its own origin —
   and never leave it pointing at `localhost`, or the generated sitemap ships
   localhost URLs. Keep the `www`: the apex `mondoshope.shop` has no DNS record.
6. **Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project
   env**, not just `.env` — the link-preview middleware reads them at the edge
   and silently degrades to the generic card without them. Verify after deploy:
   `curl -A "facebookexternalhit/1.1" https://www.mondoshope.shop/produit/<slug>`
7. **Set delivery prices per wilaya** in `/admin/livraison`. All 58 wilayas are
   seeded at 0 — nothing ships at a sane price until this is filled in. Disable
   any wilaya you don't serve.
8. **Decide on free shipping.** It ships **off** (`free_ship_threshold` is null).
   If the client wants it, set the amount in `/admin/parametres`.
9. **Seed real content through the admin UI**, not SQL — that proves the CRUD
   forms work. Then **re-open one of each and EDIT it** — change a price, a name,
   a delivery fee, an order status — **reload the page**, and confirm the new
   value stuck. Creating and editing are different code paths; reload rather
   than trusting the screen, because an unchecked failed write leaves the old
   value in the query cache looking correct.
10. **Place one real order end-to-end in a real browser, not logged in as
    admin** — through both the cart checkout and the product page's buy-now — and
    confirm the confirmation page shows the recap. This is the one thing that
    silently passes if you test it while authenticated. Delete the test order
    afterwards (name the customer TEST so it can't be mistaken for real).
11. **Cancel a test order** and confirm the product's stock went back up.
12. **Add at least one active pixel** in `/admin/pixels` before any ad spend, and
    confirm in Meta Events Manager that each campaign's pixel receives only its
    own pages' events.
13. **Tell the client** to change their password themselves in `/admin/compte` —
    you typed the one they're currently using.

---

## Known gaps / deliberate omissions

- **Staff accounts with per-section permissions** were excluded from this build
  by request. The `admin_users` allow-list is a single flat admin role: everyone
  on it can do everything — `dev@mondoshope.shop`, added in `0012`, has exactly
  the same rights as the owner account. The allow-list is owned by
  `0012_dev_admin_account.sql`: edit the two email lists there, and create the
  auth user under Authentication → Users first. Do not edit `0008`, whose
  single-operator revoke clause `0012` supersedes. If the client later hires staff, this becomes an
  `admin_profiles` table with a `sections text[]` column plus `has_section()`
  policies and a service-role edge function to create accounts.
- **Stock counts are hidden in the UI, not in the API.** The storefront never
  prints a number, but `products` is world-readable and the row still carries
  `stock` and every `stock_matrix` cell, so anyone reading the network tab can
  see them. Closing that means serving the storefront from a view that replaces
  each count with `least(count, 20)` — 20 being the per-line cap `place_order()`
  already enforces, so the stepper keeps working while 21 and 500 look
  identical. Not done here because it changes the public read path that the
  landing pages and the link-preview middleware also use.
- **Finance / physical-store ledger** were also excluded by request. There is no
  cost price, margin, expense or till tracking anywhere. `/admin` shows booked
  revenue (non-cancelled orders) only.
- `xlsx@0.18.5` is the npm release. Its known CVEs are in the **parsing** path;
  this project only ever writes files, never parses untrusted spreadsheets.
