-- 0055: Return-to-Exchange Option (Size / Variant / Replacement Exchange Flow)
-- Allows customers and admins to choose between a Refund ('refund') or an Exchange / Replacement ('exchange')
-- when opening a return request, with a specific exchange preference note (e.g., preferred size, colour, or piece).

-- 1. Add resolution_type & exchange_preference columns to return_requests & order_returns --
alter table public.products
  add column if not exists return_window_days int
    check (return_window_days is null or return_window_days between 0 and 90);

alter table public.return_requests
  add column if not exists resolution_type text not null default 'refund'
    check (resolution_type in ('refund', 'exchange')),
  add column if not exists exchange_preference text
    check (exchange_preference is null or length(exchange_preference) <= 200);

alter table public.order_returns
  add column if not exists resolution_type text not null default 'refund'
    check (resolution_type in ('refund', 'exchange'));

-- 2. Update request_return RPC -----------------------------------------
drop function if exists public.request_return(text, text, jsonb, text, text);
drop function if exists public.request_return(text, text, jsonb, text, text, text);
drop function if exists public.request_return(text, text, jsonb, text, text, text, text, text);

create or replace function public.request_return(
  p_code text,
  p_phone_last4 text,
  p_items jsonb,
  p_reason text,
  p_details text,
  p_phone text default null,
  p_resolution_type text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_id            uuid;
  v_state         text;
  v_days          int;
  v_item_days     int;
  v_delivered     timestamptz;
  v_item          jsonb;
  v_pid           uuid;
  v_qty           int;
  v_ordered       int;
  v_returned      int;
  v_inflight      int;
  v_name          text;
  v_clean         jsonb := '[]'::jsonb;
  v_req           uuid;
  v_res_type      text := lower(btrim(coalesce(p_resolution_type, 'refund')));
  v_exchange_pref text := nullif(left(btrim(coalesce(p_exchange_preference, '')), 200), '');
begin
  if v_res_type not in ('refund', 'exchange') then
    v_res_type := 'refund';
  end if;
  if v_res_type = 'exchange' and (v_exchange_pref is null or length(v_exchange_pref) < 2) then
    raise exception 'EXCHANGE_PREF_REQUIRED';
  end if;

  -- Signed-in owners match auth.uid() automatically; guests must prove the full 10-digit mobile number.
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;

  select return_window_days into v_days from public.store_settings limit 1;
  v_delivered := public.order_delivered_at(v_order.id);
  if v_delivered is null then raise exception 'WINDOW_CLOSED'; end if;

  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'NO_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    -- Per-product return window: use snapshotted returnWindowDays on the order line, else live product setting, else store default
    select coalesce(
      max((e ->> 'returnWindowDays')::int),
      (select p.return_window_days from public.products p where p.id = v_pid),
      v_days,
      0
    )
    into v_item_days
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid;

    if v_item_days <= 0 then raise exception 'RETURNS_OFF'; end if;
    if now() > v_delivered + make_interval(days => v_item_days) then raise exception 'WINDOW_CLOSED'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = v_order.id and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference)
    values (
      v_order.id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.request_return(text, text, jsonb, text, text, text, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text, text, text, text) to anon, authenticated;

-- 3. Update admin_create_return_request RPC ----------------------------
drop function if exists public.admin_create_return_request(uuid, jsonb, text, text);
drop function if exists public.admin_create_return_request(uuid, jsonb, text, text, text, text);

create or replace function public.admin_create_return_request(
  p_order_id uuid,
  p_items jsonb,
  p_reason text,
  p_details text,
  p_resolution_type text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_item          jsonb;
  v_pid           uuid;
  v_qty           int;
  v_ordered       int;
  v_returned      int;
  v_inflight      int;
  v_name          text;
  v_clean         jsonb := '[]'::jsonb;
  v_req           uuid;
  v_res_type      text := lower(btrim(coalesce(p_resolution_type, 'refund')));
  v_exchange_pref text := nullif(left(btrim(coalesce(p_exchange_preference, '')), 200), '');
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if v_res_type not in ('refund', 'exchange') then
    v_res_type := 'refund';
  end if;
  if v_res_type = 'exchange' and (v_exchange_pref is null or length(v_exchange_pref) < 2) then
    raise exception 'EXCHANGE_PREF_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'NO_ITEMS'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference)
    values (
      p_order_id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) to authenticated;

-- 4. Update track_order RPC to include resolutionType & exchangePreference
create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
  v_owner boolean;
begin
  if p_phone_last4 !~ '^[0-9]{4}$' then return null; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return null; end if;

  select * into v_order from public.orders where id = v_id;
  v_owner := auth.uid() is not null and v_order.user_id = auth.uid();

  return jsonb_build_object(
    'orderCode', v_order.order_code,
    'status', v_order.status,
    'items', coalesce((
      select jsonb_agg(
        e || jsonb_build_object(
          'returnWindowDays',
          coalesce(
            (e ->> 'returnWindowDays')::int,
            (select p.return_window_days from public.products p where p.id = (e ->> 'productId')::uuid),
            (select s.return_window_days from public.store_settings s limit 1),
            7
          )
        )
      )
      from jsonb_array_elements(v_order.items) e
    ), v_order.items),
    'subtotal', v_order.subtotal,
    'shippingFee', v_order.shipping_fee,
    'shippingFeeOriginal', v_order.shipping_fee_original,
    'extraFees', v_order.extra_fees,
    'promoCode', v_order.promo_code,
    'discountAmount', v_order.discount_amount,
    'total', v_order.total,
    'paymentStatus', v_order.payment_status,
    'refundedAmount', v_order.refunded_amount,
    'paymentMethod', case when v_owner then v_order.payment_method else null end,
    'paymentReference', case
      when v_owner then v_order.payment_reference
      when v_order.payment_reference is null then null
      else repeat('*', greatest(length(v_order.payment_reference) - 4, 0)) || right(v_order.payment_reference, 4)
    end,
    'paymentAmount', case when v_owner then v_order.payment_amount else null end,
    'paymentSubmittedAt', v_order.payment_submitted_at,
    'paymentPaidAt', case when v_owner then v_order.payment_paid_at else null end,
    'paymentNote', case when v_owner or v_order.payment_status = 'failed' then v_order.payment_note else null end,
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'delivery', case when v_owner and v_order.status = 'pending' then jsonb_build_object(
        'name', v_order.customer_name, 'phone', v_order.phone, 'address', v_order.address,
        'city', v_order.city, 'pincode', v_order.pincode, 'note', v_order.note
      ) else null end,
    'shipping', case
      when v_order.shipping_carrier is null then null
      else jsonb_build_object(
        'carrier', v_order.shipping_carrier,
        'trackingNumber', v_order.tracking_number,
        'trackingUrl', v_order.tracking_url,
        'expectedDelivery', v_order.expected_delivery
      )
    end,
    'cancellation', case
      when v_order.status = 'cancelled' then jsonb_build_object(
        'reason', v_order.cancel_reason,
        'by', v_order.cancelled_by,
        'at', v_order.cancelled_at,
        'refundReference', v_order.refund_reference,
        'refundedAt', v_order.refunded_at
      ) else null end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb),
    'returnRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'items', r.items, 'reason', r.reason, 'details', r.details, 'status', r.status,
        'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at,
        'pickupDate', r.pickup_date, 'pickedUpAt', r.picked_up_at,
        'resolutionType', r.resolution_type, 'exchangePreference', r.exchange_preference
      ) order by r.created_at)
      from public.return_requests r where r.order_id = v_order.id
    ), '[]'::jsonb),
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'items', o.items, 'reason', o.reason, 'refunded', o.refunded,
        'resolutionType', o.resolution_type, 'createdAt', o.created_at
      ) order by o.created_at)
      from public.order_returns o where o.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- 5. Harden withdraw_return_request (ownership check for account-owned orders)
create or replace function public.withdraw_return_request(
  p_code text, p_phone_last4 text, p_request_id uuid, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  update public.return_requests set status = 'withdrawn'
  where id = p_request_id and order_id = v_id and status = 'requested';
  if not found then raise exception 'CANNOT_WITHDRAW'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.withdraw_return_request(text, text, uuid, text) from public;
grant execute on function public.withdraw_return_request(text, text, uuid, text) to anon, authenticated;

-- 6. Update record_order_return & refund_return to propagate resolution_type
--    and account for promo discount_amount when calculating item refunds
create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order       public.orders;
  v_item        jsonb;
  v_pid         uuid;
  v_qty         int;
  v_ordered     int;
  v_returned    int;
  v_inflight    int;
  v_restocked   int := 0;
  v_rows        int;
  v_clean       jsonb := '[]'::jsonb;
  v_price       numeric;
  v_value       numeric := 0;   -- undiscounted value of the items in THIS call
  v_items_all   numeric;        -- undiscounted value of every item on the order
  v_items_net   numeric;        -- net item amount paid after promo discount_amount (excluding delivery & extra fees)
  v_raw_prev    numeric;        -- undiscounted value of items already refunded by earlier returns
  v_this_refund numeric := 0;   -- discounted rupee amount refunded for THIS return
  v_paid        numeric;
  v_new_ref     numeric;
  v_full        boolean := false;
  v_refunded    numeric := 0;
  v_ret_id      uuid;
  v_res_type    text := 'refund';
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is null then raise exception 'REQUEST_REQUIRED'; end if;

  select coalesce(r.resolution_type, 'refund')
    into v_res_type
  from public.return_requests r
  where r.id = p_request_id and r.order_id = p_order_id and r.status = 'approved'
  for update;
  if not found then raise exception 'REQUEST_NOT_OPEN'; end if;

  if exists (
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

  insert into public.order_returns (order_id, items, reason, refunded, refund_amount, resolution_type)
  values (
    p_order_id,
    v_clean,
    nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
    coalesce(p_refund, false) and v_order.payment_status = 'paid',
    null,
    v_res_type
  )
  returning id into v_ret_id;

  update public.return_requests
  set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
  where id = p_request_id and status = 'approved';
  if not found then raise exception 'REQUEST_NOT_OPEN'; end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
    from jsonb_array_elements(v_order.items) e;
    v_paid := coalesce(v_order.payment_amount, v_order.total);
    v_items_net := least(greatest(v_items_all - coalesce(v_order.discount_amount, 0), 0), v_paid);

    select coalesce(sum(public.return_items_value(v_order.items, r.items)), 0)
      into v_raw_prev
    from public.order_returns r
    where r.order_id = p_order_id and r.refunded and r.id <> v_ret_id;

    if v_raw_prev + v_value >= v_items_all - 0.005 then
      v_full := true;
      v_this_refund := greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0);
      v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_new_ref
      where id = p_order_id;
    else
      v_this_refund := case when v_items_all > 0 then round(v_value * v_items_net / v_items_all, 2) else 0 end;
      v_this_refund := least(v_this_refund, greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0));
      v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;

    update public.order_returns set refund_amount = v_this_refund where id = v_ret_id;
    v_refunded := v_new_ref;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked, 'refundedAmount', v_refunded, 'fullyRefunded', v_full);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

create or replace function public.refund_return(p_return_id uuid, p_expected_refunded numeric default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_ret         public.order_returns;
  v_order       public.orders;
  v_value       numeric;
  v_items_all   numeric;
  v_items_net   numeric;
  v_raw_prev    numeric;
  v_this_refund numeric;
  v_paid        numeric;
  v_new_ref     numeric;
  v_full        boolean := false;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_ret from public.order_returns where id = p_return_id;
  if not found then raise exception 'RETURN_NOT_FOUND'; end if;

  select * into v_order from public.orders where id = v_ret.order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into v_ret from public.order_returns where id = p_return_id for update;
  if not found then raise exception 'RETURN_NOT_FOUND'; end if;

  if v_ret.refunded then raise exception 'ALREADY_REFUNDED'; end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;
  if p_expected_refunded is not null
     and abs(coalesce(v_order.refunded_amount, 0) - p_expected_refunded) > 0.005 then
    raise exception 'ORDER_CHANGED';
  end if;

  v_value := public.return_items_value(v_order.items, v_ret.items);
  v_paid  := coalesce(v_order.payment_amount, v_order.total);

  select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
  from jsonb_array_elements(v_order.items) e;
  v_items_net := least(greatest(v_items_all - coalesce(v_order.discount_amount, 0), 0), v_paid);

  select coalesce(sum(public.return_items_value(v_order.items, r.items)), 0) into v_raw_prev
  from public.order_returns r
  where r.order_id = v_order.id and r.refunded and r.id <> v_ret.id;

  if v_raw_prev + v_value >= v_items_all - 0.005 then
    v_full := true;
    v_this_refund := greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0);
    v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
    update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_new_ref
    where id = v_order.id;
  else
    v_this_refund := case when v_items_all > 0 then round(v_value * v_items_net / v_items_all, 2) else 0 end;
    v_this_refund := least(v_this_refund, greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0));
    v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
    update public.orders set refunded_amount = v_new_ref where id = v_order.id;
  end if;

  update public.order_returns set refunded = true, refund_amount = v_this_refund where id = v_ret.id;

  return jsonb_build_object('ok', true, 'refundedAmount', v_new_ref, 'fullyRefunded', v_full);
end $$;

revoke all on function public.refund_return(uuid, numeric) from public, anon;
grant execute on function public.refund_return(uuid, numeric) to authenticated;

-- 6. Stamp decided_at on withdraw_return_request so the timeline & request card show the exact withdrawal timestamp --
update public.return_requests
set decided_at = coalesce(decided_at, created_at)
where status = 'withdrawn' and decided_at is null;

create or replace function public.withdraw_return_request(
  p_code text, p_phone_last4 text, p_request_id uuid, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_state text;
begin
  -- Signed-in owners match auth.uid() automatically; guests must prove the full 10-digit mobile number.
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  update public.return_requests
  set status = 'withdrawn',
      decided_at = now()
  where id = p_request_id and order_id = v_id and status = 'requested';
  if not found then raise exception 'CANNOT_WITHDRAW'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.withdraw_return_request(text, text, uuid, text) from public;
grant execute on function public.withdraw_return_request(text, text, uuid, text) to anon, authenticated;
