-- =====================================================================
-- 0059: QA Security & RPC Hardening
--  1. Restore account-ownership check in `public.withdraw_return_request`
--     (which was overwritten in section 6 of 0055_return_exchange.sql)
--     while preserving `decided_at = now()`.
--  2. Enforce account-ownership check in `public.cancel_order` and
--     `public.update_order_delivery` so unauthenticated callers cannot
--     cancel or redirect orders owned by a registered user account.
--  3. Rate-limit `public.is_admin_email(text)` inside the database so
--     direct PostgREST callers cannot enumerate admin emails.
-- =====================================================================

-- 1. withdraw_return_request: enforce user_id ownership + stamp decided_at
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
  -- Signed-in owners match auth.uid() automatically; guests must prove the full 10-digit mobile number.
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  update public.return_requests
  set status = 'withdrawn',
      decided_at = now()
  where id = p_request_id and order_id = v_id and status = 'requested';
  if not found then raise exception 'CANNOT_WITHDRAW'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.withdraw_return_request(text, text, uuid, text) from public;
grant execute on function public.withdraw_return_request(text, text, uuid, text) to anon, authenticated;

-- 2. cancel_order: enforce user_id ownership on account-owned orders
create or replace function public.cancel_order(
  p_code text, p_phone_last4 text, p_reason text, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  -- destructive: guests must give the full phone number (p_phone); the signed-in owner is matched by auth.uid()
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  if v_order.status = 'cancelled' then raise exception 'ALREADY_CANCELLED'; end if;
  if v_order.status not in ('pending', 'confirmed') then raise exception 'CANNOT_CANCEL'; end if;

  update public.orders
  set status = 'cancelled',
      cancel_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
      cancelled_by = 'customer',
      cancelled_at = now()
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'refundDue', v_order.payment_status in ('paid', 'submitted'));
end $$;

revoke all on function public.cancel_order(text, text, text, text) from public;
grant execute on function public.cancel_order(text, text, text, text) to anon, authenticated;

-- 3. update_order_delivery: enforce user_id ownership on account-owned orders
create or replace function public.update_order_delivery(
  p_code text, p_phone_last4 text, p_customer jsonb, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order   public.orders;
  v_id      uuid;
  v_state   text;
  v_name    text := btrim(p_customer ->> 'name');
  v_phone   text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address text := btrim(p_customer ->> 'address');
  v_city    text := btrim(p_customer ->> 'city');
  v_pincode text := btrim(p_customer ->> 'pincode');
  v_note    text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0'  then v_phone := right(v_phone, 10); end if;

  if v_name is null or char_length(v_name) not between 2 and 80 then raise exception 'INVALID_NAME'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'INVALID_PHONE'; end if;
  if v_address is null or char_length(v_address) not between 5 and 300 then raise exception 'INVALID_ADDRESS'; end if;
  if v_city is null or char_length(v_city) not between 2 and 60 then raise exception 'INVALID_CITY'; end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'INVALID_PINCODE'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'INVALID_NOTE'; end if;

  -- destructive: p_phone is the CURRENT phone on the order (proof for a guest); v_phone is the new one
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'pending' then raise exception 'NOT_EDITABLE'; end if;

  update public.orders
  set customer_name = v_name, phone = v_phone, address = v_address,
      city = v_city, pincode = v_pincode, note = v_note, delivery_updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('phoneLast4', right(v_phone, 4));
end $$;

revoke all on function public.update_order_delivery(text, text, jsonb, text) from public;
grant execute on function public.update_order_delivery(text, text, jsonb, text) to anon, authenticated;

-- 4. is_admin_email: per-email DB rate limiting against PostgREST enumeration
create or replace function public.is_admin_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean text := lower(btrim(coalesce(p_email, '')));
begin
  if v_clean = '' or length(v_clean) > 254 then
    return false;
  end if;

  -- Per-email DB rate limit (5 checks per 10 minutes per email) so direct
  -- PostgREST callers cannot hammer a target address without blocking legitimate
  -- admin password resets via a shared global bucket.
  if not public.check_rate_limit('password-reset', md5('admin-email-check:' || v_clean)) then
    return false;
  end if;

  return exists (
    select 1
    from auth.users u
    join public.admins a on a.user_id = u.id
    where lower(u.email) = v_clean
  );
end $$;

revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;

-- 5. track_order: redact [Pickup: ...] PII for guests & return delivery/isOwner for signed-in owners on all statuses
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
    'isOwner', v_owner,
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
    'delivery', case when v_owner then jsonb_build_object(
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
        'id', r.id,
        'items', r.items,
        'reason', r.reason,
        'details', case
          when v_owner then r.details
          when r.details is null then null
          else nullif(btrim(regexp_replace(r.details, '(?:\r?\n|^)\[Pickup:\s*[^\]]+\]\s*$', '', 'i')), '')
        end,
        'status', r.status,
        'adminNote', r.admin_note,
        'createdAt', r.created_at,
        'decidedAt', r.decided_at,
        'pickupDate', r.pickup_date,
        'pickedUpAt', r.picked_up_at,
        'resolutionType', r.resolution_type,
        'exchangePreference', r.exchange_preference
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

-- 6. record_order_return & refund_return: prevent exchange returns from being marked refunded
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
  v_value       numeric := 0;
  v_items_all   numeric;
  v_items_net   numeric;
  v_raw_prev    numeric;
  v_this_refund numeric := 0;
  v_paid        numeric;
  v_new_ref     numeric;
  v_full        boolean := false;
  v_refunded    numeric := 0;
  v_ret_id      uuid;
  v_res_type    text := 'refund';
  v_do_refund   boolean := false;
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

  v_do_refund := coalesce(p_refund, false) and v_res_type <> 'exchange' and v_order.payment_status = 'paid';

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
    v_do_refund,
    null,
    v_res_type
  )
  returning id into v_ret_id;

  update public.return_requests
  set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
  where id = p_request_id and status = 'approved';
  if not found then raise exception 'REQUEST_NOT_OPEN'; end if;

  if v_do_refund then
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
  if coalesce(v_ret.resolution_type, 'refund') = 'exchange' then raise exception 'ALREADY_REFUNDED'; end if;
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

-- 7. deactivate_my_account: also block when a cancelled order has a 'submitted' UPI payment awaiting verification/refund
create or replace function public.deactivate_my_account(p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_clean_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if public.is_admin() then
    raise exception 'ADMIN_CANNOT_DEACTIVATE';
  end if;

  if exists (
    select 1 from public.orders o
    where o.user_id = v_uid
      and (
        o.status in ('pending', 'confirmed', 'packed', 'shipped')
        or (o.status = 'cancelled' and o.payment_status in ('paid', 'submitted'))
      )
  ) then
    raise exception 'ACTIVE_ORDERS_EXIST';
  end if;

  if exists (
    select 1
    from public.return_requests r
    join public.orders o on o.id = r.order_id
    where o.user_id = v_uid
      and r.status in ('requested', 'approved')
  ) or exists (
    select 1
    from public.order_returns ret
    join public.orders o on o.id = ret.order_id
    where o.user_id = v_uid
      and ret.refunded = false
      and coalesce(ret.resolution_type, 'refund') = 'refund'
      and o.payment_status in ('paid', 'submitted')
  ) then
    raise exception 'OPEN_RETURNS_EXIST';
  end if;

  insert into public.profiles (id, deactivated_at, deactivation_reason)
  values (v_uid, now(), v_clean_reason)
  on conflict (id) do update
  set deactivated_at = now(),
      deactivation_reason = excluded.deactivation_reason;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.deactivate_my_account(text) from public, anon;
grant execute on function public.deactivate_my_account(text) to authenticated;

