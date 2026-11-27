import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { safeNextPath } from "@/lib/safe-redirect"
import { netReturnRefund, refundLines } from "./refund"
import { returnableQuantities, returnLineKey } from "./returns"
import { mapRpcError } from "./rpc-errors"
import { requestReturnSchema } from "./schema"

const ROOT = process.cwd()
const SRC = join(ROOT, "src")

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkTsx(full, out)
    else if (full.endsWith(".tsx")) out.push(full)
  }
  return out
}

describe("1. Standard login redirect flow audit", () => {
  it("returns to the originating storefront page or Home (/) by default", () => {
    expect(safeNextPath(null, "/")).toBe("/")
    expect(safeNextPath("", "/")).toBe("/")
    expect(safeNextPath("/", "/")).toBe("/")
    expect(safeNextPath("/products/brass-diya", "/")).toBe("/products/brass-diya")
    expect(safeNextPath("/checkout", "/")).toBe("/checkout")
    expect(safeNextPath("/wishlist", "/")).toBe("/wishlist")
    expect(safeNextPath("/account/orders", "/")).toBe("/account/orders")
  })

  it("blocks open redirects and login redirect loops", () => {
    expect(safeNextPath("https://evil.example/phish", "/")).toBe("/")
    expect(safeNextPath("//evil.example/phish", "/")).toBe("/")
    expect(safeNextPath("/login", "/")).toBe("/")
    expect(safeNextPath("/login?next=/checkout", "/")).toBe("/")
    expect(safeNextPath("/admin/login", "/")).toBe("/")
  })

  it("MobileBottomNav does not gate showSignIn on auth hydration ready flag", () => {
    const code = readFileSync(join(SRC, "components/store/mobile-bottom-nav.tsx"), "utf8")
    expect(code).toContain('const showSignIn = !user && !pathname?.startsWith("/account")')
    expect(code).not.toMatch(/showSignIn\s*=\s*ready\s*&&/)
  })
})

describe("2. Non-resizable textareas globally audit", () => {
  it("disables resize on shared textareaField in ui.module.css", () => {
    const css = readFileSync(join(SRC, "components/ui/ui.module.css"), "utf8")
    const line = css.split(/\r?\n/).find((l) => l.includes(":where(.textareaField)"))
    expect(line).toBeDefined()
    expect(line).toContain("resize: none;")
  })

  it("ensures zero raw <textarea elements bypass the shared Textarea component", () => {
    const offenders = walkTsx(SRC)
      .filter((f) => !f.endsWith("ui\\textarea.tsx") && !f.endsWith("ui/textarea.tsx"))
      .filter((f) => /<textarea\b/.test(readFileSync(f, "utf8")))
    expect(offenders).toEqual([])
  })
})

describe("3. Checkout step-by-step mobile/browser Back navigation audit", () => {
  it("shared useStepHistory hook wires pushState, history.go, popstate, and pathname guard, and CheckoutForm uses it", () => {
    const hookCode = readFileSync(join(SRC, "hooks/use-step-history.ts"), "utf8")
    expect(hookCode).toContain("if (window.location.pathname !== pathname) return")
    expect(hookCode).toContain("window.history.pushState(")
    expect(hookCode).toContain("window.history.go(delta)")
    expect(hookCode).toContain('window.addEventListener("popstate", onPopState)')

    const checkoutCode = readFileSync(join(SRC, "components/store/checkout-form.tsx"), "utf8")
    expect(checkoutCode).toContain("useStepHistory<CheckoutStep>({")
    expect(checkoutCode).toContain('pathname: "/checkout"')
    expect(checkoutCode).toContain('stateKey: "checkoutStep"')
  })

  it("simulates step-by-step history transitions (1 -> 2 -> 3 -> Back 2 -> Back 1 -> exit)", () => {
    const stack: Array<{ pathname: string; checkoutStep?: number }> = [{ pathname: "/cart" }, { pathname: "/checkout" }]
    let idx = 1
    let step: 1 | 2 | 3 = 1
    let pushed = 0

    const pushForward = (next: 1 | 2 | 3) => {
      for (let s = step + 1; s <= next; s += 1) {
        stack.splice(idx + 1)
        stack.push({ pathname: "/checkout", checkoutStep: s })
        idx += 1
        pushed += 1
      }
      step = next
    }

    const hardwareBack = () => {
      idx -= 1
      const entry = stack[idx]
      if (entry.pathname !== "/checkout") return "exited-to-" + entry.pathname
      const target = entry.checkoutStep === 2 || entry.checkoutStep === 3 ? entry.checkoutStep : 1
      pushed = Math.max(0, target - 1)
      step = target
      return `step-${step}`
    }

    pushForward(2)
    expect(step).toBe(2)
    expect(pushed).toBe(1)

    pushForward(3)
    expect(step).toBe(3)
    expect(pushed).toBe(2)

    expect(hardwareBack()).toBe("step-2")
    expect(pushed).toBe(1)

    expect(hardwareBack()).toBe("step-1")
    expect(pushed).toBe(0)

    expect(hardwareBack()).toBe("exited-to-/cart")
  })
})

describe("4. Signed-in owner submitted UTR update audit (migration 0072)", () => {
  it("migration 0072 allows signed-in account owner to update submitted UTR while still blocking guests", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/0072_allow_owner_update_submitted_utr.sql"),
      "utf8"
    )
    expect(sql).toContain("if v_order.payment_status = 'submitted'")
    expect(sql).toContain("and not (v_order.user_id is not null and auth.uid() = v_order.user_id)")
    expect(sql).toContain("raise exception 'ALREADY_SUBMITTED'")
    expect(sql).toContain("if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'")
    expect(sql).toContain("if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'")
  })

  it("maps ALREADY_SUBMITTED cleanly for unauthenticated guest callers", () => {
    expect(mapRpcError("ALREADY_SUBMITTED", "fallback")).toContain("Sign in to your account to update it")
  })
})

describe("5. Option A variant matrix UX (Out-of-stock clickable + Notify Me + Non-existent combo hint)", () => {
  it("distinguishes in-stock, exact out-of-stock (selected & unselected), and non-existent combinations", () => {
    const code = readFileSync(join(SRC, "components/store/product-actions.tsx"), "utf8")
    expect(code).toContain("isExactOos")
    expect(code).toContain("isUnavailableCombo")
    expect(code).toContain("styles.variantPillSelectedOos")
    expect(code).toContain("styles.variantPillUnavailable")
    expect(code).toContain("styles.variantHeaderOosBadge")
    expect(code).toContain("isn't available in")

    const css = readFileSync(join(SRC, "components/store/product-actions.module.css"), "utf8")
    expect(css).toContain(".variantPillSelectedOos")
    expect(css).toContain(".variantPillUnavailable")
    expect(css).toContain(".variantHeaderOosBadge")
  })

  it("migration 0073 enables variant-level back-in-stock alerts when other variants are in stock", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/0073_variant_stock_alerts.sql"), "utf8")
    expect(sql).toContain("p_variant_id text default null")
    expect(sql).toContain("coalesce((v_variant ->> 'stock')::int, 0) > 0")
    expect(sql).toContain("raise exception 'ALREADY_IN_STOCK'")
  })
})

describe("6. Full-Repository Deep Audit Hardening (migration 0074 & Option 2 fixes #1–#14)", () => {
  it("migration 0074 hardens variant stock restore, variantId validation, PIN fresh-auth, gateway lockout, stock alerts, and is_admin_email", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/0074_full_audit_hardening.sql"), "utf8")
    // #2: non-variant product rejects non-null variantId
    expect(sql).toContain("(not r.has_variants and r.variant_id is null)")
    // #1: per-variant JSONB stock restoration in cancel, admin_reset_data, and returns
    expect(sql).toContain("create or replace function public.restock_cancelled_order()")
    expect(sql).toContain("create or replace function public.admin_reset_data(p_scopes text[])")
    expect(sql).toContain("create or replace function public.record_order_return(")
    // #3: PIN RPCs no longer accept auth.users.updated_at bypass
    expect(sql).not.toContain("u.updated_at > now() - interval '120 seconds'")
    expect(sql).toContain("u.last_sign_in_at > now() - interval '120 seconds'")
    // #4 & #10: variant-aware return pricing + cumulative v_new_ref
    expect(sql).toContain("create or replace function public.return_items_value(")
    expect(sql).toContain("v_refunded := v_new_ref;")
    // #6: get_order_for_gateway enforces find_order_for_guest lockout
    expect(sql).toContain("from public.find_order_for_guest(p_code, p_phone_last4)")
    expect(sql).toContain("raise exception 'TOO_MANY_ATTEMPTS'")
    // #8: subscribe_stock_alert rate-limited & protects guest rows
    expect(sql).toContain("public.internal_rate_key('stock-alert', v_phone)")
    expect(sql).toContain("when v_uid is not null and user_id = v_uid and v_name <> '' then v_name")
    // #9: is_admin_email gated behind p_server_secret
    expect(sql).toContain("p_server_secret text default null")
    expect(sql).toContain("public._assert_email_rpc_secret(v_hash, p_server_secret)")
  })

  it("#4 variant-aware refund pricing matches exact variant price instead of max product price", () => {
    const orderItems = [
      { productId: "p1", variantId: "v-small", name: "Bottle — 250ml", slug: "bottle", price: 300, quantity: 1, image: null },
      { productId: "p1", variantId: "v-large", name: "Bottle — 1L", slug: "bottle", price: 900, quantity: 1, image: null },
    ]
    const lines = refundLines(orderItems, [{ productId: "p1", variantId: "v-small", name: "Bottle — 250ml", quantity: 1 }])
    expect(lines).toHaveLength(1)
    expect(lines[0]?.unitPrice).toBe(300)
    expect(lines[0]?.amount).toBe(300)
    expect(netReturnRefund(orderItems, [{ productId: "p1", variantId: "v-small", quantity: 1 }])).toBe(300)
  })

  it("#5 catalog mutations invalidate catalogue cache rather than only reviews cache", () => {
    const code = readFileSync(join(SRC, "features/products/actions.ts"), "utf8")
    const deleteIdx = code.indexOf("export async function deleteProduct")
    const reviewIdx = code.indexOf("export async function getMyProductReviewState")
    const catalogBlock = code.slice(deleteIdx, reviewIdx)
    expect(catalogBlock).not.toContain("refreshReviews()")
    expect(catalogBlock.match(/refreshCatalogue\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it("#7a /track and /order-placed render preview skeletons without calling useSearchParams in preview mode", () => {
    const pageViews = readFileSync(join(SRC, "components/store/page-views.tsx"), "utf8")
    expect(pageViews).toContain("<Suspense fallback={<TrackOrder preview />}>")
    expect(pageViews).toContain("<Suspense fallback={<OrderPlaced preview />}>")
    const track = readFileSync(join(SRC, "components/store/track-order.tsx"), "utf8")
    expect(track).toContain("if (preview) return <TrackOrderBody urlCode=\"\" />")
    const placed = readFileSync(join(SRC, "components/store/order-placed.tsx"), "utf8")
    expect(placed).toContain("if (preview) return <OrderPlacedBody preview urlCode=\"\" />")
  })

  it("#9 admin forgot-password passes server secret to is_admin_email RPC", () => {
    const code = readFileSync(join(SRC, "features/auth/account-actions.ts"), "utf8")
    expect(code).toContain("p_server_secret: getServerRpcSecret()")
  })

  it("#13 sensitive password/PIN/track forms clean up on <Activity> hide", () => {
    const profileForm = readFileSync(join(SRC, "components/account/profile-form.tsx"), "utf8")
    expect(profileForm).toContain("form.reset({ hasPassword, current: \"\", next: \"\", confirm: \"\" })")
    const adminForms = readFileSync(join(SRC, "components/admin/account-forms.tsx"), "utf8")
    expect(adminForms).toContain("form.reset({ current: \"\", next: \"\", confirm: \"\" })")
    expect(adminForms).toContain("setForm.reset({ pin: \"\", confirm: \"\" })")
    const track = readFileSync(join(SRC, "components/store/track-order.tsx"), "utf8")
    expect(track).toContain("if (active) setCodeSuffix(nextSuffix)")
  })
})

describe("7. Full-Codebase Audit Hardening Pass 2 (migration 0075 & Option A #1–#12)", () => {
  it("migration 0075 revokes post-0061 table privileges, revokes sessions on reset, fails closed on is_admin_email, and wires variantId in return RPCs", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/0075_return_variants_and_security_hardening.sql"), "utf8")
    expect(sql).toContain("revoke all on public.password_reset_tokens from public, anon, authenticated;")
    expect(sql).toContain("revoke all on public.email_settings from public, anon;")
    expect(sql).toContain("revoke all on public.stock_alerts from public, anon;")
    expect(sql).toContain("delete from auth.refresh_tokens where user_id = v_user.id::text;")
    expect(sql).toContain("delete from auth.sessions where user_id = v_user.id;")
    expect(sql).toContain("'isOwner', v_is_owner")
    expect(sql).not.toContain("char_length(p_server_secret) < 16")
    expect(sql).toContain("create or replace function public.request_return(")
    expect(sql).toContain("create or replace function public.admin_create_return_request(")
  })

  it("returnableQuantities and requestReturnSchema support returning 2 variants of the same product independently", () => {
    const items = [
      { productId: "11111111-1111-4111-8111-111111111111", variantId: "v-s", name: "Tee — S", slug: "tee", price: 499, quantity: 2, image: null },
      { productId: "11111111-1111-4111-8111-111111111111", variantId: "v-xl", name: "Tee — XL", slug: "tee", price: 699, quantity: 1, image: null },
    ]
    const returns = [
      {
        id: "r1",
        items: [{ productId: "11111111-1111-4111-8111-111111111111", variantId: "v-s", name: "Tee — S", quantity: 1 }],
        reason: "Size issue",
        refunded: true,
        createdAt: "2026-11-27T00:00:00Z",
      },
    ]
    const left = returnableQuantities(items, returns)
    expect(left.get(returnLineKey(items[0]!))).toBe(1)
    expect(left.get(returnLineKey(items[1]!))).toBe(1)

    const parsed = requestReturnSchema.safeParse({
      code: "KK-ABC123",
      reason: "Wrong size",
      items: [
        { productId: "11111111-1111-4111-8111-111111111111", variantId: "v-s", quantity: 1 },
        { productId: "11111111-1111-4111-8111-111111111111", variantId: "v-xl", quantity: 1 },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it("Admin Quick Jump renders <Link> items instead of <button> + router.push to avoid overlay history race", () => {
    const code = readFileSync(join(SRC, "components/admin/admin-sidebar.tsx"), "utf8")
    const qjStart = code.indexOf("function QuickJumpDialog")
    const qjEnd = code.indexOf("export function AdminSidebar")
    const qj = code.slice(qjStart, qjEnd)
    expect(qj).toContain("<Link")
    expect(qj).not.toContain("router.push(item.href)")
  })

  it("createGatewayRetrySession gates PII on row.isOwner rather than any signed-in user", () => {
    const code = readFileSync(join(SRC, "features/orders/actions.ts"), "utf8")
    expect(code).toContain("const isOrderOwner = Boolean(user && row.isOwner === true)")
  })
})
