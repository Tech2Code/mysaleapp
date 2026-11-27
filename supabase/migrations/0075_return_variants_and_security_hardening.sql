-- =====================================================================
-- 0075: End-to-End Variant Return/Exchange Support + Security Hardening
--
-- Fixes included:
--   1. Variant-aware request_return(), admin_create_return_request(), and
--      record_order_return() NOT_IN_REQUEST check (preserves variantId in
--      return_requests.items and validates per (productId, variantId)).
--   2. Fail-closed is_admin_email() when server_rpc_secret_hash is NULL.
--   3. Revoke active auth.sessions & auth.refresh_tokens on Gmail SMTP
--      password reset in consume_password_reset_token().
--   4. Explicit table-level REVOKE privileges on post-0061 tables
--      (password_reset_tokens, email_settings, stock_alerts).
--   5. Return `isOwner` from get_order_for_gateway() so guest PII is never
--      leaked to unrelated signed-in users.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table-level privilege revocations on post-0061 tables
-- ---------------------------------------------------------------------
revoke all on public.password_reset_tokens from public, anon, authenticated;

revoke all on public.email_settings from public, anon;
revoke truncate, references, trigger on public.email_settings from authenticated;

revoke all on public.stock_alerts from public, anon;
revoke truncate, references, trigger on public.stock_alerts from authenticated;

-- ---------------------------------------------------------------------
-- 2. request_return: preserve & validate variantId per line
-- ---------------------------------------------------------------------
create or replace function public.request_return(
  p_code                text,
  p_phone_last4         text,
  p_items               jsonb,
  p_reason              text,
  p_details             text default null,
  p_phone               text default null,
  p_resolution_type     text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_id            uuid;
  v_state         text;
  v_days          int;
  v_item_days     int;
  v_delivered     timestamptz;
  v_item          jsonb;
  v_pid           uuid;
  v_vid           text;
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
  if v_res_type not in ('refund', 'exchange') then
    v_res_type := 'refund';
  end if;
  if v_res_type = 'exchange' and (v_exchange_pref is null or length(v_exchange_pref) < 2) then
    raise exception 'EXCHANGE_PREF_REQUIRED';
  end if;

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
  v_delivered := public.order_delivered_at(v_order.id);
  if v_delivered is null then raise exception 'WINDOW_CLOSED'; end if;

  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'NO_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_vid := nullif(btrim(coalesce(v_item ->> 'variantId', '')), '');
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and (v_vid is null or e ->> 'variantId' = v_vid);
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(
      max((e ->> 'returnWindowDays')::int),
      (select p.return_window_days from public.products p where p.id = v_pid),
      v_days,
      0
    )
    into v_item_days
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and (v_vid is null or e ->> 'variantId' = v_vid);

    if v_item_days <= 0 then raise exception 'RETURNS_OFF'; end if;
    if now() > v_delivered + make_interval(days => v_item_days) then raise exception 'WINDOW_CLOSED'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = v_order.id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(r ->> 'variantId', '') = v_vid);

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(c ->> 'variantId', '') = v_vid);

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_strip_nulls(jsonb_build_object(
      'productId', v_pid,
      'variantId', v_vid,
      'name', left(coalesce(v_name, ''), 120),
      'quantity', v_qty
    ));
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference)
    values (
      v_order.id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.request_return(text, text, jsonb, text, text, text, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. admin_create_return_request: preserve & validate variantId per line
-- ---------------------------------------------------------------------
create or replace function public.admin_create_return_request(
  p_order_id            uuid,
  p_items               jsonb,
  p_reason              text,
  p_details             text,
  p_resolution_type     text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_item          jsonb;
  v_pid           uuid;
  v_vid           text;
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
    v_vid := nullif(btrim(coalesce(v_item ->> 'variantId', '')), '');
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and (v_vid is null or e ->> 'variantId' = v_vid);
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(r ->> 'variantId', '') = v_vid);

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(c ->> 'variantId', '') = v_vid);

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_strip_nulls(jsonb_build_object(
      'productId', v_pid,
      'variantId', v_vid,
      'name', left(coalesce(v_name, ''), 120),
      'quantity', v_qty
    ));
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

-- ---------------------------------------------------------------------
-- 4. record_order_return: group NOT_IN_REQUEST check by (productId, variantId)
-- ---------------------------------------------------------------------
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
  v_vid           text;
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
             coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') as vid,
             sum(case when coalesce((e ->> 'quantity')::int, 0) >= 1 then (e ->> 'quantity')::int else 0 end) as q
      from jsonb_array_elements(p_items) e
      group by 1, 2
    ) a
    where a.q > coalesce((
      select sum((x ->> 'quantity')::int)
      from public.return_requests r, jsonb_array_elements(r.items) x
      where r.id = p_request_id
        and x ->> 'productId' = a.pid
        and (
          coalesce(nullif(btrim(coalesce(x ->> 'variantId', '')), ''), '') = a.vid
          or coalesce(nullif(btrim(coalesce(x ->> 'variantId', '')), ''), '') = ''
        )
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
    v_vid := nullif(btrim(coalesce(v_item ->> 'variantId', '')), '');
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), coalesce(max((e ->> 'price')::numeric), 0)
      into v_ordered, v_price
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and (v_vid is null or e ->> 'variantId' = v_vid);
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(r ->> 'variantId', '') = v_vid);

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and (v_vid is null or coalesce(c ->> 'variantId', '') = v_vid);

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      if v_vid is not null then
        update public.products p
        set variants = (
          select coalesce(jsonb_agg(
            case
              when (v ->> 'id') = v_vid
                then jsonb_set(v, '{stock}', to_jsonb(least(100000, coalesce((v ->> 'stock')::int, 0) + v_qty)))
              else v
            end
          ), '[]'::jsonb)
          from jsonb_array_elements(p.variants) v
        ),
        restocked_at = case
          when exists (
            select 1 from jsonb_array_elements(p.variants) v
            where (v ->> 'id') = v_vid and coalesce((v ->> 'stock')::int, 0) = 0
          ) and v_qty > 0 then now()
          else p.restocked_at
        end
        where p.id = v_pid
          and jsonb_typeof(p.variants) = 'array'
          and jsonb_array_length(p.variants) > 0;
      end if;

      update public.products
         set stock = least(100000, stock + v_qty),
             restocked_at = case when stock = 0 and v_qty > 0 then now() else restocked_at end
       where id = v_pid;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then v_restocked := v_restocked + v_qty; end if;
    end if;

    if v_res_type = 'exchange' then
      if v_vid is not null then
        update public.products p
        set variants = (
          select coalesce(jsonb_agg(
            case
              when (v ->> 'id') = v_vid
                then jsonb_set(v, '{stock}', to_jsonb(greatest(0, coalesce((v ->> 'stock')::int, 0) - v_qty)))
              else v
            end
          ), '[]'::jsonb)
          from jsonb_array_elements(p.variants) v
        )
        where p.id = v_pid
          and jsonb_typeof(p.variants) = 'array'
          and jsonb_array_length(p.variants) > 0;
      end if;

      update public.products set stock = greatest(0, stock - v_qty) where id = v_pid;
    end if;

    v_value := v_value + v_price * v_qty;
    v_clean := v_clean || jsonb_strip_nulls(jsonb_build_object(
      'productId', v_pid,
      'variantId', v_vid,
      'name', left(coalesce(v_item ->> 'name', ''), 120),
      'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    ));
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
    v_refunded := v_new_ref;
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

-- ---------------------------------------------------------------------
-- 5. is_admin_email: fail closed when server_rpc_secret_hash is NULL
-- ---------------------------------------------------------------------
create or replace function public.is_admin_email(
  p_email         text,
  p_server_secret text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_clean text := lower(btrim(coalesce(p_email, '')));
  v_role  text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_hash  text;
begin
  if v_role <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    select es.server_rpc_secret_hash into v_hash
      from public.email_settings es
     where es.id = true;

    if not public._assert_email_rpc_secret(v_hash, p_server_secret) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if v_clean = '' or length(v_clean) > 254 then
    return false;
  end if;

  if not public.check_rate_limit('password-reset', public.internal_rate_key('admin-email-ip')) then
    return false;
  end if;

  return exists (
    select 1
    from auth.users u
    join public.admins a on a.user_id = u.id
    where lower(u.email) = v_clean
  );
end $$;

revoke all on function public.is_admin_email(text, text) from public;
grant execute on function public.is_admin_email(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. consume_password_reset_token: revoke existing auth.sessions & refresh_tokens
-- ---------------------------------------------------------------------
create or replace function public.consume_password_reset_token(
  p_token_hash    text,
  p_scope         text,
  p_new_password  text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_scope       text := lower(btrim(coalesce(p_scope, '')));
  v_hash        text := lower(btrim(coalesce(p_token_hash, '')));
  v_tok         public.password_reset_tokens%rowtype;
  v_user        record;
  v_mail        public.email_settings%rowtype;
  v_name        text;
  v_reactivated boolean := false;
begin
  select * into v_mail from public.email_settings where id = true;
  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_scope not in ('customer', 'admin') or v_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if p_new_password is null or char_length(p_new_password) < 8 or char_length(p_new_password) > 128 then
    return jsonb_build_object('ok', false, 'code', 'invalid_password');
  end if;

  select * into v_tok
    from public.password_reset_tokens
   where token_hash = v_hash
     and scope = v_scope
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select u.id, u.email, u.encrypted_password, u.raw_user_meta_data
    into v_user
    from auth.users u
   where u.id = v_tok.user_id
     and u.deleted_at is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_scope = 'admin' then
    if not exists (select 1 from public.admins a where a.user_id = v_user.id) then
      return jsonb_build_object('ok', false, 'code', 'not_admin');
    end if;
  end if;

  if v_user.encrypted_password is not null
     and v_user.encrypted_password <> ''
     and extensions.crypt(p_new_password, v_user.encrypted_password) = v_user.encrypted_password then
    return jsonb_build_object('ok', false, 'code', 'same_password');
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('has_password', true),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_user.id;

  -- Revoke all existing sessions & refresh tokens so stolen sessions cannot persist after password reset.
  delete from auth.refresh_tokens where user_id = v_user.id::text;
  delete from auth.sessions where user_id = v_user.id;

  update public.password_reset_tokens
     set used_at = now()
   where user_id = v_user.id
     and scope = v_scope
     and used_at is null;

  if v_scope = 'admin' then
    update public.admins
       set pin_failed_attempts = 0,
           pin_locked_until    = null
     where user_id = v_user.id;
  else
    update public.profiles
       set deactivated_at = null
     where id = v_user.id
       and deactivated_at is not null;
    v_reactivated := found;
  end if;

  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'name'), '')
  )
    into v_name
    from public.profiles p
   where p.id = v_user.id;

  return jsonb_build_object(
    'ok', true,
    'userId', v_user.id,
    'email', v_user.email,
    'recipientName', v_name,
    'reactivated', v_reactivated,
    'mailer', case
      when coalesce(v_mail.enabled, false)
           and nullif(btrim(coalesce(v_mail.gmail_user, '')), '') is not null
           and nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is not null
      then jsonb_build_object(
        'gmailUser', v_mail.gmail_user,
        'gmailAppPasswordEnc', v_mail.gmail_app_password_enc,
        'senderName', v_mail.sender_name,
        'replyTo', v_mail.reply_to
      )
      else null
    end
  );
end $$;

revoke all on function public.consume_password_reset_token(text, text, text, text) from public;
grant execute on function public.consume_password_reset_token(text, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. get_order_for_gateway: return isOwner flag for PII gating
-- ---------------------------------------------------------------------
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
  v_order    public.orders;
  v_found_id uuid;
  v_state    text;
  v_is_owner boolean := false;
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
    v_is_owner := true;
  else
    select res_id, res_state
      into v_found_id, v_state
    from public.find_order_for_guest(p_code, p_phone_last4);

    if v_state = 'locked' then
      raise exception 'TOO_MANY_ATTEMPTS';
    end if;
    if v_state <> 'ok' or v_found_id is null then
      return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
    end if;
  end if;

  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;
  if v_order.payment_status = 'submitted' then raise exception 'ALREADY_SUBMITTED'; end if;

  return jsonb_build_object(
    'ok', true,
    'isOwner', v_is_owner,
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
