-- =====================================================================
-- Rate limiter hardening (security re-audit of 0019). Safe to re-run.
--  Before: check_rate_limit(key, max, window) was callable by anon with CALLER-chosen max and window, so
--  anyone could reset a bucket (window = 1 second) or burn another caller's quota (window = a day).
--  Now: the limits live in the function, per scope. A caller can only say "count one hit for this scope
--  and key"; it can no longer shorten a window or raise a limit. Unknown scopes are not limited.
-- =====================================================================

drop function if exists public.check_rate_limit(text, int, int);

create or replace function public.check_rate_limit(p_scope text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max     int;
  v_window  int;
  v_key     text;
  v_hits    int;
begin
  -- scope -> (max hits, window seconds). Change limits here (new migration), never from the client.
  select l.max_hits, l.window_seconds into v_max, v_window
  from (values
    ('track-order',     20, 600),
    ('submit-payment',  20, 600),
    ('update-delivery', 20, 600),
    ('cancel-order',    20, 600),
    ('request-return',  20, 600),
    ('withdraw-return', 20, 600),
    ('place-order',     15, 600),
    ('login',           10, 600),
    ('pincode',         60, 600)
  ) as l(scope, max_hits, window_seconds)
  where l.scope = p_scope;

  if v_max is null then return true; end if;                       -- unknown scope: not limited
  -- the app always sends a 32-char hex hash; anything else is not a real caller key
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then return true; end if;

  v_key := p_scope || ':' || p_key;

  -- Opportunistic cleanup (~5% of calls) of long-expired rows. Windows are at most 10 minutes, so
  -- anything older than an hour is dead.
  if random() < 0.05 then
    delete from public.rate_limits
    where ctid in (select ctid from public.rate_limits where window_start < now() - interval '1 hour' limit 1000);
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (v_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => v_window) then now() else r.window_start end,
        hits         = case when r.window_start < now() - make_interval(secs => v_window) then 1 else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= v_max;
end;
$$;

revoke all on function public.check_rate_limit(text, text) from public;
grant execute on function public.check_rate_limit(text, text) to anon, authenticated;

-- =====================================================================
-- DB re-audit fixes
-- =====================================================================

-- A. expire_unpaid_orders: lock ORDER rows first, then their products (id order), then update only the
--    locked ids. cancel_order / the restock trigger lock order -> products, so the old products -> orders
--    order could deadlock with a customer or admin cancel of an expiring order.
create or replace function public.expire_unpaid_orders()
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_hours int;
  v_ids   uuid[];
  v_count int;
begin
  select unpaid_order_expiry_hours into v_hours from public.store_settings limit 1;
  if coalesce(v_hours, 0) <= 0 then return 0; end if;

  select coalesce(array_agg(x.id), '{}') into v_ids from (
    select o.id from public.orders o
    where o.status = 'pending' and o.payment_status in ('pending', 'failed')
      and o.created_at < now() - make_interval(hours => v_hours)
    order by o.id
    for update skip locked
  ) x;
  if cardinality(v_ids) = 0 then return 0; end if;

  perform p.id from public.products p
  where p.id in (
    select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e where o.id = any (v_ids)
  )
  order by p.id for update;

  update public.orders
  set status = 'cancelled',
      cancel_reason = 'Payment not received in time',
      cancelled_by = 'system',
      cancelled_at = now()
  where id = any (v_ids)
    and status = 'pending' and payment_status in ('pending', 'failed');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- B. refund_order: round once, require at least 1 paisa.
create or replace function public.refund_order(
  p_order_id uuid, p_amount numeric, p_expected_status text, p_reference text, p_note text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_paid   numeric;
  v_amount numeric := case when p_amount is null then null else round(p_amount, 2) end;
  v_new    numeric;
  v_full   boolean;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_expected_status is not null and v_order.status::text <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;

  v_paid := coalesce(v_order.payment_amount, v_order.total);
  if v_amount is not null and (v_amount < 0.01 or v_amount > v_paid - coalesce(v_order.refunded_amount, 0) + 0.005) then
    raise exception 'BAD_AMOUNT';
  end if;

  v_new := case when v_amount is null then v_paid else least(v_paid, coalesce(v_order.refunded_amount, 0) + v_amount) end;
  v_full := v_new >= v_paid - 0.005;

  update public.orders set
    refunded_amount  = v_new,
    payment_status   = case when v_full then 'refunded' else payment_status end,
    refunded_at      = case when v_full then now() else refunded_at end,
    refund_reference = coalesce(nullif(left(btrim(coalesce(p_reference, '')), 60), ''), refund_reference),
    payment_note     = coalesce(nullif(left(btrim(coalesce(p_note, '')), 300), ''), payment_note)
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'refundedAmount', v_new, 'fullyRefunded', v_full);
end $$;

revoke all on function public.refund_order(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.refund_order(uuid, numeric, text, text, text) to authenticated;

-- C. record_order_return: "fully refunded" is decided from the VALUE OF ITEMS refunded (this call + earlier
--    refunded returns), not from refunded_amount, which is cash and may include delivery or a goodwill
--    refund_order. refunded_amount is still increased by this call's item value (capped at what was paid).
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

  if p_request_id is not null and not exists (
    select 1 from public.return_requests
    where id = p_request_id and order_id = p_order_id and status in ('requested', 'approved')
    for update
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

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
    update public.return_requests set status = 'received', received_at = now()
    where id = p_request_id and status in ('requested', 'approved');
    if not found then raise exception 'REQUEST_NOT_OPEN'; end if;
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
      v_new_ref := v_paid;
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_paid
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
