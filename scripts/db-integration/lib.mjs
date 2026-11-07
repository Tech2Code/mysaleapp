// Shared helpers for the opt-in database integration tests. See README.md.
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, "../..")
const require = createRequire(resolve(ROOT, "package.json"))

/** Every row these tests create carries this marker (customer name / product-name prefix). */
export const MARK = "AUDIT TEST"
export const NO_ID = "00000000-0000-4000-8000-000000000000"

export function loadEnv() {
  const env = {}
  const file = resolve(ROOT, ".env")
  if (existsSync(file)) {
    for (const l of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  }
  return { ...env, ...process.env }
}

export const eqn = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006
export const msg = (r) => (r.error ? r.error.message || String(r.error.code) : null)
export const has = (r, s) => !!msg(r) && msg(r).includes(s)

/** Creates the clients, results list and helpers every suite shares. Call after signing in is possible (not in --dry). */
export function createContext(env) {
  const { createClient } = require("@supabase/supabase-js")
  const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const anon = mk()
  const admin = mk()
  const RUN = Date.now().toString(36)
  const results = []
  const created = { products: [], orders: [], addresses: [] }
  let phn = 0

  const ctx = {
    anon,
    admin,
    RUN,
    results,
    created,
    settings: null,
    adminUid: null,
    realSnap: [],
    addrSnap: [],
    rec(suite, name, pass, evidence) {
      results.push({ suite, name, pass: !!pass })
      const ev = evidence === undefined ? "" : " :: " + (typeof evidence === "string" ? evidence : JSON.stringify(evidence))
      console.log(`${pass ? "PASS" : "FAIL"} [${suite}] ${name}${pass ? "" : ev}`)
    },
    info: (s, v) => console.log("   .. " + s + (v === undefined ? "" : " " + JSON.stringify(v))),
    /** A phone number that is never a real customer's (900000xxxx). */
    phone: () => "90000000" + String(10 + (phn++ % 80)),
    cust: (phone, extra = {}) => ({ name: MARK, phone, address: `${MARK} address 1`, city: "Testcity", pincode: "110001", ...extra }),
    stockOf: async (id) => (await admin.from("products").select("stock").eq("id", id).single()).data?.stock,
    getOrder: async (id) => (await admin.from("orders").select("*").eq("id", id).single()).data,
    countMarker: async () => (await admin.from("orders").select("id", { count: "exact", head: true }).eq("customer_name", MARK)).count,
    async mkProduct(tag, price = 100, stock = 10, fees = [], active = true) {
      const r = await admin
        .from("products")
        .insert({ name: `${MARK} ${tag}`, slug: `audit-test-${tag.toLowerCase().replace(/\W+/g, "-")}-${RUN}`, price, stock, fees, is_active: active, description: "audit" })
        .select("*")
        .single()
      if (r.error) throw new Error("product insert: " + r.error.message)
      created.products.push(r.data.id)
      return r.data
    },
    /** Places an order through the public RPC (as a guest) and returns the stored row. */
    async newOrder(items, ph = ctx.phone(), client = anon) {
      const r = await client.rpc("create_order", { p_customer: ctx.cust(ph), p_items: items, p_prefix: "ZZ" })
      if (r.error) throw new Error("create_order failed: " + r.error.message)
      const row = Array.isArray(r.data) ? r.data[0] : r.data
      const o = (await admin.from("orders").select("*").eq("order_code", row.order_code).single()).data
      created.orders.push(o.id)
      return { row, o, id: o.id, code: row.order_code, ph, last4: ph.slice(-4) }
    },
    async pay(o, status) {
      const upd = { payment_status: "paid", payment_method: "upi", payment_amount: o.o?.total ?? o.total, payment_paid_at: new Date().toISOString() }
      if (status) upd.status = status
      const u = await admin.from("orders").update(upd).eq("id", o.id)
      if (u.error) throw new Error("mark paid: " + u.error.message)
      return Number((await ctx.getOrder(o.id)).payment_amount)
    },
    refund: (c, id, amt, exp = null, ref = null, note = null) => c.rpc("refund_order", { p_order_id: id, p_amount: amt, p_expected_status: exp, p_reference: ref, p_note: note }),
    ret: (id, items, refund = false, req = null) => admin.rpc("record_order_return", { p_order_id: id, p_items: items, p_reason: MARK, p_refund: refund, p_request_id: req }),
  }
  return ctx
}
