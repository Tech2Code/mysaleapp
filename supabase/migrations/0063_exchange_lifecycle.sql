-- 0063: Modern Exchange & Replacement Lifecycle
-- Separates reverse logistics (old item pickup & warehouse receipt) from forward logistics
-- (outbound dispatch of replacement/exchanged item & final delivery to customer).
-- An exchange/replacement is only complete once the new item is delivered to the customer.

alter table public.return_requests
  add column if not exists requested_by text not null default 'customer'
    check (requested_by in ('customer', 'admin')),
  add column if not exists exchange_status text
    check (exchange_status is null or exchange_status in ('dispatched', 'delivered')),
  add column if not exists exchange_shipped_at timestamptz,
  add column if not exists exchange_delivered_at timestamptz,
  add column if not exists exchange_tracking text
    check (exchange_tracking is null or length(exchange_tracking) <= 200);

-- Update admin_create_return_request to record requested_by = 'admin'
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
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference, requested_by)
    values (
      p_order_id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end,
      'admin'
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) to authenticated;

-- Admin RPC to advance or undo outbound exchange fulfillment after old items are received.
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

-- Update track_order RPC (preserving all 0062 security, PII redaction, and payment gateway fields) to include outbound exchange fulfillment fields
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
