-- 0065: Structured Courier / Shipping Details for Outbound Exchange & Replacement Dispatch
-- Stores carrier, trackingNumber, trackingUrl, expectedDelivery in return_requests.exchange_shipping
-- so admin & customer timelines show the full ShippingInfo card (copyable AWB + Track shipment link + expected date).

alter table public.return_requests
  add column if not exists exchange_shipping jsonb;

drop function if exists public.advance_exchange_fulfillment(uuid, text, text);
drop function if exists public.advance_exchange_fulfillment(uuid, text, text, jsonb);

create or replace function public.advance_exchange_fulfillment(
  p_request_id uuid,
  p_stage text,
  p_tracking text default null,
  p_shipping jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_req            public.return_requests;
  v_clean_tracking text := nullif(left(btrim(coalesce(p_tracking, '')), 200), '');
  v_carrier        text := nullif(left(btrim(coalesce(p_shipping ->> 'carrier', '')), 80), '');
  v_tracking_no    text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingNumber', '')), 60), '');
  v_tracking_url   text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingUrl', '')), 500), '');
  v_expected       text := nullif(left(btrim(coalesce(p_shipping ->> 'expectedDelivery', '')), 20), '');
  v_clean_shipping jsonb := null;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.resolution_type <> 'exchange' then raise exception 'NOT_EXCHANGE'; end if;
  if v_req.status <> 'received' then raise exception 'NOT_RECEIVED'; end if;
  if v_req.exchange_mode = 'doorstep' then raise exception 'CANNOT_UNDO'; end if;

  if v_carrier is not null then
    v_clean_shipping := jsonb_build_object(
      'carrier', v_carrier,
      'trackingNumber', v_tracking_no,
      'trackingUrl', v_tracking_url,
      'expectedDelivery', v_expected
    );
    if v_clean_tracking is null then
      v_clean_tracking := left(
        case when v_tracking_no is not null then v_carrier || ' · ' || v_tracking_no else v_carrier end,
        200
      );
    end if;
  end if;

  if p_stage = 'dispatched' then
    if v_req.exchange_status is not null then raise exception 'ALREADY_DISPATCHED'; end if;
    update public.return_requests
    set exchange_status = 'dispatched',
        exchange_shipped_at = now(),
        exchange_tracking = v_clean_tracking,
        exchange_shipping = v_clean_shipping
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
        exchange_tracking = null,
        exchange_shipping = null
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

revoke all on function public.advance_exchange_fulfillment(uuid, text, text, jsonb) from public, anon;
grant execute on function public.advance_exchange_fulfillment(uuid, text, text, jsonb) to authenticated;

-- Include exchangeShipping in track_order RPC (preserving all 0062/0063/0064 security & fields)
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
        'exchangeTracking', r.exchange_tracking,
        'exchangeShipping', r.exchange_shipping
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
