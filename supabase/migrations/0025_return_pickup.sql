-- 0025: return pickup steps (Myntra-style): approved -> pickup scheduled (date) -> picked up -> received -> refunded.
--  * return_requests.pickup_date  : the day the courier / shop collects the goods (set when approving)
--  * return_requests.picked_up_at : when the pickup actually happened (admin marks it)
--  * decide_return_request takes the pickup date; mark_return_picked_up is new; track_order returns both fields.
-- The request status stays requested/approved/rejected/withdrawn/received; "picked up" is derived (approved + picked_up_at).

alter table public.return_requests
  add column if not exists pickup_date date,
  add column if not exists picked_up_at timestamptz;

drop function if exists public.decide_return_request(uuid, boolean, text);

create or replace function public.decide_return_request(p_request_id uuid, p_approve boolean, p_note text, p_pickup_date date default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 2 then raise exception 'NOTE_REQUIRED'; end if;

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

create or replace function public.mark_return_picked_up(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  update public.return_requests set picked_up_at = now()
  where id = p_request_id and status = 'approved' and picked_up_at is null;
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mark_return_picked_up(uuid) from public, anon;
grant execute on function public.mark_return_picked_up(uuid) to authenticated;

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
        'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at,
        'pickupDate', r.pickup_date, 'pickedUpAt', r.picked_up_at
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
