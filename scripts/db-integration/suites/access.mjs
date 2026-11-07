import { NO_ID, MARK, msg } from "../lib.mjs"

export const description = "set_default_address (one default, ownership, anon denied) and a permissions sweep as anon (tables and RPCs)"

export async function run(ctx) {
  const { anon, admin, rec } = ctx

  // =============== set_default_address ===============
  {
    const S = "addresses"
    const uid = ctx.adminUid
    const pre = (await admin.from("addresses").select("*").eq("user_id", uid)).data || []
    ctx.addrSnap = pre // cleanup restores the original defaults
    const hasDefault = pre.some((a) => a.is_default)
    const base = { user_id: uid, label: "AUDIT", full_name: MARK, phone: "9000000001", address: `${MARK} address`, city: "Testcity", pincode: "110001" }
    const ins = async (is_default) => {
      const r = await admin.from("addresses").insert({ ...base, is_default }).select("*").single()
      if (r.error) throw new Error("address insert: " + r.error.message)
      ctx.created.addresses.push(r.data.id)
      return r.data
    }
    const A = await ins(!hasDefault)
    const B = await ins(false)
    const defaults = async () => ((await admin.from("addresses").select("id,is_default").eq("user_id", uid)).data || []).filter((a) => a.is_default).map((a) => a.id)
    let r = await admin.rpc("set_default_address", { p_id: B.id })
    let d = await defaults()
    rec(S, "making B default leaves exactly one default (B)", !r.error && d.length === 1 && d[0] === B.id, msg(r) || { n: d.length })
    r = await admin.rpc("set_default_address", { p_id: A.id })
    d = await defaults()
    rec(S, "flipping back leaves exactly one default (A)", !r.error && d.length === 1 && d[0] === A.id, msg(r))
    r = await admin.rpc("set_default_address", { p_id: NO_ID })
    d = await defaults()
    rec(S, "unknown / not-owned id -> ADDRESS_NOT_FOUND, default untouched", !!r.error && msg(r).includes("ADDRESS_NOT_FOUND") && d.length === 1 && d[0] === A.id, msg(r))
    r = await anon.rpc("set_default_address", { p_id: A.id })
    rec(S, "anon cannot call it", !!r.error, msg(r))
    await Promise.all([admin.rpc("set_default_address", { p_id: A.id }), admin.rpc("set_default_address", { p_id: B.id })])
    d = await defaults()
    rec(S, "concurrent calls never leave two defaults", d.length <= 1, { n: d.length })
    const sel = await anon.from("addresses").select("id").eq("id", A.id)
    rec(S, "anon cannot read addresses", !!sel.error || (sel.data || []).length === 0)
  }

  // =============== permissions sweep as anon ===============
  {
    const S = "anon"
    const oid = (await ctx.admin.from("orders").select("id").eq("customer_name", MARK).limit(1).single()).data?.id ?? NO_ID
    const pid = ctx.P1.id
    const rnd = "00000000-0000-4000-8000-0000000000aa"
    const deny = async (name, p) => {
      const r = await p
      const rows = r.data ? (Array.isArray(r.data) ? r.data.length : 1) : 0
      rec(S, `anon ${name} is denied`, !!r.error || rows === 0, r.error ? r.error.message.slice(0, 70) : `no error, rows=${rows}`)
    }
    const blank = { order_code: "AUDIT-X", customer_name: MARK, phone: "9000000001", address: "a", city: "c", pincode: "110001", items: [], subtotal: 0 }
    await deny("INSERT orders", anon.from("orders").insert(blank).select())
    await deny("UPDATE orders", anon.from("orders").update({ note: "hack" }).eq("id", oid).select())
    await deny("DELETE orders", anon.from("orders").delete().eq("id", oid).select())
    await deny("UPDATE products", anon.from("products").update({ price: 1 }).eq("id", pid).select())
    await deny("INSERT products", anon.from("products").insert({ name: `${MARK} anon`, slug: "audit-test-anon-" + ctx.RUN, price: 1, stock: 1 }).select())
    await deny("DELETE products", anon.from("products").delete().eq("id", pid).select())
    await deny("INSERT order_returns", anon.from("order_returns").insert({ order_id: oid, items: [] }).select())
    await deny("UPDATE order_returns", anon.from("order_returns").update({ reason: "x" }).eq("order_id", oid).select())
    await deny("INSERT return_requests", anon.from("return_requests").insert({ order_id: oid, items: [], reason: "xx" }).select())
    await deny("UPDATE return_requests", anon.from("return_requests").update({ status: "approved" }).eq("order_id", oid).select())
    await deny("INSERT admins", anon.from("admins").insert({ user_id: rnd }).select())
    await deny("SELECT admins", anon.from("admins").select("*"))
    await deny("INSERT store_settings", anon.from("store_settings").insert({ id: false }).select())
    await deny("UPDATE profiles (other id)", anon.from("profiles").update({ full_name: "hack" }).eq("id", rnd).select())
    await deny("INSERT profiles", anon.from("profiles").insert({ id: rnd, full_name: MARK }).select())
    for (const t of ["orders", "order_admin_notes", "addresses", "order_returns", "return_requests", "order_status_history", "profiles", "wishlists"]) {
      await deny(`SELECT ${t}`, anon.from(t).select("*").limit(5))
    }
    await deny("INSERT order_status_history", anon.from("order_status_history").insert({ order_id: oid, status: "delivered" }).select())
    const ts = new Date().toISOString()
    const args = {
      dashboard_stats: { p_start: ts, p_end: ts, p_prev_start: null, p_prev_end: null, p_bucket: "day" },
      refund_order: { p_order_id: rnd, p_amount: 1, p_expected_status: null, p_reference: null, p_note: null },
      adjust_product_stock: { p_id: pid, p_delta: 0 },
      expire_unpaid_orders: {},
      record_order_return: { p_order_id: rnd, p_items: [], p_reason: "", p_refund: false, p_request_id: null },
      decide_return_request: { p_request_id: rnd, p_approve: false, p_note: "xx" },
    }
    for (const [fn, a] of Object.entries(args)) {
      const r = await anon.rpc(fn, a)
      rec(S, `anon rpc ${fn} is denied`, !!r.error, msg(r))
    }
    // admin_reset_data is deliberately NOT called here, not even as anon: never touch it from tests.

    // adjust_product_stock (admin path) on our own product only: clamps at 0
    const p = await admin.rpc("adjust_product_stock", { p_id: pid, p_delta: -100000 })
    rec("admin", "adjust_product_stock clamps at 0 (own test product)", !p.error && (await ctx.stockOf(pid)) === 0, msg(p))
  }
}
