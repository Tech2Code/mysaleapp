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

-- 4. is_admin_email: enforce DB-level rate limiting against PostgREST enumeration
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

  -- Enforce a strict DB-level rate limit (5 checks per 10 minutes globally) so
  -- direct PostgREST callers cannot brute-force enumerate admin email addresses.
  if not public.check_rate_limit('password-reset', md5('is_admin_email_global')) then
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

