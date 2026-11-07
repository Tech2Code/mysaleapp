-- 0030: return + dashboard hardening.
--  1. record_order_return: a return opened from a request needs the request to be APPROVED (before, a request still
--     waiting for a decision could be turned straight into 'received', skipping approve / reject). The "only the
--     requested items" limit is now summed per product (the same product on two lines could exceed it).
--  2. decide_return_request: the pickup date must be a sensible date (not in the past, at most 90 days ahead, India time).
--  3. dashboard_stats: revenue = money actually received (payment_amount, else total) minus refunds, and an order whose
--     items were all returned and refunded (payment 'refunded', delivery charge kept by the shop) still counts the
--     charge it kept. Before, it dropped out of revenue completely.

create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order     public.orders;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_ordered   int;
  v_returned  int;
  v_inflight  int;
  v_restocked int := 0;
  v_rows      int;
  v_clean     jsonb := '[]'::jsonb;
  v_price     numeric;
  v_value     numeric := 0;   -- value of the items in THIS call
  v_items_all numeric;        -- value of every item on the order
  v_items_ref numeric;        -- value of items already refunded by earlier returns
  v_paid      numeric;
  v_new_ref   numeric;
  v_full      boolean := false;
  v_refunded  numeric := 0;
  v_ret_id    uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  -- Every return starts from a customer request the admin approved (nothing is "received" out of the blue).
  if p_request_id is null then raise exception 'REQUEST_REQUIRED'; end if;

  if p_request_id is not null and not exists (
    select 1 from public.return_requests
    where id = p_request_id and order_id = p_order_id and status = 'approved'
    for update
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

  -- A return opened from a request can only take back what the customer asked for (product and quantity, summed per
  -- product so the same product on two lines cannot get past the limit; zero / negative lines are ignored like in the loop below).
  if p_request_id is not null and exists (
    select 1 from (
      select e ->> 'productId' as pid,
             sum(case when coalesce((e ->> 'quantity')::int, 0) >= 1 then (e ->> 'quantity')::int else 0 end) as q
      from jsonb_array_elements(p_items) e
      group by 1
    ) a
    where a.q > coalesce((
      select sum((x ->> 'quantity')::int)
      from public.return_requests r, jsonb_array_elements(r.items) x
      where r.id = p_request_id and x ->> 'productId' = a.pid
    ), 0)
  ) then
    raise exception 'NOT_IN_REQUEST';
  end if;

  perform p.id from public.products p
  where p.id in (
    select (e ->> 'productId')::uuid from jsonb_array_elements(p_items) e
    where e ->> 'productId' is not null
  )
  order by p.id for update;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), coalesce(max((e ->> 'price')::numeric), 0)
      into v_ordered, v_price
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = stock + v_qty where id = v_pid;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then v_restocked := v_restocked + v_qty; end if;
    end if;

    v_value := v_value + v_price * v_qty;
    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded, refund_amount)
  values (p_order_id, v_clean, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), coalesce(p_refund, false),
          case when coalesce(p_refund, false) then v_value else null end)
  returning id into v_ret_id;

  if p_request_id is not null then
    update public.return_requests set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
    where id = p_request_id and status = 'approved';
    if not found then raise exception 'REQUEST_NOT_OPEN'; end if;
  else
    -- Recorded without opening it from the request (e.g. a direct return): still close the order's approved request.
    update public.return_requests set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
    where order_id = p_order_id and status = 'approved';
  end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
    from jsonb_array_elements(v_order.items) e;
    v_paid := coalesce(v_order.payment_amount, v_order.total);

    -- value of items refunded by EARLIER returns (this call's return row is already inserted, so exclude it by
    -- summing refund_amount of the other refunded rows; rows from before this fix have no refund_amount and
    -- are priced from their items)
    select coalesce(sum(coalesce(r.refund_amount, (
      select coalesce(sum((ri ->> 'quantity')::int * coalesce((
        select max((oi ->> 'price')::numeric) from jsonb_array_elements(v_order.items) oi
        where (oi ->> 'productId')::uuid = (ri ->> 'productId')::uuid), 0)), 0)
      from jsonb_array_elements(r.items) ri))), 0)
      into v_items_ref
    from public.order_returns r
    where r.order_id = p_order_id and r.refunded and r.id <> v_ret_id;

    if v_items_ref + v_value >= v_items_all - 0.005 then
      v_full := true;
      -- ITEMS ONLY: delivery and other charges are never refunded for a return
      v_new_ref := least(coalesce(v_order.refunded_amount, 0) + v_value, v_paid);
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_new_ref
      where id = p_order_id;
    else
      v_new_ref := least(coalesce(v_order.refunded_amount, 0) + v_value, v_paid);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;
    v_refunded := v_new_ref;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked, 'refundedAmount', v_refunded, 'fullyRefunded', v_full);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

create or replace function public.decide_return_request(p_request_id uuid, p_approve boolean, p_note text, p_pickup_date date default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 2 then raise exception 'NOTE_REQUIRED'; end if;
  if p_approve and p_pickup_date is not null and (p_pickup_date < v_today or p_pickup_date > v_today + 90) then
    raise exception 'BAD_PICKUP_DATE';
  end if;

  update public.return_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
      pickup_date = case when p_approve then p_pickup_date else null end,
      decided_at = now()
  where id = p_request_id and status = 'requested';
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_return_request(uuid, boolean, text, date) from public, anon;
grant execute on function public.decide_return_request(uuid, boolean, text, date) to authenticated;

create or replace function public.dashboard_stats(
  p_start timestamptz, p_end timestamptz, p_prev_start timestamptz, p_prev_end timestamptz, p_bucket text
)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_fmt text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_bucket is null or p_bucket not in ('day', 'month') then raise exception 'BAD_BUCKET'; end if;
  v_fmt := case when p_bucket = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end;

  with cur as (
    select o.id, o.status, o.payment_status, o.items, o.created_at, n.net,
           (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as is_paid
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where o.created_at >= p_start and o.created_at < p_end
  ),
  prev as (
    select (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as is_paid,
           n.net
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where p_prev_start is not null and o.created_at >= p_prev_start and o.created_at < p_prev_end
  ),
  buckets as (
    select to_char(c.created_at at time zone 'Asia/Kolkata', v_fmt) as k,
           coalesce(sum(c.net) filter (where c.is_paid), 0) as revenue,
           count(*) filter (where c.counts) as orders
    from cur c group by 1
  ),
  lines as (
    select e ->> 'productId' as pid,
           min(e ->> 'name') as name,
           min(e ->> 'image') as image,
           sum((e ->> 'quantity')::int) as qty,
           sum((e ->> 'price')::numeric * (e ->> 'quantity')::int) as rev
    from cur c, jsonb_array_elements(c.items) e
    where c.is_paid
    group by 1
  ),
  returned as (
    select r ->> 'productId' as pid, sum((r ->> 'quantity')::int) as qty
    from public.order_returns ret
    join cur c on c.id = ret.order_id and c.is_paid,
         jsonb_array_elements(ret.items) r
    group by 1
  ),
  top as (
    select l.pid, l.name, l.image,
           l.qty - coalesce(rt.qty, 0) as qty,
           l.rev - coalesce(rt.qty, 0) * (l.rev / nullif(l.qty, 0)) as rev
    from lines l left join returned rt on rt.pid = l.pid
    where l.qty - coalesce(rt.qty, 0) > 0
    order by 5 desc, l.pid
    limit 5
  )
  select jsonb_build_object(
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'revenue', revenue, 'orders', orders)) from buckets), '[]'::jsonb),
    'current', jsonb_build_object(
      'revenue', coalesce((select sum(net) from cur where is_paid), 0),
      'orders', (select count(*) from cur where counts),
      'paid', (select count(*) from cur where is_paid)
    ),
    'previous', jsonb_build_object(
      'revenue', coalesce((select sum(net) from prev where is_paid), 0),
      'orders', (select count(*) from prev where counts),
      'paid', (select count(*) from prev where is_paid)
    ),
    'byStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from cur group by 1) s), '{}'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(jsonb_build_object('productId', pid, 'name', name, 'image', image, 'quantity', qty, 'revenue', rev) order by rev desc, pid)
      from top
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;
