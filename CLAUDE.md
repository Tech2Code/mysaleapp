# Project conventions (read before changing anything)

See `AGENTS.md` too: this is Next.js 16 with Cache Components, so read `node_modules/next/dist/docs/` before using framework APIs.

## Forms: always use the shared inputs

All form inputs come from `@/components/form` (`src/components/form/`):

| Need | Component |
|---|---|
| Single-line text, number, date, url, password | `TextField` (`leading="₹"` / `"+91"`, `suggestions=[…]`) |
| Multi-line text | `TextAreaField` |
| Dropdown | `SelectField` (native `<select>`, pass `options`) |
| Search box | `SearchField` |
| On/off toggle | `SwitchField` |

Rules:
- **Never** put a raw `<input>`, `<textarea>`, `<select>` or `ui/input` / `ui/textarea` in a page or feature component. Label, hint, error text and ARIA wiring live in the shared components.
- Missing an input type? Add it to `src/components/form/` and export it from `index.ts`. Don't build a one-off.
- They work with react-hook-form: `<TextField label="Name" error={errors.name?.message} {...register("name")} />`. Use `fieldSize="md"` in the admin panel, default `lg` on the storefront, and `pill` for search/filter bars.
- The one exception: `ImageUploader` (a file drop-zone) owns its own `<input type="file">`.

## UI patterns to reuse (don't re-invent per page)

- **Admin forms save with `StickySaveBar`** (`components/admin/sticky-save-bar.tsx`): last child of the `<form>`, spans the whole page, shows "unsaved changes". Never put Save/Cancel inside one side column.
- **Loading feedback = `RouteProgress`** (`components/shared/route-progress.tsx`): a thin top bar that starts on any in-app link click automatically. For `useTransition` work (filters, tabs, search) call `useProgressWhile(pending)`. Never fade/dim the page (`opacity-*`) while loading.
- Every dynamic admin or store page needs its own `loading.tsx` (or an inner `<Suspense>`), and `params` / `searchParams` are awaited inside that boundary.
- **Never leave a column empty on wide screens.** Use a two-column grid (`xl:grid-cols-2`) or a main + side layout, and keep the side column short.
- Button heights match inputs: default = `h-10` (admin, `fieldSize="md"`), `size="lg"` = `h-11` (storefront). Don't hand-set heights on buttons that sit next to fields.
- A payment status must be shown with `paymentDisplay()` / `<PaymentBadge orderStatus>` so a cancelled order never says "awaiting payment".
- Product charges (handling etc.) are added **once per product**, never × quantity, and are always shown with the product name and a reason.

## Scroll position after a change (never leave the reader at the bottom)

- When an action swaps a tall panel for a short one (pay form → "we're verifying", Cancel button → notice) or a filter shortens a list, the page shrinks and the browser leaves the reader at the bottom. Handle it every time:
  - After a server action changes what a panel shows, call `useRevealOnChange(key)` (`hooks/use-reveal-on-change.ts`) with a value that changes with the result (a status). It scrolls to the nearest `data-reveal-top` region, else to the page top. Already used in `PaymentPanel`, `CancelOrder`, `RequestReturn`.
  - Filters/sort/search above a list (`ProductBrowser`): after the list changes, scroll the list start back under the sticky bar (see the `useLayoutEffect` there). Keep a `min-h` on the list so a short result doesn't collapse the page.
- Any new "submit, then the screen changes" flow must do this. Check at 360px with the page scrolled to the bottom.

## Pincode

Every pincode field fills the city and shows "City, State" via `usePincodeLookup` (`components/shared/use-pincode-lookup.ts`, server action `features/location/actions.ts`, India Post free API). City and State are separate fields in forms (State is a `FormSelectField`, `v.state()`); the DB has no `state` column, so the server joins them into `city` as "City, State" (`joinCityState`) and forms split it back (`splitCityState`), both in `features/location/states.ts`. Autofill never overwrites a value the user typed.

## "Other" reasons and guest privacy

- Any reason dropdown with an "Other" (customer cancel, admin cancel, return request) needs a comment: use `otherNeedsDetail()` from `features/orders/reasons.ts` in the form **and** in the zod schema.
- The guest track page (`/track`, found with code + last 4 digits) shows status, timeline, items (name × qty) and pay-now/verifying cards only. No receipt, no priced summary, no address. The `track_order` RPC (migration 0014) masks the UTR and withholds payment details and the delivery address unless the caller is the signed-in owner. Anything private goes in `/account/orders/[code]`.

## Other rules

- Pages stay thin; business logic goes in `src/features/<feature>/` (queries, actions, schema, types).
- Every Server Action validates with Zod and checks auth itself (`assertAdmin()` / `getCurrentUser()`).
- Database changes go in a new numbered file in `supabase/migrations/` (never edit an applied one). **Claude applies them itself** with the Supabase CLI (see "Database migrations" below); the user never runs them by hand. Mention in the reply which migrations were applied.
- **No shop details in code.** Name, tagline, description, SEO keywords, WhatsApp number, email/phone/city, social links, announcement banner, order-code prefix, delivery fee, free-delivery amount and UPI details are all owner-editable in **Admin → Settings** (table `store_settings`). Never hard-code them.
  - Server code: `await getStoreSettings()` (`features/settings/queries.ts`). Client components: `useStoreSettings()`. Page metadata: use `generateMetadata` + `pageMetadata(shop, …)`.
  - WhatsApp links/messages always take the settings object: `shopWhatsappLink(shop, text)`, `buildOrderMessage(shop, …)`.
  - A new owner-editable setting = a nullable column in a new migration + `types.ts` / `defaults.ts` / `schema.ts` / `queries.ts` / `actions.ts` in `features/settings` + a field in `components/admin/store-settings-form.tsx`.
  - `src/config/site.ts` keeps only deployment constants (site URL, locale, currency).

## Layout, sticky and alignment rules

- **Sticky elements** use the utilities in `globals.css`, never a hand-written `top-*`: `sticky-store` (under the store header), `sticky-store-flush` (filter bars), `sticky-admin` (under the admin top bar). Header heights come from `--store-header-h` / `--admin-topbar-h`; change them there only.
- **Horizontal chip/thumbnail rows** use `scroll-row` (adds padding so rings and shadows are not clipped).
- **No blank space.** Side-by-side cards sit in a grid that stretches (`items-stretch`, last card `flex-1`), or in `xl:columns-2` with `break-inside-avoid` when heights differ (see the settings form).
- Rows that must align (sidebar links, chips, buttons next to fields) get a fixed height plus `leading-none`; icon-only boxes use `grid place-items-center`.

## Validation (one place)

`src/lib/validation/` holds every limit and format: `LIMITS`, `PATTERNS`, `FIELD_KINDS` (input masks) and the zod primitives `v` (`v.email()`, `v.phone()`, `v.utr()`…). Schemas in `features/*/schema.ts` are built from `v`; inputs get their mask with `<TextField kind="phone" />`. To change a rule, change it there once.

## Dropdowns

`SelectField` is a custom (Base UI) dropdown, not a native `<select>`. With react-hook-form use `FormSelectField` (`control`, `name`).

## UI ids for "change this part"

Every element in components and pages carries `data-ui`: the root is `area/Component` (pages: `page:/route`), anything inside is `area/Component/tag-hint`, e.g. `store/Header/button-open-cart`. In dev press **Alt+I** (or the corner button), hover an element, click to copy its id. `grep -rn 'data-ui="store/Header/button-open-cart"' src` finds it. After editing components run `npm run ui:tag` (ids are regenerated; counters like `-2` can shift when siblings are added). Skips `components/ui/*` and image/SEO files. Stripped from production builds (`next.config.ts`).

## Admin orders lists and dashboard

- Dashboard tiles link to `/admin/orders?view=<id>`. A view is defined once in `features/orders/views.ts` and `applyOrderView()` in `admin-queries.ts`; the tile count and the list both use it.
- Filters (`OrdersBrowser`, `DashboardRangeShell`) are optimistic: chips switch immediately, a skeleton shows while loading, the user can pick again at once. Use the top `RouteProgress` bar for page navigation only, not filters.
- Dashboard range lives in the URL (`?range=7d|30d|90d|month|last-month|year|all` or `?from=&to=`); see `features/orders/dashboard-range.ts`.

## Order lifecycle (one rule set)

- `features/orders/transitions.ts` is the only place that says which status can follow which (`NEXT_STATUSES`), who can cancel and when, and the cancel reasons. The admin dropdown, the client check and the server action all use `checkTransition()`; never re-implement a rule in a component. Example: "Shipped" needs a courier name; "Confirmed" and later need a paid payment; "Cancelled" is never picked from the dropdown.
- Cancelling goes through `cancelOrder` (customer RPC `cancel_order`, until packed) or `cancelOrderAsAdmin` (until shipped), always with a reason. Show the result with `<CancellationNotice>`; a paid order shows "refund due" until the payment is marked Refunded.
- Order ids shown to people get a `<CopyButton>`.

## Dark mode

Use theme tokens only (`bg-background`, `bg-card`, `text-foreground`, `bg-success-solid`…). A fill that carries white text must be a `*-solid` token (same dark shade in both themes). Never hard-code `bg-white`/`text-black`/`text-neutral-*` except for a QR code or a brand logo. All form fields share `bg-background`.

## Admin account and launch

- `/admin/account`: name, login email (Supabase emails a confirmation link), password (re-checks the current one). `/admin/forgot-password` and `/admin/reset-password` are the reset flow. Schemas live in `features/auth/account-schema.ts`.
- `/admin/launch`: launch checklist and "clear test data" (orders / customers' saved data / catalogue + photos) via RPC `admin_reset_data`. Settings and the admin login are never touched.
- Reading the clock (`new Date()`) in a page needs `await connection()` first (Cache Components).

## Form spacing and typography

- **Errors never move the layout.** `FieldShell` reserves a strip under every field and draws the error absolutely inside it (11px). So stacks of fields use `FIELD_STACK` (`space-y-1.5`) and grids use `FIELD_GRID` (`gap-x-4 gap-y-1.5`), not bigger gaps. Filters and search boxes that never show errors pass `noErrorSpace` (pill fields do it automatically). Keep validation messages short (about 45 characters or less) so they fit on one line on a phone.
- **Type is fluid.** `text-lg … text-7xl` are `clamp()` tokens in `globals.css` with matching line heights; don't hard-code sizes like `text-[2.6rem]`. Big unprefixed spacing (`py-20`, `gap-12`, `p-8`, `mt-24`…) needs a smaller phone value first (`py-14 sm:py-20`).
- Check a change at 360px: no horizontal scroll, body text at least 14px, helper text at least 11px.

## Stock, unpaid orders and returns

- Stock is **reserved when the order is placed** (`create_order`, migration 0010) and given back once if the order is cancelled. The `stock` number is the sellable amount; dispatch does not change it.
- Unpaid orders (status pending, payment pending/failed) are cancelled automatically after `store_settings.unpaid_order_expiry_hours` (default 24, 0 = never) by `expire_unpaid_orders()`, run every 15 minutes by pg_cron. An order where the customer already submitted a UTR is never auto-cancelled. Cancellation `by` can be `system`.
- Returns: `record_order_return()` (admin only, delivered orders). Per item the admin chooses "Back into stock" (resellable) or not (damaged). Rows live in `order_returns`; show them with `<ReturnsList>`.

## Return requests

Customer flow: delivered order → **Request a return** (inside `store_settings.return_window_days` of delivery, default 7; 0 = off) → admin **approves** (with pickup/shipping instructions) or **rejects** (reason required) → when the goods arrive the admin **records the return** from the approved request (`record_order_return` with `p_request_id`), choosing per item whether it goes back into stock → the request becomes `received`.
- One open request per order (DB unique index). The customer can withdraw it until it is reviewed.
- Rules live in `features/orders/returns.ts` (window, returnable quantities, reasons); the DB enforces the same (migration 0012). RPCs: `request_return`, `withdraw_return_request` (guest by code + last 4, or signed in), `decide_return_request` (admin).
- Dashboard tile and `/admin/orders?view=return-requests` list orders with a request waiting for a decision.
- The admin can tell the customer on WhatsApp after deciding (`buildReturnDecisionMessage`).

## Dashboard range

Default is the current **financial year** (April–March, India), compared with the same stretch of last year. Other options: this month, a particular month (`?month=YYYY-MM`), custom dates (spans over ~3 years and impossible dates like `2026-02-31` are ignored and fall back to the default). See `features/orders/dashboard-range.ts`.

## Database migrations (Claude applies them)

- The Supabase CLI is logged in and linked to the **production** project (`nepfgwfunxebhsfrfxeb`); there is no staging. Always pass `--remote` (without it the CLI targets a local Docker stack that isn't running).
- Flow: write `supabase/migrations/00NN_name.sql`, read it, run `npx --no-install supabase db push --remote --dry-run` (its own command), read the output, then `npx --no-install supabase db push --remote --yes` (its own command, never chained with the dry run). Then verify against the real DB (see below).
- Migrations 0001–0021 are applied. Never edit an applied file; fix forward with a new one. Re-running an old file reverts newer function bodies (`create or replace`).
- SQL conventions: `security definer` functions set `search_path = public, pg_temp`, check `is_admin()` inside, `revoke ... from public, anon` and grant only what is needed. `orders.status` is an enum: compare with `status::text` against text params. Lock order everywhere is **order row first, then products in id order**.

## Verifying against production (no staging)

- Use throw-away Node scripts in the scratchpad (supabase-js from `node_modules`, URL and anon key read from `.env`, never printed). For test logins ask the user; don't write passwords into the repo or memory.
- Only create clearly marked test data (customer name "AUDIT TEST", products "AUDIT TEST …"), delete it in a `finally`, and check that real products' stock is unchanged. Never run `admin_reset_data`.
- Browser checks: install Playwright in the scratchpad (not in the project); the user's `next dev` runs on port 3000.

## Tests

- `npm run test` (Vitest, node env, `TZ=America/Los_Angeles` so IST-independence is real). Tests sit next to the code (`*.test.ts`) and cover the pure modules: pricing, transitions, returns, deadline, dashboard-range, reasons, `paymentDisplay`, location states, validation. Run it with `npx tsc --noEmit` and `npx eslint src` before every push.
- A rule that exists in both TS and SQL (pricing, return window, cancel statuses, the awaiting-payment predicate) must be changed in both; the SQL is the source of truth.

## Rate limiting and abuse

- `src/features/security/rate-limit.ts` → `limited(scope, extra?)`, called BEFORE the RPC in guest order actions, `placeOrder`, admin login and the pincode lookup. The limits live in the DB function `check_rate_limit(p_scope, p_key)` (migration 0021), never in the caller. Add a scope there (new migration) before using a new one.
- The IP comes from `x-vercel-forwarded-for` / `x-real-ip` / `x-forwarded-for`, is hashed with `RATE_LIMIT_SALT` (**must be set in production**; the local `.env` has one) and is never stored raw. The limiter fails open if it errors.

## Refunds, stock cache, dashboard numbers

- Refunds: the `refund_order` RPC (admin only) is the one path for "mark refunded"; a partial refund keeps `payment_status = 'paid'` with `refunded_amount > 0`. `record_order_return` decides "fully refunded" from the value of items refunded and adds item value to `refunded_amount`.
- The catalogue cache (`getActiveProducts`) is `cacheLife("minutes")` because stock also changes from pg_cron expiry, which can't call `updateTag`. Server actions that change stock (place order, cancel, record return) call `updateTag(CACHE_TAGS.products)`.
- The dashboard reads one RPC, `dashboard_stats` (revenue net of refunds, top products net of returns). Don't reintroduce per-row downloads.
- Admin status / payment / cancel updates are compare-and-set (`.eq("status", …).select("id")`, plus `expectedStatus` from the client for status changes) so a stale tab can't overwrite a newer state.
- `getCurrentUser` / `isAdminUser` are wrapped in React `cache()` (once per request). Don't read the user after changing the session inside the same request.
- Motion: `LazyMotion` (the domMax chunk) is in `providers.tsx`; use `m.*` from `motion/react-m`, never `motion.*`, and never start above-the-fold content at `opacity: 0` (the server HTML must be visible).

## Pending work (remove each item when done; delete this section when the list is empty)

When the user asks to "clear the pending list" (or before a push), work through these, verify each, then delete the item here.

Bugs / UX
1. Mobile (360px): after tapping a category chip while scrolled down, the first row of cards sits under the sticky filter bar. Cause: the `useLayoutEffect` in `components/store/product-browser.tsx` (~88-98) measures before the AnimatePresence exit animation shrinks the list. Also: `useSearchParams` is read once, so a client-side link to `/products?sort=…` while already on `/products` doesn't update the chips, and the debounced `replaceState` is dropped if the user navigates within 300 ms.
2. Admin order page: "To collect ₹X" shows next to "Received ₹X" once paid; "Record a return" stays available after everything was already returned.
3. Console warnings on the product page ("state update on a component that hasn't mounted yet"; Next dev warning about uncached data outside Suspense on `/products/[slug]`).

Not yet browser-tested (do these, then delete the item)
4. "Shipped" refuses without a courier; dashboard ranges (`?range=month`, `?month=`, custom, an absurd `from/to` falls back) and every tile link matching its count; the login rate-limit message (use a different email for hammering, don't lock the real admin); `/admin/account` password rules (letters-only / digits-only rejected, don't actually change it); admin cancel with "Other"; address book (add two, one default, un-default, delete); keyboard / a11y pass on header and checkout; SSR HTML of `/` and `/products` has no `opacity:0`; filter scroll at 360px (item 1); after the E2E cleanup confirm no leftover rows in `return_requests`, `order_returns`, `order_status_history` (they should cascade with the orders).

Hardening / cleanup (lower priority)
5. Vercel: set `RATE_LIMIT_SALT` for Production and redeploy (the user does this).
6. Confirm the pg_cron job `expire-unpaid-orders` is scheduled and running (`cron.job`, `cron.job_run_details`); the migration swallows errors if `pg_cron` couldn't be enabled. Add a cleanup for `rate_limits` (anon can create rows via the RPC) and `order_lookup_failures`.
7. Guest order lookup: a known order code can still be locked out for 15 minutes with 10 wrong last-4 guesses (per-order throttle, migration 0009). Consider asking for the full phone number for cancel / change-address.
8. `refund_order` has no idempotency key (a double-click on a partial refund refunds twice); `admin_reset_data` locks products before orders (rare, admin only) and also restocks delivered orders; `dashboard_stats`: a NULL `p_bucket` passes and ties in top products are unordered; add `pg_temp` to the `search_path` of the older SECURITY DEFINER functions.
9. The CSP has no `script-src` / `default-src` (needs a nonce-based policy via the proxy); the admin login limiter fails open.
10. Perf at scale: `dashboard_stats` scans the whole range (add a covering partial index or a rollup when orders reach tens of thousands); the rate-limit RPC is awaited serially before the real work (the pincode lookup could run it in parallel); `ProductGrid` calls `toCardData` inline, which defeats `memo(ProductCard)` if it ever becomes a client component; admin search is `ilike '%q%'` (use `pg_trgm` when it grows).
11. Tests still missing: server actions, `views.ts`, and SQL (pgTAP or RPC scripts against a local Supabase). `vitest.config.ts` logs an ESM warning and `vite-tsconfig-paths` is now redundant there.
12. Optional: demo mode (`isSupabaseConfigured` guards, `features/products/demo-data.ts`) could move to one boundary or go; `features/account/*` vs `features/auth/account-*` naming overlap.
