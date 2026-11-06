-- =====================================================================
-- Stock delta edits + partial refunds. Safe to re-run.
--  1. adjust_product_stock(): the admin product form no longer overwrites `stock` with a possibly
--     stale absolute number (which wiped out stock reserved by a customer order placed meanwhile).
--     It sends the change relative to what it loaded; this applies it to the CURRENT stock in one
--     statement. Admin only. Never goes below 0 (clamped), returns the resulting stock.
--  2. orders.refunded_amount: money already returned to the customer for a paid order.
--  3. record_order_return(): the payment becomes 'refunded' only once the refunded items cover every
--     item ordered; before that the order stays 'paid' and refunded_amount grows by the value of the
--     returned items (price x quantity from the order itself, never from the client).
--  4. track_order(): also exposes refundedAmount (same as 0014 otherwise).
-- =====================================================================

-- 1 ------------------------------------------------------------------
create or replace function public.adjust_product_stock(p_id uuid, p_delta int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_stock int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_delta is null or abs(p_delta) > 1000000 then raise exception 'BAD_DELTA'; end if;

  update public.products set stock = greatest(0, stock + p_delta) where id = p_id returning stock into v_stock;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  return v_stock;
end $$;

revoke all on function public.adjust_product_stock(uuid, int) from public, anon;
grant execute on function public.adjust_product_stock(uuid, int) to authenticated;

-- 2 ------------------------------------------------------------------
alter table public.orders add column if not exists refunded_amount numeric(10,2) not null default 0;

-- 3 ------------------------------------------------------------------
create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
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
  v_clean     jsonb := '[]'::jsonb;
  v_price     numeric;
  v_value     numeric := 0;   -- value of the items in THIS call
  v_items_all numeric;        -- value of every item on the order
  v_paid      numeric;
  v_new_ref   numeric;
  v_full      boolean := false;
  v_refunded  numeric := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is not null and not exists (
    select 1 from public.return_requests where id = p_request_id and order_id = p_order_id and status in ('requested', 'approved')
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

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
      v_restocked := v_restocked + v_qty;
    end if;

    v_value := v_value + v_price * v_qty;
    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded)
  values (p_order_id, v_clean, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), coalesce(p_refund, false));

  if p_request_id is not null then
    update public.return_requests set status = 'received', received_at = now() where id = p_request_id;
  end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
    from jsonb_array_elements(v_order.items) e;
    v_paid := coalesce(v_order.payment_amount, v_order.total);

    -- items refunded so far (earlier refunded amount counts items only, delivery/charges come with the final one)
    v_new_ref := coalesce(v_order.refunded_amount, 0) + v_value;
    if v_new_ref >= v_items_all - 0.005 then
      v_full := true;
      v_new_ref := v_paid;
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_paid
      where id = p_order_id;
    else
      v_new_ref := least(v_new_ref, v_paid);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;
    v_refunded := v_new_ref;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked, 'refundedAmount', v_refunded, 'fullyRefunded', v_full);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- 4 ------------------------------------------------------------------
create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql security definer set search_path = public
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
    'items', v_order.items,
    'subtotal', v_order.subtotal,
    'shippingFee', v_order.shipping_fee,
    'shippingFeeOriginal', v_order.shipping_fee_original,
    'extraFees', v_order.extra_fees,
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
        'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at
      ) order by r.created_at)
      from public.return_requests r where r.order_id = v_order.id
    ), '[]'::jsonb),
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'items', o.items, 'reason', o.reason, 'refunded', o.refunded, 'createdAt', o.created_at
      ) order by o.created_at)
      from public.order_returns o where o.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
