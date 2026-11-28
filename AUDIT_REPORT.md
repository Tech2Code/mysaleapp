# Complete Ecommerce Application — Deep Audit Report

**Project:** Kalakriti / MySaleApp (`d:\nextApps\mysaleapp`)
**Audit Date:** 2026-11-28 (IST)
**Git Branch:** `audit-production-readiness` (branched from `main` at `c11d057`, preserving all uncommitted working-tree work)
**Stack:** Next.js 16.4.5 (App Router, Turbopack, Cache Components, Partial Prefetching), React 19.3, TypeScript 5, Supabase (Auth, Postgres, RLS, Storage, RPCs), Plain CSS Modules (`*.module.css`, zero Tailwind), Vitest 5.1

---

## 1. Executive Summary

A full-stack, multi-domain deep audit was conducted across the entire 48-commit Git history (`6844d17` → `c11d057` + uncommitted working tree), all 76 existing Supabase SQL migrations (`0001`–`0076`), all 14 `"use server"` modules, API routes, storefront customer flows, admin panel workflows, CSS Modules, mobile native-app UX, accessibility, performance, and SEO.

| Severity | Found | Fixed & Verified | Documented / Trade-off |
| --- | --- | --- | --- |
| **Critical** | 1 | 1 | 0 |
| **High** | 10 | 10 | 0 |
| **Medium** | 17 | 14 | 3 (architectural trade-offs / deferred polish) |
| **Low** | 12 | 9 | 3 (minor / optional cleanup) |

**Final Verification Status:**
- **TypeScript (`tsc --noEmit --incremental false`):** PASS (0 errors)
- **ESLint (`npm run lint`):** PASS (0 errors, 0 warnings)
- **Automated Tests (`npm test`):** PASS (33/33 files, **897/897 tests passed**, including 8 new permanent regression guards)
- **Production Build (`npm run build`):** PASS (Compiled in 10.1s, TypeScript in 10.8s, 84/84 static/PPR routes generated)

---

## 2. Git History & Architecture Audit Findings

- **History Reviewed:** All 48 commits from `6844d17` (2026-11-05 initial bootstrap) through `c11d057` (2026-11-27 premium animations & audit hardening), plus 69 modified / 8 untracked working-tree files (Settings Hub, Admin Global Search, `PillTabs`/`SegmentedTabs`, `0076_store_settings_pincode.sql`).
- **Branch Hygiene:** Local & remote `ui-redesign` (`be1bcc2`) is fully merged into `main` (`git log main..ui-redesign` is empty) and can be safely pruned.
- **Architecture Strengths Verified:**
  - 100% plain CSS Modules (`*.module.css`), zero Tailwind utility classes, zero `rem`/`em` units, dual CSS variable theme system (`theme-store.css` & `theme-admin.css`).
  - Next.js 16 Cache Components (`cacheComponents: true`, `"use cache"`, `cacheLife`, `cacheTag`, `await connection()`), derived `<Skeletonize>` loading contracts (`loading-contract.test.ts`: 38/38 passing).
  - Server-computed order totals, variant-aware `create_order` with `FOR UPDATE` locks in deterministic ID order, and HMAC-signed HttpOnly admin PIN & password-reset cookies.
- **Regressions & Debt Found and Fixed:**
  - `<LazyMotion>` in `src/components/shared/providers.tsx` imported `domMax` synchronously, defeating code-splitting and leaving `src/components/shared/motion-features.ts` orphaned. **Fixed.**
  - `public/sw.js` used stale-while-revalidate for HTML navigations (risking stale JS chunk 404s and `Failed to find Server Action` errors across deploys), lacked a fallback `Response` when `/offline` wasn't cached, and omitted `event.waitUntil()` on `/_next/image` SWR. **Fixed (`v7`).**
  - Missing admin segment error boundary (`src/app/admin/(panel)/error.tsx`) caused admin errors to show storefront WhatsApp copy. **Fixed.**
  - `src/app/offline/page.tsx` lost its top button margin after button migration (`offlineTryLink` orphaned). **Fixed.**
  - 7 completely unused UI/dashboard component files left behind from migrations (`attention-tile.tsx`, `ui/avatar.tsx`, `ui/badge.tsx`, `ui/card.tsx`, `ui/select.tsx`, `ui/separator.tsx`, `ui/tabs.tsx`). **Removed.**
  - `src/proxy.ts` matcher ran `updateSession()` on `/icon`, `/apple-icon`, and `/opengraph-image`. **Fixed.**

---

## 3. Detailed Findings & Fixes Implemented

### Critical Findings

#### C1. Return / Exchange / Replacement Wizard Completely Blocked for All Variant Products — **FIXED**
- **Affected File:** `src/components/store/request-return.tsx`
- **Root Cause:** `returnableQuantities()` keys its `Map` by `returnLineKey(item)` (`"${productId}::${variantId}"`), but line 353 checked `left.get(p.productId) ?? 0`, which returned `0` for every variant item and made `tooMany` unconditionally `true`, blocking Step 1 progression and submission.
- **Fix:** Updated line 353 to `left.get(returnLineKey(p)) ?? 0`. Locked with regression test in `src/features/orders/ux-flows-audit.test.ts`.

---

### High Severity Findings

#### H1. Password-Recovery Session Restriction (`kk_pw_reset` / `kk_cust_pw_reset`) Bypassable via Query Params — **FIXED**
- **Affected File:** `src/app/auth/callback/route.ts`
- **Root Cause:** `handleAuthenticatedSuccess()` let query parameters (`flow=oauth`, `next=...email_changed=1`, or unverified `type=signup` on PKCE `?code=`) suppress `isRecoveryFlow`, allowing a modified PKCE recovery link to establish a normal authenticated session without setting `kk_pw_reset` / `kk_cust_pw_reset`.
- **Fix:** Passed explicit `authMethod: "pkce" | "otp"` so `otpType` is only trusted when `verifyOtp()` ran, removed `next.includes("email_changed=1")` bypass, and enforced recovery detection whenever `hasRecentRecoverySent` or `recoveryIntent` is present.

#### H2. Concurrent Variant Product Edits Overwrite Customer Stock Reservations — **FIXED**
- **Affected Files:** `src/features/products/actions.ts`, `src/components/admin/product-form.tsx`, `supabase/migrations/0077_audit_hardening.sql`
- **Root Cause:** `saveProduct()` wrote absolute form variant stocks directly into `products.variants`, silently wiping concurrent customer `create_order` / `cancel_order` stock changes, swallowed `stockError`, and logged `stockDelta: 0`.
- **Fix:** Passed `expectedVariantStocks` from `ProductForm`, preserved live DB variant stocks on metadata `UPDATE`, added atomic `adjust_product_variant_stock(p_id, p_deltas)` RPC in migration `0077` (with backward-compatible fallback), surfaced errors on sync failure, and logged the true `appliedStockDelta`.

#### H3. Omitted `variantId` in Return RPCs Enabled Multi-Variant Over-Refund, `NOT_IN_REQUEST` Bypass & Stock Drift — **FIXED**
- **Affected File:** `supabase/migrations/0077_audit_hardening.sql` (`return_items_value`, `request_return`, `admin_create_return_request`, `record_order_return`)
- **Root Cause:** Matching `v_vid is null or e ->> 'variantId' = v_vid` allowed omitting `variantId` on multi-variant orders to match all variants at `MAX(price)`, bypass `NOT_IN_REQUEST` totals, or restock aggregate stock without updating `variants` JSONB.
- **Fix:** Required non-null `variantId` whenever the order has variant lines for that `productId`, enforced strict `(productId, variantId)` matching, and added a per-product total quantity cap in `NOT_IN_REQUEST`.

#### H4. `refund_order` Allowed Partial Refunds Before Dispatch/Cancel & `guard_payment_status` Allowed Unpaid → Refunded — **FIXED**
- **Affected File:** `supabase/migrations/0077_audit_hardening.sql` (`refund_order`, `guard_payment_status`)
- **Root Cause:** `guard_payment_status()` only blocked transitions to `payment_status = 'refunded'` on `pending/confirmed/packed` orders, allowing partial `refund_order` calls to increment `refunded_amount` before cancellation/dispatch, and did not reject `pending/failed/submitted -> refunded` at the DB trigger level.
- **Fix:** Blocked `refund_order` on `pending/confirmed/packed`, and hardened `guard_payment_status()` to reject both `old.payment_status <> 'paid' -> refunded` (`NOT_PAID`) and `refunded_amount` increases before dispatch/cancel (`REFUND_BEFORE_DISPATCH`).

#### H5. Redirect-Based Payment Gateways Immediately Cancelled Orders Before Redirecting — **FIXED**
- **Affected Files:** `src/features/orders/gateway-client.ts`, `src/components/store/checkout-form.tsx`, `src/components/store/payment-panel.tsx`
- **Root Cause:** `openGatewayCheckout` returned `{ status: "dismissed" }` immediately after `window.location.assign(session.checkoutUrl)`, causing `CheckoutForm` to call `cancelOrder()` while the browser was navigating to the gateway.
- **Fix:** Added `{ status: "redirecting" }` outcome and handled it in `CheckoutForm` and `PaymentPanel` without cancelling the order.

#### H6. Cross-Account PII Leak in Checkout "Add New Address" Modal — **FIXED**
- **Affected File:** `src/components/store/checkout-form.tsx`
- **Root Cause:** `clientProfile` state was discarded (`const [, setClientProfile]`) and `CheckoutAddressModalBody` received raw server-rendered `initialProfile` without checking `canUseInitial`.
- **Fix:** Computed `activeProfile = clientProfile ?? (canUseInitial ? initialProfile : null)` and passed `activeProfile` to `CheckoutAddressModalBody`.

#### H7. Expired Verification & Password-Reset Messages Swallowed on `/login` — **FIXED**
- **Affected File:** `src/components/store/google-sign-in.tsx`
- **Root Cause:** The alert ternary only matched `"cancelled"` and `"expired"`, replacing full error messages (`verify-expired` and token expiry messages) with the generic sign-in error.
- **Fix:** Matched `"auth"` explicitly and rendered custom `problem` messages directly.

#### H8. Doorstep Exchange "Add / Edit Courier Details" (`mode="set_courier"`) Never Wired in Admin UI — **FIXED**
- **Affected File:** `src/components/admin/return-status-control.tsx`
- **Root Cause:** `ExchangeFulfillmentControl` and `advanceExchangeFulfillment` implemented `set_courier`, but `ReturnStatusControl` never exposed it in the status dropdown for approved doorstep exchanges.
- **Fix:** Added `"exchange_set_courier"` choice when `isDoorstepApproved` is true and rendered `<ExchangeFulfillmentControl mode="set_courier" />`.

#### H9. Service Worker Stale HTML Deploy Hazard, Synchronous `domMax`, and Missing Admin Error Boundary — **FIXED**
- **Affected Files:** `public/sw.js`, `src/components/shared/providers.tsx`, `src/app/admin/(panel)/error.tsx`, `src/app/error.tsx`
- **Fix:** Switched `sw.js` (`v7`) HTML navigations to network-first with guaranteed `Response` fallback and `event.waitUntil()` on image SWR; lazy-loaded `motion-features.ts` in `Providers`; created `src/app/admin/(panel)/error.tsx`.

#### H10. Broken CSS Module References, Mobile SearchDialog `100vw` / Safe-Area, and Offline Button Margin — **FIXED**
- **Affected Files:** `src/components/store/order-status.module.css`, `src/components/store/footer.module.css`, `src/components/store/search-dialog.module.css`, `src/app/offline/page.tsx`, `src/app/(store)/store-layout.module.css`
- **Fix:** Added missing `.banSvg`, `.whatsappIcon`, `.arrowSvg` classes; replaced `width: 100vw` with `width: 100%` + `env(safe-area-inset-*)` in `search-dialog.module.css`; restored `styles.errorRetryBtn` margin on `/offline` and removed orphaned `.offlineTryLink`.

---

### Medium Severity Findings (Fixed)

1. **M1 — `verifyGatewayPayment` Rate-Limit Key & Paid-Status Oracle (`src/features/orders/actions.ts`):** Scoped `limited("gateway-payment", parsed.data.code)` and moved `gatewayOrderId` + cryptographic `adapter.verifyClientPayment()` verification *before* branching on `payment_status === "paid"`.
2. **M2 — Missing `assertActiveCustomer()` on Customer Mutations (`src/features/addresses/actions.ts`, `src/features/wishlist/actions.ts`, `src/features/products/actions.ts`):** Enforced `assertActiveCustomer()` on `saveAddress`, `deleteAddress`, `setDefaultAddress`, `syncWishlist`, `setWishlisted`, `submitProductReview`, and owner `deleteProductReview`.
3. **M3 — `placeOrder` & `submitPayment` Payment-Mode Enforcement (`src/features/orders/actions.ts`):** Rejected manual UPI `placeOrder` and `submitPayment` when `shop.paymentMode !== "manual_upi"`; scoped `limited("submit-payment", parsed.data.code)`.
4. **M4 — Stale Gateway Failure Webhooks & Webhook Body Cap (`supabase/migrations/0077_audit_hardening.sql`, `src/app/api/webhooks/payment/route.ts`):** Ignored delayed `record_gateway_failure` webhooks whose `gateway_order_id` does not match the order's active retry session; enforced 256 KB max body size (`413`) on `/api/webhooks/payment`.
5. **M5 — Cookie HMAC Fallback Consistency (`src/lib/supabase/proxy.ts`):** Added `SUPABASE_SERVICE_ROLE_KEY` as a deterministic fallback before `PROD_FALLBACK_SECRET` to avoid per-isolate secret drift when `COOKIE_SECRET` is omitted.
6. **M6 — Database Reliability, Analytics & Performance (`supabase/migrations/0077_audit_hardening.sql`):**
   - Caught `unique_violation` TOCTOU races in `subscribe_stock_alert()` and `undo_return_step()`.
   - Fixed multi-variant `topProducts` revenue inflation in `dashboard_stats()` by grouping by `(order_id, productId, variantId)` before rolling up by `productId`.
   - Enforced `^https?://` on `trackingUrl` in `advance_exchange_fulfillment()` and `decide_return_request()`.
   - Revoked `EXECUTE` on `guard_order_status_transition()` and `track_product_restock()`; added `store_settings_contact_pincode_fmt` CHECK constraint.
   - Added 6 performance indexes (`order_returns_refunded_created_idx`, `return_requests_status_created_idx`, `orders_unpaid_expiry_eff_idx`, `stock_alerts_status_created_idx`, `stock_alerts_user_id_idx`, `product_reviews_user_id_idx`).
7. **M7 — Admin Orders Filter Counts, UTR Search & Auth-Before-Query (`src/features/orders/admin-queries.ts`, `src/app/admin/(panel)/orders/page.tsx`, `src/components/admin/order-filters.tsx`):** Excluded cancelled orders from `payment=submitted` counts and list queries (matching Dashboard `to-verify`), ignored explicit period on `OrderView` filter counts, added `payment_reference` (UTR) to orders list search, and awaited `requireAdmin()` before firing DB queries.
8. **M8 — Admin Return Request 300-Char Packing Bug (`src/features/orders/admin-actions.ts`, `src/components/admin/create-return-request.tsx`):** Accepted `pickupAddress` and `refundUpiId` as separate validated fields and composed on the server.
9. **M9 — Exchange Courier Past-Date Validation (`src/features/orders/admin-actions.ts`):** Added `expectedDeliveryProblem()` validation in `decideReturnRequest` and `advanceExchangeFulfillment`.
10. **M10 — `resetStoreData` Cache Invalidation (`src/features/settings/launch-actions.ts`):** Called `updateTag(CACHE_TAGS.products)` when clearing `"customers"` scope (which deletes `product_reviews`).
11. **M11 — Audit Log Coverage (`src/features/security/audit.ts`, `src/features/products/actions.ts`):** Added `"account"` targetType and logged `stock_alert.delete`.
12. **M12 — `GoogleSignIn` Unmemoized `onParams` Callback (`src/components/store/google-sign-in.tsx`):** Memoized `handleSearchParams` with `useCallback` and guarded `verified=1` toast with a ref.
13. **M13 — Multi-Variant Return Summary Name & Duplicate React Keys (`src/components/store/request-return.tsx`, `src/components/admin/return-requests.tsx`):** Matched items and keyed lists by `returnLineKey`.
14. **M14 — Gateway-Aware Checkout/Account Copy (`src/components/store/cart-view.tsx`, `src/components/account/account-views.tsx`):** Dynamically displayed gateway vs. manual UPI copy and distinguished `pending` vs. `failed` payment deadlines.
15. **M15 — UI/UX, LCP, Timers, SEO & Controls:**
    - Removed above-the-fold `opacity: 0` + `delay: 0.2` on `/order-placed` (`src/components/store/order-placed.tsx`).
    - Replaced uncleaned `setTimeout` calls in `src/components/shared/scroll-reset.tsx` with a single cleared `transitionTimer`.
    - Merged duplicate `:root` block in `src/app/globals.css`.
    - Added `"/track"` to `src/app/robots.ts` `disallow`; added `faqJsonLd` helper in `src/lib/seo.ts`.
    - Replaced native `<select id="bulk-scope">` in `src/components/admin/variant-matrix-modal.tsx` with shared `SelectField`.
    - Expanded mobile tap targets on product cards (`.cardWishlistPos`, `.quickAddBtn`), search dialog (`.clearAllBtn`), and carousel dots (`.carouselDotBtn`).

### Low Severity Findings (Fixed)
- Cleared `kk-wishlist-oos-ids` and `kk-stock-alerts` from `localStorage` on sign-out (`src/components/shared/auth-listener.tsx`).
- Fixed guest Razorpay blank `contact: "+91"` (`src/features/orders/gateway-client.ts`).
- Added `compareAtPrice > price` guard on product cards & reviews banner (`src/components/store/product-card.tsx`, `src/components/store/product-actions.tsx`).
- Fixed `"Select option"` button label for variant products & `!pending` guard on review delete dialog (`src/components/store/product-actions.tsx`).
- Added `aria-hidden="true"` to decorative icons (`footer.tsx`, `cancel-order.tsx`, `category-grid.tsx`, `carousel.tsx`, `order-placed.tsx`, `product-row-actions.tsx`).
- Added dark-mode `@media (prefers-color-scheme: dark)` support to `src/app/global-error.tsx`.
- Removed 7 unused component files and excluded `/icon`, `/apple-icon`, `/opengraph-image` from `src/proxy.ts`.

---

## 4. Remaining Issues, Architectural Trade-Offs & Unverified Scenarios

| Item | Severity | Reason / Recommendation |
| --- | --- | --- |
| **Apply Migration `0077_audit_hardening.sql`** | Operational | **Applied** to linked Supabase project (`nepfgwfunxebhsfrfxeb`) via `npx supabase db push --remote --yes`. |
| **Browser-direct Storage uploads bypass Admin PIN lock** | Medium (Trade-off) | `ImageUploader` uploads directly to Supabase Storage (RLS checks `is_admin()`, 5 MB max, image-only MIME types). Proxying through Next.js Server Actions hits Vercel's 4.5 MB body limit; consider signed upload URLs minted by an `assertAdmin()` Server Action in a future release. |
| **CSP `https://cdn.jsdelivr.net`** | Low (Trade-off) | Required by `browser-image-compression`'s default web worker. Can be removed if `useWebWorker: false` is acceptable or if the worker script is self-hosted under `/public`. |
| **Admin Audit Logs Viewer UI** | Medium (Feature gap) | `admin_audit_logs` is populated on mutations; building a read-only viewer tab in Admin → Account/Launch is recommended as a follow-up feature. |
| **Dead CSS Module Classes (~145 selectors) & Legacy Deps (`cn`, `cva`)** | Low (Tech debt) | Non-functional bloat from recent tab/button migrations; safe to prune incrementally alongside visual regression snapshots. |
| **Stale `ui-redesign` branch** | Low (Git hygiene) | Fully merged into `main`; delete via `git branch -d ui-redesign` and `git push origin --delete ui-redesign`. |
| **Unverified External Integrations** | Unverified | Live Razorpay/Cashfree/PhonePe/Stripe payment captures & webhooks, live Gmail SMTP delivery, live India Post pincode API latency, and live Supabase `pg_cron` expiry execution were not exercised against production to avoid polluting production orders/emails. |
