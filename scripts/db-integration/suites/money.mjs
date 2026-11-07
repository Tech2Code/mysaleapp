import { NO_ID, eqn, msg, has, MARK } from "../lib.mjs"

export const description = "refund_order, record_order_return + return requests, dashboard_stats against a raw recomputation"

export async function run(ctx) {
  const { anon, admin, rec, newOrder, pay, refund, ret, stockOf, getOrder, mkProduct } = ctx
  const P1 = ctx.P1
  const P2 = ctx.P2

  // =============== refund_order ===============
  {
    const S = "refund"
    const PR = await mkProduct("REFUND", 100, 20)
    const x = await newOrder([{ productId: PR.id, quantity: 2 }])
    const paid = await pay(x)
    let o = await getOrder(x.id)
    const snap = (q) => JSON.stringify([q.refunded_amount, q.payment_status, q.refunded_at, q.refund_reference])
    let r = await refund(admin, x.id, 50)
    o = await getOrder(x.id)
    rec(S, "partial 50: stays paid, refunded_amount 50", !r.error && r.data.fullyRefunded === false && o.payment_status === "paid" && eqn(o.refunded_amount, 50), msg(r) || r.data)
    const s0 = snap(await getOrder(x.id))
    for (const [label, amt] of [["above what is left", paid - 50 + 1], ["0", 0], ["negative", -5], ["0.004 (rounds to 0)", 0.004]]) {
      r = await refund(admin, x.id, amt)
      rec(S, `amount ${label} -> BAD_AMOUNT, nothing changed`, has(r, "BAD_AMOUNT") && snap(await getOrder(x.id)) === s0, msg(r))
    }
    r = await refund(admin, x.id, null, "delivered")
    rec(S, "stale expected status -> ORDER_CHANGED, nothing changed", has(r, "ORDER_CHANGED") && snap(await getOrder(x.id)) === s0, msg(r))
    // dashboard revenue is net of the partial refund
    const t = new Date(o.created_at).getTime()
    const d = await admin.rpc("dashboard_stats", { p_start: new Date(t - 60e3).toISOString(), p_end: new Date(t + 60e3).toISOString(), p_prev_start: null, p_prev_end: null, p_bucket: "day" })
    const raw = (await admin.from("orders").select("status,payment_status,total,subtotal,refunded_amount").gte("created_at", new Date(t - 60e3).toISOString()).lt("created_at", new Date(t + 60e3).toISOString())).data
    const net = (q) => Math.max(Number(q.total ?? q.subtotal) - Number(q.refunded_amount || 0), 0)
    const rev = raw.filter((q) => q.status !== "cancelled" && q.payment_status === "paid").reduce((a, q) => a + net(q), 0)
    rec(S, "dashboard revenue is net of a partial refund", !d.error && eqn(d.data.current.revenue, rev) && rev > 0, { rpc: d.data?.current, raw: rev })
    r = await refund(admin, x.id, null, o.status, "REF1", "audit note")
    o = await getOrder(x.id)
    rec(S, "expected status ok + null amount refunds the remainder", !r.error && r.data.fullyRefunded === true && o.payment_status === "refunded" && !!o.refunded_at && eqn(o.refunded_amount, paid), msg(r) || r.data)
    r = await refund(admin, x.id, null)
    rec(S, "second full refund -> NOT_PAID", has(r, "NOT_PAID"), msg(r))
    const u = await newOrder([{ productId: PR.id, quantity: 1 }])
    r = await refund(admin, u.id, 10)
    rec(S, "unpaid order -> NOT_PAID", has(r, "NOT_PAID"), msg(r))
    const c = await newOrder([{ productId: PR.id, quantity: 1 }])
    await pay(c)
    await admin.from("orders").update({ status: "cancelled", cancelled_by: "admin", cancel_reason: MARK, cancelled_at: new Date().toISOString() }).eq("id", c.id)
    r = await refund(admin, c.id, null, "cancelled")
    rec(S, "a cancelled but paid order can be refunded", !r.error && r.data.fullyRefunded === true, msg(r))
    const l = await newOrder([{ productId: PR.id, quantity: 1 }])
    await pay(l)
    r = await refund(admin, l.id, 10, null, "R".repeat(100), "N".repeat(400))
    o = await getOrder(l.id)
    rec(S, "reference truncated to 60 and note to 300 characters", !r.error && o.refund_reference?.length === 60 && o.payment_note?.length === 300, msg(r))
    r = await refund(anon, l.id, 1)
    rec(S, "anon refund_order rejected, order unchanged", !!r.error && eqn((await getOrder(l.id)).refunded_amount, 10), msg(r))
    r = await refund(admin, NO_ID, 1)
    rec(S, "unknown order -> ORDER_NOT_FOUND", has(r, "ORDER_NOT_FOUND"), msg(r))
  }

  // =============== record_order_return + requests ===============
  {
    const S = "returns"
    const it = (p, restock = false, q = 1) => ({ productId: p.id, quantity: q, name: p.name, restock })
    const deliver = (id) => admin.from("orders").update({ status: "delivered" }).eq("id", id)

    let x = await newOrder([{ productId: P1.id, quantity: 3 }, { productId: P2.id, quantity: 2 }])
    const T = await pay(x, "delivered")
    const s1 = await stockOf(P1.id)
    const s2 = await stockOf(P2.id)
    let r = await ret(x.id, [it(P1, true, 1), it(P2, false, 1)], true)
    let ob = await getOrder(x.id)
    rec(S, "restock only the lines marked restock", !r.error && (await stockOf(P1.id)) === s1 + 1 && (await stockOf(P2.id)) === s2 && r.data.restocked === 1, msg(r) || r.data)
    rec(S, "partial return refunds item value only: stays paid", ob.payment_status === "paid" && eqn(ob.refunded_amount, 300), { ps: ob.payment_status, ra: ob.refunded_amount })
    r = await ret(x.id, [it(P1, true, 3)])
    rec(S, "over-return -> TOO_MANY_RETURNED", has(r, "TOO_MANY_RETURNED"), msg(r))
    r = await ret(x.id, [it(P1, true, 1), it(P1, true, 2)])
    rec(S, "duplicate lines in one call cannot over-return", has(r, "TOO_MANY_RETURNED"), msg(r))
    rec(S, "stock unchanged after a rejected return (rolled back)", (await stockOf(P1.id)) === s1 + 1)
    const other = await mkProduct("OTHER", 10, 1)
    r = await ret(x.id, [it(other, true, 1)])
    rec(S, "item not in the order -> ITEM_NOT_IN_ORDER", has(r, "ITEM_NOT_IN_ORDER"), msg(r))
    r = await ret(x.id, [{ productId: P1.id, quantity: 0 }])
    rec(S, "quantity 0 only -> NO_ITEMS", has(r, "NO_ITEMS"), msg(r))
    r = await ret(x.id, [])
    rec(S, "empty list -> NO_ITEMS", has(r, "NO_ITEMS"), msg(r))
    r = await anon.rpc("record_order_return", { p_order_id: x.id, p_items: [{ productId: P1.id, quantity: 1 }], p_reason: "x", p_refund: false, p_request_id: null })
    rec(S, "anon record_order_return rejected", !!r.error, msg(r))
    r = await ret(x.id, [it(P1, true, 2), it(P2, true, 1)], true)
    ob = await getOrder(x.id)
    rec(S, "returning everything with refund -> refunded, refunded_amount = paid", !r.error && ob.payment_status === "refunded" && eqn(ob.refunded_amount, T), { err: msg(r), ps: ob.payment_status, ra: ob.refunded_amount, T })

    // goodwill refund first, then item refunds: capped at what was paid
    x = await newOrder([{ productId: P1.id, quantity: 1 }, { productId: P2.id, quantity: 1 }])
    const paidA = await pay(x)
    await refund(admin, x.id, 100)
    await deliver(x.id)
    r = await ret(x.id, [it(P1)], true)
    ob = await getOrder(x.id)
    rec(S, "item refund after a goodwill refund adds up (100 + 100 = 200)", !r.error && ob.payment_status === "paid" && eqn(ob.refunded_amount, 200), msg(r) || r.data)
    r = await ret(x.id, [it(P2)], true)
    ob = await getOrder(x.id)
    rec(S, "last item -> refunded, refunded_amount = paid", !r.error && r.data.fullyRefunded === true && ob.payment_status === "refunded" && eqn(ob.refunded_amount, paidA), msg(r) || r.data)

    // refund = false leaves money alone; refund_amount recorded per refunded return
    x = await newOrder([{ productId: P1.id, quantity: 2 }, { productId: P2.id, quantity: 1 }])
    await pay(x)
    await deliver(x.id)
    const sa = await stockOf(P1.id)
    r = await ret(x.id, [it(P1, false, 1)], false)
    ob = await getOrder(x.id)
    rec(S, "refund=false: no money moved, no restock when restock=false", !r.error && Number(ob.refunded_amount || 0) === 0 && (await stockOf(P1.id)) === sa && r.data.restocked === 0)
    r = await ret(x.id, [it(P1, true, 1)], false)
    rec(S, "restock=true raises stock by 1", !r.error && (await stockOf(P1.id)) === sa + 1 && r.data.restocked === 1, msg(r))
    r = await ret(x.id, [it(P1, true, 1)], false)
    rec(S, "third unit of a 2-unit line -> TOO_MANY_RETURNED", has(r, "TOO_MANY_RETURNED"), msg(r))
    r = await ret(x.id, [it(P2, true, 1)], true)
    const rows = (await admin.from("order_returns").select("*").eq("order_id", x.id)).data
    rec(S, "refund_amount stored only on refunded returns", rows.length === 3 && rows.filter((q) => !q.refunded).every((q) => q.refund_amount === null) && rows.filter((q) => q.refunded).every((q) => eqn(q.refund_amount, 200)), rows.map((q) => [q.refunded, q.refund_amount]))

    // not delivered
    const nd = await newOrder([{ productId: P1.id, quantity: 1 }])
    r = await ret(nd.id, [it(P1)])
    rec(S, "non-delivered order -> NOT_DELIVERED", has(r, "NOT_DELIVERED"), msg(r))
    r = await anon.rpc("request_return", { p_code: nd.code, p_phone_last4: nd.last4, p_items: [{ productId: P1.id, quantity: 1 }], p_reason: "Damaged", p_details: null })
    rec(S, "request_return on a non-delivered order -> NOT_DELIVERED", has(r, "NOT_DELIVERED"), msg(r))

    // deleted product line
    const PD = await mkProduct("DELETED", 50, 5)
    const od = await newOrder([{ productId: PD.id, quantity: 1 }])
    await pay(od, "delivered")
    await admin.from("products").delete().eq("id", PD.id)
    ctx.created.products = ctx.created.products.filter((i) => i !== PD.id)
    r = await ret(od.id, [it(PD, true, 1)], false)
    rec(S, "a line whose product was deleted returns with restocked 0", !r.error && r.data.restocked === 0, msg(r) || r.data)

    // request flow
    const q = await newOrder([{ productId: P1.id, quantity: 3 }])
    await pay(q, "delivered")
    const req = (items, reason = "Damaged") => anon.rpc("request_return", { p_code: q.code, p_phone_last4: q.last4, p_items: items, p_reason: reason, p_details: MARK })
    r = await req([{ productId: P1.id, quantity: 4 }])
    rec(S, "request for more than ordered -> TOO_MANY_RETURNED", has(r, "TOO_MANY_RETURNED"), msg(r))
    r = await req([{ productId: P1.id, quantity: 1 }], " ")
    rec(S, "request without a reason -> REASON_REQUIRED", has(r, "REASON_REQUIRED"), msg(r))
    r = await req([{ productId: P1.id, quantity: 1 }])
    const id1 = r.data?.id
    rec(S, "request_return ok", !r.error && r.data?.ok === true, msg(r) || r.data)
    r = await req([{ productId: P1.id, quantity: 1 }])
    rec(S, "second open request -> ALREADY_OPEN", has(r, "ALREADY_OPEN"), msg(r))
    r = await anon.rpc("request_return", { p_code: q.code, p_phone_last4: "9999", p_items: [{ productId: P1.id, quantity: 1 }], p_reason: "x", p_details: null })
    rec(S, "wrong last4 is a soft error", r.data?.ok === false, r.data || msg(r))
    const wd = (id) => anon.rpc("withdraw_return_request", { p_code: q.code, p_phone_last4: q.last4, p_request_id: id })
    r = await wd(id1)
    rec(S, "withdraw while requested", !r.error && r.data.ok, msg(r))
    r = await wd(id1)
    rec(S, "withdraw again -> CANNOT_WITHDRAW", has(r, "CANNOT_WITHDRAW"), msg(r))
    r = await req([{ productId: P1.id, quantity: 2 }])
    const id2 = r.data?.id
    rec(S, "a new request is allowed after a withdraw", !r.error, msg(r))
    r = await admin.rpc("decide_return_request", { p_request_id: id2, p_approve: false, p_note: "" })
    rec(S, "reject without a note -> NOTE_REQUIRED", has(r, "NOTE_REQUIRED"), msg(r))
    r = await anon.rpc("decide_return_request", { p_request_id: id2, p_approve: true, p_note: "xx" })
    rec(S, "anon cannot decide", !!r.error, msg(r))
    r = await admin.rpc("decide_return_request", { p_request_id: id2, p_approve: true, p_note: "AUDIT TEST pickup" })
    rec(S, "approve ok", !r.error, msg(r))
    r = await admin.rpc("decide_return_request", { p_request_id: id2, p_approve: true, p_note: "again" })
    rec(S, "deciding again -> NOT_PENDING", has(r, "NOT_PENDING"), msg(r))
    r = await wd(id2)
    rec(S, "withdraw after approval -> CANNOT_WITHDRAW", has(r, "CANNOT_WITHDRAW"), msg(r))
    r = await req([{ productId: P1.id, quantity: 1 }])
    rec(S, "new request while one is approved -> ALREADY_OPEN", has(r, "ALREADY_OPEN"), msg(r))
    const s3 = await stockOf(P1.id)
    r = await ret(q.id, [it(P1, true, 2)], false, id2)
    const rq = (await admin.from("return_requests").select("status,received_at").eq("id", id2).single()).data
    rec(S, "recording the return closes the request (received) and restocks", !r.error && rq.status === "received" && !!rq.received_at && (await stockOf(P1.id)) === s3 + 2, { err: msg(r), rq })
    r = await ret(q.id, [it(P1, false, 1)], false, id2)
    rec(S, "reusing a closed request -> REQUEST_NOT_OPEN", has(r, "REQUEST_NOT_OPEN"), msg(r))
    const cr = await req([{ productId: P1.id, quantity: 1 }])
    r = await ret(x.id, [it(P1, false, 1)], false, cr.data?.id)
    rec(S, "a request id from another order -> REQUEST_NOT_OPEN", has(r, "REQUEST_NOT_OPEN"), msg(r))
    await admin.rpc("decide_return_request", { p_request_id: cr.data?.id, p_approve: true, p_note: "ok" })
    const [a, b] = await Promise.all([ret(q.id, [it(P1, false, 1)], false, cr.data?.id), wd(cr.data?.id)])
    rec(S, "approved request: a concurrent withdraw fails, the record succeeds", !a.error && has(b, "CANNOT_WITHDRAW"), { rec: msg(a), wd: msg(b) })
  }

  // =============== dashboard_stats vs raw recomputation ===============
  {
    const S = "dashboard"
    const now = Date.now()
    const start = new Date(now - 30 * 864e5)
    const end = new Date(now + 864e5)
    const prevStart = new Date(now - 60 * 864e5)
    const call = (c, s, e, p, pe, bucket) =>
      c.rpc("dashboard_stats", { p_start: s.toISOString(), p_end: e.toISOString(), p_prev_start: p ? p.toISOString() : null, p_prev_end: pe ? pe.toISOString() : null, p_bucket: bucket })
    let r = await call(anon, start, end, prevStart, start, "day")
    rec(S, "anon dashboard_stats rejected", !!r.error, msg(r))
    r = await call(admin, start, end, null, null, "week")
    rec(S, "bad bucket -> BAD_BUCKET", has(r, "BAD_BUCKET"), msg(r))

    const compute = async (s, e, ps, pe, bucket) => {
      const all = (await admin.from("orders").select("id,status,payment_status,items,created_at,total,subtotal,refunded_amount").limit(100000)).data
      const rets = (await admin.from("order_returns").select("order_id,items")).data
      const inR = (o, a, b) => new Date(o.created_at) >= a && new Date(o.created_at) < b
      const net = (o) => Math.max(Number(o.total ?? o.subtotal) - Number(o.refunded_amount || 0), 0)
      const paid = (o) => o.status !== "cancelled" && o.payment_status === "paid"
      const sum = (xs) => xs.reduce((a, o) => a + net(o), 0)
      const cur = all.filter((o) => inR(o, s, e))
      const prev = ps ? all.filter((o) => inR(o, ps, pe)) : []
      const byStatus = {}
      cur.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1))
      const buckets = {}
      cur.forEach((o) => {
        const d = new Date(new Date(o.created_at).getTime() + 5.5 * 36e5).toISOString() // India time
        const k = bucket === "month" ? d.slice(0, 7) : d.slice(0, 10)
        const b = (buckets[k] ||= { revenue: 0, orders: 0 })
        if (paid(o)) b.revenue += net(o)
        if (o.status !== "cancelled") b.orders++
      })
      const lines = {}
      const paidIds = new Set(cur.filter(paid).map((o) => o.id))
      cur.filter(paid).forEach((o) => o.items.forEach((i) => { const l = (lines[i.productId] ||= { qty: 0, rev: 0 }); l.qty += i.quantity; l.rev += Number(i.price) * i.quantity }))
      const back = {}
      rets.filter((q) => paidIds.has(q.order_id)).forEach((q) => q.items.forEach((i) => (back[i.productId] = (back[i.productId] || 0) + i.quantity)))
      const top = Object.entries(lines).map(([pid, l]) => ({ pid, qty: l.qty - (back[pid] || 0), rev: l.rev - (back[pid] || 0) * (l.rev / l.qty) })).filter((t) => t.qty > 0).sort((a, b) => b.rev - a.rev)
      return { rev: sum(cur.filter(paid)), orders: cur.filter((o) => o.status !== "cancelled").length, paid: cur.filter(paid).length, prevRev: sum(prev.filter(paid)), prevOrders: prev.filter((o) => o.status !== "cancelled").length, byStatus, buckets, top }
    }
    const check = async (label, s, e, ps, pe, bucket) => {
      const res = await call(admin, s, e, ps, pe, bucket)
      if (res.error) return rec(S, label, false, msg(res))
      const d = res.data
      const x = await compute(s, e, ps, pe, bucket)
      const probs = []
      if (!eqn(d.current.revenue, x.rev)) probs.push(["revenue", d.current.revenue, x.rev])
      if (d.current.orders != x.orders) probs.push(["orders", d.current.orders, x.orders])
      if (d.current.paid != x.paid) probs.push(["paid", d.current.paid, x.paid])
      if (!eqn(d.previous.revenue, x.prevRev)) probs.push(["prevRevenue", d.previous.revenue, x.prevRev])
      if (d.previous.orders != x.prevOrders) probs.push(["prevOrders", d.previous.orders, x.prevOrders])
      for (const k of new Set([...Object.keys(d.byStatus), ...Object.keys(x.byStatus)])) if ((d.byStatus[k] || 0) != (x.byStatus[k] || 0)) probs.push(["status " + k, d.byStatus[k], x.byStatus[k]])
      const bk = Object.fromEntries(d.buckets.map((b) => [b.key, b]))
      for (const k of new Set([...Object.keys(bk), ...Object.keys(x.buckets)])) {
        const a = bk[k] || { revenue: 0, orders: 0 }
        const b = x.buckets[k] || { revenue: 0, orders: 0 }
        if (!eqn(a.revenue, b.revenue) || a.orders != b.orders) probs.push(["bucket " + k, a, b])
      }
      const t5 = x.top.slice(0, 5)
      if (d.topProducts.length !== t5.length) probs.push(["top length", d.topProducts.length, t5.length])
      d.topProducts.forEach((t, i) => { if (!t5[i] || !eqn(t.revenue, t5[i].rev) || t.quantity != t5[i].qty) probs.push(["top" + i, { q: t.quantity, r: t.revenue }, t5[i]]) })
      rec(S, label, probs.length === 0, probs)
    }
    await check("day buckets, last 30 days + previous 30", start, end, prevStart, start, "day")
    const y0 = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
    await check("month buckets, this year vs last year", y0, new Date(Date.UTC(y0.getUTCFullYear() + 1, 0, 1)), new Date(Date.UTC(y0.getUTCFullYear() - 1, 0, 1)), y0, "month")
    await check("all time, no previous period", new Date("2000-01-01"), new Date("2100-01-01"), null, null, "month")

    const PT = await mkProduct("DASHTOP", 777, 50)
    const o = await newOrder([{ productId: PT.id, quantity: 4 }])
    await pay(o, "delivered")
    await refund(admin, o.id, 100)
    await ret(o.id, [{ productId: PT.id, quantity: 1, restock: true }], false)
    const res = await call(admin, start, end, null, null, "day")
    const tp = res.data?.topProducts.find((t) => t.productId === PT.id)
    const mine = (await compute(start, end, null, null, "day")).top.find((t) => t.pid === PT.id)
    rec(S, "top products are net of returned units (4 sold, 1 back -> 3 x 777 = 2331)", mine && mine.qty === 3 && eqn(mine.rev, 2331) && (!tp || (tp.quantity == 3 && eqn(tp.revenue, 2331))), { tp, mine })
    await check("re-check after a partly refunded and partly returned order", start, end, prevStart, start, "day")
  }
}
