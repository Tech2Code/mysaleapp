import { randomBytes } from "node:crypto"
import { msg, has } from "../lib.mjs"

export const description = "guest privacy of track_order (masked UTR, no address), wrong-attempt lockout, check_rate_limit scopes and table lockdown"

const hex = () => randomBytes(16).toString("hex")

export async function run(ctx) {
  const { anon, admin, rec } = ctx
  const S = "guest"

  // ---- track_order privacy ----
  const o = await ctx.newOrder([{ productId: ctx.P2.id, quantity: 1 }])
  await admin.from("orders").update({ payment_status: "submitted", payment_method: "upi", payment_reference: "AUDIT1234567890", payment_amount: o.o.total, payment_submitted_at: new Date().toISOString(), payment_note: "AUDIT TEST private note" }).eq("id", o.id)
  const r = await anon.rpc("track_order", { p_code: o.code, p_phone_last4: o.last4 })
  const j = r.data
  const s = JSON.stringify(j || {})
  rec(S, "track_order with the right code + last4 returns the order", !!j && j.orderCode === o.code, msg(r))
  if (j) {
    rec(S, "UTR is masked and the full UTR is absent", /^\*+7890$/.test(j.paymentReference || "") && !s.includes("AUDIT1234567890"), j.paymentReference)
    rec(S, "delivery address / name / phone are hidden", j.delivery === null && !s.includes("AUDIT TEST address") && !s.includes(o.ph), { delivery: j.delivery })
    rec(S, "payment method / amount / paid time hidden", j.paymentMethod === null && j.paymentAmount === null && j.paymentPaidAt === null)
    rec(S, "payment note hidden unless the payment failed", j.paymentNote === null, j.paymentNote)
  }
  let w = await anon.rpc("track_order", { p_code: o.code, p_phone_last4: "1111" })
  rec(S, "wrong last4 -> null (soft, no error)", !w.error && w.data === null, msg(w) || w.data)
  w = await anon.rpc("track_order", { p_code: "NOPE-XXXXXX", p_phone_last4: "1111" })
  rec(S, "unknown code looks the same as wrong last4", !w.error && w.data === null)
  w = await anon.rpc("track_order", { p_code: o.code, p_phone_last4: "abcd" })
  rec(S, "non-numeric last4 -> null", w.data === null)

  // ---- lockout (on a dedicated order so the real one stays usable) ----
  const L = await ctx.newOrder([{ productId: ctx.P2.id, quantity: 1 }])
  const res = []
  for (let i = 0; i < 10; i++) {
    const x = await anon.rpc("track_order", { p_code: L.code, p_phone_last4: "1234" })
    res.push(x.data === null)
  }
  const right = await anon.rpc("track_order", { p_code: L.code, p_phone_last4: L.last4 })
  rec(S, "10 wrong attempts return null; the next one (even correct) is locked", res.every(Boolean) && right.data?.error === "TOO_MANY_ATTEMPTS", right.data || msg(right))
  const cr = await anon.rpc("cancel_order", { p_code: L.code, p_phone_last4: L.last4, p_reason: "x" })
  rec(S, "the lock also covers cancel_order", cr.data?.error === "TOO_MANY_ATTEMPTS", cr.data || msg(cr))
  const fl = await anon.from("order_lookup_failures").select("*").limit(1)
  rec(S, "anon cannot read order_lookup_failures", !!fl.error || (fl.data || []).length === 0)
  const fo = await anon.rpc("find_order_for_guest", { p_code: o.code, p_last4: "1" })
  rec(S, "find_order_for_guest is not callable by anon", !!fo.error, msg(fo))
  ctx.info("note: lock rows for the audit order codes stay in order_lookup_failures until they age out (no delete path)")

  // ---- check_rate_limit(p_scope, p_key): limits live in the DB, not the caller ----
  const cl = (scope, key) => anon.rpc("check_rate_limit", { p_scope: scope, p_key: key })
  const burst = async (scope, key, n) => {
    const out = []
    for (let i = 0; i < n; i++) {
      const x = await cl(scope, key)
      if (x.error) return { err: x.error.message }
      out.push(x.data)
    }
    return out
  }
  const limitCase = async (scope, limit) => {
    const out = await burst(scope, hex(), limit + 1)
    rec(S, `${scope}: ${limit} allowed, the next is refused`, !out.err && out.slice(0, limit).every((v) => v === true) && out[limit] === false, out.err || { n: out.length })
  }
  await limitCase("track-order", 20)
  await limitCase("login", 10)
  const k = hex()
  await burst("login", k, 11)
  rec(S, "an exhausted key stays refused", (await cl("login", k)).data === false)
  rec(S, "a different key is unaffected", (await cl("login", hex())).data === true)
  const unknown = await burst("nonsense-scope", hex(), 30)
  rec(S, "unknown scope is never limited", !unknown.err && unknown.every((v) => v === true), unknown.err)
  for (const [name, key] of Object.entries({ short: "abcd1234", upper: hex().toUpperCase(), long: "a".repeat(200), null: null, nonhex: "z".repeat(32) })) {
    const out = await burst("login", key, 15)
    rec(S, `invalid key (${name}) fails open`, !out.err && out.every((v) => v === true), out.err)
  }
  const extra = await anon.rpc("check_rate_limit", { p_scope: "login", p_key: hex(), p_max: 1000, p_window_seconds: 1 })
  rec(S, "caller cannot pass its own max / window", !!extra.error, msg(extra))
  const sel = await anon.from("rate_limits").select("*").limit(1)
  const ins = await anon.from("rate_limits").insert({ key: "audit-test:" + hex(), window_start: new Date().toISOString(), hits: 1 })
  const upd = await anon.from("rate_limits").update({ hits: 0 }).neq("key", "x").select()
  const del = await anon.from("rate_limits").delete().neq("key", "x").select()
  rec(S, "anon cannot read/insert/update/delete rate_limits", (!!sel.error || !(sel.data || []).length) && !!ins.error && (!!upd.error || !(upd.data || []).length) && (!!del.error || !(del.data || []).length), [msg(sel), msg(ins), msg(upd), msg(del)])
  void has
}
