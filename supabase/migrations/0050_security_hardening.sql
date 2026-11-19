-- =====================================================================
-- 0050: Security hardening for profiles.role, request_return & submit_payment
-- =====================================================================

-- 1. Defense-in-depth on public.profiles.role:
--    Revoke column-level INSERT/UPDATE on `role` from anon/authenticated so
--    API callers cannot supply or mutate `role`, and also check `session_user`
--    inside the SECURITY DEFINER trigger (since `current_user` is always the
--    function owner inside SECURITY DEFINER).
revoke insert (role), update (role) on public.profiles from anon, authenticated;

create or replace function public.before_profile_write_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_admins boolean;
  v_caller_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), session_user);
begin
  -- Always keep profiles.full_name clean (without the "(Admin)" suffix used in auth.users)
  new.full_name := public.clean_person_name(new.full_name);

  select exists (select 1 from public.admins a where a.user_id = new.id)
    into v_in_admins;

  if tg_op = 'INSERT' then
    if pg_trigger_depth() <= 1 and (v_caller_role in ('authenticated', 'anon') or auth.uid() is not null) and not public.is_admin() then
      new.role := case when v_in_admins then 'admin' else 'customer' end;
    elsif new.role is null then
      new.role := case when v_in_admins then 'admin' else 'customer' end;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      if pg_trigger_depth() <= 1 and (v_caller_role in ('authenticated', 'anon') or auth.uid() is not null) and not public.is_admin() then
        new.role := old.role;
      end if;
    end if;
  end if;

  return new;
end $$;

-- 2. request_return: require full 10-digit phone for guests (p_strict := true)
--    and block unauthenticated callers from mutating account-owned orders.
drop function if exists public.request_return(text, text, jsonb, text, text);

create or replace function public.request_return(
  p_code text, p_phone_last4 text, p_items jsonb, p_reason text, p_details text, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order     public.orders;
  v_id        uuid;
  v_state     text;
  v_days      int;
  v_delivered timestamptz;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_ordered   int;
  v_returned  int;
  v_inflight  int;
  v_name      text;
  v_clean     jsonb := '[]'::jsonb;
  v_req       uuid;
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
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;

  select return_window_days into v_days from public.store_settings limit 1;
  if coalesce(v_days, 0) <= 0 then raise exception 'RETURNS_OFF'; end if;
  v_delivered := public.order_delivered_at(v_order.id);
  if v_delivered is null or now() > v_delivered + make_interval(days => v_days) then raise exception 'WINDOW_CLOSED'; end if;

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
    insert into public.return_requests (order_id, items, reason, details)
    values (v_order.id, v_clean, left(btrim(p_reason), 80), nullif(left(btrim(coalesce(p_details, '')), 300), ''))
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.request_return(text, text, jsonb, text, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text, text) to anon, authenticated;

-- 3. submit_payment: block unauthenticated callers from mutating account-owned orders
create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
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

  select * into v_order from public.orders where id = v_id for update;

  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;

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

