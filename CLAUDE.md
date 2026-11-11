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
- **Loading skeletons are derived, never hand-built.** A skeleton is the REAL page rendered with placeholder data inside `<Skeletonize>` (`components/shared/skeletonize.tsx`; CSS in `globals.css` turns every text run, icon, image and control into a muted block of the same size), so it can't drift from the UI. To give a page a skeleton:
  1. Put the page's markup in a view component that takes props (`components/{admin,store,account}/…-view.tsx`); the page only fetches and renders `<XView data={…} />`. A new UI element goes inside the view and gets its skeleton for free.
  2. Add the entity's placeholder data to `features/<feature>/placeholders.ts` (typed, so `tsc` forces you to update it when the type grows).
  3. Add `loading.tsx` next to the page: `<Skeletonize><XView {...placeholders} /></Skeletonize>`. Busy states inside client components do the same (`pending ? <Skeletonize><Table rows={placeholders}/></Skeletonize> : children`); a component whose content lives in the browser (cart, wishlist) takes a `preview` prop and wraps itself in `<Skeletonize>` until hydrated.
  - Never write skeleton markup (`<Skeleton>`, `animate-pulse bg-muted`, `h-*`/`w-*` blocks, `fallback={<div…>}`). `src/app/loading-contract.test.ts` fails if a dynamic page has no own `loading.tsx`, if a `loading.tsx` contains raw markup/classes or doesn't reuse the page's view, or if hand-built skeletons appear anywhere. Every dynamic admin or store page needs its own `loading.tsx`; `params` / `searchParams` are awaited inside that boundary.
  - Opt-outs inside a view: `data-skeleton-block` makes an element one block; real text stays hidden, so keep placeholder strings realistic in length.
- **Never leave a column empty on wide screens.** Use a two-column grid (`xl:grid-cols-2`) or a main + side layout, and keep the side column short.
- Button heights match inputs: default = `h-10` (admin, `fieldSize="md"`), `size="lg"` = `h-11` (storefront). Don't hand-set heights on buttons that sit next to fields.
- A payment status must be shown with `paymentDisplay()` / `<PaymentBadge orderStatus>` so a cancelled order never says "awaiting payment".
- Product charges (handling etc.) are added **once per product**, never × quantity, and are always shown with the product name and a reason.

## Scroll position after a change (never leave the reader at the bottom)

- When an action swaps a tall panel for a short one (pay form → "we're verifying", Cancel button → notice) or a filter shortens a list, the page shrinks and the browser leaves the reader at the bottom. Handle it every time:
  - After a server action changes what a panel shows, call `useRevealOnChange(key)` (`hooks/use-reveal-on-change.ts`) with a value that changes with the result (a status). It scrolls to the nearest `data-reveal-top` region, else to the page top. Already used in `PaymentPanel`, `CancelOrder`, `RequestReturn`.
  - Filters/sort/search above a list (`ProductBrowser`): after the list changes, scroll the list start back under the sticky bar (see the `useLayoutEffect` there). Do NOT add a `min-h` to the list: it leaves a blank gap under a short result.
- Any new "submit, then the screen changes" flow must do this. Check at 360px with the page scrolled to the bottom.

## Scroll position on navigation (a new page always opens at the top)

- **Symptom this prevents:** a page opened from a link landing halfway down, at the bottom, or a bit above the top (worst on phones). Cause: Next scrolls to the top only ONCE, on the first commit of a navigation (the `loading.tsx` skeleton); the real page then streams in, the document height changes and the browser clamps/anchors the scroll position.
- **`<ScrollReset />`** (`components/shared/scroll-reset.tsx`, rules in `lib/scroll-reset.ts`, tested) is mounted once in every layout that hosts pages, inside `<Suspense fallback={null}>`: `(store)/layout.tsx` and `admin/(panel)/layout.tsx`. It scrolls to the top when the PATH changes and holds the top until the page height has been stable for 700 ms (cap 3.5 s), with `overflow-anchor: none` on html/body or the reader scrolls. It leaves back/forward (the browser restores the position), `#hash` links and same-path changes (filters, `?query`) alone. **A new layout group (new area of the site) must mount it too.**
- **Never move the scroll from an effect that runs on mount.** `scrollTo` / `scrollBy` / `scrollIntoView` are only for a real change the reader caused (a filter, an action result): use `revealTop()` / `useRevealOnChange(key)`, or the `ProductBrowser` pattern.
- **A "first run" flag (`useRef(true)`) is not a guard.** React Strict Mode and Next's hidden-page cache (Cache Components keeps old pages mounted and re-runs their effects when they are shown again) run effects again with nothing changed. Compare against the last value instead (`lastFilters` in `ProductBrowser`).
- To watch the page height use `document.body` (or the element), never `<html>`: `html` is `h-full`, so its size does not follow the content.
- Don't add `scroll-behavior: smooth` tricks per page: `html` has `scroll-smooth` + `data-scroll-behavior="smooth"` so Next turns smooth scrolling off during route changes. Programmatic scrolls that must be instant pass `behavior: "instant"`.

## Product photos

Always render photos with `ProductImage` (`components/store/product-image.tsx`, client component): alt text is transparent while the photo downloads (no broken-image look, the parent's `bg-muted` shows) and a failed photo falls back to the gradient tile. Never use a raw `next/image` for product photos. Don't gate visibility on `onLoad` (an image that finished before hydration never fires it).

## Pincode

Every pincode field fills the city and shows "City, State" via `usePincodeLookup` (`components/shared/use-pincode-lookup.ts`, server action `features/location/actions.ts`, India Post free API). City and State are separate fields in forms (State is a `FormSelectField`, `v.state()`); the DB has no `state` column, so the server joins them into `city` as "City, State" (`joinCityState`) and forms split it back (`splitCityState`), both in `features/location/states.ts`. Autofill never overwrites a value the user typed.

## "Other" reasons and guest privacy

- Any reason dropdown with an "Other" (customer cancel, admin cancel, return request) needs a comment: use `otherNeedsDetail()` from `features/orders/reasons.ts` in the form **and** in the zod schema.
- The guest track page (`/track`, found with code + last 4 digits) shows status, timeline, items (name × qty), pay-now/verifying cards and, when a return exists, the `<RefundSummary>`. No receipt, no address. The `track_order` RPC (migration 0014) masks the UTR and withholds payment details and the delivery address unless the caller is the signed-in owner. Anything private goes in `/account/orders/[code]`.

## Other rules

- Pages stay thin; business logic goes in `src/features/<feature>/` (queries, actions, schema, types).
- Every Server Action validates with Zod and checks auth itself (`assertAdmin()` / `getCurrentUser()`).
- Database changes go in a new numbered file in `supabase/migrations/` (never edit an applied one). **Claude applies them itself** with the Supabase CLI (see "Database migrations" below); the user never runs them by hand. Mention in the reply which migrations were applied.
- **No shop details in code.** Name, tagline, description, SEO keywords, WhatsApp number, email/phone/city, social links, announcement banner, product-page highlight line (`highlightLine`), home badge (`heroBadge`), price note, GST details, invoice name/address, order-code prefix, delivery fee, free-delivery amount and UPI details are all owner-editable in **Admin → Settings** (table `store_settings`). Never hard-code them.
  - Server code: `await getStoreSettings()` (`features/settings/queries.ts`). Client components: `useStoreSettings()`. Page metadata: use `generateMetadata` + `pageMetadata(shop, …)`.
  - WhatsApp links/messages always take the settings object: `shopWhatsappLink(shop, text)`, `buildOrderMessage(shop, …)`.
  - A new owner-editable setting = a nullable column in a new migration + `types.ts` / `defaults.ts` / `schema.ts` / `queries.ts` / `actions.ts` in `features/settings` + a field in `components/admin/store-settings-form.tsx`.
  - `src/config/site.ts` keeps only deployment constants (site URL, locale, currency).

## Tax, GST and invoices (owner flips one switch)

- The shop starts **not GST-registered**: no tax line anywhere, the bill is a **Bill of Supply** and says no tax is charged. Prices are always the final amount the customer pays.
- Admin → Settings → **Tax & invoices**: switch "I am registered under GST" on, enter GSTIN (`GSTIN_PATTERN` in `features/settings/schema.ts`) and the one GST rate that is already included in prices. Nothing else changes in code or deploys: the bill becomes a **Tax Invoice** (GSTIN, taxable value, GST included) and product pages show "Inclusive of all taxes". The form and DB both refuse registered without GSTIN + rate.
- Everything tax-related reads `features/settings/tax.ts` (`gstActive`, `priceNote`, `invoiceTitle`, `gstIncluded`). Never hard-code "Inclusive of all taxes" or a GST rate in a component. The owner's own `priceNote` text always wins. Invoice name/address fall back to shop name and city/state.
- The bill itself is `<InvoiceDocument>` (`components/shared/invoice-document.tsx`), shown at `/account/orders/[code]/invoice` and `/admin/orders/[id]/invoice` (noindex, not for cancelled orders, print / "Save as PDF" via `<PrintButton>`; `globals.css` prints it black on white and hides everything else). Guests have no invoice.
- Limits to revisit with a CA: one GST rate for the whole shop (no per-product rate), no CGST/SGST/IGST split (the DB has no customer state), the invoice number is the order code (not sequential).

## Layout, sticky and alignment rules

- **Sticky elements** use the utilities in `globals.css`, never a hand-written `top-*`: `sticky-store` (under the store header), `sticky-store-flush` (filter bars), `sticky-admin` (under the admin top bar). Header heights come from `--store-header-h` / `--admin-topbar-h`; change them there only.
- **Horizontal chip/thumbnail rows** use `scroll-row` (adds padding so rings and shadows are not clipped).
- **No blank space.** Side-by-side cards sit in a grid that stretches (`items-stretch`, last card `flex-1`), or in `xl:columns-2` with `break-inside-avoid` when heights differ (see the settings form).
- Rows that must align (sidebar links, chips, buttons next to fields) get a fixed height plus `leading-none`; icon-only boxes use `grid place-items-center`.

## Validation (one place)

`src/lib/validation/` holds every limit and format: `LIMITS`, `PATTERNS`, `FIELD_KINDS` (input masks) and the zod primitives `v` (`v.email()`, `v.phone()`, `v.utr()`…). Schemas in `features/*/schema.ts` are built from `v`; inputs get their mask with `<TextField kind="phone" />`. To change a rule, change it there once.

- No inline numbers in schemas or `maxLength`: use `LIMITS.*`. Money goes through `v.money` / `v.optionalMoney` (0..max, max 2 decimals); quantities through `v.quantity()` (1..20); tracking/AWB through `v.trackingNumber()` + `kind="trackingNumber"` (5-30 of A-Z 0-9 - / _, upper-cased); tracking links through `v.httpsUrl()`; dates through `v.isoDate()` / `v.futureDate(days)` (`todayIST()`, `addDays()` in `lib/validation/dates.ts`). Don't read the clock in a client component's render (Cache Components): validate on submit instead.
- DB mirrors: migrations 0045+ hold the matching CHECKs (tracking, UTR, amounts, stock, text lengths). A new LIMIT that has a column needs a new migration.

## Dropdowns

`SelectField` is a custom (Base UI) dropdown, not a native `<select>`. With react-hook-form use `FormSelectField` (`control`, `name`).

## UI ids for "change this part"

Every element in components and pages carries `data-ui`: the root is `area/Component` (pages: `page:/route`), anything inside is `area/Component/tag-hint`, e.g. `store/Header/button-open-cart`. In dev press **Alt+I** (or the corner button), hover an element, click to copy its id. `grep -rn 'data-ui="store/Header/button-open-cart"' src` finds it. After editing components run `npm run ui:tag` (ids are regenerated; counters like `-2` can shift when siblings are added). Skips `components/ui/*` and image/SEO files. Stripped from production builds (`next.config.ts`).

## Admin orders lists and dashboard

- Dashboard tiles link to `/admin/orders?view=<id>`. A view is defined once in `features/orders/views.ts` and `applyOrderView()` in `admin-queries.ts`; the tile count and the list both use it.
- Filters (`OrdersBrowser`, `DashboardRangeShell`) are optimistic: chips switch immediately, a `<Skeletonize>` placeholder (real table/dashboard with placeholder data) shows while loading, the user can pick again at once. Use the top `RouteProgress` bar for page navigation only, not filters.
- Dashboard range lives in the URL (`?range=7d|30d|90d|month|last-month|year|all` or `?from=&to=`); see `features/orders/dashboard-range.ts`.

## Order lifecycle (one rule set)

- `features/orders/transitions.ts` is the only place that says which status can follow which (`NEXT_STATUSES`), who can cancel and when, and the cancel reasons. The admin dropdown, the client check and the server action all use `checkTransition()`; never re-implement a rule in a component. Example: "Shipped" needs a courier name; "Confirmed" and later need a paid payment; "Cancelled" is never picked from the dropdown.
- Cancelling goes through `cancelOrder` (customer RPC `cancel_order`, until packed) or `cancelOrderAsAdmin` (until shipped), always with a reason. Show the result with `<CancellationNotice>`; a paid order shows "refund due" until the payment is marked Refunded.
- Order ids shown to people get a `<CopyButton>`.
- **Finished orders are locked.** Delivered and cancelled orders can't change shipping, items, prices, customer/address or status (`features/orders/locking.ts` for the UI note + server refusal; DB trigger `lock_finished_orders`, migration 0023, allow-lists `payment_*`, `refunded_*`, `refund_reference`, `stock_*`, `updated_at`, `user_id → null`). Still allowed: the private admin note, payments/refunds, returns. Payments: `payment_status` never moves away from `paid` (except to `refunded`) or `refunded` on any order, and on a delivered/cancelled paid order the amount, paid time and UTR are frozen (`features/orders/payment-rules.ts`, form + `updateOrderPayment` + trigger `guard_payment_status`, migration 0024). A new column on `orders` is locked on finished orders until added to the trigger's list.
- **Return stage** (`returnStage()` in `features/orders/returns.ts`) is the ONE derived state for a return (requested → approved [pickup scheduled for `pickup_date`] → picked up [`picked_up_at`] / rejected / withdrawn → received → partly refunded / refunded). `orders.status` stays `delivered`. Show it with `<ReturnStageBadge>`; the return steps are NOT a separate card, they continue the order timeline after Delivered (`<OrderTimeline returnInput audience>`, steps from `returnTimeline()`: requested → approved → pickup scheduled (date) → pickup successful → received → refund) (admin wording vs `customerLabel`; customer/guest text never has amounts); list queries must embed `return_requests` + `order_returns` for `Order.returnStage` to be set. WhatsApp: `buildStatusUpdateMessage(…, { returnStage })`.

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
- Admin stock edits are **deltas**, never absolute: the product form sends the stock it loaded (`expectedStock`) and `saveProduct` applies `new − expected` to the CURRENT stock through the `adjust_product_stock` RPC (migration 0015), so an edit can't wipe stock a customer just reserved. New products are a plain insert.
- Returns: `record_order_return()` (admin only, delivered orders). Per item the admin chooses "Back into stock" (resellable) or not (damaged). Rows live in `order_returns`; show them with `<ReturnsList>`.

## Return requests

Customer flow: delivered order → **Request a return** (inside `store_settings.return_window_days` of delivery, default 7; 0 = off) → admin **approves** (with pickup/shipping instructions) or **rejects** (reason required) → when the goods arrive the admin **records the return** from the approved request (`record_order_return` with `p_request_id`), choosing per item whether it goes back into stock → the request becomes `received`.
- One open request per order (DB unique index). The customer can withdraw it until it is reviewed.
- Rules live in `features/orders/returns.ts` (window, returnable quantities, reasons); the DB enforces the same (migration 0012). RPCs: `request_return`, `withdraw_return_request` (guest by code + last 4, or signed in), `decide_return_request` (admin).
- Return views (one definition each in `orderViewFilter()`, used by the list, the dashboard tiles AND the chip counts `getReturnViewCounts()`): `return-requests` (waiting for a decision), `returns-to-receive` (approved, goods not back), `return-refund-pending` (a return recorded without a refund, payment still paid), `returns-refunded`. The admin orders list has a chip row for them (`RETURN_VIEWS`, `scroll-row`); ids are capped at `RETURN_VIEW_ID_LIMIT` (100, newest) because they travel in one URL.
- A return recorded without a refund can be refunded later per return: `refund_return` RPC (migration 0024) via `refundReturn` / `<RefundReturnButton>` in the admin returns list. It keeps `order_returns.refunded / refund_amount` and `orders.refunded_amount` in step (same bookkeeping as ticking "I have refunded these items"). A refund through the payment card (`refund_order`) is cash only and does not mark any return refunded.
- A rejected request shows as a badge in lists for `REJECTED_BADGE_DAYS` (7) after the decision, then only in the order's detail/timeline. After a rejection the customer can send a NEW request while the window is open (`canRequestAgain()`; the DB only forbids two OPEN requests). Customer-facing status lines come from `customerStatusLine()` (never "Delivered — enjoy!" while a return exists, never amounts). Request-status pills use `requestStatusMeta()`, the same copy table as the stages.
- The admin can tell the customer on WhatsApp after deciding (`buildReturnDecisionMessage`).

- Pickup (migration 0025): approving needs a pickup date (`decide_return_request(…, p_pickup_date)`); the admin marks "Pickup successful" (`mark_return_picked_up`, behind a confirm). Every admin action that changes an order or return must call `revalidatePathsForCustomer()` (admin-actions.ts) so the customer order pages and `/track` don't show a stale status.

- Recording a return (any way) closes the order's approved request (inside `record_order_return`, migration 0027; a trigger version in 0026 broke "record from request" and was dropped), so the stage can't stay on "Pickup scheduled" after the goods came back. Return UI is ONE card per side ("Returns": requests as tiles, then `<ReturnsList bare>` "Items received back"): admin `AdminReturnRequests` (`#returns`, linked from the locked Fulfilment card), customer `ReturnRequestsPanel`. On a delivered order the admin Fulfilment **status dropdown** (`ReturnStatusControl`) is the ONE place for every return step (approve/reject, pickup successful, items received, refund); the Returns card only displays. Don't add return action buttons elsewhere. The admin Fulfilment controls are sticky (`md:sticky-admin`) next to the long timeline.

## Refresh

`<RefreshButton>` (`components/shared/refresh-button.tsx`) refetches a page in place (default `router.refresh()`, or `onRefresh` for browser-fetched data like `/track`). It is on admin order detail and `/track`.

## Refunds are items only, one badge per order

- A return refunds the **price of the returned items only**; delivery and other charges are never refunded (SQL: `record_order_return` / `refund_return`, migration 0028; TS: `features/orders/refund.ts`). `refunded_amount` therefore ends below the amount paid when charges were paid. Show it with `<RefundSummary>` (paid, per-item refund, "Not refunded" charges, "You get back") on the customer order page, `/track` (guests too: this is the one priced block they see, no address or payment details), and the admin order page; `RequestReturn` shows a live "You will get back" estimate. Stage text (badges, status lines) still has no amounts.
- Show ONE badge per order with `<OrderStatusBadge>` (latest thing: return stage, else payment needing attention while pending, else order status). Don't stack StatusBadge + ReturnStageBadge + PaymentBadge. The payment card and the orders table payment column still use `PaymentBadge` on their own.

- A return recorded from a customer request takes back ONLY the requested items and quantities (dialog lists just those; `record_order_return` raises `NOT_IN_REQUEST`, migration 0029). The no-request option in the status dropdown is labelled "Return received (no request)" and exists only for goods agreed outside the app.

- Rules added by the audit (migration 0030): a request must be `approved` before goods can be recorded from it; a cancelled order whose payment is `submitted` may still be marked paid so it can be refunded; every later order step needs a `paid` payment (a refunded order can only be cancelled); pickup dates must be real dates within today..+90 days (IST); `dashboard_stats` revenue = amount received minus refunds. Password reset is rate limited (`password-reset` scope, migration 0040) and `admin_reset_data` is not callable by anon.

## Header, search and account menu

- The header search icon (all sizes) opens `<SearchDialog>` (`components/store/search-dialog.tsx`, server action `searchProducts` in `features/products/search-actions.ts` over the cached catalogue): live results, Enter or "See all results" goes to `/products?q=`. Don't link the search icon to /products.
- Below `sm` the wishlist and cart icons are not in the header: they are rows in the account dropdown (`AccountMenu`, opens on click, with a dot on the icon when either has items). Guests get Sign in + Track order there on phones; on web the guest icon is a plain link straight to /login. From `sm` up the icons stay in the header.

- A paid payment can only be marked refunded once the order is shipped, delivered or cancelled (`REFUNDABLE_STATUSES` in payment-rules.ts, DB guard in migration 0043). Before dispatch (pending / confirmed / packed) the admin cancels the order first, then records the refund.

## Courier details

Courier / AWB / tracking link / expected date are entered ONLY in `<CourierDialog>` (`components/admin/courier-dialog.tsx`): opened by "Add details" when the status dropdown is on Shipped, and by the Edit button on the shipping card (`CourierEditButton`, shown on a shipped order). No inline courier form in Fulfilment. Keep the dialog outside any parent `<form>` (React bubbles submit through portals).

## Toasts after actions

In a `useTransition` flow that ends with `router.refresh()`, show the SUCCESS toast with `later(() => toast.success(...))` from `useToastAfter(pending)` (`hooks/use-toast-after.ts`) so it appears right after the loader ends, not while it still spins. Error toasts stay immediate.

## Modals, popups and dialogs (unified pattern)

- **Always use the standard Dialog structure**: Every modal must use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, and `DialogFooter` from `@/components/ui/dialog`.
  - **Sizing & Scrolling**: `DialogContent` must always carry `className="max-h-[90dvh] overflow-y-auto sm:max-w-md"` (or `sm:max-w-lg` for large multi-item lists). This ensures responsive presentation on mobile and desktop without viewport overflows.
  - **Header & Close Button**: `DialogHeader` renders the title, description, and an accessible 'X' close button. Close triggers in header/footer must always have `type="button"` so they do not inadvertently trigger form submit inside `<form>`.
  - **Form Fields inside Modals**: Use standard shared form components from `@/components/form` (`TextField`, `TextAreaField`, `SelectField`, `SwitchField`) inside `FIELD_STACK` (`space-y-1.5`) or `FIELD_GRID` (`gap-x-4 gap-y-1.5`).
  - **Footer Action Buttons**: Footer buttons must consistently use `rounded-full`, have `gap-1.5`, and pair text with an action icon:
    - Cancel / Close: `<Button type="button" variant="outline" className="gap-1.5 rounded-full"><XIcon className="size-4" /> Cancel</Button>`
    - Primary Save / Submit: `<Button type="submit" className="gap-1.5 rounded-full">{pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon className="size-4" />} Save</Button>`
    - Action Send / Submit: `<SendIcon className="size-4" />`
    - Destructive: `<Button type="button" variant="destructive" className="gap-1.5 rounded-full">{pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon className="size-4" />} Delete</Button>`
- **Confirmations**: **Never build custom inline "Are you sure?" confirmation dialogs.** Always reuse `<ConfirmDialog>` (`components/shared/confirm-dialog.tsx`):
  - Any click that changes data and is hard to undo opens `<ConfirmDialog>` first: cancel, delete, refund, verify/reject payment, status change, pickup, withdraw request, sign out.
  - Not for add-to-cart, wishlist, filters, or forms saved with `StickySaveBar`.

## Dashboard range

Default is the current **financial year** (April–March, India), compared with the same stretch of last year. Other options: this month, a particular month (`?month=YYYY-MM`), custom dates (spans over ~3 years and impossible dates like `2026-02-31` are ignored and fall back to the default). See `features/orders/dashboard-range.ts`.

## Database migrations (Claude applies them)

- The Supabase CLI is logged in and linked to the **production** project (`nepfgwfunxebhsfrfxeb`); there is no staging. Always pass `--remote` (without it the CLI targets a local Docker stack that isn't running).
- Flow: write `supabase/migrations/00NN_name.sql`, read it, run `npx --no-install supabase db push --remote --dry-run` (its own command), read the output, then `npx --no-install supabase db push --remote --yes` (its own command, never chained with the dry run). Then verify against the real DB (see below).
- Migrations 0001–0045 are applied. Never edit an applied file; fix forward with a new one. Re-running an old file reverts newer function bodies (`create or replace`).
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

Not verified in a browser yet (code is done, `tsc` / `eslint` / `npm run test` are green)
1. Skeleton changes made without a browser check: the admin hard-reload frame order is now monotonic (the layout's header-only Suspense fallback was removed, `AdminGate` renders nothing next to the page); table skeleton blocks are rounded (`clip-path` on text-only `td`/`th` in `globals.css`, light + dark, 1280 + 360); placeholder counts were aligned by reading code (order detail with a return, dashboard 5 top products / 6 recent, orders 20 rows, products 12, launch 9, product 3 photos). Re-measure landmark deltas (target ≤ 24 px for list-length-dependent lists, 0-8 px elsewhere), check the 360 px orders header for a stray white cell, and the 14 px timeline-dot difference on `/account/orders/<code>`. The dev data has only 7 orders / 12 products, so the 20-row orders skeleton is taller than the real list there.
2. UI changes only checked by types / lint / tests: `/track` courier + tracking wrap at 360 px, "Part refunded" vs "Refund done" label (`returns-list.tsx`), return form quantity defaults to 1 for a single one-piece line, "Withdraw request" confirm dialog. Also not opened: the WhatsApp message text for a delivered order with a return stage (customer text must have no amounts) and "Reject" with an empty reason.
3. Console warnings on the product page ("state update on a component that hasn't mounted yet"; Next dev warning about uncached data outside Suspense on `/products/[slug]`) were never reproduced. Needs the stack trace from the `next dev` terminal.

12. Scroll on navigation (`<ScrollReset />`): the `/products` filter was checked on a phone and works. Still to check on a phone and on desktop: scroll down on the home page and open a category, a product, Cart, Account, then scroll down on those and open another page: each must open at the top and stay there; back/forward restores the old position; a `#hash` link still jumps.

Deploy / environment (the user does these)
5. Vercel: set `RATE_LIMIT_SALT` for Production (production logs a warning while it is unset) and `NEXT_PUBLIC_SITE_URL` to the real domain (it feeds sitemap, canonical, OG URLs and the admin slug hint), then redeploy. Deploy the code together with migrations 0022+: since 0022 a guest needs the FULL phone number to cancel an order, so older deployed code gets "order not found" on guest cancel.
6. Not exercised: the PWA install prompt, and the production CSP's `upgrade-insecure-requests` on a real https origin (only checked over http on localhost).

Known limitations / design decisions to revisit
7. Return stages: there is no "refund initiated" state (the DB has nothing between "goods back" and "money refunded"; it shows as "Return received, no refund recorded yet"). A refund made on the payment card (`refund_order`) is cash only and is not tied to a specific return. `refund_return` / `record_order_return` refund the shipping fee together with the last item. The "Returns refunded" / "Received, refund pending" views use the newest 100 order ids (URL length).
8. `payment_status` set to `refunded` directly through PostgREST is accepted on any order status (the server action and UI refuse it; no DB guard for unpaid -> refunded).
9. A signed-in owner of a non-pending order who opens `/track` still sees the "full mobile number" field in the cancel dialog (`track_order` doesn't say who the owner is; the server accepts the owner without a phone). Guests cannot edit delivery on `/track` at all (WhatsApp message instead).
10. CSP keeps `'unsafe-inline'` in `script-src` (a nonce policy would force every page dynamic and lose the static shell). The admin login limiter fails open on purpose (Supabase Auth has its own limits).
11. `dashboard_stats` scans the whole date range (add a rollup when orders reach tens of thousands). `getDashboard` tile counts and `orderViewFilter` are not unit-tested (private in `admin-queries.ts`). The admin account page leaves some empty space under the Password card at ≥ 1024 px. Optional: demo mode (`isSupabaseConfigured` guards, `features/products/demo-data.ts`) could move to one boundary or go; `features/account/*` vs `features/auth/account-*` naming overlap.
