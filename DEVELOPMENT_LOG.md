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


---

### 2026-11-27 19:50 IST — Non-Resizable Textareas, Checkout Step-by-Step Mobile Back & Signed-In Owner UTR Update Fix

- **User Prompt**:
  1. Keep standard login redirect flow (return to the page where sign-in started, or Home `/`).
  2. Disable manual resize handles on all multiline textboxes across the app.
  3. Fix mobile/browser Back inside multi-step Checkout so it moves step-by-step (`3 → 2 → 1 → exit`) instead of jumping straight back to `/cart`.
  4. Fix `"A payment reference was already submitted for this order. Sign in to your account to update it."` error appearing even for signed-in order owners.
- **Problem / Root Cause**:
  1. `MobileBottomNav` gated `showSignIn` on `ready`, so tapping Account before hydration routed guests to `/account/orders` → `/login?next=/account/orders`.
  2. `:where(.textareaField)` in `src/components/ui/ui.module.css` omitted `resize: none;`, leaving browsers' default resize handle visible.
  3. `CheckoutForm` tracked `step` purely in local React state (`useState`) without pushing browser history states or handling `popstate`, so mobile Back exited `/checkout` immediately.
  4. Migration `0061` added an unconditional `if v_order.payment_status = 'submitted' then raise exception 'ALREADY_SUBMITTED'` check in `public.submit_payment`, blocking even the signed-in account owner from correcting a submitted UTR.
- **Solution / Fix**:
  - Updated `MobileBottomNav` (`src/components/store/mobile-bottom-nav.tsx`) to compute `showSignIn` without waiting on `ready` so guests always use `loginHref` (standard flow).
  - Added `resize: none;` to `:where(.textareaField)` in `src/components/ui/ui.module.css`.
  - Wired `window.history.pushState` + `popstate` + `window.history.go(delta)` in `CheckoutForm` (`src/components/store/checkout-form.tsx`) so mobile hardware/swipe Back and in-app Back buttons step cleanly `3 → 2 → 1 → previous page`.
  - Created and pushed migration `0072_allow_owner_update_submitted_utr.sql` updating `public.submit_payment` so the signed-in owner (`v_order.user_id is not null and auth.uid() = v_order.user_id`) can update a `submitted` UTR before verification while guests remain blocked with `ALREADY_SUBMITTED`.
- **Files Modified**:
  - `src/components/store/mobile-bottom-nav.tsx`
  - `src/components/ui/ui.module.css`
  - `src/components/store/checkout-form.tsx`
  - `supabase/migrations/0072_allow_owner_update_submitted_utr.sql`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 20:06 IST — Option A Out-of-Stock Variant Matrix UX & Reusable `useStepHistory` Mobile Back Hook

- **User Prompt**:
  1. Implement Option A (Myntra/Nike/Shopify gold standard) for out-of-stock and non-existent product variant combinations (`Size × Color`).
  2. Standardize step-by-step mobile hardware/swipe Back across the app and persist it as a permanent global rule for all future modules.
- **Problem / Root Cause**:
  1. In `ProductActions`, non-existent variant combinations (e.g., `M / Black` not created while `S / Black` is in stock) appeared identical to in-stock pills and silently jumped `Size` without explanation, while selected out-of-stock pills (`stock === 0`) looked faded (`opacity: 0.6`) with no header "Out of stock" badge.
  2. Multi-step modals already used `<Dialog onBackStep={...}>`, whereas full-page multi-step flows needed a shared reusable history hook and a permanent global engineering rule.
- **Solution / Fix**:
  - Updated [product-actions.tsx](file:///d:/nextApps/mysaleapp/src/components/store/product-actions.tsx) & [product-actions.module.css](file:///d:/nextApps/mysaleapp/src/components/store/product-actions.module.css) with 3 crisp variant pill states: In Stock, Out of Stock (clickable + dashed strikethrough + full-opacity `variantPillSelectedOos` + red header `Out of stock` badge + WhatsApp **Notify Me**), and Non-Existent Combo (upfront muted dashed `variantPillUnavailable` + smooth switch to nearest available option with clear info toast).
  - Extracted reusable [use-step-history.ts](file:///d:/nextApps/mysaleapp/src/hooks/use-step-history.ts) hook and wired [checkout-form.tsx](file:///d:/nextApps/mysaleapp/src/components/store/checkout-form.tsx) to use it.
  - Persisted the mandatory step-by-step Mobile Back rule in global `C:\Users\User\.gemini\config\GEMINI.md` and project [CLAUDE.md](file:///d:/nextApps/mysaleapp/CLAUDE.md).
  - Extended [ux-flows-audit.test.ts](file:///d:/nextApps/mysaleapp/src/features/orders/ux-flows-audit.test.ts) to verify `useStepHistory` and Option A variant matrix states.
- **Files Modified**:
  - `src/components/store/product-actions.tsx`
  - `src/components/store/product-actions.module.css`
  - `src/hooks/use-step-history.ts`
  - `src/components/store/checkout-form.tsx`
  - `src/features/orders/ux-flows-audit.test.ts`
  - `CLAUDE.md`
  - `DEVELOPMENT_LOG.md`
  - `C:\Users\User\.gemini\config\GEMINI.md` (global rule)


---

### 2026-11-27 20:12 IST — Final Deep Audit of Today's Changes & Variant-Level Back-in-Stock Alert Fix (`0073`)

- **User Prompt**: Deep audit of all work completed today to catch and fix any remaining bugs before sign-off.
- **Problem / Root Cause**:
  1. **Critical Variant Notify-Me Bug**: `subscribe_stock_alert` (`0068_back_in_stock.sql`) checked `products.stock > 0` instead of the selected variant's stock. When a customer clicked an out-of-stock variant (e.g. `M / Black`, `stock = 0`) on a product where another variant (`S / Black`, `stock = 5`) was in stock and submitted **Notify me on WhatsApp**, the RPC falsely rejected it with `ALREADY_IN_STOCK`. Additionally, localStorage saved only `product.id`, conflating alerts across different variants of the same product.
  2. **Flat Variant OOS Styling**: The single-axis variant picker fallback in `product-actions.tsx` still applied `variantPillOos` over `variantPillSelected` instead of `variantPillSelectedOos`.
  3. **Checkout Unmount Cleanup**: `CheckoutForm`'s `useLayoutEffect` cleanup reset `step` to `1` without resetting `useStepHistory`'s `pushedStepsRef`.
- **Solution / Fix**:
  - Created and pushed migration [0073_variant_stock_alerts.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0073_variant_stock_alerts.sql) adding `variant_id` & `variant_label` to `public.stock_alerts` and updating `subscribe_stock_alert` to validate variant stock when `p_variant_id` is provided.
  - Updated `stockAlertSchema` ([schema.ts](file:///d:/nextApps/mysaleapp/src/features/products/schema.ts)), `subscribeStockAlert` ([actions.ts](file:///d:/nextApps/mysaleapp/src/features/products/actions.ts)), and `ProductActions` ([product-actions.tsx](file:///d:/nextApps/mysaleapp/src/components/store/product-actions.tsx)) to pass `variantId`, key local alert state per `productId:variantId`, and apply `variantPillSelectedOos` on flat variants too.
  - Added `resetHistoryDepth()` to `CheckoutForm`'s unmount cleanup ([checkout-form.tsx](file:///d:/nextApps/mysaleapp/src/components/store/checkout-form.tsx)).
  - Added migration `0073` test coverage in [ux-flows-audit.test.ts](file:///d:/nextApps/mysaleapp/src/features/orders/ux-flows-audit.test.ts).
- **Files Modified**:
  - `supabase/migrations/0073_variant_stock_alerts.sql`
  - `src/features/products/schema.ts`
  - `src/features/products/actions.ts`
  - `src/components/store/product-actions.tsx`
  - `src/components/store/checkout-form.tsx`
  - `src/features/orders/ux-flows-audit.test.ts`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 20:19 IST — Full-Day Audit Fix: Admin Variant Back-in-Stock Stock Resolution & Display

- **User Prompt**: Deep audit across all commits from today (`4b26ba3`, `349debd`) and current uncommitted changes.
- **Problem / Root Cause**:
  - `listStockAlerts()` in `src/features/products/admin-queries.ts` only read parent `products.stock`, ignoring `stock_alerts.variant_id` / `variant_label` added in migration `0073`. As a result, Admin → Products falsely marked an out-of-stock variant alert (e.g. `M / Black`, `stock = 0`) as *"Ready to notify"* whenever another variant of the same product had stock, and omitted the variant label from both the admin card and the WhatsApp notification message.
- **Solution / Fix**:
  - Added `variantId` and `variantLabel` to `StockAlert` ([types.ts](file:///d:/nextApps/mysaleapp/src/features/products/types.ts)).
  - Updated `listStockAlerts()` ([admin-queries.ts](file:///d:/nextApps/mysaleapp/src/features/products/admin-queries.ts)) to select `variant_id`, `variant_label`, and `product.variants`, resolving `productStock` against the specific variant when `variant_id` is set.
  - Updated `ProductsView` ([products-view.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/products-view.tsx)) to display the variant badge next to the product name and include `(${a.variantLabel})` in the WhatsApp restock message.
- **Files Modified**:
  - `src/features/products/types.ts`
  - `src/features/products/admin-queries.ts`
  - `src/components/admin/products-view.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 20:40 IST — Full-Repository Deep Audit Hardening (Option 2: Fixes #1–#14 + Migration 0074)

- **User Prompt**: `"kaya ek baar abhi tak ke sabhi commits ke uper deep audit chala kar dekha sakte ho."` → `"option 2"` (fix all Critical + High + Medium findings #1–#14).
- **Problems / Root Causes**:
  1. **Per-variant JSONB stock desync**: `restock_cancelled_order()`, `admin_reset_data()`, and `record_order_return()` only updated aggregate `products.stock` and never restored/deducted per-variant stock in `products.variants`.
  2. **Non-variant `variantId` bypass**: `create_order()` allowed a non-null `variantId` on single-SKU products to pass `line_ok`.
  3. **Admin PIN `updated_at` bypass**: `set_admin_pin()`, `disable_admin_pin()`, and `clear_admin_pin_lock()` accepted `auth.users.updated_at > now() - 120s` as fresh auth instead of requiring `last_sign_in_at`.
  4. **Multi-variant return overpayment**: `record_order_return()`, `return_items_value()`, and `refund.ts` priced returns via `MAX(price)` per `productId` instead of matching `variantId`.
  5. **Stale storefront catalog cache**: `deleteProduct`, `toggleProductFlag`, `saveCategory`, and `deleteCategory` called `refreshReviews()` instead of `refreshCatalogue()`.
  6. **Gateway retry guest throttling & PII**: `get_order_for_gateway()` skipped `find_order_for_guest()` 5-strike lockout, and `createGatewayRetrySession()` returned customer PII to unauthenticated guests and rate-limited without order code keying.
  7. **Blank `/track` & `/order-placed` skeletons + a11y + iOS zoom**: `useSearchParams()` suspended inside bare `<Suspense>` on preview loading; per-row inputs in `variant-matrix-modal.tsx` and quick-jump search in `admin-sidebar.tsx` lacked explicit labels; mobile inputs `< 16px` triggered iOS Safari zoom.
  8. **`subscribe_stock_alert` hardening**: Lacked DB-level rate limit and allowed overwriting a guest row's `user_id`/`customer_name`.
  9. **`is_admin_email` anon enumeration**: Callable directly by `anon` without `p_server_secret`.
  10. **`record_order_return` return value**: Returned single-return `v_this_refund` instead of cumulative `v_new_ref`.
  11. **Variant WhatsApp summary**: `placeOrder` and `createGatewayCheckoutSession` merged cart lines by `productId` only, dropping variant labels and variant prices.
  12. **Variant `restocked_at` badge**: `updateProduct` only stamped `restocked_at` when aggregate `products.stock` moved from `0 -> >0`, missing per-variant restocks.
  13. **Next.js 16 `<Activity>` state persistence**: Password/PIN/Email forms kept typed secrets across route hides, and `TrackOrderBody` did not re-sync `codeSuffix` on `<Activity>` restore.
  14. **Mobile touch targets `< 44px`**: Return wizard steppers/chips, search dialog chips/back button, PWA dismiss button, and variant matrix controls were under `44px` on small screens.
- **Solution / Fix**:
  - Created and pushed migration [0074_full_audit_hardening.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0074_full_audit_hardening.sql) fixing #1, #2, #3, #4, #6, #8, #9, and #10 atomically in PostgreSQL.
  - Updated [products/actions.ts](file:///d:/nextApps/mysaleapp/src/features/products/actions.ts) (#5, #12), [orders/actions.ts](file:///d:/nextApps/mysaleapp/src/features/orders/actions.ts) (#6, #11), [auth/account-actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/account-actions.ts) (#9), and [orders/refund.ts](file:///d:/nextApps/mysaleapp/src/features/orders/refund.ts) (#4).
  - Updated [page-views.tsx](file:///d:/nextApps/mysaleapp/src/components/store/page-views.tsx), [track-order.tsx](file:///d:/nextApps/mysaleapp/src/components/store/track-order.tsx), [order-placed.tsx](file:///d:/nextApps/mysaleapp/src/components/store/order-placed.tsx), [track/loading.tsx](file:///d:/nextApps/mysaleapp/src/app/(store)/track/loading.tsx), [variant-matrix-modal.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/variant-matrix-modal.tsx), [admin-sidebar.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/admin-sidebar.tsx), [profile-form.tsx](file:///d:/nextApps/mysaleapp/src/components/account/profile-form.tsx), [account-forms.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/account-forms.tsx), and the 4 mobile CSS modules (#7a, #7b, #13, #14).
  - Added 6 regression tests in [ux-flows-audit.test.ts](file:///d:/nextApps/mysaleapp/src/features/orders/ux-flows-audit.test.ts) and synced [CLAUDE.md](file:///d:/nextApps/mysaleapp/CLAUDE.md) and [README.md](file:///d:/nextApps/mysaleapp/README.md).
- **Files Modified**:
  - `supabase/migrations/0074_full_audit_hardening.sql`
  - `src/features/products/actions.ts`, `src/features/orders/actions.ts`, `src/features/orders/refund.ts`, `src/features/auth/account-actions.ts`
  - `src/components/store/page-views.tsx`, `src/components/store/track-order.tsx`, `src/components/store/order-placed.tsx`, `src/app/(store)/track/loading.tsx`
  - `src/components/admin/variant-matrix-modal.tsx`, `src/components/admin/variant-matrix-modal.module.css`, `src/components/admin/admin-sidebar.tsx`, `src/components/admin/account-forms.tsx`
  - `src/components/account/profile-form.tsx`
  - `src/components/store/request-return.module.css`, `src/components/store/search-dialog.module.css`, `src/components/store/store-widgets.module.css`
  - `src/features/orders/ux-flows-audit.test.ts`, `CLAUDE.md`, `README.md`, `DEVELOPMENT_LOG.md`


---

### 2026-11-27 20:58 IST — Full-Repo Commit-1-to-Today Verification Audit Fixes (Option A: #1–#12 + Migration 0075)

- **User Prompt**: `"abhi tak ke commit se mera matlab tha app ke first commit se leke, aaj ke last commit and abhi ke changes ko bhi deep audit karna h, abhi ke 1-14 fixes me bhi check kar lena koe bug ya gap reh to nahi gaya h?"` → `"option A"`
- **Problems / Root Causes**:
  1. **Return/Exchange `variantId` drop**: Upstream UI (`request-return.tsx`, `create-return-request.tsx`, `return-order.tsx`, `return-status-control.tsx`), `returnableQuantities`, Zod schemas (`requestReturnSchema`, `returnSchema`, `createRequestSchema`), and SQL RPCs (`request_return`, `admin_create_return_request`, `record_order_return` `NOT_IN_REQUEST` check) dropped `variantId` and deduplicated by `productId` only.
  2. **`is_admin_email` fail-open**: When `server_rpc_secret_hash` was `NULL`, `0074` accepted any 16+ char string, and `account-actions.ts` failed open on `isAdminErr`.
  3. **Password reset session revocation**: `consume_password_reset_token()` updated `auth.users.encrypted_password` without revoking `auth.sessions` / `auth.refresh_tokens`.
  4. **Missing table-level `REVOKE`s**: Post-0061 tables (`password_reset_tokens`, `email_settings`, `stock_alerts`) lacked explicit `REVOKE` statements.
  5. **Gateway retry PII gate**: `createGatewayRetrySession()` gated `customerName`/`customerPhone` on `Boolean(user)` instead of `row.isOwner === true`.
  6. **Variant-less cart adds**: Wishlist restock banner (`wishlist-view.tsx`) and Product Reviews page (`product-actions.tsx`) added variant-enabled products without a `variantId`.
  7. **Admin Quick Jump navigation race**: `<button>` + `router.push()` raced with `useOverlayHistory` `window.history.back()` in `dialog.tsx`.
  8. **Legacy admin reset PIN unlock**: `resetAdminPassword()` legacy recovery branch called `clear_admin_pin_lock()` without refreshing `last_sign_in_at`.
  9. **Stale `variantId` in `useLiveCart`**: `resolveLiveLine` retained `item.variantId` when admin removed all variants from a product.
  10. **Razorpay verification**: Accepted uncaptured `"authorized"` payments as paid and omitted webhook `currency === "INR"` check.
  11. **`subscribeStockAlert`**: Did not map `TOO_MANY_ATTEMPTS` to `RATE_LIMIT_MESSAGE`.
  12. **Sign-out cookie cleanup**: `signOutCustomer`, `signOutAdmin`, and `deactivateMyAccount` did not clear all 5 app auth cookies (`kk_recovery_intent`, cross-scope reset/PIN cookies).
- **Solution / Fix**:
  - Created and pushed migration [0075_return_variants_and_security_hardening.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0075_return_variants_and_security_hardening.sql).
  - Wired `returnLineKey` and `variantId` end-to-end across [returns.ts](file:///d:/nextApps/mysaleapp/src/features/orders/returns.ts), [types.ts](file:///d:/nextApps/mysaleapp/src/features/orders/types.ts), [schema.ts](file:///d:/nextApps/mysaleapp/src/features/orders/schema.ts), [refund.ts](file:///d:/nextApps/mysaleapp/src/features/orders/refund.ts), [admin-actions.ts](file:///d:/nextApps/mysaleapp/src/features/orders/admin-actions.ts), [request-return.tsx](file:///d:/nextApps/mysaleapp/src/components/store/request-return.tsx), [create-return-request.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/create-return-request.tsx), [return-order.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/return-order.tsx), and [return-status-control.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/return-status-control.tsx).
  - Fixed [account-actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/account-actions.ts), [orders/actions.ts](file:///d:/nextApps/mysaleapp/src/features/orders/actions.ts), [wishlist-view.tsx](file:///d:/nextApps/mysaleapp/src/components/store/wishlist-view.tsx), [product-actions.tsx](file:///d:/nextApps/mysaleapp/src/components/store/product-actions.tsx), [admin-sidebar.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/admin-sidebar.tsx), [live-cart.ts](file:///d:/nextApps/mysaleapp/src/components/store/live-cart.ts), [payment-gateway.ts](file:///d:/nextApps/mysaleapp/src/features/orders/payment-gateway.ts), [products/actions.ts](file:///d:/nextApps/mysaleapp/src/features/products/actions.ts), [auth/actions.ts](file:///d:/nextApps/mysaleapp/src/features/auth/actions.ts), and [account/actions.ts](file:///d:/nextApps/mysaleapp/src/features/account/actions.ts).
  - Added 4 new regression tests in [ux-flows-audit.test.ts](file:///d:/nextApps/mysaleapp/src/features/orders/ux-flows-audit.test.ts) and synced [CLAUDE.md](file:///d:/nextApps/mysaleapp/CLAUDE.md) & [README.md](file:///d:/nextApps/mysaleapp/README.md).
- **Files Modified**:
  - `supabase/migrations/0075_return_variants_and_security_hardening.sql`
  - `src/features/orders/{types.ts,returns.ts,schema.ts,refund.ts,actions.ts,admin-actions.ts,payment-gateway.ts,ux-flows-audit.test.ts}`
  - `src/components/store/{request-return.tsx,wishlist-view.tsx,product-actions.tsx,live-cart.ts}`
  - `src/components/admin/{create-return-request.tsx,return-order.tsx,return-status-control.tsx,admin-sidebar.tsx}`
  - `src/features/auth/{account-actions.ts,actions.ts}`, `src/features/account/actions.ts`, `src/features/products/actions.ts`
  - `CLAUDE.md`, `README.md`, `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:08 IST — Apply All 10 Premium UI Animation Principles (Squash & Stretch, Anticipation, Focus Staging, Pose-to-Pose, Follow-Through, Slow In/Out, Arcs, Secondary Action, Snappy Timing & Exaggerated Feedback)

- **User Prompt**: `"is video ke hisab se jo jo ui me chizee bata raki h vo proper tarike se apply kar ke ui me test bhi kar le na , then batana"` (Instagram Reel showcasing 10 Disney-inspired premium UI animation principles).
- **Problem / Root Cause**:
  - Storefront micro-interactions used basic linear/standard transitions without expressive physical feedback on Add-to-Cart, Wishlist toggles, Cart Drawer item reveals, Product Grid focus, CTA arrows, or Carousel paging.
- **Solution / Changes Made**:
  1. **Motion & Physics Tokens (`src/styles/theme-store.css`)**: Added `--ease-smooth`, `--ease-snappy`, `--ease-spring-fallback`, and `linear()` physics-based `--ease-spring-physics` tokens (light & dark storefront themes).
  2. **Squash & Stretch (#1)**: Added `addToCartSquash` / `quickAddSquash` keyframes and temporary `"Added to cart"` / checkmark morph states on `ProductActions` (desktop + mobile sticky buy bar) and `ProductCard` quick-add buttons.
  3. **Anticipation / Wind-Up (#2)**: Added `arrowAnticipate` / `ctaArrowAnticipate` pull-back-before-launch arrow hover animations on `Hero` primary CTA, `CartDrawer` Checkout CTA, and `CartView` Proceed CTA, plus subtle tactile press squash on `.btnBase:active`.
  4. **Staging the Focus (#3)**: Added desktop pointer-only (`@media (hover: hover) and (pointer: fine)`) `:has()` focus staging on `.productGrid`, `.browserGrid`, and product carousels so hovered cards elevate while sibling cards subtly recede.
  5. **Pose-to-Pose (#4)**: Refined `ProductGallery` slide transitions to deliberate 3-pose keyframes (`scale` + directional `x`) and upgraded `uiDialogZoomIn` to a 3-pose settled modal entrance.
  6. **Follow-Through (#5)**: Added staggered spring follow-through on `CartDrawer` `DrawerItem` rows (`index * 0.045s` delay) and delayed spring entrance on `drawerFooter`.
  7. **Slow In, Slow Out (#6)**: Upgraded `Carousel` arrow & pagination-dot scrolling to a `requestAnimationFrame` cubic ease-in-out glide (auto-cancels on manual wheel/touch and respects `prefers-reduced-motion`).
  8. **Moving in Arcs (#7)**: Implemented `triggerFlyToCart()` in `src/store/cart.ts` using Web Animations API with a 12-step quadratic Bezier parabolic arc from the clicked Add-to-Cart / quick-add button to the visible `[data-cart-target="true"]` icon (Header desktop/mobile shortcut or Mobile Bottom Nav).
  9. **Secondary Action (#8)**: Wired `kk-cart-arc-landed` listener in `Header` and `MobileBottomNav` to trigger a spring icon bump (`cartBumpPop` / `navCartBump`) when items land in the cart, plus `qtyReadoutPop` micro-bounce on `QuantityStepper` value changes.
  10. **Snappy Timing (#9)**: Tightened `Tabs` (`uiTabPanelSnap`, 140ms triggers), `Header` dropdown & nav beam (`stiffness: 520`), and `ProductBrowser` category chips (`stiffness: 540`) & sort pills (`140ms`) to crisp, responsive timing.
  11. **Exaggerated Feedback (#10)**: Upgraded `WishlistButton` with a multi-keyframe spring heart overshoot + expanding ring burst (`.heartBurstRing`) + 6 radiating sparkle particles (`.heartSparkleDot`).
  - **Verification**: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm test` (33 files / 880 tests passed), and live headless Chrome CDP verification across Desktop (`1440×900`) and Mobile (`390×844`) confirming 0 console/runtime errors and live execution of all animations.
- **Files Modified**:
  - `src/styles/theme-store.css`
  - `src/store/cart.ts`
  - `src/components/ui/ui.module.css`
  - `src/components/store/wishlist-button.tsx`
  - `src/components/store/product-card.tsx`, `src/components/store/product-card.module.css`
  - `src/components/store/product-actions.tsx`, `src/components/store/product-actions.module.css`
  - `src/components/store/product-browser.tsx`, `src/components/store/product-browser.module.css`
  - `src/components/store/product-gallery.tsx`
  - `src/components/store/cart-drawer.tsx`, `src/components/store/cart.module.css`
  - `src/components/store/hero.module.css`
  - `src/components/shared/carousel.tsx`
  - `src/components/store/header.tsx`, `src/components/store/header.module.css`
  - `src/components/store/mobile-bottom-nav.tsx`, `src/components/store/mobile-bottom-nav.module.css`
  - `src/components/store/quantity-stepper.tsx`, `src/components/store/store-widgets.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:16 IST — Re-Audit Fixes for UI Animations (Wishlist Double-Pop, Sparkle Clipping, Desktop Quick-Add Specificity & Stepper `aria-live`)

- **User Prompt**: `"reaudit kar ke deh lo, sab sahi kaam kar raha h na."`
- **Problem / Root Cause**:
  1. `WishlistButton` reset `burstKey` to `0` after 650ms while `<m.span>` used `key={on-${burstKey}}`, causing the heart spring pop to replay a second time 650ms after clicking (and play on initial mount for already-wishlisted items).
  2. `heartSparkleFly` (`-22px`) and `heartRingBurst` (`scale(1.85)`) could clip against `.mediaFrame { overflow: hidden }` at the top-right corner of product cards.
  3. On desktop (`>= 768px and pointer: fine`), `.productCard:hover .quickAddBtn` came after `.mediaFrame .quickAddBtn:hover` with equal specificity, overriding the hover `scale(1.1)` and `:active` squash.
  4. `QuantityStepper` placed `key={value}` directly on the `aria-live="polite"` readout span, which remounted the live region on every click and animated on initial page load.
- **Solution / Fix**:
  - Split `showBurst` and monotonic `popCount` in `src/components/store/wishlist-button.tsx` with `initial={popCount > 0 && active ? ... : false}` so the heart pops once per user click and never replays on timeout or mount.
  - Tuned `heartSparkleFly` (`-18px`) and `heartRingBurst` (`scale(1.55)`) in `src/components/store/product-card.module.css` so all 6 sparkles stay unclipped inside `mediaFrame`, and added explicit `.productCard:hover .quickAddBtn:hover` / `:active` rules inside the desktop pointer media query.
  - Kept the `aria-live="polite"` span stable in `src/components/store/quantity-stepper.tsx` and applied `qtyValuePop` to an inner span only after user interaction (`popTick > 0`).
  - Re-verified with `tsc --noEmit`, `npm run lint`, `npm test` (880/880 passed), and live headless Chrome audit (0 console/runtime errors across Desktop & Mobile).
- **Files Modified**:
  - `src/components/store/wishlist-button.tsx`
  - `src/components/store/product-card.module.css`
  - `src/components/store/quantity-stepper.tsx`
  - `src/components/store/store-widgets.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:20 IST — Add Diagonal Cross-Line on Out-of-Stock & Unavailable Variant Pills

- **User Prompt**: `"jo varient ya size etc stock me nahi h usme ek beech se cross jesa kuch laga do taki usual ui me rahe ki ha ye stock me nahi h."`
- **Problem / Root Cause**: Out-of-stock variant pills only used a dashed border and text strikethrough, which was subtler than the standard e-commerce diagonal slash across the chip.
- **Solution / Fix**: Added a responsive corner-to-corner diagonal slash (`linear-gradient(to top right, ...)`) across `.variantPillOos`, `.variantPillUnavailable`, and `.variantPillSelectedOos` in [product-actions.module.css](file:///d:/nextApps/mysaleapp/src/components/store/product-actions.module.css) (adapts to any pill width/height, works cleanly in light & dark mode, and keeps pills clickable for Option A Notify Me).
- **Files Modified**:
  - `src/components/store/product-actions.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:22 IST — Second Forensic Re-Audit Fixes (Carousel Snap Restore, Carousel Top-Edge Clip Prevention, Physics `linear()` Spring Activation & Arc Image Fallback)

- **User Prompt**: `"dubara reaudit karo"`
- **Problem / Root Cause**:
  1. In `Carousel`, cancelling a smooth scroll mid-flight via wheel/touch (`cancelScrollAnim`) stopped `requestAnimationFrame` without clearing the temporary inline `scrollSnapType = "none"` and `scrollBehavior = "auto"` styles, leaving scroll-snap disabled until another arrow click completed.
  2. Hover focus staging lifted product cards by `translateY(-6px) scale(1.016)` (~`8.5px` upward), slightly exceeding `.carouselTrack`'s `8px` top padding and clipping the top card edge inside horizontal carousels.
  3. `--ease-spring-physics` (`linear(...)`) was defined in `theme-store.css` but not wired via `@supports (transition-timing-function: linear(0, 1))`.
  4. `triggerFlyToCart` did not attach an `onerror` handler to the temporary flying thumbnail `<img>`.
- **Solution / Fix**:
  - Updated `cancelScrollAnim` in `src/components/shared/carousel.tsx` to always reset `scrollSnapType` and `scrollBehavior` inline styles.
  - Tuned hover focus lift to `translateY(-4px) scale(1.012)` in `src/components/store/product-card.module.css` and `src/components/store/product-browser.module.css` so hovered cards stay inside `.carouselTrack` padding with zero clipping.
  - Wired `@supports (transition-timing-function: linear(0, 1))` using `--ease-spring-physics` with `--ease-spring-fallback` on `.wishlistTrigger` in `src/components/store/product-card.module.css`.
  - Added `img.onerror = () => img.remove()` in `triggerFlyToCart` (`src/store/cart.ts`).
  - Re-verified with `tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm test` (33/33 files, 880/880 passed), and live headless Chrome audit (0 console/runtime errors across Desktop & Mobile).
- **Files Modified**:
  - `src/components/shared/carousel.tsx`
  - `src/components/store/product-card.module.css`
  - `src/components/store/product-browser.module.css`
  - `src/store/cart.ts`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:26 IST — Fix Delayed Wishlist Add/Remove Toast for Signed-In Users

- **User Prompt**: `"whishlist me ad karne pe or remove karne pe toast bhot late aata h ? sa kue ye to sahi kaam kar raha tha?"`
- **Problem / Root Cause**:
  - In `src/hooks/use-wishlist-toggle.ts`, guest users received an instant `toast.success(...)`, whereas signed-in users updated the heart optimistically (`setOn`) but waited for `await setWishlisted(productId, next)` (Supabase auth + DB upsert/delete + `revalidatePath("/wishlist")`) before showing `toast.success(...)` — causing a 600ms–1.5s delay after the heart animation finished.
  - Additionally, `WishlistButton` could trigger burst animation while `pending === true`.
- **Solution / Fix**:
  - Fired `toast.success(...)` optimistically right alongside `setOn(productId, next)` using a stable `id: wishlist-${productId}` so rapid toggles replace cleanly instead of stacking; if the background `setWishlisted` server action fails, state rolls back and the same toast ID updates to `toast.error(...)`.
  - Guarded `WishlistButton`'s `onClick` with `if (pending) return` so burst animations never fire while a request is in flight.
- **Files Modified**:
  - `src/hooks/use-wishlist-toggle.ts`
  - `src/components/store/wishlist-button.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:29 IST — Fix Clipped Checkout Quantity Bubbles (`.miniQtyBubble` & `.qtyBubble`)

- **User Prompt**: `"class=\"checkout-form-module__4OxTVq__miniQtyBubble\" text to kat hi raha h?"`
- **Problem / Root Cause**:
  - `.miniThumbWrap` and `.lineThumbWrap` in `src/components/store/checkout-form.module.css` use `overflow: hidden` to clip product images to rounded corners, while `.miniQtyBubble` (`top: -3px; right: -3px; width: 17px`) and `.qtyBubble` (`top: -4px; right: -4px; width: 20px`) were positioned outside the clipped box with fixed width and no `line-height: 1`, slicing off the badge corner and text.
- **Solution / Fix**:
  - Repositioned both `.miniQtyBubble` and `.qtyBubble` cleanly inside the thumbnail frame (`top: 2px; right: 2px; z-index: 2`), switched to `min-width` + horizontal padding (`padding: 0 4px` / `0 5px`), added `line-height: 1`, `font-variant-numeric: tabular-nums`, and a crisp `1.5px` card ring shadow so 1-digit and 2-digit quantities render fully unclipped.
- **Files Modified**:
  - `src/components/store/checkout-form.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:33 IST — Remove Sibling Product Card Dimming on Hover

- **User Prompt**: `"ek cheez annowing lag rahi h, ki ek card pe hover kar ta hu to baaki thodi dull si ho jati h esa kue?"`
- **Problem / Root Cause**:
  - Video animation #3 ("Staging the focus") applied `opacity: 0.76; transform: scale(0.988)` to non-hovered sibling product cards in `.productGrid`, `.browserGrid`, and carousels, which felt distracting while scanning products.
- **Solution / Fix**:
  - Removed the `:has(...:hover) ...:not(:hover)` sibling-dimming rules from `src/components/store/product-card.module.css` and `src/components/store/product-browser.module.css` while preserving the clean individual card hover lift, shadow elevation, image zoom, and quick-add reveal.
- **Files Modified**:
  - `src/components/store/product-card.module.css`
  - `src/components/store/product-browser.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-27 21:46 IST — Delay Cart Drawer Until Arc Lands + Add Wishlist Parabolic Fly-In / Reverse Fly-Out Arcs

- **User Prompt**: `"ek kaam karo to turant na khalo, jisse ki Moving in Arcs fly karta dikhe, or yasi same animation fly vala wishlist vale me la do or remove karne pe bhi."`
- **Problem / Root Cause**:
  - Calling `useCart.add(...)` opened the Cart Drawer immediately at `t = 0ms`, obscuring the header/bottom-nav cart icon while the product thumbnail was still flying along its parabolic arc.
  - Wishlist add/remove did not have the matching parabolic arc animation to/from the Header / Mobile Bottom Nav Wishlist icon, and `--ease-smooth` in `theme-store.css` was unused after removing sibling dimming.
- **Solution / Changes Made**:
  1. Added optional `{ openDrawer?: boolean }` parameter (default `true`) to `useCart.add` in `src/store/cart.ts`, and refactored the parabolic Bezier flyer into a shared `flyParabolicArc` helper powering both `triggerFlyToCart(el, img, onLand)` and `triggerFlyWishlist(el, "add" | "remove", img)`.
  2. Updated `ProductCard`, `ProductActions`, and `WishlistView` to add items immediately with `{ openDrawer: false }`, fly the thumbnail along the unobstructed parabolic arc (`480ms`), bump the Cart icon (`kk-cart-arc-landed`), and open the Cart Drawer right after landing (`+90ms` beat; instant under `prefers-reduced-motion`).
  3. Wired `triggerFlyWishlist` into `WishlistButton` (passing `productImage` from `ProductCard` and `ProductActions`) so adding flies the product thumbnail up into `[data-wishlist-target="true"]` and bumps the Wishlist icon (`kk-wishlist-arc-landed`), while removing triggers a reverse parabolic arc flying back out from the Wishlist icon to the clicked heart button.
  4. Added `data-wishlist-target="true"` and `kk-wishlist-arc-landed` bump feedback in `Header` (desktop + mobile shortcuts) and `MobileBottomNav`.
  5. Cleaned up unused `--ease-smooth` token from `src/styles/theme-store.css` and unused `opacity` transition from `.productCard`.
- **Files Modified**:
  - `src/store/cart.ts`
  - `src/components/store/wishlist-button.tsx`, `src/components/store/wishlist-view.tsx`
  - `src/components/store/product-card.tsx`, `src/components/store/product-card.module.css`
  - `src/components/store/product-actions.tsx`
  - `src/components/store/header.tsx`, `src/components/store/mobile-bottom-nav.tsx`
  - `src/styles/theme-store.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 08:41 IST — Horizontal Scrollable FAQ Category Tabs with Auto-Center Focus & Edge Fades

- **User Prompt**: `"class=\"faq-view-module__4zFBqW__faqCategoryTabs\" ko web se hi sroll lagao, or ha mobile me agar koe tab pe click karke active karte h to, uskocenter me focus hoke aana cahiyevo tab aadha screen ke bahar rehte h active hone ke baad, tum apna ai laga ke best ui implementation and ux daalo"`
- **Problem / Root Cause**:
  - `.faqCategoryTabs` switched to `flex-wrap: wrap` at `@media (min-width: 640px)` in `src/components/store/faq-view.module.css`, preventing horizontal scrolling on web/tablet widths.
  - Clicking a partially off-screen tab on mobile (or overflowing web widths) activated it without scrolling the tablist, leaving the active tab half-clipped at the viewport edge.
  - Inactive tabs used `font-weight: 500` vs `600` on active tabs (causing slight width shift) and had `36px` height on mobile instead of `44px` touch targets, with no scrollability edge fades or desktop prev/next controls.
- **Solution / Changes Made**:
  1. Kept `.faqCategoryTabs` on a single horizontal scrollable row across all viewports (`flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: inline proximity; scroll-padding-inline: 36px`), removing the `@media (min-width: 640px)` `flex-wrap: wrap` override.
  2. Added smooth horizontal-only auto-centering (`centerTab` using `getBoundingClientRect()` + `container.scrollTo({ left: clampedLeft, behavior })`, respecting `prefers-reduced-motion`) whenever a tab is clicked, navigated via keyboard (`ArrowLeft`/`ArrowRight`/`Home`/`End`), or reset via "Show all questions".
  3. Added progressive-enhancement edge fade masks (`@property --faq-fade-start` / `--faq-fade-end` with `animation-timeline: scroll(self inline)` and `IntersectionObserver` + `ResizeObserver` fallback) plus subtle pointer-fine desktop left/right chevron scroll buttons outside `[role="tablist"]`.
  4. Upgraded mobile tab touch targets to `44px` height, unified `font-weight: 600` + `1.5px` border to avoid layout shift and support forced-colors active indication via `[aria-selected="true"]`, and added roving `tabIndex` keyboard navigation.
- **Files Modified**:
  - `src/components/store/faq-view.tsx`
  - `src/components/store/faq-view.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 08:44 IST — Remove Edge Fade Mask Shade on FAQ Category Tabs

- **User Prompt**: `"class=\"faq-view-module__4zFBqW__faqCategoryTabs\" right left me ek with shade sa dikh raha h, jisse tab chuja raha h thoda sa"`
- **Problem / Root Cause**:
  - The `36px` left/right CSS mask fade (`--faq-fade-start` / `--faq-fade-end`) and `position: absolute` desktop chevron buttons overlapped the edges of `.faqCategoryTabs`, creating a white-ish washed-out shade that partially obscured the outer tabs.
- **Solution / Changes Made**:
  - Removed the edge fade `mask`, `@property --faq-fade-*`, and scroll-driven fade keyframes from `src/components/store/faq-view.module.css` so tabs remain 100% crisp and unobstructed from edge to edge.
  - Changed desktop prev/next scroll chevron buttons to sit as non-overlapping flex siblings (`gap: 8px`) beside `.faqCategoryTabs` (only shown on pointer-fine desktop when overflow exists, with disabled state at either scroll end instead of shifting layout).
- **Files Modified**:
  - `src/components/store/faq-view.tsx`
  - `src/components/store/faq-view.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 08:50 IST — Add Mobile Edge-to-Edge Bleed & Live Scroll Progress Pill for FAQ Tabs

- **User Prompt**: `"mobile me kabhi kabhi pata hi nahi chal raha ki or tabs bhi h, jo ki scroll karke dikhna h, isha koe solution do bet possible ux ke hisab se"`
- **Problem / Root Cause**:
  - Without the edge fade mask, padded tabs on mobile could occasionally align neatly near the right card padding, giving users no clear cue that additional category tabs exist off-screen.
- **Solution / Changes Made**:
  1. Added **mobile full-bleed edge-to-edge scrolling** (`margin: -4px -18px; padding: 4px 18px;` on `< 640px`) inside `.faqToolbarCard` so off-screen tabs naturally peek at the outer card edge without washing out or covering any tab text.
  2. Added a **live 60fps scroll progress pill** (`64px × 4px` centered track with `var(--primary)` sliding thumb updated via `requestAnimationFrame` + passive scroll listener) directly underneath `.faqCategoryTabs`, rendered only when tabs overflow (`hasOverflow`), giving instant visual proof of more tabs and current scroll position on both mobile and desktop.
- **Files Modified**:
  - `src/components/store/faq-view.tsx`
  - `src/components/store/faq-view.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 08:54 IST — Replace FAQ Tab Scroll Progress Pill with Prev/Next Chevron Buttons on Mobile & Desktop

- **User Prompt**: `"na iski jagh btn nahi use kar sakte kaya?"`
- **Problem / Root Cause**:
  - User preferred explicit left/right arrow buttons on mobile instead of the scroll progress pill below the tabs.
- **Solution / Changes Made**:
  - Removed the scroll progress pill (`faqScrollProgressTrack` / `faqScrollProgressThumb`, `thumbRef`, and passive scroll listener).
  - Enabled the non-overlapping `.faqTabScrollBtn` left/right chevron buttons across all viewports (mobile `36px × 36px`, desktop `34px × 34px`) whenever `hasOverflow` is true, with disabled state at either scroll end.
- **Files Modified**:
  - `src/components/store/faq-view.tsx`
  - `src/components/store/faq-view.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 08:56 IST — Remove Outer Box Border & Padding from Invoice Summary Block

- **User Prompt**: `".shared-module__1ZJSKq__invoiceSummaryWrap .shared-module__1ZJSKq__invoiceSummaryBox me xhadow ya border use karne ki jaroot kaya h normal invoice ki tarah rakho na"`
- **Problem / Root Cause**:
  - `.invoiceSummaryWrap .invoiceSummaryBox` in `src/components/shared/shared.module.css` rendered an outer boxed border (`border: 1px solid var(--border); border-radius: 12px; padding: 16px`), making the totals block look like a separate card instead of a clean traditional invoice totals section.
- **Solution / Changes Made**:
  - Removed the outer `border`, `border-radius`, `padding`, and ensured `box-shadow: none` on `.invoiceSummaryWrap .invoiceSummaryBox` so the totals summary aligns cleanly flush like a standard printable invoice while keeping its internal tax and grand-total divider lines.
- **Files Modified**:
  - `src/components/shared/shared.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:02 IST — Upgrade PaymentControl Verify/Reject Actions to Shared `<Button>` Variants & Responsive Layout

- **User Prompt**: `"iske ui ko sahi karo, web and mobile dono me best ui ux lagao or cancel btn ko white me kue kar rakha h ye to red jesa hona cahiye na comman btn me kaya chal raha h usi hisab se use karo , or all over the app ek audit chalaan ki har jagh comman btns hi h na apna koe alg btns classes or css to nahi chal rahai."`
- **Problem / Root Cause**:
  - In `src/components/admin/payment-control.tsx`, the Verify button used custom `.verifyBtn` CSS instead of shared `<Button variant="success">`, the Reject button used white `variant="outline"` instead of `<Button variant="destructiveOutline">`, and `.verifyActionRow` wrapped awkwardly leaving Reject as a tiny half-width white stub above full-width "Edit payment record manually".
  - App-wide audit also revealed multiple destructive/cancel buttons using neutral `outline`/custom CSS and ~34 action buttons bypassing `<Button>` / `buttonVariants`.
- **Solution / Changes Made**:
  - Switched `PaymentControl` actions to shared `<Button>` variants: `variant="success"` for Verify, `variant="destructiveOutline"` for Reject trigger, `variant="destructive"` + `variant="outline"` inside the subtly red-tinted `.rejectBox`, `fullWidth` `variant="outline"` for manual edit, and `buttonVariants({ variant: "primary", size: "xs" })` for the UPI refund link.
  - Upgraded `.verifyActionRow` and `.rejectBtnRow` in `src/components/admin/admin-orders.module.css`: full-width `44px` thumb-friendly stacked rows on mobile (`< 640px`), and clean balanced full-row side-by-side flex layout (`flex: 2 1 220px` + `flex: 1 1 116px`) on desktop (`>= 640px`) with zero orphan stubs.
- **Files Modified**:
  - `src/components/admin/payment-control.tsx`
  - `src/components/admin/admin-orders.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:11 IST — App-Wide Standardization of Action & Destructive Buttons to Shared `<Button>` / `buttonVariants`

- **User Prompt**: `"sabko"` (following app-wide button audit)
- **Problem / Root Cause**:
  - Across Admin, Store, Account, and Shared components, destructive/cancel/disable actions used neutral `outline` or manual red CSS overrides, and ~30 action buttons/links/dialog triggers recreated button styling with one-off CSS classes instead of using the shared `<Button>` / `buttonVariants` variants (`destructive`, `destructiveOutline`, `whatsapp`, `success`, `soft`, `outline`, `primary`, `secondary`).
- **Solution / Changes Made**:
  1. **Admin**: Migrated `order-controls.tsx` (`Select Next →`, WhatsApp update, Cancel order), `order-view.tsx` (Invoice, WhatsApp, Call), `return-requests.tsx` (Approve/Reject triggers), `create-return-request.tsx`, `return-order.tsx`, `refund-return-button.tsx`, `order-filters.tsx` (Reset, Search all-time, Clear search), `products-view.tsx` (Notify on WhatsApp), `store-settings-form.tsx` (Disable promo → `destructiveOutline`), `admin-account-menu.tsx` (PIN lock Sign out → `destructiveOutline`), `account-forms.tsx` (Turn off PIN → `destructiveOutline`), and `variant-matrix-modal.tsx` (Clear variants → `destructive`).
  2. **Store**: Migrated `cancel-order.tsx` (`Cancel order` → `destructiveOutline`), `request-return.tsx` (`Request return`, `Edit`, `Change / add address`, `Cancel return/exchange/replacement` → `destructiveOutline`), `checkout-form.tsx` (address actions, UPI deep-link, QR toggle), `payment-panel.tsx` (UPI app, QR toggle), `faq-view.tsx` & `footer.tsx` (WhatsApp CTAs → `whatsapp`), `install-prompt.tsx`, and `search-dialog.tsx` (`See all` CTA).
  3. **Account & Shared**: Migrated `account-nav.tsx` (`Sign out` → `destructiveOutline`), `profile-form.tsx` (`Deactivate account` → `destructiveOutline`), `address-book.tsx` (`Delete` → `destructiveOutline`), `account-views.tsx` (`Ask about this order` → `whatsapp`), `cookie-banner.tsx` (Essential only / Customize / Accept all), `refresh-button.tsx`, and `app/offline/page.tsx`.
- **Files Modified**:
  - `src/components/admin/order-controls.tsx`, `src/components/admin/order-view.tsx`, `src/components/admin/return-requests.tsx`, `src/components/admin/create-return-request.tsx`, `src/components/admin/return-order.tsx`, `src/components/admin/refund-return-button.tsx`, `src/components/admin/order-filters.tsx`, `src/components/admin/products-view.tsx`, `src/components/admin/store-settings-form.tsx`, `src/components/admin/admin-account-menu.tsx`, `src/components/admin/account-forms.tsx`, `src/components/admin/variant-matrix-modal.tsx`
  - `src/components/store/cancel-order.tsx`, `src/components/store/request-return.tsx`, `src/components/store/checkout-form.tsx`, `src/components/store/payment-panel.tsx`, `src/components/store/faq-view.tsx`, `src/components/store/footer.tsx`, `src/components/store/install-prompt.tsx`, `src/components/store/search-dialog.tsx`
  - `src/components/account/account-nav.tsx`, `src/components/account/profile-form.tsx`, `src/components/account/address-book.tsx`, `src/components/account/account-views.tsx`
  - `src/components/shared/cookie-banner.tsx`, `src/components/shared/refresh-button.tsx`, `src/app/offline/page.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:19 IST — Extract Shared `PillTabs` & `SegmentedTabs` Components and Standardize All App Tab Bars

- **User Prompt**: `"iske baad jo humne faq vala tab me changes kiye h, usko ek components bana ke proper iske jese or bhi tab s h aap me usme use karo ek deep audit chalana, check karna shayad 2 types ke tab h dono o alag alag components bana ke jaha use karna h karo."`
- **Problem / Root Cause**:
  - Tab bars across the app were hand-built in 15+ separate places using two recurring patterns (floating pill/chip strips and track-enclosed segmented controls), with inconsistent scrolling, missing auto-centering on mobile, and duplicated CSS.
- **Solution / Changes Made**:
  1. Created **`PillTabs`** (`src/components/shared/pill-tabs.tsx` + `pill-tabs.module.css`) with shared `useScrollableTabs` hook: single-row horizontal scroll on web & mobile, smooth horizontal-only auto-centering of active tabs, overflow-aware non-overlapping left/right chevron buttons, `solid`/`tint` tones, `tablist`/`group`/`navigation` modes, `44px` mobile touch targets, and full WAI-ARIA keyboard support.
  2. Created **`SegmentedTabs`** (`src/components/shared/segmented-tabs.tsx` + `segmented-tabs.module.css`): track-enclosed segmented tabs supporting `equal`, `scroll` (reusing `useScrollableTabs` auto-center + `<`/`>` overflow arrows), and `inline` layouts, `card`/`primary` active surfaces, `rounded`/`pill` shapes, icons, count badges, and attention dots.
  3. Migrated all 7 floating pill tab strips (`faq-view.tsx`, `legal-view.tsx`, `product-browser.tsx` category & mobile sort pills, `product-actions.tsx` review aspect filters, `products-view.tsx` stock filter chips, `variant-matrix-modal.tsx` quick-pricing tabs) to `PillTabs`.
  4. Migrated all 8 segmented tab controls (`order-filters.tsx` customer order status tabs, `cookie-banner.tsx` policy modal tabs, `google-sign-in.tsx` auth mode switcher, `theme-toggle.tsx`, `admin-account-menu.tsx` PIN recovery tabs, `orders-table.tsx` & `products-view.tsx` view switchers, `sales-chart.tsx` chart mode & metric switchers) to `SegmentedTabs`.
- **Files Modified**:
  - Created: `src/components/shared/pill-tabs.tsx`, `src/components/shared/pill-tabs.module.css`, `src/components/shared/segmented-tabs.tsx`, `src/components/shared/segmented-tabs.module.css`
  - Updated: `src/components/store/faq-view.tsx`, `src/components/store/legal-view.tsx`, `src/components/store/product-browser.tsx`, `src/components/store/product-actions.tsx`, `src/components/store/google-sign-in.tsx`, `src/components/admin/products-view.tsx`, `src/components/admin/variant-matrix-modal.tsx`, `src/components/admin/order-filters.tsx`, `src/components/admin/admin-account-menu.tsx`, `src/components/admin/orders-table.tsx`, `src/components/admin/sales-chart.tsx`, `src/components/shared/cookie-banner.tsx`, `src/components/shared/theme-toggle.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:29 IST — Fix Edge-Tab Scroll Glitch in `SegmentedTabs` / `PillTabs` (`useScrollableTabs`)

- **User Prompt**: `"class=\"segmented-tabs-module__1SexrG__segmentedScrollShell\" me ja rha hu to canceled ke baad refund tab pe jese hi ja rha hu to kuch glitch sa kart ah, esa har tab me to nahi h or ye ho kue raha h?"`
- **Problem / Root Cause**:
  1. Switching to the last tab (`Refund`) triggered two overlapping `scrollTo` animations (once synchronously in `handleSelect`, once again in `useEffect`) while `scroll-snap-align: center` fought the edge-clamped `maxScroll` position.
  2. `IntersectionObserver` on `firstEl`/`lastEl` combined with `hasOverflow = start || end` could oscillate arrow-button visibility (`±88px` width) when the last tab's width shifted slightly (`font-weight: 500 → 600` and unmounting `attentionDot`).
- **Solution / Changes Made**:
  - Replaced `IntersectionObserver` edge detection in `useScrollableTabs` (`src/components/shared/pill-tabs.tsx`) with exact `scrollLeft` / `scrollWidth` / `clientWidth` measurement via passive `scroll` listener + `ResizeObserver` and `92px` overflow hysteresis so arrow buttons never flicker/oscillate.
  - Deduplicated `centerItem` to fire once per selection inside `requestAnimationFrame` (and on re-click of an already-active tab).
  - Removed competing `scroll-snap-type` / `scroll-snap-align` from `.pillTabsTrack` and `.segmentedTrayScroll`, and unified `font-weight: 600` on `.segmentBtn` so active/inactive tab widths never shift.
- **Files Modified**:
  - `src/components/shared/pill-tabs.tsx`
  - `src/components/shared/pill-tabs.module.css`
  - `src/components/shared/segmented-tabs.tsx`
  - `src/components/shared/segmented-tabs.module.css`
  - `DEVELOPMENT_LOG.md`



---

### 2026-11-28 08:45 IST — Shop All Skeleton & Scroll Flicker Fix, Checkout Refresh Persistence, Order Placed Top Scroll, UTR Focus, GST Invoice Breakdown, Mobile Full-Screen Admin Settings, Pincode Persistence & Admin Global Search

- **User Prompt**:
  1. Fix Shop All page skeleton loader not showing and middle content disappearing/reappearing on scroll (web & mobile).
  2. Fix refreshing on Checkout Payment screen sending the user back to the Address screen (mobile & web).
  3. Fix Order Placed screen appearing scrolled down after payment instead of at the top (mobile & web).
  4. Update Invoice totals to show Subtotal → Less: Promo Discount → Add: Fees/Delivery → Taxable Value + Add: GST (CGST+SGST / IGST) → Grand Total.
  5. Fix Mobile Admin Settings Back going 2 steps back, fix non-working Cancel button, and convert all Settings tabs on mobile into the common full-screen view (`<Dialog mobileFullScreen>`).
  6. Fix Settings → Contact & Location Pincode not showing in the Pincode field after saving.
  7. Build a comprehensive Admin Global Search covering live orders/products/categories/promos plus every minor setting and feature.
  8. Fix clicking "Place Order" without entering UTR not bringing the UTR input cleanly into view.
  9. Always read `DEVELOPMENT_LOG.md` before starting tasks so previously fixed bugs never regress.
- **Problems / Root Causes**:
  1. `ProductsPageView` rendered `<ProductBrowser>` (which calls `useSearchParams()`) inside `<Suspense fallback={<ProductGrid />}>` even during `loading.tsx`, stripping the search/sort/category filter bar from the skeleton; meanwhile `.stickyFilterBar` toggled `backdrop-filter: blur(28px)` with `transition: backdrop-filter` + negative `50vw` full-bleed margins + `body:has(.stickyFilterBar) { overflow-x: clip }` + React `isStuck` state re-renders on scroll, triggering Chromium compositor tile flicker. `ProductImage` also did not check `img.complete` on mount for already-cached images.
  2. `CheckoutForm` initialized `step` to `1` on mount without restoring `window.history.state.checkoutStep` or persisting checkout draft state in `sessionStorage`, so refreshing on Step 2 or Step 3 reset to Step 1.
  3. Navigating from `/checkout` to `/order-placed` via `router.replace()` while the mobile virtual keyboard was open on the UTR input left the viewport scrolled down after keyboard dismissal.
  4. `InvoiceDocument` mixed discount/delivery rows directly into the items `<tbody>` without a dedicated Subtotal row or explicit CGST+SGST / IGST addition flow.
  5. `StoreSettingsFormInner` managed mobile detail screens with plain `useState(false)` (no history entry, causing mobile Back to exit the route / jump 2 steps back) and its Cancel button only reset the form without closing the mobile view.
  6. Store `pincode` was only stored in local component `useState("")` and explicitly cleared with `setPincode("")` on save instead of being persisted in `store_settings`.
  7. Admin `QuickJumpDialog` only indexed 11 static links and was inaccessible from the mobile topbar.
  8. `utrInputRef.current?.scrollIntoView()` ran synchronously before React painted the validation error and before mobile keyboard resize, leaving the UTR field partially obscured by the sticky header/bottom bar.
- **Solution / Changes Made**:
  1. **Shop All Skeleton & Smooth Scroll**: Added `preview` mode to `ProductsPageView` & `ProductBrowser` (bypassing `useSearchParams()` in `src/app/(store)/products/loading.tsx`), replaced `isStuck` React state with a rAF-throttled DOM `data-stuck` attribute, removed `backdrop-filter` transition / `50vw` bleed / `body:has() overflow-x: clip`, and checked `imgRef.current?.complete` in `ProductImage`.
  2. **Checkout Refresh Persistence**: Added `syncHistoryDepth` to `useStepHistory` and `sessionStorage` draft persistence/restoration (`kk-checkout-draft`, owner-scoped and cleared on order placement, sign-out, or empty cart) in `CheckoutForm` so refreshing on Summary or Payment stays on the same step (web & mobile) with working step-by-step Back.
  3. **Order Placed Top Scroll & UTR Focus**: Blurred active input + scrolled to top right before `router.replace("/order-placed?...")`, added `useLayoutEffect` top-scroll guard in `OrderPlacedBody`, and added a rAF-positioned `focusUtrInput()` helper with `scroll-margin-top`/`scroll-margin-bottom` on `.utrStepSection` for both client and server UTR errors.
  4. **GST / E-commerce Invoice Summary**: Rebuilt `InvoiceDocument` summary into a clean right-aligned audit trail: `Subtotal` → `Less: Promo discount` → `Add: Extra fees` → `Add: Delivery` → `Taxable value (excl. GST)` + `Add: CGST + SGST` (intra-state) or `Add: IGST` (inter-state) → `Grand Total`.
  5. **Mobile Full-Screen Admin Settings + Pincode Persistence**: Converted all 7 Settings tabs on mobile (`< 960px`) to open inside our common `<DialogContent mobileFullScreen>` (automatic `useOverlayHistory` Back handling + sticky header + working Cancel & Save footer); added `contact_pincode` (`supabase/migrations/0076_store_settings_pincode.sql`) with backward-compatible fallback in `saveStoreSettings`, wired `pincode` into `react-hook-form` & `StoreSettings`, and added `?section=<id>` deep-linking.
  6. **Admin Global Search**: Created `searchAdminGlobal` server action (`src/features/admin/search-actions.ts`) and `AdminGlobalSearch` (`src/components/admin/admin-global-search.tsx`, `admin-global-search.module.css`) with instant search across all pages, every Settings tab & minor field, plus debounced live DB search across Orders, Products, Categories & Promo Codes — accessible via `⌘K`/`Ctrl+K`, Desktop Sidebar, and Mobile Topbar.
  7. **Persistent Memory Rule**: Added mandatory "Read `DEVELOPMENT_LOG.md` Before Starting Any Task" instruction to `C:\Users\User\.gemini\config\GEMINI.md`.
- **Files Modified**:
  - `src/app/(store)/products/loading.tsx`, `src/components/store/page-views.tsx`, `src/components/store/product-browser.tsx`, `src/components/store/product-browser.module.css`, `src/components/store/product-image.tsx`
  - `src/hooks/use-step-history.ts`, `src/components/store/checkout-form.tsx`, `src/components/store/checkout-form.module.css`, `src/components/store/order-placed.tsx`
  - `src/components/shared/invoice-document.tsx`, `src/components/shared/shared.module.css`
  - `supabase/migrations/0076_store_settings_pincode.sql`, `src/features/settings/{types.ts,defaults.ts,schema.ts,queries.ts,actions.ts}`, `src/components/admin/store-settings-form.tsx`, `src/components/admin/admin-views.module.css`
  - `src/features/admin/search-actions.ts`, `src/components/admin/admin-global-search.tsx`, `src/components/admin/admin-global-search.module.css`, `src/components/admin/admin-sidebar.tsx`, `src/components/admin/admin-core.module.css`
  - `C:\Users\User\.gemini\config\GEMINI.md`, `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:15 IST — Redesign Admin Global Search Controls, Live Skeleton Loading & Command Palette UX

- **User Prompt**: `"admin global search me ye 3 bhot confusing h, isme best possible ui ux lagao or jab user kuch serch kare to serch resilts me kuch skelaton dikha sakte h , kue ki abhi ek vo ek dum gayab hi rehta h , agar result aat h tab dikhta h? iska best possible ui ux or functionality, tum sep pe reserch karek apply karo"`
- **Problem / Root Cause**:
  1. **3 Confusing Controls in Search Bar**: `<input type="search">` did not hide Chromium/WebKit's native blue `::-webkit-search-cancel-button`, so typing showed a blue native `×` right next to a custom circular `×` clear button and a non-clickable `ESC` badge. On mobile, an extra 56px `<DialogHeader>` stacked above `.searchInputBar`.
  2. **Blank Results Void & Premature "No matches" Flash**: `loadingLive` was only toggled *after* the 180ms debounce timer fired, so typing a non-static query (like an order code or customer name) flashed `"No matches"` for 180ms and then rendered an empty `<div className={styles.groupsStack}>` void until the DB query returned.
- **Solution / Changes Made**:
  1. **Unambiguous Controls (Desktop + Native Mobile App Bar)**: Hid native browser search cancel icons (`::-webkit-search-cancel-button` / `decoration`), replaced the duplicate circular `×` with a clear `"Clear"` text button, added a single crisp desktop Close (`×`) button separated by a subtle divider, moved keyboard shortcuts (`↑↓ Navigate`, `↵ Open`, `Esc Close`) into a Linear/Stripe-style desktop footer bar, and unified mobile into a single sticky native app search bar (`[← Back]` + `[🔍 input Clear]`) with `>= 44px` tap targets.
  2. **Zero-Flash `<Skeletonize>` Live Loading**: Tracked resolved `{ query, data, error }` state + per-session cache so `isLiveLoading` flips to `true` on frame 0 as soon as 2+ chars are typed, rendering a layout-accurate 3-row `<Skeletonize>` block immediately at the top of `.groupsStack` while static matches remain clickable below, and swapping the leading search icon to a spinner.
  3. **Command-Palette Ergonomics & Accessibility**: Added token match highlighting (`<mark>`), per-group result counts, keyboard `scrollIntoView` + hover-synced `activeIndex`, polite settled-only screen-reader announcements, 1-char typing hint, inline retry banner on DB errors, and quick-suggestion chips in the empty state.
- **Files Modified**:
  - `src/components/admin/admin-global-search.tsx`
  - `src/components/admin/admin-global-search.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:17 IST — Remove `.paletteFooter` from Admin Global Search for Cleaner Minimal Layout

- **User Prompt**: `"class=\"admin-global-search-module__dqEnOG__paletteFooter\" ye show karn ki jaroot h ab"` → `"haa"`
- **Problem / Root Cause**:
  - The desktop keyboard-shortcut footer bar in `AdminGlobalSearch` added extra visual chrome while keyboard shortcuts (`↑↓`, `Enter`, `Esc`) already work natively.
- **Solution / Changes Made**:
  - Removed `.paletteFooter` markup and its unused CSS rules from `admin-global-search.tsx` and `admin-global-search.module.css`, and bumped desktop `.searchResultsBody` `max-height` from `430px` to `460px` to give results more breathing room.
- **Files Modified**:
  - `src/components/admin/admin-global-search.tsx`
  - `src/components/admin/admin-global-search.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:20 IST — Prevent Admin Global Search Skeleton from Pushing Instant Matches Down

- **User Prompt**: `"ab ho ye raha h ki, jab user serach kar raha h kuch match karta h to vo sapse niche aa jata h, or uper faltu me skelaton loader chalta rehta h? ye kue ho raha h?"`
- **Problem / Root Cause**:
  - `LiveSearchSkeleton` (3 full rows) was unconditionally rendered at the top of `.groupsStack` whenever `isLiveLoading` was `true`. When the user searched for a Settings or Page term (e.g. `"gst"`, `"delivery"`, `"upi"`), instant static matches appeared right away but were pushed to the bottom beneath the 3-row skeleton on every keystroke until the debounced DB query completed.
- **Solution / Changes Made**:
  - Split loading feedback into two clean states in `admin-global-search.tsx`:
    - `showFullSkeleton` (`isLiveLoading && !hasStaticMatches && !hasLiveMatches`): renders the full 3-row `<LiveSearchSkeleton />` only when no instant matches exist yet (e.g. searching an order code, customer name, or product SKU), preventing a blank results area.
    - `showInlineLiveCheck` (`isLiveLoading && (hasStaticMatches || hasLiveMatches)`): keeps instant matches pinned right at the top with zero layout shift, and shows a compact, non-intrusive `"Checking live orders, products & promos…"` row below them while the DB query finishes.
- **Files Modified**:
  - `src/components/admin/admin-global-search.tsx`
  - `src/components/admin/admin-global-search.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:26 IST — Split Long "Partially refunded ₹X of ₹Y" Pill into Compact Status Pill + Amount Detail

- **User Prompt**: `"Partially refunded ₹1,899 of ₹8,292 jo aat h usko break kar sate h kaya ye bhot bada pill aa raha h,"`
- **Problem / Root Cause**:
  - `paymentDisplay()` returned the full string `"Partially refunded ₹1,899 of ₹8,292"` as a single `label`, and `.badgePillBase` enforces `white-space: nowrap`, producing an oversized ~260px pill across Admin Orders table/cards, Payment Control header, and Customer Order Summary.
- **Solution / Changes Made**:
  - Updated `paymentDisplay()` in `src/features/orders/types.ts` to return a short `label: "Partially refunded"` plus a separate `detail: "₹X of ₹Y"`.
  - Updated `PaymentBadge`, `OrderSummary`, and `InvoiceDocument` (plus `.paymentBadgeGroup`, `.paymentBadgeDetail`, and `.paymentStatusRight` in `src/components/shared/shared.module.css`) so the status renders as a compact `Partially refunded` pill paired with subtle `tabular-nums` amount text (`₹1,899 of ₹8,292`) that wraps cleanly on narrow screens.
- **Files Modified**:
  - `src/features/orders/types.ts`
  - `src/components/shared/payment-badge.tsx`
  - `src/components/shared/order-summary.tsx`
  - `src/components/shared/invoice-document.tsx`
  - `src/components/shared/shared.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 09:32 IST — Always Stack Partial Refund Amount Consistently Below Status Pill

- **User Prompt**: `"kisi me amount niche aa rah ahkisi me sane hi kue h"`
- **Problem / Root Cause**:
  - `.paymentBadgeGroup` and `.paymentStatusRight` used `flex-wrap: wrap` (horizontal row), so the `₹X of ₹Y` amount sat inline next to the `Partially refunded` pill in wide containers and wrapped underneath in narrower table cells/cards, creating inconsistent alignment.
- **Solution / Changes Made**:
  - Switched `.paymentBadgeGroup` and `.paymentStatusRight` in `src/components/shared/shared.module.css` to consistent `flex-direction: column` (`gap: 3px`) so the `₹X of ₹Y` amount always renders neatly beneath the `Partially refunded` pill everywhere.
  - Updated `.statusBox .badgesRow` and `.paymentRoot .paymentHeader` in `src/components/admin/admin-orders.module.css` to `align-items: flex-start` so sibling badges and headings stay top-aligned with the pill.
- **Files Modified**:
  - `src/components/shared/shared.module.css`
  - `src/components/admin/admin-orders.module.css`
  - `DEVELOPMENT_LOG.md`



---

### 2026-11-28 09:38 IST — Extend Unified Settings Hub UI/UX (Desktop 2-Column + Mobile Full-Screen Dialog) to Admin My Account, Admin Data & Launch & Customer Profile

- **User Prompt**: `"jese admin settings ka ui ux h abhi vese hi my account or baaki ek deep audit kar lena or kisi kis me ese lag sakt ah , web and mobile dono sahi se karna koe bug na rahe"`
- **Audit Findings**:
  1. **Admin → My Account (`/admin/account`)**: Stacked 4 heavy forms vertically (`Your details`, `Quick PIN lock`, `Login email`, `Password`), requiring long scrolling on both desktop and mobile.
  2. **Admin → Data & Launch (`/admin/launch`)**: Stacked `Launch checklist` and `Clear test data` danger panel vertically on mobile and side-by-side on desktop.
  3. **Customer → My Account → Profile (`/account/profile`)**: Stacked 4 separate sections vertically (`Personal details`, `Password & security`, `Your data & privacy`, `Deactivate account`) on mobile. (Desktop already has the outer `/account` sidebar, so keeping flat cards on desktop avoids nested sidebars.)
  4. **Other pages audited**: Dashboard (bento), Orders/Products/Categories (tables/lists), Checkout (3-step native shell), and Addresses (already using `<Dialog mobileFullScreen>` for Add/Edit) are already optimal and left untouched.
- **Solution / Changes Made**:
  - **Admin My Account (`src/components/admin/account-forms.tsx`)**: Upgraded to the exact Admin Settings Hub layout — sticky 2-column left sidebar on desktop (`>= 960px`) grouped into *Profile* & *Security & Login* (with live green dot for active 4-digit PIN lock), native drill-down list + common `<DialogContent mobileFullScreen>` with automatic `useOverlayHistory` hardware Back on mobile (`< 960px`), and `?section=details|pin|email|password` + email-callback auto-open deep-linking. Preserved `<Activity>` password/PIN cleanup.
  - **Admin Data & Launch (`src/components/admin/launch-panel.tsx`)**: Upgraded to the same unified Settings Hub layout (`Launch checklist` with live completion pill/dot + `Clear test data` with live record counts) on desktop & mobile `<DialogContent mobileFullScreen>`, with `?section=checklist|reset` deep-linking and `<Activity>` cleanup.
  - **Customer Profile (`src/components/account/profile-form.tsx`, `account.module.css`)**: Converted the 4 stacked Profile cards on mobile (`< 900px`) into a clean native drill-down hub opening each section in `<DialogContent mobileFullScreen>` (with email-change callback auto-open & hardware Back), while keeping desktop (`>= 900px`) clean without double sidebars.
  - **Admin Global Search (`src/components/admin/admin-global-search.tsx`)**: Updated deep-links for Quick PIN lock (`?section=pin`), Login email (`?section=email`), Password (`?section=password`), Launch checklist (`?section=checklist`), and Clear test data (`?section=reset`).
- **Files Modified**:
  - `src/components/admin/account-forms.tsx`
  - `src/components/admin/launch-panel.tsx`
  - `src/components/admin/admin-global-search.tsx`
  - `src/components/account/profile-form.tsx`, `src/components/account/account.module.css`
  - `DEVELOPMENT_LOG.md`



---

### 2026-11-28 09:52 IST — Fix Data & Launch Card Padding & Border Selector After Settings Hub Migration

- **User Prompt**: `"Data & launch page ka ui me padding etc sahi se nahi aa rha h? check and fix karo"`
- **Problem / Root Cause**:
  - In `src/components/admin/admin-views.module.css`, `.launchCard` and `.launchCardDanger` were nested under `.launchGrid .launchCard`. When `LaunchPanel` moved into `.settingsWorkspace` / `.settingsSectionStack` / `.settingsMobileDialogBody`, the `.launchGrid` wrapper was removed, so `.launchCard` lost its `flex` gap, border, radius, and padding (`16px` mobile / `24px` desktop).
- **Solution / Fix**:
  - Made `.launchCard` and `.launchCardDanger` standalone selectors in `src/components/admin/admin-views.module.css` (`padding: 16px`, `gap: 16px`, `border-radius: 12px`, and `padding: 24px` at `>= 640px` matching `.sectionCard` & `.promoSection`), and removed the unused `.launchGrid` rules.
  - Audited `AccountSettings` (`admin-core.module.css`) and `ProfileForm` (`account.module.css`) to confirm all their card classes are already standalone with full padding.
- **Files Modified**:
  - `src/components/admin/admin-views.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 10:12 IST — Deep Full-Stack Audit & Universal Root-Cause Fixes (Security, State/Hooks, UI/UX, CSS Modules & a11y)

- **User Prompt**: `"abhi tak ke saare changes and usse related ui ux, functionality security, etc jo bhi ek app me kiya ja sakta h sab ka ek deep - deep audit karo or fix karke report do, fix esa karna di duara na aae universally fix karna."`
- **Problems / Root Causes Found Across 3-Angle Deep Audit**:
  1. **Security & DB (`search-actions.ts`, `admin-global-search.tsx`, `auth-listener.tsx`, `checkout-form.tsx`, `launch-panel.tsx`, `admin-account-menu.tsx`)**:
     - `searchAdminGlobal` queried non-existent `products.sku` column (silent Postgres `42703` breaking 100% of live Product search), lacked runtime `typeof rawQuery` check, left `"` and `*` unsanitized in PostgREST `.or()`, had no rate limit, and masked PIN-lock errors as cached empty results.
     - `Cmd+K` / `Ctrl+K` and `OPEN_ADMIN_SEARCH_EVENT` opened Admin Global Search on top of the Admin PIN lock screen, and `adminSearchCache` was not wiped on `manualLock`.
     - `AuthListener.clearOrderSession()` did not clear `"kk-checkout-draft"`, leaving checkout PII in `sessionStorage` after sign-out / account switch; `CheckoutForm` also restored unvalidated JSON drafts with no TTL and did not clear other-user drafts immediately.
     - `LaunchPanel` retained destructive `"RESET"` confirmation text across tab switches and mobile dialog close; `AdminPinGateDialog` retained `password`/`newPin` state when exiting Forgot-PIN view.
  2. **State Machines, Hooks & Navigation (`use-step-history.ts`, `use-pincode-lookup.ts`, `pill-tabs.tsx`, `segmented-tabs.tsx`, `store-settings-form.tsx`, `account-forms.tsx`, `profile-form.tsx`, `product-image.tsx`, `product-browser.tsx`, `orders/types.ts`)**:
     - `useStepHistory.syncHistoryDepth` did not synthesize missing history entries when restoring from `sessionStorage` without existing history state (causing in-app Back to exit `/checkout`), and stale `checkoutStep: 3` on guest refresh was not reset to `1`.
     - `usePincodeLookup({ overwrite: true })` overwrote saved City/State and dirtied `/admin/settings` immediately on mount.
     - `PillTabs` and `SegmentedTabs` swallowed `onChange` on active-tab re-click, breaking Review aspect chip deselection (`product-actions.tsx`) and Forgot Password → Sign In tab switching (`google-sign-in.tsx`). `useScrollableTabs` also lacked a `MutationObserver` for dynamic count/trailing width changes.
     - `*SectionQuerySync` left `?section=` in the URL, making repeated Global Search jumps to the same section a no-op; `window.history.replaceState(null, ...)` in `account-forms.tsx` & `profile-form.tsx` wiped mobile dialog `__overlayId` history state.
     - `StoreSettingsForm` allowed submitting an invalid pincode error and its mobile Cancel button silently wiped edits in other sections even when the current section was clean.
     - `ProductImage` left pre-hydration image errors permanently invisible (`opacity: 0`).
  3. **UI/UX, CSS Modules, Mobile Native Feel & a11y**:
     - Broken/orphaned CSS selectors after button migrations: `.footerInstallBtn .downloadSvg` (lost primary color on `InstallPrompt`), `.editPickupBtn .pencilSvg` (lost `12px` size), `.addrActionBtn .actionIcon14`, `.faqWhatsappCta .faqActionIcon`.
     - `PillTabs` `<Link>` branch hardcoded `pillCountActive` instead of checking `tone === "tint"`; `SegmentedTabs` `layout="equal"` only handled 2 or 3 columns; `ProductBrowser` `.mobileSortRow` nested `overflow-x: auto` around `PillTabs`; `AddressBook` Delete button lost `margin-left: auto`; `CustomerOrdersFilterBar` Reset button still bypassed `<Button>`; `.dialogHeaderMobileFull` & `AdminGlobalSearch` lacked `env(safe-area-inset-*)` and `>= 44px` mobile touch targets; `LaunchPanel` desktop vertical tabs lacked roving `tabIndex` + arrow-key nav + `role="tabpanel"`; several decorative icons lacked `aria-hidden="true"`.
- **Universal Fixes Applied**:
  - Hardened `searchAdminGlobal` (removed `products.sku`, hardened PostgREST sanitization, added `limited("track-order", ...)`, discriminated `{ ok, locked }`) and `AdminGlobalSearch` (PIN-lock guard, `manualLock` cache wipe, `closeAndReset` on `⌘K`, `reqIdRef` invalidation, `activeKey` tracking, mobile safe-area & touch targets), plus wired Global Search into `AdminMobileBottomNav` drawer.
  - Cleared `kk-checkout-draft` in `AuthListener.clearOrderSession()`, added strict sanitization + 30-min TTL + rAF/timer cleanup in `CheckoutForm`, and upgraded `useStepHistory.syncHistoryDepth(step, hasExistingEntries)` to synthesize missing history entries on restore.
  - Fixed `usePincodeLookup` to never overwrite saved city/state on primed initial pincode mount, added invalid-pincode submit guard & section-aware mobile Close/Cancel in `StoreSettingsForm`, preserved `window.history.state` & stripped `?section=` across Settings/Account/Launch/Profile hubs, cleared `"RESET"` on leave/close in `LaunchPanel`, and cleared forgot-PIN inputs in `AdminPinGateDialog`.
  - Fixed `PillTabs` & `SegmentedTabs` active re-click dispatch, `MutationObserver` overflow sync, `<Link>` tint count contrast, universal `segmentedTrayEqual` grid, and mobile `44px` touch targets; fixed `ProductImage` pre-hydration errors, `ProductBrowser` double-scroll & `stickyTop: 0`, `paymentDisplay` cancelled partial-refund detail, `InvoiceDocument` print `break-inside: avoid`, orphaned CSS selectors, `AddressBook` Delete alignment, `OrderFilters` `<Button>` consistency, safe-area insets, and WAI-ARIA keyboard/screen-reader attributes.
  - Added 8 permanent architectural regression tests in `src/features/orders/ux-flows-audit.test.ts` (Section 8).
- **Files Modified**:
  - `src/features/admin/search-actions.ts`, `src/components/admin/admin-global-search.tsx`, `src/components/admin/admin-global-search.module.css`, `src/components/admin/admin-sidebar.tsx`
  - `src/components/shared/auth-listener.tsx`, `src/hooks/use-step-history.ts`, `src/components/store/checkout-form.tsx`
  - `src/components/shared/use-pincode-lookup.ts`, `src/components/admin/store-settings-form.tsx`, `src/components/admin/account-forms.tsx`, `src/components/admin/launch-panel.tsx`, `src/components/admin/admin-account-menu.tsx`, `src/components/account/profile-form.tsx`
  - `src/components/shared/pill-tabs.tsx`, `src/components/shared/pill-tabs.module.css`, `src/components/shared/segmented-tabs.tsx`, `src/components/shared/segmented-tabs.module.css`
  - `src/components/store/product-image.tsx`, `src/components/store/product-browser.tsx`, `src/components/store/product-browser.module.css`, `src/components/store/store-widgets.module.css`, `src/components/store/request-return.module.css`, `src/components/store/faq-view.tsx`
  - `src/components/account/address-book.tsx`, `src/components/account/account.module.css`, `src/components/account/account-nav.tsx`, `src/components/account/account-views.tsx`
  - `src/components/admin/order-filters.tsx`, `src/components/admin/admin-orders.module.css`, `src/components/ui/ui.module.css`, `src/components/shared/theme-toggle.tsx`, `src/components/shared/shared.module.css`, `src/components/shared/invoice-document.tsx`, `src/features/orders/types.ts`
  - `src/features/orders/ux-flows-audit.test.ts`, `DEVELOPMENT_LOG.md`
- **Follow-Up Polish & Migration Verification (10:20 IST)**:
  - Verified remote Supabase (`nepfgwfunxebhsfrfxeb`) via `npm run db:dry`: migration `0076_store_settings_pincode.sql` is already applied and remote DB is 100% up to date.
  - Completed vertical `tablist` keyboard nav (`ArrowUp`/`ArrowDown`/`Home`/`End`, roving `tabIndex`, `role="tabpanel"`, `srOnly` status dots) on `StoreSettingsForm` & `AccountSettings` (100% parity with `LaunchPanel`), added Step 3 `promoBelowMin` warning banner in `CheckoutForm`, removed remaining dead/orphaned button CSS rules (`order-status.module.css`, `footer.module.css`, `search-dialog.module.css`, `checkout-form.module.css`, `faq-view.module.css`), and added the permanent **Exhaustive Single-Pass Deep Audit & Zero-Leftover Fixes** rule to `C:\Users\User\.gemini\config\GEMINI.md`.


---

### 2026-11-28 10:56 IST — Complete End-to-End Ecommerce Deep Audit, Hardening & Production Readiness (`audit-production-readiness`)

- **User Prompt**: Full-stack deep audit from first Git commit (`6844d17`) through latest changes covering Git history, architecture, customer storefront, admin panel, security, database/RPCs, UI/UX (web & mobile), accessibility, performance, and SEO — fix all safely fixable issues on a separate Git branch, re-verify everything, and generate `AUDIT_REPORT.md`, `REGRESSION_CHECKLIST.md`, and `TEST_RESULTS.md`.
- **Key Root Causes Discovered**:
  1. **Critical (`request-return.tsx`)**: `tooMany` checked `left.get(p.productId)` instead of `left.get(returnLineKey(p))`, blocking all returns/exchanges on variant products.
  2. **Security (`auth/callback/route.ts`, `orders/actions.ts`, `addresses/actions.ts`, `wishlist/actions.ts`, `products/actions.ts`, `webhooks/payment/route.ts`, `lib/supabase/proxy.ts`)**: Query params could suppress `isRecoveryFlow` on PKCE recovery links; `placeOrder`/`submitPayment` did not enforce `paymentMode === "manual_upi"`; `verifyGatewayPayment` branched on paid status before cryptographic signature check and omitted `code` from rate-limit key; `assertActiveCustomer()` was missing on address/wishlist/review mutations; webhook lacked body size cap; proxy HMAC fallback was ephemeral when `COOKIE_SECRET` was unset.
  3. **Backend / DB (`0077_audit_hardening.sql`, `products/actions.ts`, `product-form.tsx`)**: Concurrent variant product edits overwrote customer stock reservations; return RPCs allowed omitting `variantId` on multi-variant orders; `refund_order` / `guard_payment_status` allowed partial refunds before dispatch/cancel and unpaid→refunded; stale gateway failure webhooks could overwrite newer retry sessions; TOCTOU `unique_violation` races in `subscribe_stock_alert` & `undo_return_step`; multi-variant `dashboard_stats` `topProducts` revenue inflation; missing `^https?://` check on exchange `trackingUrl`; 6 missing DB indexes.
  4. **Customer & Admin Flows (`gateway-client.ts`, `checkout-form.tsx`, `payment-panel.tsx`, `google-sign-in.tsx`, `return-status-control.tsx`, `admin-queries.ts`, `admin-actions.ts`, `create-return-request.tsx`, `launch-actions.ts`)**: Redirect gateways immediately cancelled orders; checkout address modal leaked `initialProfile` across account switches; `/login` swallowed expired verification/reset copy; doorstep exchange `set_courier` was unwired; `payment=submitted` filter/counts included cancelled orders; admin return creation packed address/UPI into 300-char `details`; `resetStoreData` skipped product cache tag on `"customers"` scope.
  5. **Infra, UI/UX, Perf & SEO (`public/sw.js`, `providers.tsx`, `admin/(panel)/error.tsx`, `scroll-reset.tsx`, `order-placed.tsx`, `search-dialog.module.css`, `robots.ts`, `globals.css`, `variant-matrix-modal.tsx`)**: SW SWR HTML risked stale chunks/action IDs; synchronous `domMax` defeated `LazyMotion` code-splitting; missing admin error boundary; 4 broken CSS Module class refs (`.banSvg`, `.whatsappIcon`, `.arrowSvg`); SearchDialog `100vw` + missing safe-area insets; uncleaned `scroll-reset` timers; `/order-placed` above-the-fold `opacity: 0`; native `<select>` in `VariantMatrixModal`; 7 unused UI/dashboard files.
- **Solution / Changes Made**:
  - Created branch `audit-production-readiness` and fixed all Critical (1), High (10), Medium (14), and Low (9) findings, authored `supabase/migrations/0077_audit_hardening.sql`, added 8 permanent regression tests in `src/features/orders/ux-flows-audit.test.ts` (Section 9), and generated `AUDIT_REPORT.md`, `REGRESSION_CHECKLIST.md`, and `TEST_RESULTS.md`.
  - Verified with `tsc --noEmit --incremental false` (0 errors), `npm run lint` (0 errors, 0 warnings), `npm test` (33/33 files, 897/897 tests), and `npm run build` (84/84 pages generated cleanly).
- **Files Modified / Created**:
  - Created: `supabase/migrations/0077_audit_hardening.sql`, `src/app/admin/(panel)/error.tsx`, `AUDIT_REPORT.md`, `REGRESSION_CHECKLIST.md`, `TEST_RESULTS.md`
  - Deleted (unused): `src/components/admin/dashboard/attention-tile.tsx`, `src/components/ui/{avatar,badge,card,select,separator,tabs}.tsx`
  - Modified: `public/sw.js`, `src/proxy.ts`, `src/app/robots.ts`, `src/app/globals.css`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/offline/page.tsx`, `src/app/(store)/store-layout.module.css`, `src/app/auth/callback/route.ts`, `src/app/api/webhooks/payment/route.ts`, `src/app/admin/(panel)/orders/page.tsx`, `src/lib/seo.ts`, `src/lib/supabase/proxy.ts`, `src/features/orders/{actions,admin-actions,admin-queries,gateway-client}.ts`, `src/features/orders/{actions,admin-queries,ux-flows-audit}.test.ts`, `src/features/addresses/actions.ts`, `src/features/wishlist/actions.ts`, `src/features/products/actions.ts`, `src/features/settings/launch-actions.ts`, `src/features/security/audit.ts`, `src/components/shared/{providers,auth-listener,scroll-reset,carousel}.tsx`, `src/components/shared/shared.module.css`, `src/components/store/{request-return,checkout-form,payment-panel,google-sign-in,order-placed,cart-view,product-card,product-actions,footer,cancel-order,category-grid}.tsx`, `src/components/store/{order-status,footer,search-dialog,product-card}.module.css`, `src/components/account/account-views.tsx`, `src/components/admin/{return-status-control,return-requests,create-return-request,order-filters,product-form,product-row-actions,variant-matrix-modal}.tsx`, `DEVELOPMENT_LOG.md`



---

### 2026-11-28 11:03 IST — Move FAQ Tabs & Questions Into Standard JSON Data File (`src/data/faqs.json`)

- **User Prompt**: `"faqs ke tabs or unke faqes ko ek json file me bane ke use kar ke map karke use kar sate? abhi kese h? josn ka format standard rakhna taki map karne me aasani ho. or baaad me agar kuch changes karne ho to json m esidha akr sake"`
- **Problem / Root Cause**:
  - Both `FAQ_CATEGORIES` and the 12 FAQ items were hardcoded inside `src/components/store/faq-view.tsx`, making content edits or adding new FAQ tabs require editing TypeScript component code.
- **Solution / Changes Made**:
  - Created standard JSON dataset [src/data/faqs.json](file:///d:/nextApps/mysaleapp/src/data/faqs.json) with two top-level arrays: `categories` (`key`, `label`, `icon`) and `items` (`id`, `category`, optional `defaultOpen`, `question`, `answer`, optional `link: { href, label }`).
  - Updated [src/components/store/faq-view.tsx](file:///d:/nextApps/mysaleapp/src/components/store/faq-view.tsx) to map tabs and FAQ cards directly from `faqs.json` while supporting live store-settings template placeholders (`{{shopName}}`, `{{shippingSummary}}`, `{{expiryText}}`, `{{returnSummary}}`, `{{invoiceSummary}}`, `{{studioOriginPhrase}}`, `{{orderCodePrefix}}`) and fallback icon mapping.
- **Files Modified**:
  - `src/data/faqs.json` (created)
  - `src/components/store/faq-view.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 21:43 IST — Fix Shop All Page Skeleton & Page-Switch Loader, Convert Address "Save as" to Icon Tabs, and Unify Order vs Product Review Aspects

- **User Prompt**:
  1. Shop All page par jab bhi new page hota hai to pura center ka content gayab ho jata hai aur achanak se aata hai — wahan skeleton loader hona chahiye.
  2. Address "Save as" ko select box hata kar icon tabs mein do.
  3. Order page ke review popup mein "What did you love about it?" ke options aur Product Detail page ke options alag-alag kyun aate hain?
- **Problems / Root Causes**:
  1. **Shop All Skeleton (`page-views.tsx`, `product-browser.tsx`)**: `ProductsPageView` rendered `<Suspense fallback={<ProductGrid ... />}>` without `<Skeletonize>` or the filter bar, and clicking a new pagination page in `ProductBrowser` swapped straight to uncached product cards (`opacity: 0` pending images) with no skeleton transition.
  2. **Address "Save as" (`address-book.tsx`, `checkout-form.tsx`, `request-return.tsx`)**: `AddressDialog` rendered a `<FormSelectField>` dropdown for `label` (`Home` / `Work` / `Other`), while Checkout and Return pickup address modals rendered plain text buttons without icons.
  3. **Review Aspects Mismatch (`src/features/orders/queries.ts`)**: `getMyOrder()` set `reviewAspects: item.reviewAspects ?? live?.reviewAspects`. Because `mapProduct()` defaults `live.reviewAspects` to `[]` (truthy empty array) when a product has no product-level override, `??` stopped at `[]` and never fell back to `live.category?.reviewAspects`, forcing the Order review popup onto `DEFAULT_REVIEW_ASPECTS` while Product Detail resolved `product.category.reviewAspects`.
- **Solution / Changes Made**:
  1. Replaced `ProductsPageView`'s `<Suspense fallback>` with `<Skeletonize><ProductBrowser products={items} categories={categories} preview /></Skeletonize>` and added a crisp `180ms` `<Skeletonize>` transition on `ProductBrowser` pagination changes (with unmount timer cleanup).
  2. Replaced "Save as" across `AddressBook`, `CheckoutForm` ("Add new address" modal), and `RequestReturn` (New pickup address modal) with the shared `<SegmentedTabs layout="equal" surface="card" shape="rounded" />` featuring `HomeIcon`, `BriefcaseIcon`, and `MapPinIcon`.
  3. Updated `getMyOrder()` in `src/features/orders/queries.ts` to resolve `reviewAspects` in the exact same priority order as Product Detail (`item.reviewAspects` non-empty → `live.reviewAspects` non-empty → `live.category.reviewAspects` non-empty → `undefined` / defaults).
  4. Added 3 permanent regression tests in `src/features/orders/ux-flows-audit.test.ts`.
- **Files Modified**:
  - `src/components/store/page-views.tsx`
  - `src/components/store/product-browser.tsx`
  - `src/components/account/address-book.tsx`, `src/components/account/account.module.css`
  - `src/components/store/checkout-form.tsx`
  - `src/components/store/request-return.tsx`
  - `src/features/orders/queries.ts`
  - `src/features/orders/ux-flows-audit.test.ts`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 21:51 IST — Fix Mobile Shop All Duplicate Sort/Category Pill Carousels & Hide Mobile Tab Carousel Arrows

- **User Prompt**: `"ye dono mobile me same ui lag rahe h ? with carausal ui ux odd lag raha h, mobile me? fix ths ui issue"` (with screenshot showing Sort & Category stacked as two identical pill carousels with `<` `>` arrow buttons on mobile).
- **Problem / Root Cause**:
  1. `ProductBrowser` rendered two stacked `PillTabs` rows on mobile (`< 640px`) — one for Sort (`Featured`, `Newest`, `Price: low to high`) and another right below it for Categories (`All`, `Home Decor`, `Gifts`…), making them look visually identical and confusing.
  2. `PillTabs` and `SegmentedTabs` rendered two `44px` circular `<` `>` chevron buttons on mobile (`< 640px`), consuming `~104px` (~30%) of a `360px` screen width on touch devices where users swipe naturally.
- **Solution / Changes Made**:
  1. Removed the duplicate mobile Sort `PillTabs` row in `src/components/store/product-browser.tsx` and placed a compact mobile-only Sort `<SelectField>` (`Sort: Featured`) in the results header bar right opposite the product count (`16 products`), while keeping the sticky bar clean with Search + a single edge-to-edge swipeable Category pill strip (desktop `>= 640px` layout unchanged).
  2. Hid `.scrollArrowBtn` on mobile (`< 640px`) in `pill-tabs.module.css` and `segmented-tabs.module.css` (shown at `>= 640px` on desktop) so mobile tab strips deliver a full-width native touch-swipe experience.
- **Files Modified**:
  - `src/components/store/product-browser.tsx`
  - `src/components/store/product-browser.module.css`
  - `src/components/shared/pill-tabs.module.css`
  - `src/components/shared/segmented-tabs.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 22:13 IST — App-Wide Modern Ecommerce UI, WCAG AA Contrast & Accessibility Craft Pass (`/impeccable`)

- **User Prompt**: `"/impeccable mere all ovver the app ke ui ko ek baar analize kar ke mordern feasiable assesable etc jese ek mordern ecommerce app me hona chaiye vesa ui implement karo. bus dhyan rahe web and mobile ki fuctionality me change na aae"`
- **Problems / Root Causes**:
  1. **WCAG AA Primary Contrast (`theme-store.css`)**: Storefront `--primary` (`#ff6b5a`) on white (`#ffffff`) had a ~2.92:1 contrast ratio, failing WCAG AA (4.5:1) on CTAs, active tabs, badges, and links; `--border` (`0.055`) and `--input` (`0.09`) were too faint on light displays.
  2. **Unthemed Browser Surfaces & High-Contrast Focus (`globals.css`)**: Missing palette-tinted `::selection`, `caret-color`, `accent-color`, default `text-underline-offset`, and `@media (forced-colors: active)` `:focus-visible` outline fallbacks for box-shadow focus rings.
  3. **Visual Craft & Hierarchy (`hero.module.css`, `product-card.module.css`, `header.module.css`, `footer.module.css`)**: Hero headline accent used low-contrast gradient text; mobile product cards nested double box-shadows (`.productCard` + `.mediaFrame`); desktop hover-only Quick Add button was not revealed on `:focus-within`; sticky header and footer lacked crisp hairline separation borders.
  4. **Touch Targets & Tabular Numerals (`mobile-bottom-nav.module.css`, `product-detail.module.css`, `product-actions.module.css`, `cart.module.css`, `checkout-form.module.css`, `ui.module.css`, `form.module.css`, `admin-core.module.css`, `admin/(panel)/layout.tsx`)**: Several mobile/coarse-pointer interactive controls (dialog/checkout back buttons, cart remove buttons, gallery arrows, copy buttons, variant pills, search clear/voice icons, admin nav links) were below `44px`; price/table figures lacked `tabular-nums` in several views; Admin panel lacked a keyboard skip-to-content link.
- **Solution / Changes Made**:
  - Deepened storefront `--primary` to WCAG AA-compliant `#dc4331` (4.63:1 on white) / hover `#c53423` (dark `#e24c3b`) and sharpened `--border`, `--input`, and `--muted-foreground` tokens in `theme-store.css` and `theme-admin.css`.
  - Added themed `::selection`, `caret-color`, `accent-color`, `text-underline-offset`, and `@media (forced-colors: active)` focus outlines in `globals.css`.
  - Replaced hero gradient text with sharp editorial italic `color: var(--primary)`, eliminated nested mobile product-card shadows, added `:focus-within` Quick Add reveal, and added crisp header/footer hairlines.
  - Upgraded coarse-pointer / mobile touch targets to `>= 44px`, refined Switch proportions & placeholder legibility, added `font-variant-numeric: tabular-nums` to PDP prices, cart totals, and tables, and added an accessible Skip to content link to `AdminPanelLayout` — with zero changes to web or mobile JS/business functionality.
- **Files Modified**:
  - `src/app/globals.css`, `src/styles/theme-store.css`, `src/styles/theme-admin.css`
  - `src/components/store/header.module.css`, `src/components/store/hero.module.css`, `src/components/store/product-card.module.css`, `src/components/store/mobile-bottom-nav.module.css`, `src/components/store/footer.module.css`, `src/components/store/product-detail.module.css`, `src/components/store/product-actions.module.css`, `src/components/store/cart.module.css`, `src/components/store/checkout-form.module.css`
  - `src/components/ui/ui.module.css`, `src/components/form/form.module.css`, `src/components/admin/admin-core.module.css`, `src/app/admin/(panel)/layout.tsx`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 22:43 IST — Unified Storefront + Admin Theme System (8 Curated Presets + Custom 3-Color Builder in Admin Settings)

- **User Prompt**: `"i think theme user nad amin me alag alag chal raha h? inko same hi kar de to manage karne me aasan rahega ... yesa ho sakta h kaya , m ye 8 ke 8 option de du admin me takki admin inme se koe bhi select kar sake, or ek custom bhi jisse user apne aap koe custom bana sake?"`
- **Problem / Root Cause**:
  - Storefront (`src/styles/theme-store.css`) and Admin Panel (`src/styles/theme-admin.css`) used two completely separate color palettes, making the two halves look like unrelated apps and requiring edits in two files for any re-theme.
- **Solution / Changes Made**:
  - Unified Storefront + Admin colors into a single stylesheet [src/styles/theme.css](file:///d:/nextApps/mysaleapp/src/styles/theme.css) imported once in [src/app/globals.css](file:///d:/nextApps/mysaleapp/src/app/globals.css), with **Artisanal Terracotta** as the default and all **8 WCAG AA/AAA presets** (`terracotta`, `vermilion`, `emerald`, `indigo`, `teal`, `burgundy`, `cobalt`, `charcoal`) supporting Light & Dark modes across both Storefront and Admin (Admin retains compact density only).
  - Created [src/features/settings/theme.ts](file:///d:/nextApps/mysaleapp/src/features/settings/theme.ts) with preset metadata, strict 6-digit hex validation, WCAG 2.1 contrast calculation, and automatic Light + Dark CSS derivation from 3 custom brand colors.
  - Added DB migration [supabase/migrations/0078_store_theme.sql](file:///d:/nextApps/mysaleapp/supabase/migrations/0078_store_theme.sql) (`theme_preset`, `theme_custom`) and wired `StoreSettings` types, defaults, Zod schema, cached queries, and `saveStoreSettings` (with graceful unpushed-migration fallback).
  - Injected `data-theme={settings.themePreset}` and SSR custom CSS `<style id="kalakriti-custom-theme">` in [src/app/layout.tsx](file:///d:/nextApps/mysaleapp/src/app/layout.tsx) for zero-FOUC rendering.
  - Added **Theme & Appearance** section ([theme-settings-section.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/theme-settings-section.tsx) + [theme-settings-section.module.css](file:///d:/nextApps/mysaleapp/src/components/admin/theme-settings-section.module.css)) inside Admin → Settings ([store-settings-form.tsx](file:///d:/nextApps/mysaleapp/src/components/admin/store-settings-form.tsx)) with live Storefront + Admin dual preview, Light/Dark toggle, 8 preset cards, 3-color custom builder, WCAG AA contrast badges, and instant DOM sync on save.
  - Added unit tests in [src/features/settings/theme.test.ts](file:///d:/nextApps/mysaleapp/src/features/settings/theme.test.ts).
  - Synced Favicon (`src/app/icon.tsx`), Apple Touch Icon (`src/app/apple-icon.tsx`), PWA icons (`src/app/icons/[size]/route.tsx`), `manifest.ts`, `generateViewport()` `themeColor`, and `LogoMark` (`src/components/shared/logo.tsx` + `theme.css`) to the active unified theme with cache-busting `?v=<theme>` URLs and live browser-tab favicon refresh on Save.
  - Applied migration `0078_store_theme.sql` to remote Supabase (`nepfgwfunxebhsfrfxeb`).
- **Files Created / Modified**:
  - Created: `src/styles/theme.css`, `src/features/settings/theme.ts`, `src/features/settings/theme.test.ts`, `supabase/migrations/0078_store_theme.sql`, `src/components/admin/theme-settings-section.tsx`, `src/components/admin/theme-settings-section.module.css`
  - Modified: `src/app/globals.css`, `src/app/layout.tsx`, `src/features/settings/{types,defaults,schema,queries,actions}.ts`, `src/components/admin/store-settings-form.tsx`, `DEVELOPMENT_LOG.md`


---

### 2026-11-28 23:12 IST — Lighten Bespoke Studio CTA Banner for Light & Dark Theme Harmony

- **User Prompt**: `".home-view-module__YpomYW__pageSection .home-view-module__YpomYW__bespokeBanner ye section kuch jayada hi dark lag raha h? light mode me?"`
- **Problem / Root Cause**:
  - `.bespokeBanner` in `src/components/store/home-view.module.css` used dark `--store-support` as its background even in Light mode, making it feel heavy against the airy storefront and reducing contrast on the `var(--primary)` eyebrow text.
- **Solution / Changes Made**:
  - Replaced the heavy dark block with a soft theme-tinted editorial gradient (`--card` + `--store-section-tint` + subtle `--primary` radial glow), a `1px` tinted border hairline, and high-contrast `--foreground` / `--muted-foreground` typography that adapts seamlessly across all 8 presets, Custom theme, and Light/Dark modes; removed unused `.browseOutlineBtn`/`.browseArrow` CSS rules.
  - Follow-up deep CSS contrast audit fixes: pinned `.dark[data-theme="charcoal"]` `--logo-grad-*` to obsidian so the ivory `LogoMark` glyph never disappears on light `--primary`, switched `AnnouncementBar` to `var(--primary)` / `var(--primary-foreground)` with `currentColor` icon so Charcoal Light never renders invisible dark-on-dark icons, and replaced hardcoded dark swatch ring border in `theme-settings-section.module.css` with theme-aware `color-mix(...)`.
- **Files Modified**:
  - `src/components/store/home-view.module.css`, `src/components/store/announcement-bar.module.css`, `src/styles/theme.css`, `src/components/shared/shared.module.css`, `src/components/admin/theme-settings-section.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 22:16 IST — Restore Borderless Frosted-Glass `.stickyFilterBar` Styling on Shop All

- **User Prompt**: `"class=\"product-browser-module__IbPrtq__stickyFilterBar\" ye sticky pe jese pele th avese kar do, border etc hata do"`
- **Problem / Root Cause**:
  - `.stickyFilterBar` in `product-browser.module.css` had a `border: 1px solid transparent` / `border-radius: 16px` and `border-color` on `[data-stuck]`, making it look like a bordered box instead of the original seamless borderless frosted-glass bar.
- **Solution / Changes Made**:
  - Restored `.stickyFilterBar` to `border: 0; border-radius: 0; background-color: transparent; box-shadow: none;` and `.stickyFilterBar[data-stuck]` to frosted glass (`background-color: color-mix(in oklab, var(--background) 82%, transparent); backdrop-filter: blur(28px) saturate(180%); box-shadow: 0 14px 32px -16px var(--shadow-color-soft);`) with zero border and compositor-safe transitions.
- **Files Modified**:
  - `src/components/store/product-browser.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 22:18 IST — Restore Full-Viewport Edge-to-Edge Width on `.stickyFilterBar`

- **User Prompt**: `"class=\"product-browser-module__IbPrtq__stickyFilterBar\" iski width jitni thi full me utni karo na sticky hone pe"`
- **Solution / Changes Made**:
  - Restored full-bleed viewport width (`margin: 0 calc(50% - 50vw) 32px calc(50% - 50vw); padding: 14px calc(50vw - 50%);`) and `:global(body):has(.stickyFilterBar) { overflow-x: clip; }` on `.stickyFilterBar` in `src/components/store/product-browser.module.css` so the frosted-glass sticky bar spans 100% edge-to-edge on web & mobile while keeping the inner controls aligned with the page container.
- **Files Modified**:
  - `src/components/store/product-browser.module.css`
  - `DEVELOPMENT_LOG.md`


---

### 2026-11-28 22:23 IST — Refine `SegmentedTabs` Height & Tray Proportions on Mobile and Desktop

- **User Prompt**: `".segmented-tabs-module__1SexrG__segmentedTray mobile me tab ki height kuch jayada hi lag rahi h? isko fix karo or web me bhi ek baar usi hisab se dekh lena"`
- **Problem / Root Cause**:
  - `.segmentedTray` used `padding: 4px` around `.segmentBtnScroll` (`height: 44px`), producing a `54px` tall tab bar on mobile (`< 640px`) and `46px` for equal segmented tabs on desktop.
- **Solution / Changes Made**:
  - Tightened `.segmentedTray` to `padding: 3px; gap: 3px; border-radius: 11px;`.
  - Standardized mobile `.segmentBtn` and `.segmentBtnScroll` to `height: 36px` (`44px` total tray height on mobile — sleek while preserving comfortable tap area) and desktop (`>= 640px`) to `height: 34px` (`42px` total tray height).
- **Files Modified**:
  - `src/components/shared/segmented-tabs.module.css`
  - `DEVELOPMENT_LOG.md`
