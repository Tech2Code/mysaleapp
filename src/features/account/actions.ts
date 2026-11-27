"use server"

// Customer account: the signed-in shopper's own profile (name, email, phone). Admin login/password lives in features/auth/account-*.

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { assertActiveCustomer, getCurrentUser, hasValidPasswordResetCookie } from "@/features/auth/guards"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { getStoreSettings } from "@/features/settings/queries"
import { fail, type ActionResult } from "@/lib/action-result"
import { formatDate, formatPrice, normalizeIndianPhone } from "@/lib/format"
import { cleanMetaName, safeAvatarUrl } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { customerPasswordSchema, deactivateAccountSchema, profileSchema, type Profile } from "./schema"

async function trustedOrigin(): Promise<string | undefined> {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url)) return siteConfig.url
  if (process.env.NEXT_PUBLIC_SITE_URL) return siteConfig.url
  if (process.env.NODE_ENV === "production") return undefined
  return (await headers()).get("origin") ?? undefined
}

type ProfileRow = {
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  deactivated_at?: string | null
}

/** Name, phone and email of the signed-in customer. Returns null for guests. */
export async function getMyProfile(opts?: { consumeReactivated?: boolean }): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url, deactivated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()
  if (data?.deactivated_at) return null

  const inRecovery = hasValidPasswordResetCookie(cookieStore.get("kk_cust_pw_reset")?.value, "customer", user.id)
  let reactivated = false
  if (opts?.consumeReactivated && !inRecovery && cookieStore.get("kk_acct_reactivated")?.value === "1") {
    cookieStore.delete("kk_acct_reactivated")
    reactivated = true
  }
  const providers = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : []
  const hasEmailProvider =
    Boolean(user.user_metadata?.has_password) ||
    providers.includes("email") ||
    Boolean(user.identities?.some((i) => i.provider === "email"))

  const metaPhone = typeof user.user_metadata?.phone === "string" ? normalizeIndianPhone(user.user_metadata.phone) : null
  return {
    fullName: cleanMetaName(data?.full_name) ?? cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name) ?? "",
    phone: data?.phone ?? metaPhone ?? "",
    avatarUrl: safeAvatarUrl(data?.avatar_url),
    email: user.email ?? "",
    hasPassword: inRecovery ? false : hasEmailProvider,
    ...(reactivated ? { reactivated: true } : {}),
  }
}

export async function updateProfile(
  input: unknown
): Promise<ActionResult<{ email: string; emailConfirmationSentTo: string | null }>> {
  const auth = await assertActiveCustomer()
  if (!auth.ok) return fail(auth.error)
  const user = auth.user

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const p = parsed.data
  const normalizedPhone = p.phone ? normalizeIndianPhone(p.phone) : null
  const currentEmail = (user.email ?? "").trim()
  const requestedEmail = p.email?.trim().toLowerCase()
  const isEmailChanged = Boolean(requestedEmail && requestedEmail !== currentEmail.toLowerCase())
  if (await limited(isEmailChanged ? "password-reset" : "place-order", `profile:${user.id}`)) {
    return fail(RATE_LIMIT_MESSAGE)
  }

  const supabase = await getServerSupabase()
  const origin = isEmailChanged ? await trustedOrigin() : undefined

  // Request email change before mutating profiles so a rejected email doesn't leave partial profile edits saved.
  const authRes =
    isEmailChanged && requestedEmail
      ? await supabase.auth.updateUser(
          { email: requestedEmail },
          origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account/profile?email_changed=1")}` } : undefined
        )
      : { data: { user }, error: null }

  if (authRes.error && isEmailChanged) {
    const msg = authRes.error.message.toLowerCase()
    const code = authRes.error.code ?? ""
    if (msg.includes("already") || msg.includes("registered") || code === "email_exists") {
      return fail("That email is already used by another account.", {
        email: ["That email is already used by another account."],
      })
    }
    if (
      msg.includes("rate limit") ||
      msg.includes("once every") ||
      msg.includes("security purposes") ||
      code === "over_email_send_rate_limit" ||
      code === "over_request_rate_limit"
    ) {
      return fail(
        "Email limit reached on Supabase's free mail sender (or 60-second cooldown). Please wait a few minutes before changing your email again."
      )
    }
    if (code === "email_address_invalid" || (msg.includes("invalid") && msg.includes("email"))) {
      return fail("Please enter a valid, real email address (test domains like @example.com are blocked by Supabase).", {
        email: ["Enter a valid, deliverable email address."],
      })
    }
    if (code === "email_address_not_authorized" || msg.includes("not authorized")) {
      return fail(
        "This email address isn't authorised on Supabase's default mail sender yet. Configure Custom SMTP in Supabase → Authentication → Emails, or use an authorised email."
      )
    }
    if (msg.includes("error sending") || msg.includes("smtp") || code === "unexpected_failure") {
      return fail(
        "Supabase could not send the confirmation email (free mail sender quota or SMTP issue). Please try again later."
      )
    }
    return fail("Could not change your email address. Please try again.")
  }

  const profileRes = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: p.fullName,
    phone: normalizedPhone,
  })
  if (profileRes.error) return fail("Could not save your profile")

  const updatedEmail = authRes.data.user?.email?.trim() || currentEmail
  const emailAppliedImmediately =
    isEmailChanged && Boolean(requestedEmail) && updatedEmail.toLowerCase() === requestedEmail

  revalidatePath("/account", "layout")
  revalidatePath("/checkout")
  revalidatePath("/", "layout")
  return {
    ok: true,
    data: {
      email: emailAppliedImmediately && requestedEmail ? requestedEmail : currentEmail,
      emailConfirmationSentTo: isEmailChanged && !emailAppliedImmediately && requestedEmail ? requestedEmail : null,
    },
  }
}

/** Updates (or sets for the first time on Google-only accounts) the customer's login password. */
export async function changeCustomerPassword(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")
  if (!user.email) return fail("This account has no email address to set a password for.")

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const inRecovery = hasValidPasswordResetCookie(cookieStore.get("kk_cust_pw_reset")?.value, "customer", user.id)
  const providers = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : []
  const hasExistingPassword =
    !inRecovery &&
    (Boolean(user.user_metadata?.has_password) ||
      providers.includes("email") ||
      Boolean(user.identities?.some((i) => i.provider === "email")))

  const parsed = customerPasswordSchema.safeParse({
    ...(input && typeof input === "object" ? input : {}),
    hasPassword: hasExistingPassword,
  })
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  if (await limited("login", user.email)) return fail(RATE_LIMIT_MESSAGE)

  if (hasExistingPassword) {
    const check = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.current ?? "",
    })
    if (check.error) {
      return fail("Your current password is incorrect.", {
        current: ["Incorrect password"],
      })
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
    data: { has_password: true },
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("different") || msg.includes("same")) {
      return fail("Use a new password, not your current one.", {
        next: ["Use a new password, not your current one"],
      })
    }
    return fail("Could not update your password. Please try again.")
  }

  await supabase.rpc("reactivate_my_account")
  cookieStore.delete("kk_cust_pw_reset")
  cookieStore.delete("kk_recovery_intent")
  cookieStore.delete("kk_acct_reactivated")
  revalidatePath("/account/profile")
  return { ok: true }
}

/**
 * Deactivates the signed-in customer's account and signs them out.
 * Blocked if the customer has active unfulfilled orders or open return requests.
 * Signing back in later automatically restores the account.
 */
export async function deactivateMyAccount(input: unknown): Promise<ActionResult> {
  const auth = await assertActiveCustomer()
  if (!auth.ok) return fail(auth.error)
  const user = auth.user

  const parsed = deactivateAccountSchema.safeParse(input ?? {})
  if (!parsed.success) {
    return fail("Please check your reason.", z.flattenError(parsed.error).fieldErrors)
  }

  if (await limited("login", user.id)) return fail(RATE_LIMIT_MESSAGE)

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const { error } = await supabase.rpc("deactivate_my_account", {
    p_reason: parsed.data.reason ?? null,
  })

  if (error) {
    const msg = error.message
    if (msg.includes("ADMIN_CANNOT_DEACTIVATE")) {
      return fail("Store owner / admin accounts cannot be deactivated here.")
    }
    if (msg.includes("ACTIVE_ORDERS_EXIST")) {
      return fail("You have active orders in progress. Please wait until your active orders are delivered or cancelled before deactivating your account.")
    }
    if (msg.includes("OPEN_RETURNS_EXIST")) {
      return fail("You have an open return or exchange request in progress. Please wait until it is completed before deactivating your account.")
    }
    return fail("Could not deactivate your account. Please try again.")
  }

  await supabase.auth.signOut()
  cookieStore.delete("kk_cust_pw_reset")
  cookieStore.delete("kk_acct_reactivated")
  cookieStore.delete("kk_recovery_intent")
  cookieStore.delete("kk_admin_pin_at")
  cookieStore.delete("kk_pw_reset")
  revalidatePath("/account", "layout")
  revalidatePath("/checkout")
  revalidatePath("/", "layout")
  return { ok: true }
}

export type AccountDataExport = {
  exportedAt: string
  fileName: string
  htmlReport: string
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Exports all personal data belonging to the signed-in customer as a clean, human-readable,
 * printable HTML Account Statement (with a built-in "Print / Save as PDF" button) so any customer
 * can open and read their data effortlessly on mobile or desktop.
 */
export async function exportMyAccountData(): Promise<ActionResult<AccountDataExport>> {
  const auth = await assertActiveCustomer()
  if (!auth.ok) {
    return fail(auth.error === "Not signed in" ? "Please sign in to download your account data." : auth.error)
  }
  const user = auth.user

  if (await limited("track-order", `export:${user.id}`)) {
    return fail(RATE_LIMIT_MESSAGE)
  }

  const [supabase, shop] = await Promise.all([getServerSupabase(), getStoreSettings()])
  const [profileRes, addressesRes, wishlistRes, ordersRes, reviewsRes] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, avatar_url, updated_at").eq("id", user.id).maybeSingle(),
    supabase
      .from("addresses")
      .select("label, full_name, phone, address, city, pincode, is_default, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("wishlists").select("product_id, created_at, products(name)").eq("user_id", user.id),
    supabase
      .from("orders")
      .select(
        "order_code, status, payment_status, payment_reference, subtotal, shipping_fee, discount_amount, total, refunded_amount, items, customer_name, phone, address, city, pincode, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_reviews")
      .select("rating, title, comment, created_at, products(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  const metaName = cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name) ?? ""
  const metaPhone = typeof user.user_metadata?.phone === "string" ? (normalizeIndianPhone(user.user_metadata.phone) ?? "") : ""
  const fullName = cleanMetaName(profileRes.data?.full_name) ?? metaName ?? "Customer"
  const phone = (profileRes.data?.phone as string | null) ?? metaPhone ?? "—"
  const email = user.email ?? "—"
  const createdAt = user.created_at ? formatDate(user.created_at) : "—"
  const termsAcceptedAt =
    typeof user.user_metadata?.terms_accepted_at === "string" ? formatDate(user.user_metadata.terms_accepted_at) : "Accepted at sign-in"
  const exportedIso = new Date().toISOString()
  const exportedLabel = formatDate(exportedIso)

  const addresses = (addressesRes.data ?? []) as {
    label: string
    full_name: string
    phone: string
    address: string
    city: string
    pincode: string
    is_default: boolean
  }[]

  const orders = (ordersRes.data ?? []) as {
    order_code: string
    status: string
    payment_status: string
    payment_reference: string | null
    total: number
    refunded_amount: number | null
    items: { name?: string; quantity?: number; price?: number }[] | null
    created_at: string
  }[]

  const reviews = (reviewsRes.data ?? []) as {
    rating: number
    title: string | null
    comment: string
    created_at: string
    products: { name?: string } | { name?: string }[] | null
  }[]

  const wishlist = (wishlistRes.data ?? []) as {
    created_at: string
    products: { name?: string } | { name?: string }[] | null
  }[]

  const productNameFromJoin = (rel: { name?: string } | { name?: string }[] | null): string => {
    if (!rel) return "Product"
    if (Array.isArray(rel)) return rel[0]?.name ?? "Product"
    return rel.name ?? "Product"
  }

  const addressRows =
    addresses.length === 0
      ? `<p class="empty">No saved addresses on file.</p>`
      : `<table><thead><tr><th>Label</th><th>Recipient</th><th>Phone</th><th>Address</th><th>Pincode</th></tr></thead><tbody>${addresses
          .map(
            (a) =>
              `<tr><td><strong>${escapeHtml(a.label)}</strong>${a.is_default ? ' <span class="badge">Default</span>' : ""}</td><td>${escapeHtml(a.full_name)}</td><td>${escapeHtml(a.phone)}</td><td>${escapeHtml(a.address)}, ${escapeHtml(a.city)}</td><td>${escapeHtml(a.pincode)}</td></tr>`
          )
          .join("")}</tbody></table>`

  const orderRows =
    orders.length === 0
      ? `<p class="empty">No orders placed yet.</p>`
      : `<table><thead><tr><th>Order Code</th><th>Date</th><th>Items</th><th>Order Status</th><th>Payment</th><th>Total</th></tr></thead><tbody>${orders
          .map((o) => {
            const itemSummary = Array.isArray(o.items)
              ? o.items.map((i) => `${escapeHtml(i.name ?? "Item")} × ${Number(i.quantity ?? 1)}`).join("<br/>")
              : "—"
            const refundText = Number(o.refunded_amount ?? 0) > 0 ? `<br/><small>Refunded: ${escapeHtml(formatPrice(Number(o.refunded_amount)))}</small>` : ""
            return `<tr><td><strong>${escapeHtml(o.order_code)}</strong></td><td>${escapeHtml(formatDate(o.created_at))}</td><td>${itemSummary}</td><td>${escapeHtml(o.status)}</td><td>${escapeHtml(o.payment_status)}${o.payment_reference ? `<br/><small>UTR: ${escapeHtml(o.payment_reference)}</small>` : ""}</td><td><strong>${escapeHtml(formatPrice(Number(o.total)))}</strong>${refundText}</td></tr>`
          })
          .join("")}</tbody></table>`

  const reviewRows =
    reviews.length === 0
      ? `<p class="empty">No product reviews submitted yet.</p>`
      : `<table><thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Date</th></tr></thead><tbody>${reviews
          .map(
            (r) =>
              `<tr><td><strong>${escapeHtml(productNameFromJoin(r.products))}</strong></td><td>${"★".repeat(Math.max(1, Math.min(5, r.rating)))}${"☆".repeat(5 - Math.max(1, Math.min(5, r.rating)))} (${r.rating}/5)</td><td>${r.title ? `<strong>${escapeHtml(r.title)}</strong><br/>` : ""}${escapeHtml(r.comment)}</td><td>${escapeHtml(formatDate(r.created_at))}</td></tr>`
          )
          .join("")}</tbody></table>`

  const wishlistRows =
    wishlist.length === 0
      ? `<p class="empty">No items currently saved in wishlist.</p>`
      : `<ul>${wishlist
          .map((w) => `<li><strong>${escapeHtml(productNameFromJoin(w.products))}</strong> — saved on ${escapeHtml(formatDate(w.created_at))}</li>`)
          .join("")}</ul>`

  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(shop.shopName)} — My Account Data Summary</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px 16px; background: #F4F6F9; color: #0B3550; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .header { background: #FFFFFF; border-radius: 18px; padding: 24px; border: 1px solid rgba(11,53,80,0.10); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 22px; color: #0B3550; }
    .sub { margin: 4px 0 0 0; font-size: 13px; color: #4E6172; }
    .printBtn { background: #FF6B5A; color: #FFFFFF; border: 0; border-radius: 9999px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .card { background: #FFFFFF; border-radius: 18px; padding: 22px 24px; border: 1px solid rgba(11,53,80,0.10); }
    h2 { margin: 0 0 14px 0; font-size: 16px; color: #0B3550; border-bottom: 1px solid rgba(11,53,80,0.08); padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .fieldLabel { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #4E6172; }
    .fieldValue { font-size: 14px; font-weight: 600; color: #0B3550; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #EDF2F7; padding: 10px 12px; font-weight: 600; border-bottom: 1px solid rgba(11,53,80,0.10); }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(11,53,80,0.08); vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    .badge { display: inline-block; background: #FFE8E5; color: #FF6B5A; border-radius: 9999px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
    .empty { margin: 0; font-size: 13px; color: #4E6172; }
    ul { margin: 0; padding-left: 18px; font-size: 13px; }
    li { margin-bottom: 6px; }
    @media print { body { background: #FFFFFF; padding: 0; } .printBtn { display: none; } .card, .header { box-shadow: none; break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>${escapeHtml(shop.shopName)} — Personal Account Data Summary</h1>
        <p class="sub">Generated on ${escapeHtml(exportedLabel)} for ${escapeHtml(email)}</p>
      </div>
      <button type="button" class="printBtn" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="card">
      <h2>1. Profile &amp; Account Details</h2>
      <div class="grid">
        <div><div class="fieldLabel">Full Name</div><div class="fieldValue">${escapeHtml(fullName)}</div></div>
        <div><div class="fieldLabel">Email Address</div><div class="fieldValue">${escapeHtml(email)}</div></div>
        <div><div class="fieldLabel">Mobile Number</div><div class="fieldValue">${escapeHtml(phone)}</div></div>
        <div><div class="fieldLabel">Account Created</div><div class="fieldValue">${escapeHtml(createdAt)}</div></div>
        <div><div class="fieldLabel">Terms &amp; Privacy</div><div class="fieldValue">${escapeHtml(termsAcceptedAt)}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>2. Saved Delivery Addresses (${addresses.length})</h2>
      ${addressRows}
    </div>

    <div class="card">
      <h2>3. Order History (${orders.length})</h2>
      ${orderRows}
    </div>

    <div class="card">
      <h2>4. Submitted Product Reviews (${reviews.length})</h2>
      ${reviewRows}
    </div>

    <div class="card">
      <h2>5. Saved Wishlist Items (${wishlist.length})</h2>
      ${wishlistRows}
    </div>
  </div>
</body>
</html>`

  return {
    ok: true,
    data: {
      exportedAt: exportedIso,
      fileName: `my-account-data-${exportedIso.slice(0, 10)}.html`,
      htmlReport,
    },
  }
}
