# Regression & QA Checklist — Kalakriti (MySaleApp)

Use this checklist before every major release, database migration, payment/auth change, or UI refactor.

---

## 1. Automated Baseline Gate (Mandatory Before Any Merge/Push)

- [ ] `npx --no-install tsc --noEmit --incremental false` passes with **0 errors**
- [ ] `npm run lint` passes with **0 errors and 0 warnings**
- [ ] `npm test` passes **100%** (currently 33 files / 897 tests)
- [ ] `npm run build` succeeds cleanly (all static + PPR routes prerendered)
- [ ] If any `supabase/migrations/00NN_*.sql` was added: `npm run db:dry` reviewed and `npm run db:push` applied

---

## 2. Customer Storefront & Account Flows

### Authentication & Account Lifecycle
- [ ] Email/password sign-up sends verification link (SMTP or Supabase fallback) and rejects weak/duplicate passwords
- [ ] Email/password sign-in, Google OAuth sign-in, and `?next=` redirect (rejects open redirects like `//evil.com`)
- [ ] Forgot password → reset link → password reset enforces `kk_cust_pw_reset` restriction until password is updated (query param tampering like `&flow=oauth` or `&next=...email_changed=1` cannot bypass)
- [ ] Expired verification & password-reset links display clear, specific alert copy on `/login`
- [ ] Sign-out clears `useAuth`, `useWishlist`, `kk-checkout-draft`, `kk-wishlist-oos-ids`, `kk-stock-alerts`, and review caches
- [ ] Account deactivation blocks mutations (`saveAddress`, `setWishlisted`, `submitProductReview`, `deleteProductReview`) and reactivates cleanly on next sign-in

### Catalog, Search, Variants & Product Detail
- [ ] Home page, `/products`, and `/category/[slug]` load with derived `<Skeletonize>` skeletons and zero horizontal overflow at `360px`
- [ ] Smart search (`SearchDialog` + `/products?q=`): empty discovery view, live typo/synonym/price-range search, pagination (`?page=`), sort & category filters
- [ ] Product Detail (`/products/[slug]`): variant pills switch price, compare-at price (`> price` only), and stock live; out-of-stock variant shows Notify Me on WhatsApp modal
- [ ] Back-in-stock Notify Me: valid 10-digit Indian mobile subscribes once; duplicate/concurrent submit returns `alreadySubscribed` cleanly

### Cart, Wishlist & Checkout
- [ ] Add base product & multiple variants of the same product to Cart; quantities clamp to live stock; Cart Drawer & `/cart` stay synced
- [ ] Wishlist guest → signed-in merge on login; restocked banner + 1-tap Add to Cart / Select option
- [ ] 3-step Checkout (`Delivery` → `Order Summary` → `Payment`):
  - [ ] Pincode lookup autofills City & State without overwriting custom edits
  - [ ] Promo code applies/removes accurately; server recalculates totals
  - [ ] Refreshing on Step 2 or Step 3 restores the exact step and draft; browser/mobile Back steps `3 → 2 → 1 → exit`
  - [ ] Switching accounts never leaks previous user's name/phone into "Add new address" modal
  - [ ] Manual UPI mode: QR code, UPI deep-link, UTR validation, error scroll-to-UTR, Order Placed scrolls to top
  - [ ] Payment Gateway mode: `placeOrder`/`submitPayment` rejected server-side; popup & redirect gateways work without premature cancellation; webhook confirms payment idempotently

### Post-Order, Tracking, Cancel, Returns & Reviews
- [ ] `/order-placed`: heading paints immediately (`opacity: 1`), copy button copies order suffix cleanly
- [ ] `/track`: fixed prefix addon strips pasted prefix; guest view hides delivery address & full UTR; 5-strike lockout triggers on wrong `phoneLast4`
- [ ] `/account/orders` & `/account/orders/[code]`: status badge, timeline, invoice (`/invoice` print/PDF with GST or Bill of Supply)
- [ ] Cancel order (pending/confirmed/packed): requires reason (and detail for "Other"), restores variant & base stock, decrements promo `used_count`
- [ ] 3-step Return / Exchange / Replacement wizard:
  - [ ] Works for **both** non-variant AND multi-variant products (`returnLineKey`)
  - [ ] Refund estimate matches items-only policy; Step 3 summary shows exact variant name
  - [ ] Withdraw pending return request works for signed-in owner and guest (full 10-digit phone verified)
- [ ] Verified Product Reviews: only delivered buyers can review; create, edit, sort, aspect filter, and delete work cleanly

---

## 3. Admin Panel Flows

### Auth, PIN Lock & Navigation
- [ ] Unauthenticated & non-admin users are redirected from all `/admin/*` pages and rejected by all admin Server Actions
- [ ] 4-digit PIN lock blocks all admin pages, Server Actions, and `⌘K` Admin Global Search until unlocked; no flash of locked screen after unlock
- [ ] Admin Global Search (`⌘K` / Sidebar / Mobile Topbar) searches pages, settings fields, orders, products, categories, and promos with live skeleton loading
- [ ] Admin runtime errors render `/admin/(panel)/error.tsx` (admin UI, never storefront WhatsApp copy)

### Dashboard, Products, Categories & Promos
- [ ] Dashboard bento (`7d`, `30d`, `FY`, `month`, custom range): Revenue net of refunds, Sales Chart line/X-axis alignment, Action Queue counts match `/admin/orders?view=...`
- [ ] Products CRUD: create/edit/delete, `ImageUploader` (unsaved upload cleanup on cancel, storage cleanup on save), `VariantMatrixModal` (`SelectField` bulk scope)
- [ ] Concurrent stock safety: editing a base or variant product preserves concurrent customer order reservations via delta RPCs (`adjust_product_stock` / `adjust_product_variant_stock`)
- [ ] Back-in-stock alerts panel: 1-tap WhatsApp notify, mark notified, delete alert (logged to `admin_audit_logs`)
- [ ] Categories CRUD & Promo Codes CRUD reflect immediately on storefront (`updateTag`)

### Orders, Payments, Returns & Settings
- [ ] Orders list: FY/month filters, status tabs, payment dropdown (`To verify` excludes cancelled orders, matching Dashboard), search by code/phone/name/UTR
- [ ] Order detail (`/admin/orders/[code]`): status transitions (`expectedStatus` CAS), CourierDialog on Shipped, 1-step revert Delivered → Shipped
- [ ] Payments: verify/reject UTR, partial & full refunds blocked before dispatch/cancel (`REFUND_BEFORE_DISPATCH`) and blocked on unpaid orders (`NOT_PAID`)
- [ ] Returns & Exchanges: approve/reject (pickup date validated), pickup successful, record return (strict `variantId` & `NOT_IN_REQUEST` enforcement), refund return, doorstep exchange `Add / Edit doorstep courier details` (`set_courier`), outbound exchange dispatch/deliver/undo
- [ ] Admin "Create return request" handles long details + alternate pickup address + refund UPI without 300-char collision
- [ ] Store Settings (all 7 tabs: General, Contact & Pincode, Shipping, Payments, Tax/GST, Email SMTP, Policies/Promos): desktop 2-col sidebar + mobile `<Dialog mobileFullScreen>` with hardware Back
- [ ] Data & Launch (`/admin/launch`): checklist & `admin_reset_data` invalidates product/review caches on `"customers"` scope

---

## 4. Desktop & Mobile UI/UX, Accessibility & Performance Checks

- [ ] Test at `360px`, `768px`, `1024px`, `1440px` — zero horizontal overflow
- [ ] Mobile native feel: sticky app headers/footers, `env(safe-area-inset-*)` on modals/sheets/search dialog, `>= 44px` touch targets, hardware/swipe Back on all multi-step flows
- [ ] Light & dark mode verified on both Storefront (`theme-store.css`) and Admin (`theme-admin.css`), including `global-error.tsx`
- [ ] Keyboard navigation (`Tab`, `Enter`, `Escape`, arrow keys on `PillTabs`, `SegmentedTabs`, Settings/Account/Launch vertical tabs)
- [ ] Service Worker (`public/sw.js` `v7`): public HTML uses network-first with offline `/offline` fallback; private routes never cached
- [ ] SEO: `robots.txt` disallows `/track` and private routes; `sitemap.xml`, canonicals, OG/Twitter, and JSON-LD valid
