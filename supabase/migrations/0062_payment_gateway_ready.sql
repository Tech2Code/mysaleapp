-- =====================================================================
-- 0062: Plug-and-Play Payment Gateway Readiness (Dual-Mode: Manual UPI + Gateway)
--  1. store_settings: payment_mode ('manual_upi' default | 'gateway') & payment_gateway.
--  2. orders: payment_gateway, gateway_order_id, unique index, widened payment_reference check.
--  3. guard_payment_status() & lock_finished_orders(): allow/lock gateway columns cleanly.
--  4. check_rate_limit(): add 'gateway-payment' scope (20 / 10 min).
--  5. track_order(): expose paymentGateway & owner-only gatewayOrderId.
--  6. service_role-only gateway RPCs: get_order_for_gateway, record_gateway_session,
--     confirm_gateway_payment, record_gateway_failure.
-- =====================================================================

-- 1. store_settings: dual-mode payment columns -------------------------
alter table public.store_settings
  add column if not exists payment_mode    text not null default 'manual_upi',
  add column if not exists payment_gateway text default 'razorpay';

alter table public.store_settings drop constraint if exists store_settings_payment_mode_chk;
alter table public.store_settings add constraint store_settings_payment_mode_chk
  check (payment_mode in ('manual_upi', 'gateway'));

alter table public.store_settings drop constraint if exists store_settings_payment_gateway_chk;
alter table public.store_settings add constraint store_settings_payment_gateway_chk
  check (payment_gateway is null or payment_gateway in ('razorpay', 'cashfree', 'phonepe', 'stripe'));

-- 2. orders: gateway columns, unique index & widened payment_reference -
alter table public.orders
  add column if not exists payment_gateway  text,
  add column if not exists gateway_order_id text;

alter table public.orders drop constraint if exists orders_payment_gateway_chk;
alter table public.orders add constraint orders_payment_gateway_chk
  check (payment_gateway is null or payment_gateway in ('razorpay', 'cashfree', 'phonepe', 'stripe'));

alter table public.orders drop constraint if exists orders_gateway_order_id_fmt;
alter table public.orders add constraint orders_gateway_order_id_fmt
  check (gateway_order_id is null or gateway_order_id ~ '^[A-Za-z0-9_.:-]{4,80}$');

create unique index if not exists orders_gateway_order_id_uniq
  on public.orders (payment_gateway, gateway_order_id)
  where gateway_order_id is not null;

-- Drop both inline check (0004) and format check (0045) so gateway payment/refund IDs (e.g. pay_..., rfnd_...) work alongside UTRs.
-- Note: submit_payment() still enforces ^[A-Z0-9]{8,35}$ for customer manual UPI submissions.
alter table public.orders drop constraint if exists orders_payment_reference_check;
alter table public.orders drop constraint if exists orders_payment_reference_fmt;
alter table public.orders add constraint orders_payment_reference_fmt
  check (payment_reference is null or payment_reference ~ '^[A-Za-z0-9_-]{8,64}$');

-- 3. Payment & finished-order triggers ---------------------------------
create or replace function public.guard_payment_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    if old.payment_status::text = 'refunded'
       or (old.payment_status::text = 'paid' and new.payment_status::text <> 'refunded') then
      raise exception 'PAYMENT_LOCKED' using errcode = 'P0001';
    end if;
    if new.payment_status::text = 'refunded' and new.status::text in ('pending', 'confirmed', 'packed') then
      raise exception 'REFUND_BEFORE_DISPATCH' using errcode = 'P0001';
    end if;
  end if;

  if old.payment_status::text = 'refunded'
     or (old.status::text in ('delivered', 'cancelled') and old.payment_status::text = 'paid') then
    if new.payment_amount is distinct from old.payment_amount
       or new.payment_paid_at is distinct from old.payment_paid_at
       or new.payment_reference is distinct from old.payment_reference
       or new.payment_gateway is distinct from old.payment_gateway
       or new.gateway_order_id is distinct from old.gateway_order_id then
      raise exception 'PAYMENT_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

revoke all on function public.guard_payment_status() from public, anon, authenticated;

create or replace function public.lock_finished_orders()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_mutable constant text[] := array[
    'payment_status', 'payment_method', 'payment_reference', 'payment_amount',
    'payment_submitted_at', 'payment_paid_at', 'payment_note',
    'payment_gateway', 'gateway_order_id',
    'refunded_amount', 'refunded_at', 'refund_reference',
    'stock_reserved', 'stock_restored_at',
    'updated_at',
    'user_id'
  ];
begin
  if old.status::text not in ('delivered', 'cancelled') then
    return new;
  end if;

  -- Allow controlled 1-step admin revert from delivered -> shipped via revert_order_status()
  if old.status::text = 'delivered'
     and new.status::text = 'shipped'
     and current_setting('app.allow_delivered_revert', true) = 'on' then
    if (to_jsonb(new) - v_mutable - 'status') is distinct from (to_jsonb(old) - v_mutable - 'status') then
      raise exception 'ORDER_LOCKED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'ORDER_LOCKED' using errcode = 'P0001';
  end if;

  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'ORDER_LOCKED' using errcode = 'P0001';
  end if;

  return new;
end $$;

revoke all on function public.lock_finished_orders() from public, anon, authenticated;

-- 4. Rate limiting: add gateway-payment scope --------------------------
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
  select l.max_hits, l.window_seconds into v_max, v_window
  from (values
    ('track-order',     20, 600),
    ('submit-payment',  20, 600),
    ('gateway-payment', 20, 600),
    ('update-delivery', 20, 600),
    ('cancel-order',    20, 600),
    ('request-return',  20, 600),
    ('withdraw-return', 20, 600),
    ('place-order',     15, 600),
    ('create-order-ip', 40, 600),
    ('login',           10, 600),
    ('pincode',         60, 600),
    ('password-reset',   5, 600)
  ) as l(scope, max_hits, window_seconds)
  where l.scope = p_scope;

  if v_max is null then return true; end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then return true; end if;

  v_key := p_scope || ':' || p_key;

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

-- 5. track_order: expose paymentGateway & owner-only gatewayOrderId ----
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

-- 6. service_role-only gateway RPCs ------------------------------------
create or replace function public.get_order_for_gateway(
  p_code        text,
  p_phone_last4 text default null,
  p_user_id     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where order_code = upper(btrim(coalesce(p_code, '')));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  if v_order.user_id is not null then
    if p_user_id is null or v_order.user_id <> p_user_id then
      return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
    end if;
  else
    if coalesce(p_phone_last4, '') !~ '^[0-9]{4}$' or right(v_order.phone, 4) <> p_phone_last4 then
      return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
    end if;
  end if;

  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;
  if v_order.payment_status = 'submitted' then raise exception 'ALREADY_SUBMITTED'; end if;

  return jsonb_build_object(
    'ok', true,
    'orderId', v_order.id,
    'orderCode', v_order.order_code,
    'total', v_order.total,
    'customerName', v_order.customer_name,
    'phone', v_order.phone,
    'paymentGateway', v_order.payment_gateway,
    'gatewayOrderId', v_order.gateway_order_id
  );
end $$;

revoke all on function public.get_order_for_gateway(text, text, uuid) from public, anon, authenticated;
grant execute on function public.get_order_for_gateway(text, text, uuid) to service_role;

create or replace function public.record_gateway_session(
  p_code             text,
  p_gateway          text,
  p_gateway_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_gw    text := lower(btrim(coalesce(p_gateway, '')));
  v_gid   text := btrim(coalesce(p_gateway_order_id, ''));
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_gw not in ('razorpay', 'cashfree', 'phonepe', 'stripe') then
    raise exception 'GATEWAY_UNAVAILABLE';
  end if;
  if v_gid !~ '^[A-Za-z0-9_.:-]{4,80}$' then
    raise exception 'GATEWAY_UNAVAILABLE';
  end if;

  select * into v_order
  from public.orders
  where order_code = upper(btrim(coalesce(p_code, '')))
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;

  update public.orders
  set payment_gateway = v_gw,
      gateway_order_id = v_gid
  where id = v_order.id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.record_gateway_session(text, text, text) from public, anon, authenticated;
grant execute on function public.record_gateway_session(text, text, text) to service_role;

create or replace function public.confirm_gateway_payment(
  p_code              text,
  p_gateway           text,
  p_gateway_order_id  text,
  p_payment_reference text,
  p_amount            numeric,
  p_method            text default 'upi'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_code   text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_gw     text := lower(btrim(coalesce(p_gateway, '')));
  v_gid    text := nullif(btrim(coalesce(p_gateway_order_id, '')), '');
  v_ref    text := btrim(coalesce(p_payment_reference, ''));
  v_method text := lower(btrim(coalesce(p_method, 'upi')));
  v_amt    numeric(10,2);
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_gw not in ('razorpay', 'cashfree', 'phonepe', 'stripe') then
    raise exception 'GATEWAY_UNAVAILABLE';
  end if;
  if v_ref !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'INVALID_REFERENCE';
  end if;

  if v_code is not null then
    select * into v_order
    from public.orders
    where order_code = v_code
    for update;
  elsif v_gid is not null then
    select * into v_order
    from public.orders
    where payment_gateway = v_gw
      and gateway_order_id = v_gid
    for update;
  end if;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  -- Idempotent retry / duplicate webhook delivery
  if v_order.payment_status in ('paid', 'refunded') then
    if v_order.payment_reference = v_ref then
      return jsonb_build_object(
        'ok', true,
        'alreadyPaid', true,
        'orderCode', v_order.order_code,
        'confirmed', v_order.status <> 'cancelled',
        'refundDue', v_order.status = 'cancelled'
      );
    end if;
    raise exception 'ALREADY_PAID';
  end if;

  if p_amount is null or abs(v_order.total - round(p_amount, 2)) > 0.01 then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  if exists (
    select 1 from public.orders o
    where upper(o.payment_reference) = upper(v_ref)
      and o.id <> v_order.id
      and o.payment_status in ('submitted', 'paid')
  ) then
    raise exception 'DUPLICATE_REFERENCE';
  end if;

  v_amt := round(p_amount, 2);

  update public.orders
  set payment_status       = 'paid',
      payment_method       = case when v_method in ('upi', 'bank_transfer', 'card', 'cash', 'other') then v_method else 'other' end,
      payment_gateway      = v_gw,
      gateway_order_id     = coalesce(v_gid, v_order.gateway_order_id),
      payment_reference    = v_ref,
      payment_amount       = v_amt,
      payment_paid_at      = coalesce(v_order.payment_paid_at, now()),
      payment_submitted_at = coalesce(v_order.payment_submitted_at, now()),
      payment_note         = null,
      status               = case when v_order.status = 'pending' then 'confirmed'::public.order_status else v_order.status end
  where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'alreadyPaid', false,
    'orderCode', v_order.order_code,
    'confirmed', v_order.status <> 'cancelled',
    'refundDue', v_order.status = 'cancelled'
  );
end $$;

revoke all on function public.confirm_gateway_payment(text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.confirm_gateway_payment(text, text, text, text, numeric, text) to service_role;

create or replace function public.record_gateway_failure(
  p_code             text,
  p_gateway          text,
  p_gateway_order_id text default null,
  p_note             text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_code  text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_gw    text := lower(btrim(coalesce(p_gateway, '')));
  v_gid   text := nullif(btrim(coalesce(p_gateway_order_id, '')), '');
  v_note  text := coalesce(nullif(left(btrim(coalesce(p_note, '')), 300), ''), 'Online payment could not be completed. Please try again.');
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_code is not null then
    select * into v_order
    from public.orders
    where order_code = v_code
    for update;
  elsif v_gid is not null then
    select * into v_order
    from public.orders
    where payment_gateway = v_gw
      and gateway_order_id = v_gid
    for update;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  if v_order.status = 'pending' and v_order.payment_status in ('pending', 'failed') then
    update public.orders
    set payment_status = 'failed',
        payment_note = v_note
    where id = v_order.id;
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.record_gateway_failure(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_gateway_failure(text, text, text, text) to service_role;
