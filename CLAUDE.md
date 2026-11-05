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

## Other rules

- Pages stay thin; business logic goes in `src/features/<feature>/` (queries, actions, schema, types).
- Every Server Action validates with Zod and checks auth itself (`assertAdmin()` / `getCurrentUser()`).
- Database changes go in a new numbered file in `supabase/migrations/` (never edit an applied one) and need to be mentioned to the user, who runs them in the Supabase SQL Editor.
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

Default is the current **financial year** (April–March, India), compared with the same stretch of last year. Other options: this month, a particular month (`?month=YYYY-MM`), custom dates. See `features/orders/dashboard-range.ts`.
