-- 0064: Doorstep Exchange Mode (1-visit simultaneous handover option for Admin)
-- Allows admin to choose between:
--   'standard' : Reverse pickup -> Warehouse receive & QC -> Dispatch replacement -> Delivered
--   'doorstep' : 1-visit simultaneous handover (delivery agent brings new item & collects old item together)

alter table public.return_requests
  add column if not exists exchange_mode text not null default 'standard'
    check (exchange_mode in ('standard', 'doorstep'));

-- 1. Update decide_return_request to accept optional p_exchange_mode ('standard' | 'doorstep')
drop function if exists public.decide_return_request(uuid, boolean, text, date);
drop function if exists public.decide_return_request(uuid, boolean, text, date, text);

create or replace function public.decide_return_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text,
  p_pickup_date date default null,
  p_exchange_mode text default 'standard'
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_mode  text := case when lower(btrim(coalesce(p_exchange_mode, 'standard'))) = 'doorstep' then 'doorstep' else 'standard' end;
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
      exchange_mode = case when p_approve and resolution_type = 'exchange' then v_mode else 'standard' end,
      decided_at = now()
  where id = p_request_id and status = 'requested';
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_return_request(uuid, boolean, text, date, text) from public, anon;
grant execute on function public.decide_return_request(uuid, boolean, text, date, text) to authenticated;

-- 2. Update undo_return_step to also reset exchange_mode back to 'standard' when undoing approval
create or replace function public.undo_return_step(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_req   public.return_requests;
  v_state text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_PENDING'; end if;

  if v_req.status = 'approved' and v_req.picked_up_at is not null then
    update public.return_requests set picked_up_at = null where id = p_request_id;
    v_state := 'approved';
  elsif v_req.status = 'approved' then
    update public.return_requests
    set status = 'requested', decided_at = null, admin_note = null, pickup_date = null, exchange_mode = 'standard'
    where id = p_request_id;
    v_state := 'requested';
  elsif v_req.status = 'rejected' then
    if exists (
      select 1 from public.return_requests
      where order_id = v_req.order_id and id <> p_request_id and status in ('requested', 'approved')
    ) then raise exception 'ANOTHER_OPEN'; end if;
    update public.return_requests
    set status = 'requested', decided_at = null, admin_note = null, pickup_date = null, exchange_mode = 'standard'
    where id = p_request_id;
    v_state := 'requested';
  else
    raise exception 'CANNOT_UNDO';
  end if;

  return jsonb_build_object('ok', true, 'state', v_state);
end $$;

revoke all on function public.undo_return_step(uuid) from public, anon;
grant execute on function public.undo_return_step(uuid) to authenticated;

-- 3. Update record_order_return so doorstep exchanges atomically complete in 1 click
--    (collect old item + deliver new item + deduct replacement stock + optional restock).
create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
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
  v_restocked     int := 0;
  v_rows          int;
  v_clean         jsonb := '[]'::jsonb;
  v_price         numeric;
  v_value         numeric := 0;
  v_items_all     numeric;
  v_items_net     numeric;
  v_raw_prev      numeric;
  v_this_refund   numeric := 0;
  v_paid          numeric;
  v_new_ref       numeric;
  v_full          boolean := false;
  v_refunded      numeric := 0;
  v_ret_id        uuid;
  v_res_type      text := 'refund';
  v_exchange_mode text := 'standard';
  v_do_refund     boolean := false;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is null then raise exception 'REQUEST_REQUIRED'; end if;

  select coalesce(r.resolution_type, 'refund'), coalesce(r.exchange_mode, 'standard')
    into v_res_type, v_exchange_mode
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
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = least(100000, stock + v_qty) where id = v_pid;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then v_restocked := v_restocked + v_qty; end if;
    end if;

    -- Exchanges ship out a replacement unit, so deduct 1 unit from shelf stock per exchanged quantity.
    if v_res_type = 'exchange' then
      update public.products set stock = greatest(0, stock - v_qty) where id = v_pid;
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

  if v_res_type = 'exchange' and v_exchange_mode = 'doorstep' then
    update public.return_requests
    set status = 'received',
        received_at = now(),
        picked_up_at = coalesce(picked_up_at, now()),
        exchange_status = 'delivered',
        exchange_shipped_at = now(),
        exchange_delivered_at = now(),
        exchange_tracking = coalesce(exchange_tracking, 'Doorstep exchange')
    where id = p_request_id and status = 'approved';
  else
    update public.return_requests
    set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
    where id = p_request_id and status = 'approved';
  end if;
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
      v_this_refund := least(
        round(case when v_items_all > 0 then v_items_net * (v_value / v_items_all) else 0 end, 2),
        greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0)
      );
      v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;

    update public.order_returns set refund_amount = v_this_refund where id = v_ret_id;
    v_refunded := v_this_refund;
  end if;

  return jsonb_build_object(
    'ok', true,
    'restocked', v_restocked,
    'refundedAmount', v_refunded,
    'fullyRefunded', v_full
  );
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- 4. Guard advance_exchange_fulfillment so doorstep exchanges cannot be partially undone to 'dispatched'
create or replace function public.advance_exchange_fulfillment(
  p_request_id uuid,
  p_stage text,
  p_tracking text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_req public.return_requests;
  v_clean_tracking text := nullif(left(btrim(coalesce(p_tracking, '')), 200), '');
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.resolution_type <> 'exchange' then raise exception 'NOT_EXCHANGE'; end if;
  if v_req.status <> 'received' then raise exception 'NOT_RECEIVED'; end if;
  if v_req.exchange_mode = 'doorstep' then raise exception 'CANNOT_UNDO'; end if;

  if p_stage = 'dispatched' then
    if v_req.exchange_status is not null then raise exception 'ALREADY_DISPATCHED'; end if;
    update public.return_requests
    set exchange_status = 'dispatched',
        exchange_shipped_at = now(),
        exchange_tracking = v_clean_tracking
    where id = p_request_id;
  elsif p_stage = 'delivered' then
    if v_req.exchange_status <> 'dispatched' then raise exception 'NOT_DISPATCHED'; end if;
    update public.return_requests
    set exchange_status = 'delivered',
        exchange_delivered_at = now()
    where id = p_request_id;
  elsif p_stage = 'undo_dispatched' then
    if v_req.exchange_status <> 'dispatched' then raise exception 'CANNOT_UNDO'; end if;
    update public.return_requests
    set exchange_status = null,
        exchange_shipped_at = null,
        exchange_tracking = null
    where id = p_request_id;
  elsif p_stage = 'undo_delivered' then
    if v_req.exchange_status <> 'delivered' then raise exception 'CANNOT_UNDO'; end if;
    update public.return_requests
    set exchange_status = 'dispatched',
        exchange_delivered_at = null
    where id = p_request_id;
  else
    raise exception 'INVALID_STAGE';
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.advance_exchange_fulfillment(uuid, text, text) from public, anon;
grant execute on function public.advance_exchange_fulfillment(uuid, text, text) to authenticated;

-- 5. Include exchangeMode in track_order RPC (preserving all 0062/0063 security & fields)
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
    'requiresSignIn', (v_order.user_id is not null and not v_owner),
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
    'paymentGateway', v_order.payment_gateway,
    'gatewayOrderId', case when v_owner then v_order.gateway_order_id else null end,
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
    'updatedAt', v_order.updated_at,
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
        'reason', case
          when v_owner then v_order.cancel_reason
          when v_order.cancel_reason is null then null
          else nullif(btrim(regexp_replace(v_order.cancel_reason, '(?:\r?\n|\s)*\[Refund UPI:\s*[^\]]+\]', '', 'gi')), '')
        end,
        'by', v_order.cancelled_by,
        'at', v_order.cancelled_at,
        'refundReference', case
          when v_owner then v_order.refund_reference
          when v_order.refund_reference is null then null
          else repeat('*', greatest(length(v_order.refund_reference) - 4, 4)) || right(v_order.refund_reference, 4)
        end,
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
          else nullif(
            btrim(
              regexp_replace(
                regexp_replace(r.details, '(?:\r?\n|\s)*\[Pickup:\s*[^\]]+\]', '', 'gi'),
                '(?:\r?\n|\s)*\[Refund UPI:\s*[^\]]+\]',
                '',
                'gi'
              )
            ),
            ''
          )
        end,
        'status', r.status,
        'adminNote', r.admin_note,
        'createdAt', r.created_at,
        'decidedAt', r.decided_at,
        'pickupDate', r.pickup_date,
        'pickedUpAt', r.picked_up_at,
        'resolutionType', r.resolution_type,
        'exchangePreference', r.exchange_preference,
        'exchangeMode', r.exchange_mode,
        'exchangeStatus', r.exchange_status,
        'exchangeShippedAt', r.exchange_shipped_at,
        'exchangeDeliveredAt', r.exchange_delivered_at,
        'exchangeTracking', r.exchange_tracking
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
