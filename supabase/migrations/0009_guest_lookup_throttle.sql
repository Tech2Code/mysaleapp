-- =====================================================================
-- Brute-force protection for guest order access (order code + last 4 phone digits).
-- After 10 wrong attempts on one order code within 15 minutes, guest access to THAT order is
-- locked until the window passes. The signed-in owner of the order is never locked out.
--
-- The throttled functions return {"ok":false,"error":"ORDER_NOT_FOUND" | "TOO_MANY_ATTEMPTS"}
-- (track_order: null / {"error":"TOO_MANY_ATTEMPTS"}) instead of raising: a raised exception
-- would roll back the very row that records the failed attempt.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.order_lookup_failures (
  id         bigint generated always as identity primary key,
  order_code text not null,
  failed_at  timestamptz not null default now()
);
create index if not exists order_lookup_failures_code_idx on public.order_lookup_failures (order_code, failed_at);
create index if not exists order_lookup_failures_time_idx on public.order_lookup_failures (failed_at);

-- Only the SECURITY DEFINER functions below touch this table.
alter table public.order_lookup_failures enable row level security;
revoke all on public.order_lookup_failures from anon, authenticated;

-- ---------------------------------------------------------------------
-- Helper: identify an order for a guest (or its signed-in owner).
-- res_state: 'ok' | 'not_found' | 'locked'
-- ---------------------------------------------------------------------
create or replace function public.find_order_for_guest(p_code text, p_last4 text)
returns table (res_id uuid, res_state text)
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id   uuid;
begin
  -- the signed-in owner is recognised by their account, no throttling
  if auth.uid() is not null then
    select o.id into v_id from public.orders o where o.order_code = v_code and o.user_id = auth.uid();
    if found then return query select v_id, 'ok'::text; return; end if;
  end if;

  if (
    select count(*) from public.order_lookup_failures f
    where f.order_code = v_code and f.failed_at > now() - interval '15 minutes'
  ) >= 10 then
    return query select null::uuid, 'locked'::text;
    return;
  end if;

  select o.id into v_id from public.orders o
  where o.order_code = v_code and right(o.phone, 4) = coalesce(p_last4, '');
  if found then return query select v_id, 'ok'::text; return; end if;

  -- count the miss (only for codes that exist, so random guesses can't bloat the table)
  if exists (select 1 from public.orders o where o.order_code = v_code) then
    insert into public.order_lookup_failures (order_code) values (v_code);
    delete from public.order_lookup_failures where failed_at < now() - interval '1 day';
  end if;

  return query select null::uuid, 'not_found'::text;
end $$;

revoke all on function public.find_order_for_guest(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- track_order (no longer STABLE: it records failed attempts)
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  if p_phone_last4 !~ '^[0-9]{4}$' then return null; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return null; end if;

  select * into v_order from public.orders where id = v_id;

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
    'paymentMethod', v_order.payment_method,
    'paymentReference', v_order.payment_reference,
    'paymentAmount', v_order.payment_amount,
    'paymentSubmittedAt', v_order.payment_submitted_at,
    'paymentPaidAt', v_order.payment_paid_at,
    'paymentNote', v_order.payment_note,
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'delivery', case when v_order.status = 'pending' then jsonb_build_object(
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
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- submit_payment
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
  v_ref   text := upper(btrim(coalesce(p_reference, '')));
begin
  if v_ref !~ '^[A-Z0-9]{8,35}$' then raise exception 'INVALID_REFERENCE'; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id;

  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status = 'paid' then raise exception 'ALREADY_PAID'; end if;

  if exists (
    select 1 from public.orders o
    where upper(o.payment_reference) = v_ref and o.id <> v_order.id
      and o.payment_status in ('submitted', 'paid')
  ) then
    raise exception 'DUPLICATE_REFERENCE';
  end if;

  update public.orders
  set payment_reference = v_ref,
      payment_method = 'upi',
      payment_status = 'submitted',
      payment_submitted_at = now(),
      payment_note = null
  where id = v_order.id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.submit_payment(text, text, text) from public;
grant execute on function public.submit_payment(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- update_order_delivery
-- ---------------------------------------------------------------------
create or replace function public.update_order_delivery(p_code text, p_phone_last4 text, p_customer jsonb)
returns jsonb
language plpgsql security definer set search_path = public
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

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id;
  if v_order.status <> 'pending' then raise exception 'NOT_EDITABLE'; end if;

  update public.orders
  set customer_name = v_name, phone = v_phone, address = v_address,
      city = v_city, pincode = v_pincode, note = v_note, delivery_updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('phoneLast4', right(v_phone, 4));
end $$;

revoke all on function public.update_order_delivery(text, text, jsonb) from public;
grant execute on function public.update_order_delivery(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- cancel_order
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_code text, p_phone_last4 text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;

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

revoke all on function public.cancel_order(text, text, text) from public;
grant execute on function public.cancel_order(text, text, text) to anon, authenticated;
