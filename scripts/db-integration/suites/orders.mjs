import { MARK, NO_ID, eqn, msg } from "../lib.mjs"

export const description = "create_order integrity (tampering, junk lines, merging, smart handling & weight slab fees, tax snapshot, delivery rule); stock reserved and restocked exactly once"

function expectedTotal(settings, lines) {
  const sub = lines.reduce((a, l) => a + l.price * l.qty, 0)
  const hasOversized = lines.some((l) => l.shippingClass === "oversized" && l.qty > 0)
  const hasFragile = lines.some((l) => l.shippingClass === "fragile" && l.qty > 0)
  const oversizedAmt = hasOversized ? Number(settings.oversized_fee || 0) : 0
  const fragileAmt = hasFragile ? Number(settings.fragile_fee || 0) : 0
  const handlingFee = oversizedAmt > 0 && oversizedAmt >= fragileAmt ? oversizedAmt : fragileAmt > 0 ? fragileAmt : 0
  const totalWeightGrams = lines.reduce((a, l) => a + Math.max(0, l.weightGrams || 0) * l.qty, 0)
  const freeWeightGrams = Number(settings.free_weight_grams || 0)
  const extraWeightPerKg = Number(settings.extra_weight_fee_per_kg || 0)
  const weightFee =
    extraWeightPerKg > 0 && totalWeightGrams > freeWeightGrams
      ? Math.ceil((totalWeightGrams - freeWeightGrams) / 1000) * extraWeightPerKg
      : 0
  const fees = handlingFee + weightFee
  const above = Number(settings.free_delivery_above)
  const ship = above > 0 && sub >= above ? 0 : Number(settings.delivery_fee)
  return { sub, handlingFee, weightFee, fees, ship, total: sub + fees + ship }
}

export async function run(ctx) {
  const { anon, admin, rec, newOrder, stockOf, settings, mkProduct } = ctx
  const S = "orders"
  const P1 = await mkProduct("P1", 100, 25, { shippingClass: "fragile", weightGrams: 150 })
  const P2 = await mkProduct("P2", 200, 25)
  const PH = await mkProduct("HEAVY", 300, 15, { shippingClass: "oversized", weightGrams: 1200 })
  const PI = await mkProduct("INACTIVE", 50, 5, {}, false)
  const PS = await mkProduct("LOWSTOCK", 10, 3)
  ctx.P1 = P1
  ctx.P2 = P2
  const ph = ctx.phone()

  // ---- junk and tampered carts are rejected, and nothing is written ----
  const bad = {
    "qty 0": [{ productId: P1.id, quantity: 0 }],
    "qty 21": [{ productId: P1.id, quantity: 21 }],
    "qty 1.5": [{ productId: P1.id, quantity: 1.5 }],
    "qty -1": [{ productId: P1.id, quantity: -1 }],
    "qty string": [{ productId: P1.id, quantity: "1" }],
    "unknown product": [{ productId: NO_ID, quantity: 1 }],
    "valid + unknown": [{ productId: P1.id, quantity: 1 }, { productId: NO_ID, quantity: 1 }],
    "inactive product": [{ productId: PI.id, quantity: 1 }],
    "stock + 1": [{ productId: PS.id, quantity: 4 }],
    "stock + 1 via merge": [{ productId: PS.id, quantity: 2 }, { productId: PS.id, quantity: 2 }],
    "empty array": [],
    "not an array": { productId: P1.id, quantity: 1 },
    "31 lines": Array.from({ length: 31 }, () => ({ productId: P1.id, quantity: 1 })),
    "missing quantity": [{ productId: P1.id }],
    "null quantity": [{ productId: P1.id, quantity: null }],
    "valid + {}": [{ productId: P1.id, quantity: 1 }, {}],
    "valid + null productId": [{ productId: P1.id, quantity: 1 }, { productId: null, quantity: 1 }],
    "only {}": [{}],
    "bad uuid": [{ productId: "abc", quantity: 1 }],
    "uuid as number": [{ productId: 12345, quantity: 1 }],
    "[1,'a',null]": [1, "a", null],
  }
  const before = { n: await ctx.countMarker(), p1: await stockOf(P1.id), ps: await stockOf(PS.id) }
  for (const [k, items] of Object.entries(bad)) {
    const r = await anon.rpc("create_order", { p_customer: ctx.cust(ph), p_items: items, p_prefix: "ZZ" })
    if (r.error) rec(S, `rejected: ${k}`, true)
    else {
      const row = Array.isArray(r.data) ? r.data[0] : r.data
      const o = (await admin.from("orders").select("id,items,total").eq("order_code", row.order_code).single()).data
      if (o) ctx.created.orders.push(o.id)
      rec(S, `rejected: ${k}`, false, { ACCEPTED: true, items: o?.items, total: o?.total })
    }
  }
  rec(S, "no rows created and stock unchanged after every rejected call", (await ctx.countMarker()) === before.n && (await stockOf(P1.id)) === before.p1 && (await stockOf(PS.id)) === before.ps)

  // ---- server computes prices; client extras are ignored ----
  let x = await newOrder([{ productId: P1.id, quantity: 1, price: 1, total: 1, name: "HACK", fees: [], shippingClass: "standard", weightGrams: 0 }])
  let e = expectedTotal(settings, [{ price: 100, qty: 1, shippingClass: "fragile", weightGrams: 150 }])
  rec(S, "client price/total/name/shippingClass/weightGrams keys are ignored", eqn(x.o.subtotal, e.sub) && eqn(x.o.total, e.total) && x.o.items[0].name === `${MARK} P1` && Number(x.o.items[0].price) === 100, { sub: x.o.subtotal, total: x.o.total, exp: e })
  rec(S, "order code uses the settings prefix, not the p_prefix argument", x.code.startsWith((settings.order_code_prefix || "KK") + "-"), x.code)
  rec(S, "returned total equals stored total", eqn(x.row.total, x.o.total))
  rec(S, "immutable tax_snapshot recorded at order creation", !!x.o.tax_snapshot && typeof x.o.tax_snapshot.gstEnabled === "boolean" && x.o.tax_snapshot.shopName === settings.shop_name, x.o.tax_snapshot)

  const s0 = await stockOf(P1.id)
  x = await newOrder([{ productId: P1.id, quantity: 2 }, { productId: P1.id, quantity: 3 }])
  e = expectedTotal(settings, [{ price: 100, qty: 5, shippingClass: "fragile", weightGrams: 150 }])
  rec(S, "same product twice merges (qty 5, fragile handling fee once)", x.o.items.length === 1 && x.o.items[0].quantity === 5 && eqn(x.o.total, e.total) && (await stockOf(P1.id)) === s0 - 5, { items: x.o.items.length, total: x.o.total, exp: e.total })

  x = await newOrder([{ productId: P1.id, quantity: 3 }, { productId: P2.id, quantity: 1 }])
  e = expectedTotal(settings, [{ price: 100, qty: 3, shippingClass: "fragile", weightGrams: 150 }, { price: 200, qty: 1 }])
  rec(S, "total = price x qty + fragile handling once + delivery rule", eqn(x.o.total, e.total) && eqn(x.o.shipping_fee, e.ship), { total: x.o.total, exp: e })

  x = await newOrder([{ productId: P1.id, quantity: 1 }, { productId: PH.id, quantity: 2 }])
  e = expectedTotal(settings, [
    { price: 100, qty: 1, shippingClass: "fragile", weightGrams: 150 },
    { price: 300, qty: 2, shippingClass: "oversized", weightGrams: 1200 },
  ])
  rec(S, "highest handling tier (oversized beats fragile) once + heavy weight slab across cart", eqn(x.o.total, e.total) && eqn(x.o.shipping_fee, e.ship), { total: x.o.total, extraFees: x.o.extra_fees, exp: e })

  const above = Number(settings.free_delivery_above)
  if (above > 0 && above <= 200 * 20) {
    const q = Math.min(20, Math.ceil(above / 200))
    for (const qq of [Math.max(1, q - 1), q]) {
      const xx = await newOrder([{ productId: P2.id, quantity: qq }])
      const ee = expectedTotal(settings, [{ price: 200, qty: qq }])
      rec(S, `free-delivery rule at subtotal ${200 * qq} (threshold ${above})`, eqn(xx.o.total, ee.total) && eqn(xx.o.shipping_fee, ee.ship))
    }
  } else ctx.info("free-delivery threshold not reachable with the test product; skipped")

  // ---- stock: reserve on create, give back exactly once ----
  const PC = await mkProduct("STOCK", 100, 10)
  let o = await newOrder([{ productId: PC.id, quantity: 3 }])
  rec(S, "create_order reserves stock", (await stockOf(PC.id)) === 7)
  // since 0022 a GUEST needs the FULL phone to cancel (last 4 digits alone is refused and counted)
  const lastOnly = await anon.rpc("cancel_order", { p_code: o.code, p_phone_last4: o.last4, p_reason: "AUDIT TEST" })
  rec(S, "guest cancel with last4 only is refused (ORDER_NOT_FOUND), order untouched", lastOnly.data && lastOnly.data.ok === false && lastOnly.data.error === "ORDER_NOT_FOUND" && (await stockOf(PC.id)) === 7, lastOnly.data || msg(lastOnly))
  let r = await anon.rpc("cancel_order", { p_code: o.code, p_phone_last4: o.last4, p_phone: o.ph, p_reason: "AUDIT TEST" })
  rec(S, "guest cancel (code + full phone) restocks", !r.error && (await stockOf(PC.id)) === 10, msg(r))
  r = await anon.rpc("cancel_order", { p_code: o.code, p_phone_last4: o.last4, p_phone: o.ph, p_reason: "AUDIT TEST" })
  rec(S, "second cancel rejected, no double restock", !!r.error && (await stockOf(PC.id)) === 10, msg(r))
  let ob = await ctx.getOrder(o.id)
  rec(S, "stock_restored_at set once, cancelled_by customer", !!ob.stock_restored_at && ob.cancelled_by === "customer")

  o = await newOrder([{ productId: PC.id, quantity: 2 }])
  let u = await admin.from("orders").update({ status: "cancelled", cancelled_by: "admin", cancel_reason: "AUDIT TEST", cancelled_at: new Date().toISOString() }).eq("id", o.id)
  rec(S, "admin cancel restocks", !u.error && (await stockOf(PC.id)) === 10, msg(u))
  u = await admin.from("orders").update({ status: "cancelled" }).eq("id", o.id)
  rec(S, "re-cancelling does not restock twice", (await stockOf(PC.id)) === 10)
  u = await admin.from("orders").update({ status: "pending" }).eq("id", o.id)
  ob = await ctx.getOrder(o.id)
  rec(S, "a cancelled order cannot be un-cancelled", !!u.error && ob.status === "cancelled", msg(u))
  u = await admin.from("orders").update({ status: "delivered" }).eq("id", o.id)
  rec(S, "cancelled -> delivered is blocked too", !!u.error, msg(u))

  o = await newOrder([{ productId: PC.id, quantity: 1 }])
  await admin.from("orders").update({ status: "shipped" }).eq("id", o.id)
  r = await anon.rpc("cancel_order", { p_code: o.code, p_phone_last4: o.last4, p_phone: o.ph, p_reason: "AUDIT TEST" })
  rec(S, "guest cannot cancel a shipped order", !!r.error, msg(r))
  r = await anon.rpc("cancel_order", { p_code: o.code, p_phone_last4: "0000", p_reason: "x" })
  rec(S, "wrong last4 on cancel is a soft ORDER_NOT_FOUND", r.data && r.data.ok === false, r.data || msg(r))
}
