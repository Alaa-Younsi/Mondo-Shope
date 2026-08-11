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
| `powershell -ExecutionPolicy Bypass -File scripts/gen-og-image.ps1` | Generates the 1200×630 `public/og-image.png` share card. |

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
  on it can do everything. Adding or removing an admin is done in the Supabase
  SQL editor. If the client later hires staff, this becomes an
  `admin_profiles` table with a `sections text[]` column plus `has_section()`
  policies and a service-role edge function to create accounts.
- **Finance / physical-store ledger** were also excluded by request. There is no
  cost price, margin, expense or till tracking anywhere. `/admin` shows booked
  revenue (non-cancelled orders) only.
- `xlsx@0.18.5` is the npm release. Its known CVEs are in the **parsing** path;
  this project only ever writes files, never parses untrusted spreadsheets.
