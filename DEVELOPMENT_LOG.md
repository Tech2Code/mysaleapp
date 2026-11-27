# Development Log — Kalakriti (MySaleApp)

Chronological log of all features, UI redesigns, bug fixes, root-cause analyses, and database migrations from project inception. Updated automatically after every completed task.

---

## Historical Milestones (2026-11-05 → 2026-11-26)

| Date & Time (IST) | Commit | Summary of Changes |
| --- | --- | --- |
| 2026-11-05 11:36 | `6844d17` / `d1329f4` | Initial project bootstrap (Next.js App Router + Supabase). |
| 2026-11-05 18:16 | `e79edba` | Built core storefront & admin: UPI payment flow, cancel flow, admin tools, PWA install support. |
| 2026-11-05 22:11 | `43786f2` | Added per-element dev IDs, form spacing polish, security and stock migrations. |
| 2026-11-05 22:28 | `f04c70f` | Auto-release of unpaid orders, returns with per-item restock, dashboard date range dropdown. |
| 2026-11-05 22:44 | `0e725ed` | Customer return requests, unpaid-order notices, financial-year (FY) dashboard range. |
| 2026-11-06 07:02 | `95bafa8` | Login success tick in busy overlay, loading skeletons (`<Skeletonize>`), and UI polish. |
| 2026-11-06 15:37 | `a3a340e` | Added GST invoices, pincode lookup, rate limiting, and Vitest test suites. |
| 2026-11-06 15:43 | `5beacd4` | Bumped `@types/node` to `^22` for Vitest peer dependency compatibility. |
| 2026-11-06 16:03 | `1e52ddd` | Forced `Asia/Kolkata` timezone across all date/time formatters. |
| 2026-11-07 10:17 | `60804c6` | Documented migrations flow, tests, rate limiting, and pending work in `CLAUDE.md`. |
| 2026-11-07 13:14 | `349ae14` | Pre-launch audit fixes, GST/invoice settings, derived skeletons, order locking. |
| 2026-11-07 13:35 | `e70eaf0` | Fixed page navigation scroll position so every page opens cleanly at the top. |
| 2026-11-07 13:39 | `f56532e` | Switched logo and PWA app icons to a fixed brand glyph. |
| 2026-11-07 15:44 | `ce18d22` | Fixed blank gap under short product lists, hardened scroll-to-top, removed broken-image look. |
| 2026-11-07 18:09 | `99ec0ec` | Return pickup flow, items-only refunds, unified status badge, global search, audit fixes. |
| 2026-11-07 19:17 | `98a4bb3` | Courier popup, input validation limits, refund-before-dispatch guard, toast after loader. |
| 2026-11-11 12:04 | `accc9bd` | Smart shipping rules, modern date field, dialog & toast enhancements, UI refinements. |
| 2026-11-11 21:17 | `350f2e8` | Enforced ellipsis truncation on select fields, dialog body scrolling, responsive order views. |
| 2026-11-12 12:26 | `52ffdd1` | Hardened order, payment, return, and refund flows with tests and docs. |
| 2026-11-12 13:03 | `bde0219` | Improved invoice print layout, settings pincode lookup, updated rejected payment wording. |
| 2026-11-12 15:35 | `a91aa46` | Added FY/month order filters with live counts, fixed profile phone validation & live invoice contact info. |
| 2026-11-12 17:21 | `c22932c` | Added Google indexing and Supabase production DB setup guides; order search updates. |
| 2026-11-13 11:17 | `db8ea60` | Fixed hero layout & spacing, sold-out ordering, scroll restoration, search/filter UX, admin form state. |
| 2026-11-13 14:51 | `3822542` | Resolved edge-case state machine transitions in admin and storefront UI. |
| 2026-11-13 17:25 | `8dfffed` | Preserved unsaved images on cancel/refresh, reset forms on `<Activity>` hide, fixed back scroll restoration. |
| 2026-11-13 18:21 | `cdc7f57` | Registered `popstate` before Next.js router for reliable back-scroll restoration; synced docs. |
| 2026-11-18 13:57 | `96fc270` | Smart search, account tabs, stacked CTA prices, pincode match state, mobile UPI QR toggle. |
| 2026-11-18 17:20 | `3a6a5cb` | Hardened customer & admin auth flows, wishlist sync, pre-deploy audit fixes. |
| 2026-11-19 13:54 | `8e3f25b` | Hardened RLS policies, state transitions, admin audit logs, 4-digit PIN lock & UI. |
| 2026-11-19 22:01 | `b7454df` | Added promo codes, verified product reviews, return exchanges, and account deactivation. |
| 2026-11-19 23:11 | `b1830f5` | Fixed sign-out redirect, password reset recovery URLs, admin email check, reviews hash scroll. |
| 2026-11-20 12:39 | `4e8136c` | Added per-product return windows, 1600px admin container, standard cancel return/exchange copy. |
| 2026-11-20 15:29 | `9ff0376` | Full-stack QA audit fixes across security, admin, storefront, UI/UX, and RPCs (migration `0059`). |
| 2026-11-20 17:19 | `ee33cac` | Return pickup address selector, fixed admin PIN lock modal and QA audit edge cases. |
| 2026-11-23 12:05 | `4ba6e76` | Responsive header theme toggle, image lazy-load polish, `orderCode` admin URLs, single-popup return address steps. |
| 2026-11-23 15:03 | `1b0d5c7` | Audited and hardened storefront, admin, and shared UI state machines. |
| 2026-11-23 16:07 | `7503496` | Reviews mobile horizontal carousel, sort/filter, dynamic category/product aspects. |
| 2026-11-24 11:20 | `1e01384` / `a72b4c9` | Extracted semantic admin CSS classes, refined checkout/account styling, merged `ui-redesign`. |
| 2026-11-24 22:06 | `be1bcc2` | Migrated entire UI to plain CSS Modules (zero Tailwind), borderless tonal depth, legal compliance & micro-interactions. |
| 2026-11-25 12:11 | `232b96a` | 3-step return wizard, separated dialog header, product carousels, and **SalesChart Fix #1** (replaced Catmull-Rom with Fritsch–Carlson monotone cubic spline to prevent zero-dip overshoot). |
| 2026-11-25 17:28 | `25081c1` | Plug-and-play payment gateway readiness, deep audit fixes (`0061`–`0062`), and setup docs. |
| 2026-11-25 18:28 | `e1985ba` | Fixed mobile cart drawer link navigation and checkout payment dialog crash. |
| 2026-11-26 17:13 | `68ded4d` | Dual CSS variable theme system (`theme-store.css` + `theme-admin.css`), doorstep exchange courier flow & estimated delivery dates. |

---

## Detailed Session Entries

### 2026-11-27 (Early Session) — Checkout 3-Step Flow, Mobile App Shell, Admin PIN Flash, iOS Install Prompt, Back-in-Stock & Admin Bento Dashboard

- **Prompts Covered**:
  1. Redesign checkout flow so Price Summary & Promo Code stay in Order Summary and lock cleanly on the Payment screen (web + native mobile app feel).
  2. Fix "Admin screen is locked" brief flash after entering the 4-digit PIN.
  3. Upgrade mobile checkout to a full-view native app shell with modern step counter.
  4. Fix Safari "Tap Share -> Add to Home Screen" prompt showing on non-Safari browsers.
  5. Implement all 3 Back-in-Stock features (Notify me on WhatsApp + Admin alerts, 7-day "Back in stock" badge, Wishlist "Back in stock" banner + 1-tap Add to cart) and push DB migration `0068`.
  6. Redesign Admin Dashboard cards into a balanced, row-aligned bento layout for desktop and mobile app feel.
- **Key Fixes & Changes**:
  - **Checkout**: Split into `Delivery` → `Order Summary` (collapsible promo) → price-locked `Payment`, with native full-view mobile app header, modern progress stepper, and sticky bottom bar.
  - **Admin PIN Unlock**: Held `pinLockBackdrop` + `useBlockWhile` during `startUnlockRefresh(() => router.refresh())` in `src/components/admin/admin-account-menu.tsx`.
  - **iOS Install Prompt**: Restricted manual Safari hint strictly to Apple Safari (`src/hooks/use-install-prompt.ts`) and hid auto-banner on focused routes (`src/components/store/install-prompt.tsx`).
  - **Back-in-Stock**: Added migration `supabase/migrations/0068_back_in_stock.sql` (`restocked_at` trigger on `0 -> >0` stock + `stock_alerts` table), pushed to remote Supabase; wired storefront Notify modal, 7-day green badges, Wishlist alert banner, and Admin `/admin/products` 1-tap WhatsApp notify panel.
  - **Admin Dashboard Bento**: Rebuilt `src/components/admin/dashboard/dashboard-body.tsx` & `src/components/admin/admin-core.module.css` into a 12-column row-aligned desktop bento + mobile hero Revenue + 2-col Orders/AOV stream.

---

### 2026-11-27 11:51 IST — Fix Admin Skeleton Loading Across All Admin Pages

- **User Prompt**: `"admin page ka skelaton loading hi nah aa rha? sabhi pages ka ek baar dubar achek kar lena sahi or kisi page me bhi , na aa rah aho corect skelaton loading . web and mobile both check karna."`
- **Problem / Root Cause**:
  - In `src/app/admin/(panel)/layout.tsx`, `{children}` was wrapped inside `<Suspense fallback={null}><AdminGate>{children}</AdminGate></Suspense>`.
  - Because `<AdminGate>` is an async Server Component, React suspended at the layout's `fallback={null}` (showing a blank screen) instead of rendering each admin page's `loading.tsx` (`<Skeletonize>`).
- **Solution / Fix**:
  - Moved `<AdminGate />` to sit as a sibling next to `{children}` inside `<main>` (matching `AccountLayout`), allowing every admin page's `loading.tsx` skeleton to render immediately on frame 0 (web & mobile).
  - Added `requireAdmin({ allowWhenPinLocked: true })` and `isAdminPinLocked()` guard directly in `src/app/admin/(panel)/(dashboard)/page.tsx` before `getDashboard()` to prevent any redirect loop or data leak when PIN-locked.
  - Audited all other layouts and `loading.tsx` files across web & mobile (`loading-contract.test.ts`: 38/38 passed; total 837/837 tests passed).
- **Files Modified**:
  - `src/app/admin/(panel)/layout.tsx`
  - `src/app/admin/(panel)/(dashboard)/page.tsx`

---

### 2026-11-27 11:54 IST — Fill Blank Space Below Sales Performance Chart on Desktop

- **User Prompt**: `".admin-core-module__8Bpstq__salesChartWrap .admin-core-module__8Bpstq__chartPlotFlex vala jo section h vo box ke niche tak ya niche hona chaiye na kue ki abhi inke niche blank sapace dikh raha h , web me"`
- **Problem / Root Cause**:
  - `.dashboardCardBody` was not a flex column, and `.salesChartWrap`, `.chartPlotFlex`, `.yAxisCol`, and `.plotCanvas` had a hardcoded `height: 224px`. On desktop, when the `Sales performance` card stretched to match `Action queue`, ~140px of empty white space appeared beneath the chart.
- **Solution / Fix**:
  - Made `.dashboardCardBody`, `.salesChartWrap`, `.chartPlotFlex`, `.plotMainCol`, and `.plotCanvas` fluid flex-grow containers with `min-height: 224px` (preserving mobile height while filling the card on desktop).
  - Matched `.yAxisCol` bottom offset (`margin-bottom: 24px`) to `.xAxisRow` (`margin-top: 8px + height: 16px`) so Y-axis ticks stay aligned with gridlines.
- **Files Modified**:
  - `src/components/admin/admin-core.module.css`

---

### 2026-11-27 12:03 IST — Fix Sales Performance Line Chart Accuracy & X-Axis Alignment + Create Automatic Development Log

- **User Prompt**:
  1. `"sales performance vala jo line vala chart h usme line accurate nahi ban rahi h, ye 2nd time h jab esa ho raha h, men pehle bhi ese, fix kiya tha, ye fir kese aagaya?"`
  2. `"m jine bhi promt de kar tumse jitne task sena hu ya kuch fix karvata hu , uske liye tum ek development log bana rahe ho na, ye automatically update hote harne chaye har changes har bug fixes , kue kiya kaya problem thi kese kiya etc asab kush es log file me time date stamp ke saath or promt kaya diya tha sab kuch store hona caiye tha app development ke starting se."`
- **Problem / Root Cause**:
  1. **SVG Stroke Distortion (`pathLength={1}` + `stroke-dasharray: 1`)**: `sales-chart.tsx` used `pathLength={1}` with `.adminLineDraw { stroke-dasharray: 1 }` on an SVG with `preserveAspectRatio="none"` and `vectorEffect="non-scaling-stroke"`. Stretching the chart container vertically caused Chromium's non-uniform SVG scaling to miscompute dash length, making the line appear inaccurate/clipped.
  2. **X-Axis Label Drift**: In `area` mode, SVG points are plotted at `i / (N - 1) * 100%`, while `xAxisRow` rendered `N` equal flex columns (`left: 0` at `i / N * 100%`), shifting date labels to the left of their peaks.
  3. **Missing Development Log**: No `DEVELOPMENT_LOG.md` existed yet because global rules prevented creating `.md` files without explicit user command.
- **Solution / Fix**:
  1. Replaced `stroke-dasharray: 1` / `pathLength={1}` on `.adminLineDraw` with a pure `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` reveal so the SVG line is always a solid, undistorted path at any container size; added `key={`${metric}-${points.length}`}` for clean Revenue/Orders re-animation.
  2. Added `.xAxisAreaRow` / `.xAxisAreaLabel` positioning each area-chart X-axis label at exact `left: ${xPct}%` (matching SVG data points pixel-for-pixel) with edge-safe alignment.
  3. Created `DEVELOPMENT_LOG.md` backfilled from commit #1 (`2026-11-05`) and added the automatic update rule to `C:\Users\User\.gemini\config\GEMINI.md`.
- **Files Modified**:
  - `src/app/admin/admin.css`
  - `src/components/admin/sales-chart.tsx`
  - `src/components/admin/admin-core.module.css`
  - `DEVELOPMENT_LOG.md` (created)
  - `C:\Users\User\.gemini\config\GEMINI.md`

---

### 2026-11-27 12:10 IST — Fix `/admin/products` Crash (Infinite Re-Render on Loading Skeleton + Hydration Mismatch on Restocked Alerts)

- **User Prompt**: `"abhi mne out of produt ka stoct kya h, http://localhost:3000/admin/products page hi break hogaya?"`
- **Problem / Root Cause**:
  1. **Infinite Re-render Loop**: `ProductsView` defaulted `stockAlerts = []` (allocating a brand-new array reference on every render) while syncing state via `if (stockAlerts !== prevStockAlerts) { setPrevStockAlerts(stockAlerts); setAlerts(stockAlerts) }`. Once `/admin/products/loading.tsx` started rendering after the admin skeleton fix, calling `<ProductsView products={placeholderProducts(12)} />` without `stockAlerts` triggered an infinite re-render crash (`Too many re-renders`).
  2. **SSR Hydration Mismatch**: `buildRestockWaHref` read `typeof window !== "undefined" ? window.location.origin : ""` during render, producing a different `href` on SSR vs client whenever a restocked product had a waiting WhatsApp alert.
- **Solution / Fix**:
  1. Extracted a stable module-level `EMPTY_STOCK_ALERTS: StockAlert[] = []` constant for the `stockAlerts` default prop.
  2. Replaced `window.location.origin` with `siteConfig.url` in `buildRestockWaHref` so server and client `href` values match 100%.
- **Files Modified**:
  - `src/components/admin/products-view.tsx`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 12:13 IST — Fix Stretched Discount Badge Width When Paired With Back-in-Stock Badge

- **User Prompt**: `"jis product me back in stock aata h us product class=\"product-card-module__Dd7Zsq__discountBadge\" ki width bhi bad jati h? kue"`
- **Problem / Root Cause**:
  - `.mediaFrame .badgeStack` used `display: flex; flex-direction: column;` without `align-items: flex-start;`. Flexbox defaults to `align-items: stretch`, which stretched `.discountBadge` to match the wider `.backInStockBadge` pill below it.
- **Solution / Fix**:
  - Added `align-items: flex-start;` to `.mediaFrame .badgeStack` so every badge pill keeps its own natural compact width.
- **Files Modified**:
  - `src/components/store/product-card.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 12:17 IST — Align Card Inner Heights & Badge Pill Heights Across Storefront & Account Grids

- **User Prompt**: `"product card me elemnt hi height kuch or h but inspect karne pe browser pe size to utan hi h but alg dikhata h view me? agar eska kuch fix mile to app me sabhi jagh bhi chek karna ki esa problem or to nahi mile to , fix kar dena sabhi jagh sahi se"`
- **Problem / Root Cause**:
  1. **Product Cards (`product-card.module.css`)**: `.productCard` stretched to `height: 100%` (same box height in DevTools across a grid row), but `.cardBody` lacked `flex: 1 1 0%` and `.priceRow` lacked `margin-top: auto`, causing 1-line vs 2-line title cards to end at different visual heights with uneven price rows / bottom gaps.
  2. **Badge Pill Heights (`product-card.module.css`)**: `.discountBadge` and `.soldOutBadge` were plain inline spans inheriting `line-height: 1.5`, while `.backInStockBadge` used `inline-flex` with `font-size: 10.5px` and no `>= 640px` breakpoint rule — making stacked badges visually different heights.
  3. **Saved Address Cards (`account.module.css`)**: `.addressesGrid .addressCardItem` stretched to equal row height on desktop, but `.addrCardActions` had `margin-top: 16px` instead of `margin-top: auto`, leaving uneven bottom footers across 2-column address cards.
- **Solution / Fix**:
  - Set `.cardBody { flex: 1 1 0%; }` and `.priceRow { margin-top: auto; padding-top: 4px; }` on `ProductCard` so prices align along one clean baseline across every row.
  - Normalized all 3 product card badges (`.discountBadge`, `.soldOutBadge`, `.backInStockBadge`) to `display: inline-flex; align-items: center; line-height: 1;` with matching mobile (`4px 8px`, `11px`) and desktop (`5px 10px`, `12px`) sizing.
  - Updated `.addrStreet` (`margin-bottom: 16px`) and `.addrCardActions` (`margin-top: auto`) in `account.module.css` so address card footers align across rows.
  - Audited Admin Products tiles, Admin Orders tiles, and Product Reviews carousel cards (all already using `justify-content: space-between` cleanly).
- **Files Modified**:
  - `src/components/store/product-card.module.css`
  - `src/components/account/account.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 12:38 IST — PWA Icon Cache-Bust & Animated Launch Splash, Track Order Fixed Prefix, Universal Store Copy & Full Product Variants (Migration 0069)

- **User Prompt**:
  1. Fix installed mobile PWA still showing the old "K" logo instead of the current brand glyph, and add a smooth branded animated launch splash for web & mobile.
  2. Fix the store order prefix (`KK-`) in Track Order input so customers only type/paste the suffix, and copy only the suffix after the prefix.
  3. Apply Option B: make the entire storefront 100% universal / niche-agnostic (removing hardcoded handmade/artisan copy & search biases) + implement full Product Variants (Size / Colour / Capacity / Pack with per-variant price & stock) end-to-end.
- **Problem / Root Cause**:
  1. `public/sw.js` cached `/icons/*` cache-first in `static-v4` and `manifest.ts` had no version query parameter, causing mobile WebAPKs to retain the old cached "K" icon.
  2. Track Order required typing the full `KK-XXXXXX` prefix manually and copy buttons copied the full prefixed code.
  3. 10 storefront UI files and search scoring still contained hardcoded "handmade / artisan / crafted" assumptions, and products only supported a single SKU (price + stock).
- **Solution / Fix**:
  1. **PWA Icon & Branded Animated Splash**: Bumped `public/sw.js` to `v5`, versioned manifest icons (`/icons/192?v=2`, `/icons/512?v=2`, `/icons/maskable-512?v=2`), added `Cache-Control` on `src/app/icons/[size]/route.tsx`, and added `AppSplash` (`src/components/shared/app-splash.tsx` + `app-splash.module.css`) mounted in `Providers` for a fast, reduced-motion-safe branded animated launch on cold open (web & mobile).
  2. **Track Order Fixed Prefix & Suffix Copy**: Added `stripOrderPrefix` / `composeOrderCode` helpers (`src/features/orders/types.ts`), rendered a fixed `{prefix}-` addon in `TrackOrder` that auto-strips pasted prefixes and still supports legacy prefixes, and updated customer copy buttons (`order-placed.tsx`, `track-order.tsx`, `account-views.tsx`) to copy the clean suffix.
  3. **Universal Storefront & Search**: Replaced hardcoded handmade/artisan copy across Header, Footer, How It Works, About, FAQ, Legal/Terms, Privacy, Cookie Banner, Sign-in, Empty Category, Product Detail, and Product Actions; removed hardcoded handmade category biases from `scoreProductSearch`.
  4. **Full Product Variants (Option B)**: Added `supabase/migrations/0069_product_variants.sql` (`products.variants jsonb` + variant-aware atomic `create_order` RPC), extended `Product` / `productSchema` / `saveProduct` / `CartStore` (`cartLineKey`) / `useLiveCart`, added the Admin Product Form Variants builder, Storefront Variant Pill Selector with live price/stock/WhatsApp notify, Product Card `From ₹X` + option redirect, and Cart/Checkout variant line rendering.
- **Files Modified**:
  - `src/app/manifest.ts`, `public/sw.js`, `src/app/icons/[size]/route.tsx`, `src/components/shared/app-splash.tsx`, `src/components/shared/app-splash.module.css`, `src/components/shared/providers.tsx`
  - `src/features/orders/types.ts`, `src/features/orders/types.test.ts`, `src/components/store/track-order.tsx`, `src/components/store/order-status.module.css`, `src/components/store/order-placed.tsx`, `src/components/account/account-views.tsx`
  - `src/components/store/header.tsx`, `src/components/store/footer.tsx`, `src/components/store/how-it-works.tsx`, `src/components/store/category-view.tsx`, `src/components/store/page-views.tsx`, `src/components/store/faq-view.tsx`, `src/app/(store)/faq/page.tsx`, `src/components/store/legal-view.tsx`, `src/components/shared/cookie-banner.tsx`, `src/components/store/google-sign-in.tsx`, `src/components/store/product-detail-view.tsx`
  - `supabase/migrations/0069_product_variants.sql`, `src/features/products/types.ts`, `src/features/products/schema.ts`, `src/features/products/schema.test.ts`, `src/features/products/actions.ts`, `src/features/orders/schema.ts`, `src/store/cart.ts`, `src/components/store/live-cart.ts`, `src/components/admin/product-form.tsx`, `src/components/admin/admin-views.module.css`, `src/components/store/product-actions.tsx`, `src/components/store/product-actions.module.css`, `src/components/store/product-card.tsx`, `src/components/store/cart-drawer.tsx`, `src/components/store/cart-view.tsx`, `src/components/store/checkout-form.tsx`, `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:04 IST — Push Migration 0069, Rebuild Admin Variants UI as Modal + Presets, and Add Research-First UI Global Rule

- **User Prompt**:
  1. Push migration `0069_product_variants.sql` to remote Supabase.
  2. Convert Admin `Variants & options (optional)` into a modern popup dialog (web + mobile full-screen sheet) and permanently adopt a Research-First UI/UX standard before building any UI.
  3. Find top-rated UI/design/frontend skills & plugins from the marketplace.
  4. Deep-audit all 3 flows (PWA splash/icon, Track Order prefix, Universal Store + Product Variants).
- **Problem / Root Cause**:
  - Inline stacked variant inputs inside the narrow `380px` right sidebar of `ProductForm` felt cramped and required too much scrolling.
- **Solution / Fix**:
  1. Pushed `0069_product_variants.sql` to production Supabase (`nepfgwfunxebhsfrfxeb`).
  2. Replaced inline stacked variant fields in `src/components/admin/product-form.tsx` with a Shopify/Stripe hybrid pattern: a clean compact summary list (option label, price, MRP, stock pill, SKU, edit/delete) + 1-tap quick presets (`S / M / L`, `250g / 500g / 1 kg`, `Pack of 1 / 2`) + a spacious `Dialog` (`mobileFullScreen` on phones) with quick-fill chips, inline validation, and `Save & add another` for rapid entry.
  3. Added the permanent **Research-First Best-in-Class UI & UX** rule to `C:\Users\User\.gemini\config\GEMINI.md`.
- **Files Modified**:
  - `src/components/admin/product-form.tsx`
  - `src/components/admin/admin-views.module.css`
  - `C:\Users\User\.gemini\config\GEMINI.md`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:22 IST — Fix Variant Price/Label/SKU Loss in Checkout & Cart + Shopify-Style Auto-Managed Pricing & Stock

- **User Prompt**:
  1. Selecting a Large variant and going to checkout did not show the selected variant size, SKU, or the variant's correct price.
  2. Asked how base `Pricing & stock` in Admin should behave when variants define per-option pricing and stock.
- **Problem / Root Cause**:
  1. `src/app/(store)/checkout/page.tsx`, `src/app/(store)/cart/page.tsx`, and `src/app/(store)/layout.tsx` projected `LiveProduct` objects with an explicit destructuring `.map(...)` that **omitted `variants`**. As a result, `useLiveCart` saw `live.variants === undefined`, fell back to the base product price, and overwrote the chosen variant's price.
  2. `checkout-form.tsx` rendered `l.name` without `l.variantLabel` or `l.variantSku`, and `CartItem` did not carry `variantSku`.
  3. `ProductForm` showed editable base Price / MRP / Stock inputs alongside Variants, creating two conflicting places to edit price & stock.
- **Solution / Fix**:
  1. Passed `variants` through `LiveProduct` in `checkout/page.tsx`, `cart/page.tsx`, and `(store)/layout.tsx`.
  2. Added `variantSku` to `CartItem`, `useLiveCart`, `ProductActions`, `CartDrawer`, `CartView`, and `CheckoutForm` (all 4 checkout summary surfaces now display option label, SKU, and exact live variant price).
  3. Updated `ProductForm` `Pricing & stock` section so when `variants.length > 0`, conflicting base Price/MRP/Stock inputs are replaced by a clean auto-synced read-only summary card (Price range + Total stock), while automatically syncing hidden base form fields when variants change.
- **Files Modified**:
  - `src/app/(store)/checkout/page.tsx`, `src/app/(store)/cart/page.tsx`, `src/app/(store)/layout.tsx`
  - `src/store/cart.ts`, `src/components/store/live-cart.ts`, `src/components/store/product-actions.tsx`
  - `src/components/store/cart-drawer.tsx`, `src/components/store/cart-view.tsx`, `src/components/store/checkout-form.tsx`
  - `src/components/shared/order-summary.tsx`, `src/features/orders/types.ts`
  - `src/components/admin/product-form.tsx`, `src/components/admin/admin-views.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:28 IST — Industry-Standard Variant Metadata Pills Below Product Titles (Cart, Checkout & Order Summary)

- **User Prompt**: `"size details order summary etc me name ke aage mat daalo , web reserch kar baaki ecommerce kese ui rakhti h iska? usi hisab se best possible ui rakho"`
- **Problem / Root Cause**:
  - Variant labels were concatenated inline after the product title (`Name — Large` / `Name (Large)`) and internal SKU codes were shown in customer-facing cart/checkout screens.
- **Solution / Fix**:
  - Researched Shopify, Amazon, and Myntra cart/checkout UX: kept product titles 100% clean on Line 1, moved variant option into a crisp subtle metadata pill directly beneath the title on Line 2, and kept internal SKUs strictly Admin-only (`audience === "admin"` in `OrderSummary`) so consumer checkout stays clean and uncluttered.
- **Files Modified**:
  - `src/components/store/checkout-form.tsx`, `src/components/store/checkout-form.module.css`
  - `src/components/store/cart-drawer.tsx`, `src/components/store/cart-view.tsx`, `src/components/store/cart.module.css`
  - `src/components/shared/order-summary.tsx`, `src/components/shared/shared.module.css`
  - `src/components/store/product-actions.tsx`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:38 IST — Shopify-Grade Multi-Option Variant Matrix (Color × Size) & Decoupled Storefront Attribute Selectors

- **User Prompt**: `"varients and sizes etc ka option abhi mujhe samajh nahi aa raha? kue ki admin pannel me m kese manage karu, man lo mujhe ek hi size me 4-5 color or ek hi color me diff sizes h to un combnation ko admin pannel se kese manage karu or vo app me user ko kese dikhengi, ye sab ek deep web reserc karke, nikal baaki apps ecommerce ki kese use karti h, ye sab reserch kar ke, best possilble ui as per our compititers apply karo flow ko."`
- **Problem / Root Cause**:
  - Earlier variants were a flat list of labels, forcing admins to manually enter every Color × Size combination and showing customers a flat list of combined labels instead of separate Color and Size selectors.
- **Solution / Fix**:
  1. **Multi-Attribute Variant Data (`options?: Record<string, string>`)**: Added structured `options` (e.g. `{ Color: "Black", Size: "M" }`) + `extractVariantOptionGroups` to `src/features/products/types.ts`, raised `MAX_VARIANTS` to 60 in `schema.ts`, and persisted `options` in `products.variants` JSONB (zero new DB migration required, 100% backward-compatible with existing variants).
  2. **Admin Shopify-Style Variant Matrix Modal (`src/components/admin/variant-matrix-modal.tsx` + `.module.css`)**:
     - Step 1: Define up to 3 option groups (`Color`, `Size`, `Storage`, `Weight`, etc.) with 1-tap templates (`Color + Size`, `Size only`, `Color + Storage`, `Weight / Pack`) and tag-chip value input.
     - Step 2: Auto-generates all combinations (preserving existing prices/stocks/SKUs), provides a **Bulk Apply Bar** (`All Prices`, `All MRP`, `All Stock` → Apply to all), inline per-combination editing, and 1-click deletion for non-existent combinations (zero ghost SKUs). Full-screen native sheet on mobile.
  3. **Storefront Decoupled Attribute Selectors (`src/components/store/product-actions.tsx` + `.module.css`)**:
     - Renders separate `Color` (with automatic color swatch dots) and `Size` selector rows (Amazon / Myntra / Flipkart pattern).
     - Dynamically evaluates cross-combination availability (dimmed strikethrough on sold-out combinations, smart fallback when switching colors, live price/MRP/stock & mobile Buy Bar updates).
- **Files Modified**:
  - `src/features/products/types.ts`, `src/features/products/schema.ts`, `src/features/products/schema.test.ts`, `src/features/products/actions.ts`
  - `src/components/admin/variant-matrix-modal.tsx` (created), `src/components/admin/variant-matrix-modal.module.css` (created), `src/components/admin/product-form.tsx`
  - `src/components/store/product-actions.tsx`, `src/components/store/product-actions.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:51 IST — Live Hero Price Sync on Product Page, End-to-End Multi-Variant Key Fixes & Smart Attribute-Rule Bulk Pricing in Admin

- **User Prompt**:
  1. Top hero price (`.mainPriceText`) on the product page did not update when selecting Color/Size combinations.
  2. Audit all other price displays and the entire end-to-end order flow for bugs.
  3. Add smart attribute-based pricing/stock rules in Admin (e.g., set price by Size across all Colors, or by Color across all Sizes, or one price for all).
- **Problem / Root Cause**:
  1. `ProductDetailView` rendered static `product.price` / `product.compareAtPrice` / `Save X%` in the Server Component while `selectedVariantId` lived inside `ProductActions`.
  2. `track-order.tsx` and `invoice-document.tsx` keyed order items by `productId` alone, which would collide if a customer ordered two different variants of the same product in one order.
  3. `VariantMatrixModal` only supported "Apply to all" or editing each combination row individually.
- **Solution / Fix**:
  1. Added `ProductVariantProvider` + `ProductLivePriceHeader` (`src/components/store/product-actions.tsx`, wired in `src/components/store/product-detail-view.tsx`) so selecting any Color/Size updates the top hero price, MRP, `Save X%` badge, Buy Now button, and Mobile Sticky Bar in real time.
  2. Fixed React list keys in `track-order.tsx` and `invoice-document.tsx` to use `${productId}::${variantId}` for multi-variant orders.
  3. Upgraded `VariantMatrixModal` (`src/components/admin/variant-matrix-modal.tsx` + `.module.css`) with **Smart Rule Tabs** (`Bulk / Same price`, `Price by Size`, `Price by Color`, etc.) and a scoped **"Apply to"** bulk filter (`All combinations`, `By Size: S/M/L`, `By Color: Black/Red`) so admins can price & stock 20+ combinations in seconds.
- **Files Modified**:
  - `src/components/store/product-actions.tsx`, `src/components/store/product-detail-view.tsx`
  - `src/components/store/track-order.tsx`, `src/components/shared/invoice-document.tsx`
  - `src/components/admin/variant-matrix-modal.tsx`, `src/components/admin/variant-matrix-modal.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 13:59 IST — Fix Inline Variant Pill Wrapping on Cart Page & Standardize Stacked Variant Pills App-Wide

- **User Prompt**:
  1. Asked whether Checkout should show Order Summary before Address (researched Baymard Institute, Flipkart, Amazon, Myntra).
  2. Reported that `/cart` page still rendered the variant pill inline next to the product title instead of cleanly stacked below it like Checkout.
- **Problem / Root Cause**:
  - `.lineHeader .lineTitleGroup` in `cart.module.css` was a plain block container (`display: block`), so inline `<Link>` (`lineNameLink`) and `<span class="variantPill">` (`inline-flex`) rendered side-by-side on the same line.
- **Solution / Fix**:
  - Converted `.lineTitleGroup` (`cart.module.css`) and `.lineTextCol` (`checkout-form.module.css`) to `display: flex; flex-direction: column; align-items: flex-start;` so the variant pill always sits cleanly on Line 2 below the product title.
  - Applied the exact same clean stacked variant pill pattern to `track-order.tsx` (`order-status.module.css`) so Cart Drawer, Cart Page, Checkout, Track Order, Account Orders, and Admin Orders are 100% consistent.
- **Files Modified**:
  - `src/components/store/cart.module.css`
  - `src/components/store/checkout-form.module.css`
  - `src/components/store/track-order.tsx`
  - `src/components/store/order-status.module.css`
  - `DEVELOPMENT_LOG.md`

---

### 2026-11-27 14:02 IST — Add Dirty-State & Empty/Incomplete Group Validation to Variant Matrix Modal

- **User Prompt**: `"varients add karte time poupme agar kuch changes na bhi karo to bhi save ho raha h empy vala bhi save ho raha h? validation error ya kuch or cheeze daalo vaha pe"`
- **Problem / Root Cause**:
  - `VariantMatrixModal` allowed clicking Save even when no variants were added (`rows.length === 0`) or when zero changes were made compared to `initialVariants`, and did not validate empty/duplicate option groups.
- **Solution / Fix**:
  - Added dirty-state diffing (`serializeVariantsForDiff`) so the primary Save button stays disabled (`No changes` / `Add variants to save`) until actual changes are made.
  - Added explicit option-group validation (blank group names, duplicate group names, option groups with 0 values) and prevented empty saves when starting from empty (only allowing `Clear variants` when intentionally removing existing variants).
- **Files Modified**:
  - `src/components/admin/variant-matrix-modal.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 15:02 IST — Live Chrome DevTools E2E Audit (User & Admin Flows) + Fix `/privacy` Mobile Overflow

- **User Prompt**: Run a comprehensive live Chrome DevTools audit across all User and Admin flows on Desktop & Mobile (metrics, console/network errors, overflows, broken images, interactive checks).
- **Problem / Root Cause**:
  - Live Chrome DevTools Protocol (CDP) audit across 44 Desktop (`1440×900`) & Mobile (`390×844`) page checks found **0 console/hydration errors, 0 uncaught JS exceptions, 0 failed 4xx/5xx network requests, and 0 broken images**, and caught **1 layout bug**: `/privacy` had a `14px` horizontal overflow on Mobile (`390px` viewport, `403px` scrollWidth) because `.contentLayout .clausesStack` and `.clausesStack .clauseCard` in `legal-view.module.css` lacked `min-width: 0;`, allowing the Subprocessors `<table>` wrapper to stretch the CSS Grid column past the viewport.
- **Solution / Fix**:
  - Added `min-width: 0;` to `.contentLayout .clausesStack` and `.clausesStack .clauseCard` in `src/components/store/legal-view.module.css`.
  - Re-verified `/privacy` on Mobile (`390×844`) in Chrome DevTools: `overflowPx` dropped from `14px` to `0px` (`scrollWidth: 390 === clientWidth: 390`).
- **Files Modified**:
  - `src/components/store/legal-view.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 16:05 IST — Full-Spectrum E-Commerce Security, Authority (RBAC), Functional, SEO/PWA & a11y Audit + `X-Powered-By` Hardening

- **User Prompt**: Audit not just UI, but full e-commerce functionality, security, authorization (RBAC), API endpoints, SEO/PWA, and accessibility end-to-end.
- **Problem / Root Cause**:
  - Live HTTP security header audit detected `x-powered-by: Next.js` exposed on responses (framework fingerprinting).
  - All other security, RBAC, open-redirect, XSS, API auth, forged-cookie, SEO/PWA, and core functional checks passed cleanly.
- **Solution / Fix**:
  - Added `poweredByHeader: false` in `next.config.ts` to remove the `X-Powered-By` header across all responses.
- **Files Modified**:
  - `next.config.ts`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 16:28 IST — Fix Next.js 16 Production Build Prerender Error (`InstallPrompt` Suspense Boundary)

- **User Prompt**: Confirmed whether the app is 100% ready for live production deployment (`npm run build` verification).
- **Problem / Root Cause**:
  - `npm run build` failed during static prerendering of `/account/orders/[code]` with `CLIENT_HOOK_DYNAMIC`: `InstallPrompt` called `usePathname()` outside of a `<Suspense>` boundary in `src/app/(store)/layout.tsx` (blocked under Next.js 16 `cacheComponents: true`).
- **Solution / Fix**:
  - Wrapped `<InstallPrompt />` in `<Suspense fallback={null}>` inside `src/app/(store)/layout.tsx`.
  - Re-ran `npm run build`: all **84/84 static, SSG, PPR, and dynamic routes** compiled and prerendered cleanly (`exit code 0`).
- **Files Modified**:
  - `src/app/(store)/layout.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 16:45 IST — Fix Mobile PWA Icon Proportions, Auto-Updating Logo Versioning & Remove Post-Hydration Flash Splash

- **User Prompt**:
  1. Mobile installed PWA showed an oversized/mismatched logo on open, and logo/favicon changes should auto-update everywhere.
  2. Opening the app showed the home page first and then suddenly flashed a logo + tagline loading screen on top.
- **Problem / Root Cause**:
  1. `BrandMark` in `src/lib/brand-image.tsx` rendered `maskable-512` as a near-circle (`borderRadius: 0.46`) inside a cream (`#fbf7f2`) frame instead of a full-bleed brand gradient, and rendered `512`/`192` with `padding: 0`, making Android's native splash icon appear oversized and mismatched. Additionally, `manifest.ts` hardcoded `?v=2` and `public/sw.js` served `/icons/*`, `/icon`, and `/apple-icon` cache-first, blocking automatic icon updates when the logo changed.
  2. `AppSplash` (`src/components/shared/app-splash.tsx`) initialized with `phase = "idle"` (returning `null` during SSR and SW-cached paint) and switched to `"open"` inside `useEffect` after React hydration, causing the home page to render first and then abruptly get covered by a 1.1s JS splash overlay.
- **Solution / Fix**:
  - Exported an auto-computed deterministic `BRAND_ICON_VERSION` hash from `src/components/shared/brand-glyph.tsx` (derived from `BRAND_PALETTE` + `BrandGlyph`) and wired it into `src/app/manifest.ts` so any logo/color change automatically busts browser, CDN, and Android WebAPK icon caches.
  - Updated `BrandMark` (`src/lib/brand-image.tsx`), `src/app/icons/[size]/route.tsx`, and `src/app/apple-icon.tsx` so `maskable-512` and `apple-icon` use a full-bleed brand gradient with safe-zone glyph centering, while `192`/`512` use an inset rounded-square badge matching the header `LogoMark` proportions.
  - Updated `public/sw.js` (`v6`): removed hardcoded `?v=2` icon precaching, explicitly bypassed `/manifest.webmanifest`, and switched `/icons/*`, `/icon`, and `/apple-icon` to network-first with cache fallback.
  - Removed `<AppSplash />` from `src/components/shared/providers.tsx` and deleted the unused `app-splash.tsx` and `app-splash.module.css` so installed PWAs transition directly from the native OS splash to the Home Page with zero flash or artificial delay.
- **Files Modified**:
  - `src/components/shared/brand-glyph.tsx`
  - `src/lib/brand-image.tsx`
  - `src/app/icons/[size]/route.tsx`
  - `src/app/apple-icon.tsx`
  - `src/app/manifest.ts`
  - `public/sw.js`
  - `src/components/shared/providers.tsx`
  - `src/components/shared/app-splash.tsx` (deleted)
  - `src/components/shared/app-splash.module.css` (deleted)
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 16:50 IST — Gmail App Password SMTP Settings & End-to-End Forgot/Reset Password Flow

- **User Prompt**:
  1. Build a Gmail App Password SMTP configuration flow inside Admin Settings so the shop owner can configure email sending directly from the admin panel.
  2. Design and wire up email sending, forgot password, and reset password (for both customers and admin) to use the configured Gmail App Password SMTP flow.
  3. Test the full flow end-to-end (email sending, forgot password, reset password).
- **Problem / Root Cause**:
  - Password reset emails previously relied solely on Supabase's built-in free mail sender (~3 emails/hour rate limit) with no way for the shop owner to configure their own Gmail SMTP credentials from Admin Settings or send branded HTML reset/security emails.
- **Solution / Fix**:
  - **Database Migration (`0070_email_settings.sql`)**:
    - Added singleton admin-only `public.email_settings` table (RLS restricted strictly to `public.is_admin()`; never exposed via public `store_settings`) storing AES-256-GCM encrypted Gmail App Password, Gmail address, sender display name, reply-to, and last test status/timestamp.
    - Added `public.password_reset_tokens` table (SHA-256 hashed 32-byte tokens, 30-minute TTL, single-use, zero direct PostgREST access) with `SECURITY DEFINER` RPCs: `create_password_reset_token`, `verify_password_reset_token`, and `consume_password_reset_token` (bcrypt password update via `pgcrypto`, same-password rejection, admin PIN lock clear, customer reactivation).
  - **Email & Gmail SMTP Service (`src/features/email/`)**:
    - Added `crypto.ts` (AES-256-GCM encrypt/decrypt, SHA-256 token hashing, App Password normalization), `templates.ts` (table-based, inline-CSS HTML + plain-text templates for password reset, password changed, and SMTP test emails), `mailer.ts` (Nodemailer `smtp.gmail.com:465` TLS sender with actionable error mapping), `schema.ts`, `queries.ts` (graceful unpushed-migration fallback, never returns raw/encrypted password to client), and `actions.ts` (`saveEmailSettings`, `sendTestEmail`, `clearEmailAppPassword`).
  - **Admin Settings UI (`src/components/admin/email-settings-card.tsx` + `.module.css`)**:
    - Added **Email & Gmail SMTP** card to `/admin/settings` with enable/disable toggle, Gmail address, masked App Password input with remove-password confirmation dialog, sender display name, Reply-To, 4-step Google App Password guide, and live **Send test email** panel with status indicator.
  - **Customer & Admin Forgot/Reset Password Wiring**:
    - Updated `requestCustomerPasswordReset`, `resetCustomerPassword`, `requestPasswordReset`, `resetAdminPassword`, `/login` (`LoginPage` + `GoogleSignIn`), and `/admin/reset-password` (`AdminResetPasswordPage` + `ResetPasswordForm`) to use the Gmail SMTP one-time token flow when enabled, automatically sign the user in after reset, send a security confirmation email, strip `?token=` from the address bar, and seamlessly fall back to Supabase Auth when Gmail SMTP is disabled.
  - **Verification**:
    - Added 17 unit & end-to-end flow tests (`src/features/email/email.test.ts`, `src/features/email/password-reset-flow.test.ts`); all **32 test files / 857 tests** pass, `npm run lint` and `npx tsc --noEmit` pass with zero errors, and `npm run build` compiles cleanly.
- **Files Modified**:
  - `package.json`, `package-lock.json` (added `nodemailer`, `@types/nodemailer`)
  - `supabase/migrations/0070_email_settings.sql`
  - `src/features/email/crypto.ts`, `src/features/email/schema.ts`, `src/features/email/templates.ts`, `src/features/email/mailer.ts`, `src/features/email/queries.ts`, `src/features/email/actions.ts`
  - `src/features/email/email.test.ts`, `src/features/email/password-reset-flow.test.ts`
  - `src/components/admin/email-settings-card.tsx`, `src/components/admin/email-settings-card.module.css`
  - `src/components/admin/page-views.tsx`, `src/app/admin/(panel)/settings/page.tsx`, `src/app/admin/(panel)/settings/loading.tsx`
  - `src/features/auth/actions.ts`, `src/features/auth/account-actions.ts`
  - `src/app/(store)/login/page.tsx`, `src/components/store/page-views.tsx`, `src/components/store/google-sign-in.tsx`
  - `src/app/admin/reset-password/page.tsx`, `src/components/admin/password-reset-forms.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 16:56 IST — Extend Gmail App Password SMTP to Customer Signup Welcome & Email Verification Flows

- **User Prompt**: Confirmed whether the same Gmail App Password SMTP flow also works for Signup and Login, and requested full testing.
- **Problem / Root Cause**:
  - `signUpCustomer` previously did not send a welcome or email verification email through the configured Gmail SMTP service, relying only on Supabase's built-in sender when email confirmation was enabled.
- **Solution / Fix**:
  - Extended [0070_email_settings.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0070_email_settings.sql) with `signup_verify` scope on `public.password_reset_tokens` and two `SECURITY DEFINER` RPCs: `prepare_signup_email` and `consume_signup_verify_token`.
  - Added table-based, inline-CSS `buildWelcomeEmail` and `buildSignupVerifyEmail` templates in [templates.ts](file:///d:/nextApps/mysaleapp/src/features/email/templates.ts).
  - Updated `signUpCustomer` in [actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/actions.ts) to send a branded Welcome Email via Gmail SMTP on immediate signup and a branded 24-hour verification link (`/login?mode=verify-email&token=...`) when email confirmation is enabled.
  - Wired `/login?mode=verify-email&token=...` handling in [login/page.tsx](file:///d:/nextApps/mysaleapp/src/app/(store)/login/page.tsx) and `?verified=1` / `?error=verify-expired` user feedback in [google-sign-in.tsx](file:///d:/nextApps/mysaleapp/src/components/store/google-sign-in.tsx).
  - Added unit & flow tests in [email.test.ts](file:///d:/nextApps/mysaleapp/src/features/email/email.test.ts) and [password-reset-flow.test.ts](file:///d:/nextApps/mysaleapp/src/features/email/password-reset-flow.test.ts) covering signup welcome, signup email verification, and login (**32 test files / 859 tests passing**).
- **Files Modified**:
  - `supabase/migrations/0070_email_settings.sql`
  - `src/features/email/templates.ts`
  - `src/features/auth/actions.ts`
  - `src/app/(store)/login/page.tsx`
  - `src/components/store/google-sign-in.tsx`
  - `src/features/email/email.test.ts`
  - `src/features/email/password-reset-flow.test.ts`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 17:00 IST — Redesign Admin Store Settings into an Organised App-Like Settings Hub (Desktop Sidebar + Mobile Drill-Down)

- **User Prompt**: `"store settings me sa ui ek saath cluster ho rakha h , isko ek managable way me design karo , best ui hona chaiye, web and mobile me app jesa"`
- **Problem / Root Cause**:
  - `/admin/settings` stacked `<EmailSettingsCard>`, `<PromoCodeManager>`, and 8 cards inside `<StoreSettingsForm>` (via a 2-column CSS masonry layout) all on one overwhelming scroll, making it cluttered on both desktop and mobile.
- **Solution / Fix**:
  - Built `StoreSettingsWorkspace` in `src/components/admin/store-settings-form.tsx` (wired through `SettingsView` in `src/components/admin/page-views.tsx`) organizing all 10 settings blocks into 7 focused categories across 2 logical groups (**Storefront**: Shop & Brand, Contact & Location, Google & SEO; **Commerce & Operations**: Payments & Tax, Delivery & Orders, Promo Codes, Email & SMTP).
  - **Desktop (`>= 960px`)**: Sticky left settings sidebar with live summaries (shop name, city, payment/GST mode, delivery fee, active promo count, SMTP live status dot, and amber unsaved-changes dot) paired with a clean single-column focused right pane (`max-width: 860px`).
  - **Mobile (`< 960px`)**: Native app-style grouped Settings Hub list (`>= 64px` rows with rounded icon tiles, live subtitles, badges, and chevrons) that drills down into the selected section with a sticky frosted-glass `← Settings` app top bar and sticky bottom save bar.
  - Kept all 5 Store Settings form panels mounted inside one `<form>` (toggled via `hidden`, with `<PromoCodeManager>` and `<EmailSettingsCard>` rendered cleanly outside the `<form>` to avoid nested forms) so switching tabs never loses unsaved edits, and added automatic jump-to-error section switching on validation failure plus an unsaved-changes reminder banner when viewing Promo Codes or Email.
- **Files Modified**:
  - `src/components/admin/store-settings-form.tsx`
  - `src/components/admin/admin-views.module.css`
  - `src/components/admin/page-views.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 17:18 IST — Deep Security, Authority & UI Audit of Gmail SMTP Email & Password Reset System

- **User Prompt**: Requested a deep audit of all email-related UI, security/authority, and delivery functionality to verify everything is solid.
- **Problem / Root Cause**:
  1. **Critical Security Gap (Direct PostgREST RPC Exposure)**: The 5 `SECURITY DEFINER` RPCs in migration `0070` (`create_password_reset_token`, `verify_password_reset_token`, `consume_password_reset_token`, `prepare_signup_email`, `consume_signup_verify_token`) were executable by `anon` without server authentication, meaning a browser client using the public anon key could forge a reset token hash or probe accounts directly.
  2. **Production Secret Fallback**: `src/features/email/crypto.ts` fell back to a hardcoded dev key even when `NODE_ENV === "production"` if no server secret env var was set.
  3. **Token Consumption Rate Limit**: `resetCustomerPassword` and `resetAdminPassword` did not rate-limit token consumption attempts.
  4. **Test-Email UX Bug**: Clicking **Send test email** in `EmailSettingsCard` triggered `router.refresh()` which called `form.reset(...)`, wiping unsaved Gmail address / App Password input if the admin tested credentials before saving.
  5. **Mobile Tap Target**: `Remove saved password` button had `min-height: 32px` on mobile instead of `>= 44px`.
- **Solution / Fix**:
  - Created & pushed migration [0071_harden_email_rpcs.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0071_harden_email_rpcs.sql): added `server_rpc_secret_hash` to `public.email_settings`, dropped old unauthenticated function signatures, and enforced SHA-256 `p_server_secret` verification (`42501 FORBIDDEN` on mismatch) inside all 5 RPCs.
  - Updated [crypto.ts](file:///d:/nextApps/mysaleapp/src/features/email/crypto.ts) to derive `getServerRpcSecret()` / `hashServerRpcSecret()` and fail loudly in production if no server secret env var is configured.
  - Updated [email/actions.ts](file:///d:/nextApps/mysaleapp/src/features/email/actions.ts), [auth/actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/actions.ts), [auth/account-actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/account-actions.ts), [login/page.tsx](file:///d:/nextApps/mysaleapp/src/app/(store)/login/page.tsx), and [admin/reset-password/page.tsx](file:///d:/nextApps/mysaleapp/src/app/admin/reset-password/page.tsx) to pass `p_server_secret` and rate-limit token consumption.
  - Fixed `EmailSettingsCard` ([email-settings-card.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/email-settings-card.tsx) & [email-settings-card.module.css](file:///d:/nextApps/mysaleapp/src/components/admin/email-settings-card.module.css)) so testing credentials before saving preserves unsaved form values, and ensured `44px` mobile tap target on `Remove saved password`.
- **Files Modified**:
  - `supabase/migrations/0071_harden_email_rpcs.sql`
  - `src/features/email/crypto.ts`
  - `src/features/email/actions.ts`
  - `src/features/auth/actions.ts`
  - `src/features/auth/account-actions.ts`
  - `src/app/(store)/login/page.tsx`
  - `src/app/admin/reset-password/page.tsx`
  - `src/components/admin/email-settings-card.tsx`
  - `src/components/admin/email-settings-card.module.css`
  - `src/features/email/password-reset-flow.test.ts`
  - `DEVELOPMENT_LOG.md`
