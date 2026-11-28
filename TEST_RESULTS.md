# Test & Verification Results — Kalakriti (MySaleApp)

**Date:** 2026-11-28 (IST)
**Branch:** `audit-production-readiness`

---

## 1. Automated Verification Summary

| Check | Command | Result | Details |
| --- | --- | --- | --- |
| **TypeScript Type Check** | `npx --no-install tsc --noEmit --incremental false` | **PASS** | 0 errors |
| **ESLint** | `npm run lint` | **PASS** | 0 errors, 0 warnings |
| **Unit & Audit Test Suite** | `npm test` (`vitest run`) | **PASS** | **33 / 33** files passed, **897 / 897** tests passed (8.24s) |
| **Production Build** | `npm run build` (`next build`) | **PASS** | Compiled in 10.1s, TypeScript in 10.8s, **84 / 84** static/PPR pages generated in 17.1s |
| **Supabase Migration Push** | `npx --no-install supabase db push --remote --yes` | **PASS** | `0077_audit_hardening.sql` applied cleanly to `nepfgwfunxebhsfrfxeb` |

---

## 2. Vitest Suite Breakdown (33 Files / 897 Tests)

| Test File | Tests | Status |
| --- | --- | --- |
| `src/features/orders/transitions.test.ts` | 366 | PASS |
| `src/features/orders/rpc-errors.test.ts` | 60 | PASS |
| `src/features/orders/order-mapping.test.ts` | 39 | PASS |
| `src/app/loading-contract.test.ts` | 38 | PASS |
| `src/features/orders/admin-actions.test.ts` | 38 | PASS |
| `src/features/orders/ux-flows-audit.test.ts` | 38 (+8 new) | PASS |
| `src/features/orders/actions.test.ts` | 34 | PASS |
| `src/lib/validation/validation.test.ts` | 33 | PASS |
| `src/features/orders/dashboard-range.test.ts` | 21 | PASS |
| `src/features/orders/admin-actions-payment.test.ts` | 20 | PASS |
| `src/features/orders/return-stage.test.ts` | 20 | PASS |
| `src/features/orders/pricing.test.ts` | 16 | PASS |
| `src/features/products/schema.test.ts` | 16 | PASS |
| `src/features/orders/admin-queries.test.ts` | 14 | PASS |
| `src/features/orders/return-stage-more.test.ts` | 14 | PASS |
| `src/features/orders/returns.test.ts` | 14 | PASS |
| `src/features/email/email.test.ts` | 12 | PASS |
| `src/features/orders/payment-rules.test.ts` | 12 | PASS |
| `src/features/orders/deadline.test.ts` | 11 | PASS |
| `src/features/orders/schema.test.ts` | 9 | PASS |
| `src/features/orders/refund.test.ts` | 8 | PASS |
| `src/lib/scroll-reset.test.ts` | 8 | PASS |
| `src/features/email/password-reset-flow.test.ts` | 7 | PASS |
| `src/features/location/states.test.ts` | 7 | PASS |
| `src/features/orders/payment-gateway.test.ts` | 7 | PASS |
| `src/features/orders/types.test.ts` | 6 | PASS |
| `src/features/orders/whatsapp-return.test.ts` | 6 | PASS |
| `src/features/orders/admin-queries-returns.test.ts` | 5 | PASS |
| `src/features/orders/payment-due.test.ts` | 5 | PASS |
| `src/features/orders/reasons.test.ts` | 4 | PASS |
| `src/features/orders/admin-actions-lock.test.ts` | 3 | PASS |
| `src/features/orders/locking.test.ts` | 3 | PASS |
| `src/lib/validation/query.test.ts` | 3 | PASS |
| **Total** | **897** | **ALL PASS** |

---

## 3. New Regression Tests Added (`src/features/orders/ux-flows-audit.test.ts`, Section 9)

1. `RequestReturn` & `AdminReturnRequests` key and validate variant lines with `returnLineKey` (prevents variant return blocking and duplicate React keys).
2. `/auth/callback` never allows query parameters (`email_changed=1`, unverified `otpType`) to bypass recovery-session cookies.
3. Redirect-based payment gateways return `{ status: "redirecting" }` without cancelling the order in `CheckoutForm` or `PaymentPanel`.
4. `CheckoutForm` address modal uses account-scoped `activeProfile` instead of stale `initialProfile`.
5. `placeOrder` and `submitPayment` enforce `shop.paymentMode !== "manual_upi"`, and `verifyGatewayPayment` verifies client signature before paid-status branching.
6. Authenticated customer mutation modules (`addresses/actions.ts`, `wishlist/actions.ts`, `products/actions.ts`) enforce `assertActiveCustomer()`.
7. `ReturnStatusControl` wires doorstep `exchange_set_courier` (`mode="set_courier"`), and `admin-queries.ts` excludes cancelled orders from `payment=submitted` counts.
8. `Providers` lazy-loads `motion-features.ts`, `src/app/admin/(panel)/error.tsx` exists, and `.banSvg` / `.whatsappIcon` / `.arrowSvg` CSS classes are defined.

---

## 4. Bugs Caught & Resolved During Verification Runs

1. **Payment mode literal mismatch (`"direct_upi"` vs `"manual_upi"`):** Caught by `tsc` and `actions.test.ts` on first verification run; fixed across `src/features/orders/actions.ts`, `src/components/store/cart-view.tsx`, and `ux-flows-audit.test.ts`.
2. **`/faq` RSC prerender error:** Caught by `npm run build` (`Attempted to call buildStoreFaqs() from the server`); reverted `src/app/(store)/faq/page.tsx` since `FaqView` already renders its own `FAQPage` JSON-LD.
3. **Unused `composeReturnDetails` import in `create-return-request.tsx`:** Caught by `npm run lint` (1 warning → 0 warnings).
4. **Updated 3 existing unit test assertions** in `actions.test.ts` and `admin-queries.test.ts` to match the new hardened behaviors (`submitPayment` rate-limit key, `payment_reference` search in `listOrders`, and excluding cancelled orders from `payment=submitted` counts).

---

## 5. Tests Not Executed & Reasons

| Test / Scenario | Why Not Executed | How to Execute |
| --- | --- | --- |
| `npm run test:db` (live Supabase DB integration suite) | Linked Supabase project is **production** (`nepfgwfunxebhsfrfxeb`, no staging environment); avoided running live DB mutations while on a feature branch before backup/merge. | Back up DB, push migration `0077_audit_hardening.sql` via `npm run db:push`, then run `npm run test:db`. |
| Live Payment Gateway E2E (Razorpay / Cashfree / PhonePe / Stripe) | Requires live/test gateway API keys & webhook delivery from external providers. | Configure test keys per `payment-gateway-setup.md` and run sandbox checkout + webhook test. |
| Live Gmail SMTP Email Delivery E2E | Requires live Gmail App Password configured in Admin → Settings. | Use Admin → Settings → Email → "Send test email" after configuring App Password. |
| Automated Headless Browser (Playwright) E2E | Playwright is not installed in project dependencies (per `CLAUDE.md` conventions). | Run manual desktop (`1440px`) + mobile (`360px`) walkthrough using `REGRESSION_CHECKLIST.md`. |
