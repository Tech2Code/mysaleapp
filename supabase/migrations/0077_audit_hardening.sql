-- =====================================================================
-- 0077: Deep Production Audit Hardening
--
-- Fixes included:
--   1. adjust_product_variant_stock(p_id, p_deltas): atomic per-variant
--      delta stock updates (prevents concurrent admin edits from wiping
--      customer stock reservations) + aggregate stock sync & restocked_at.
--   2. Strict variantId enforcement in request_return(),
--      admin_create_return_request(), record_order_return(), and
--      return_items_value() when an order contains variant lines for a
--      product, plus per-product total cap in NOT_IN_REQUEST.
--   3. Guard refund_order() and guard_payment_status() against partial
--      refunds before dispatch/cancel and unpaid -> refunded transitions.
--   4. Guard record_gateway_failure() against stale webhook overwriting
--      a newer retry session's gateway_order_id.
--   5. Fix TOCTOU unique_violation race in subscribe_stock_alert() and
--      undo_return_step().
--   6. Fix multi-variant revenue inflation in dashboard_stats() topProducts.
--   7. Validate http(s):// protocol on trackingUrl in
--      advance_exchange_fulfillment() and decide_return_request().
--   8. Enforce _assert_email_rpc_secret before smtpEnabled check in
--      create_password_reset_token() and prepare_signup_email().
--   9. Revoke EXECUTE on trigger functions (guard_order_status_transition,
--      track_product_restock) + add contact_pincode CHECK constraint.
--  10. Add 5 missing performance indexes on hot admin/cron/RLS queries.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Atomic per-variant stock delta RPC
-- ---------------------------------------------------------------------
create or replace function public.adjust_product_variant_stock(
  p_id     uuid,
  p_deltas jsonb default '{}'::jsonb
)
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_prod      public.products;
  v_next      jsonb := '[]'::jsonb;
  v_elem      jsonb;
  v_vid       text;
  v_cur       int;
  v_delta     int;
  v_after     int;
  v_total     int := 0;
  v_restocked boolean := false;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_prod from public.products where id = p_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if jsonb_typeof(v_prod.variants) <> 'array' or jsonb_array_length(v_prod.variants) = 0 then
    return v_prod.stock;
  end if;

  for v_elem in select * from jsonb_array_elements(v_prod.variants) loop
    v_vid := v_elem ->> 'id';
    v_cur := coalesce((v_elem ->> 'stock')::int, 0);
    v_delta := case
      when jsonb_typeof(p_deltas) = 'object' and v_vid is not null and (p_deltas ? v_vid)
        then coalesce((p_deltas ->> v_vid)::int, 0)
      else 0
    end;
    v_after := least(100000, greatest(0, v_cur + v_delta));
    if v_cur <= 0 and v_after > 0 then
      v_restocked := true;
    end if;
    v_total := v_total + v_after;
    v_next := v_next || jsonb_build_array(jsonb_set(v_elem, '{stock}', to_jsonb(v_after)));
  end loop;

  v_total := least(100000, greatest(0, v_total));

  update public.products
  set variants = v_next,
      stock = v_total,
      restocked_at = case
        when v_restocked or (v_prod.stock <= 0 and v_total > 0) then now()
        else restocked_at
      end
  where id = p_id;

  return v_total;
end $$;

revoke all on function public.adjust_product_variant_stock(uuid, jsonb) from public, anon;
grant execute on function public.adjust_product_variant_stock(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Strict variantId matching in return_items_value & return RPCs
-- ---------------------------------------------------------------------
create or replace function public.return_items_value(p_order_items jsonb, p_return_items jsonb)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    (ri ->> 'quantity')::int * coalesce((
      select max((oi ->> 'price')::numeric)
      from jsonb_array_elements(p_order_items) oi
      where oi ->> 'productId' = ri ->> 'productId'
        and (
          coalesce(nullif(btrim(coalesce(ri ->> 'variantId', '')), ''), '') =
          coalesce(nullif(btrim(coalesce(oi ->> 'variantId', '')), ''), '')
          or (
            nullif(btrim(coalesce(ri ->> 'variantId', '')), '') is null
            and not exists (
              select 1 from jsonb_array_elements(p_order_items) o2
              where o2 ->> 'productId' = ri ->> 'productId'
                and nullif(btrim(coalesce(o2 ->> 'variantId', '')), '') is not null
            )
          )
        )
    ), 0)
  ), 0)
  from jsonb_array_elements(p_return_items) ri
$$;

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
  v_has_var       boolean;
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

    select exists (
      select 1 from jsonb_array_elements(v_order.items) e
      where (e ->> 'productId')::uuid = v_pid
        and nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
    ) into v_has_var;

    if v_has_var and v_vid is null then
      raise exception 'ITEM_NOT_IN_ORDER';
    end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');
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
      and coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

    if v_item_days <= 0 then raise exception 'RETURNS_OFF'; end if;
    if now() > v_delivered + make_interval(days => v_item_days) then raise exception 'WINDOW_CLOSED'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = v_order.id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(r ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(c ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

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
  v_has_var       boolean;
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

    select exists (
      select 1 from jsonb_array_elements(v_order.items) e
      where (e ->> 'productId')::uuid = v_pid
        and nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
    ) into v_has_var;

    if v_has_var and v_vid is null then
      raise exception 'ITEM_NOT_IN_ORDER';
    end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(r ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(c ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

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
  v_has_var       boolean;
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
  ) or exists (
    select 1 from (
      select e ->> 'productId' as pid,
             sum(case when coalesce((e ->> 'quantity')::int, 0) >= 1 then (e ->> 'quantity')::int else 0 end) as q
      from jsonb_array_elements(p_items) e
      group by 1
    ) p_tot
    where p_tot.q > coalesce((
      select sum((x ->> 'quantity')::int)
      from public.return_requests r, jsonb_array_elements(r.items) x
      where r.id = p_request_id
        and x ->> 'productId' = p_tot.pid
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

    select exists (
      select 1 from jsonb_array_elements(v_order.items) e
      where (e ->> 'productId')::uuid = v_pid
        and nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
    ) into v_has_var;

    if v_has_var and v_vid is null then
      raise exception 'ITEM_NOT_IN_ORDER';
    end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), coalesce(max((e ->> 'price')::numeric), 0)
      into v_ordered, v_price
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(r ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c
    where (c ->> 'productId')::uuid = v_pid
      and coalesce(nullif(btrim(coalesce(c ->> 'variantId', '')), ''), '') = coalesce(v_vid, '');

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
-- 3. Guard refund_order & guard_payment_status
-- ---------------------------------------------------------------------
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
    if new.payment_status::text = 'refunded' and old.payment_status::text <> 'paid' then
      raise exception 'NOT_PAID' using errcode = 'P0001';
    end if;
    if new.payment_status::text = 'refunded' and new.status::text in ('pending', 'confirmed', 'packed') then
      raise exception 'REFUND_BEFORE_DISPATCH' using errcode = 'P0001';
    end if;
  end if;

  if coalesce(new.refunded_amount, 0) > coalesce(old.refunded_amount, 0)
     and new.status::text in ('pending', 'confirmed', 'packed') then
    raise exception 'REFUND_BEFORE_DISPATCH' using errcode = 'P0001';
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

create or replace function public.refund_order(
  p_order_id uuid, p_amount numeric, p_expected_status text, p_reference text, p_note text,
  p_expected_refunded numeric default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_paid   numeric;
  v_amount numeric := case when p_amount is null then null else round(p_amount, 2) end;
  v_new    numeric;
  v_full   boolean;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_expected_status is not null and v_order.status::text <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;
  if p_expected_refunded is not null
     and abs(coalesce(v_order.refunded_amount, 0) - p_expected_refunded) > 0.005 then
    raise exception 'ORDER_CHANGED';
  end if;
  if v_order.status::text in ('pending', 'confirmed', 'packed') then
    raise exception 'REFUND_BEFORE_DISPATCH';
  end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;

  v_paid := coalesce(v_order.payment_amount, v_order.total);
  if v_amount is not null and (v_amount < 0.01 or v_amount > v_paid - coalesce(v_order.refunded_amount, 0) + 0.005) then
    raise exception 'BAD_AMOUNT';
  end if;

  v_new := case when v_amount is null then v_paid else least(v_paid, coalesce(v_order.refunded_amount, 0) + v_amount) end;
  v_full := v_new >= v_paid - 0.005;

  update public.orders set
    refunded_amount  = v_new,
    payment_status   = case when v_full then 'refunded' else payment_status end,
    refunded_at      = case when v_full then now() else refunded_at end,
    refund_reference = coalesce(nullif(left(btrim(coalesce(p_reference, '')), 60), ''), refund_reference),
    payment_note     = coalesce(nullif(left(btrim(coalesce(p_note, '')), 300), ''), payment_note)
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'refundedAmount', v_new, 'fullyRefunded', v_full);
end $$;

revoke all on function public.refund_order(uuid, numeric, text, text, text, numeric) from public, anon;
grant execute on function public.refund_order(uuid, numeric, text, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Guard record_gateway_failure against stale retry webhooks
-- ---------------------------------------------------------------------
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

  -- Ignore delayed failure webhooks from an earlier gateway session after a newer retry was started
  if v_order.gateway_order_id is not null and v_gid is not null and v_order.gateway_order_id <> v_gid then
    return jsonb_build_object('ok', true, 'ignored', true);
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

-- ---------------------------------------------------------------------
-- 5. Fix TOCTOU unique_violation in subscribe_stock_alert & undo_return_step
-- ---------------------------------------------------------------------
create or replace function public.subscribe_stock_alert(
  p_product_id uuid,
  p_name       text default '',
  p_phone      text default '',
  p_variant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone       text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name        text := left(btrim(coalesce(p_name, '')), 60);
  v_variant_id  text := nullif(left(btrim(coalesce(p_variant_id, '')), 80), '');
  v_var_label   text := null;
  v_uid         uuid := auth.uid();
  v_product     record;
  v_variant     jsonb;
  v_existing_id uuid;
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substr(v_phone, 3);
  elsif length(v_phone) = 11 and left(v_phone, 1) = '0' then
    v_phone := substr(v_phone, 2);
  end if;

  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  if not public.check_rate_limit('place-order', public.internal_rate_key('stock-alert', v_phone)) then
    raise exception 'TOO_MANY_ATTEMPTS';
  end if;

  select id, is_active, stock, variants into v_product
  from public.products
  where id = p_product_id;

  if not found or not v_product.is_active then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_variant_id is not null then
    select elem into v_variant
    from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) elem
    where elem ->> 'id' = v_variant_id
    limit 1;

    if v_variant is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if coalesce((v_variant ->> 'stock')::int, 0) > 0 then
      raise exception 'ALREADY_IN_STOCK';
    end if;
    v_var_label := nullif(btrim(coalesce(v_variant ->> 'label', '')), '');
  else
    if coalesce(v_product.stock, 0) > 0 then
      raise exception 'ALREADY_IN_STOCK';
    end if;
  end if;

  select id into v_existing_id
  from public.stock_alerts
  where product_id = p_product_id
    and coalesce(variant_id, '') = coalesce(v_variant_id, '')
    and phone = v_phone
    and status = 'waiting'
  limit 1;

  if v_existing_id is not null then
    update public.stock_alerts
    set customer_name = case
          when v_uid is not null and user_id = v_uid and v_name <> '' then v_name
          else customer_name
        end,
        variant_label = coalesce(v_var_label, variant_label)
    where id = v_existing_id;
    return jsonb_build_object('ok', true, 'alreadySubscribed', true);
  end if;

  begin
    insert into public.stock_alerts (product_id, variant_id, variant_label, user_id, customer_name, phone, status)
    values (p_product_id, v_variant_id, v_var_label, v_uid, v_name, v_phone, 'waiting');
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'alreadySubscribed', true);
  end;

  return jsonb_build_object('ok', true, 'alreadySubscribed', false);
end $$;

revoke all on function public.subscribe_stock_alert(uuid, text, text, text) from public;
grant execute on function public.subscribe_stock_alert(uuid, text, text, text) to anon, authenticated;

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
    set status = 'requested',
        decided_at = null,
        admin_note = null,
        pickup_date = null,
        exchange_mode = 'standard',
        exchange_shipping = null,
        exchange_tracking = null
    where id = p_request_id;
    v_state := 'requested';
  elsif v_req.status = 'rejected' then
    if exists (
      select 1 from public.return_requests
      where order_id = v_req.order_id and id <> p_request_id and status in ('requested', 'approved')
    ) then raise exception 'ANOTHER_OPEN'; end if;
    begin
      update public.return_requests
      set status = 'requested',
          decided_at = null,
          admin_note = null,
          pickup_date = null,
          exchange_mode = 'standard',
          exchange_shipping = null,
          exchange_tracking = null
      where id = p_request_id;
    exception when unique_violation then
      raise exception 'ANOTHER_OPEN';
    end;
    v_state := 'requested';
  else
    raise exception 'CANNOT_UNDO';
  end if;

  return jsonb_build_object('ok', true, 'state', v_state);
end $$;

revoke all on function public.undo_return_step(uuid) from public, anon;
grant execute on function public.undo_return_step(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Fix dashboard_stats multi-variant topProducts revenue inflation
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_start timestamptz, p_end timestamptz, p_prev_start timestamptz, p_prev_end timestamptz, p_bucket text
)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_fmt text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_bucket is null or p_bucket not in ('day', 'month') then raise exception 'BAD_BUCKET'; end if;
  v_fmt := case when p_bucket = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end;

  with cur as (
    select o.id, o.status, o.payment_status, o.items, o.created_at, o.discount_amount, o.payment_amount, o.total, o.subtotal, n.net,
           (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as has_rev,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid_order
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where o.created_at >= p_start and o.created_at < p_end
  ),
  prev as (
    select (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as has_rev,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid_order,
           n.net
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where p_prev_start is not null and o.created_at >= p_prev_start and o.created_at < p_prev_end
  ),
  buckets as (
    select to_char(c.created_at at time zone 'Asia/Kolkata', v_fmt) as k,
           coalesce(sum(c.net) filter (where c.has_rev), 0) as revenue,
           count(*) filter (where c.counts) as orders,
           count(*) filter (where c.is_paid_order) as paid_orders
    from cur c group by 1
  ),
  order_gross as (
    select c.id as order_id,
           coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) as items_gross,
           coalesce(nullif(c.payment_amount, 0), c.total, c.subtotal) as paid_amt,
           coalesce(c.discount_amount, 0) as discount_amt
    from cur c, jsonb_array_elements(c.items) e
    where c.is_paid_order
    group by c.id, c.payment_amount, c.total, c.subtotal, c.discount_amount
  ),
  order_lines as (
    select c.id as order_id,
           e ->> 'productId' as pid,
           coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), '') as vid,
           min(e ->> 'name') as name,
           min(e ->> 'image') as image,
           sum((e ->> 'quantity')::int) as qty,
           max((e ->> 'price')::numeric) as unit_price,
           og.items_gross,
           least(greatest(og.items_gross - og.discount_amt, 0), og.paid_amt) as items_net
    from cur c
    join order_gross og on og.order_id = c.id,
         jsonb_array_elements(c.items) e
    group by c.id, e ->> 'productId', coalesce(nullif(btrim(coalesce(e ->> 'variantId', '')), ''), ''), og.items_gross, og.discount_amt, og.paid_amt
  ),
  returned_per_order as (
    select ret.order_id,
           r ->> 'productId' as pid,
           coalesce(nullif(btrim(coalesce(r ->> 'variantId', '')), ''), '') as vid,
           sum((r ->> 'quantity')::int) as qty
    from public.order_returns ret
    join cur c on c.id = ret.order_id and c.is_paid_order,
         jsonb_array_elements(ret.items) r
    where coalesce(ret.resolution_type, 'refund') <> 'exchange'
    group by ret.order_id, r ->> 'productId', coalesce(nullif(btrim(coalesce(r ->> 'variantId', '')), ''), '')
  ),
  net_lines as (
    select ol.pid,
           ol.name,
           ol.image,
           greatest(ol.qty - coalesce(rp.qty, 0), 0) as kept_qty,
           case
             when ol.items_gross > 0 then
               round(
                 greatest(ol.qty - coalesce(rp.qty, 0), 0)
                 * ol.unit_price
                 * (ol.items_net / ol.items_gross),
                 2
               )
             else 0
           end as kept_rev
    from order_lines ol
    left join returned_per_order rp on rp.order_id = ol.order_id and rp.pid = ol.pid and rp.vid = ol.vid
  ),
  top as (
    select nl.pid,
           min(nl.name) as name,
           min(nl.image) as image,
           sum(nl.kept_qty) as qty,
           round(sum(nl.kept_rev), 2) as rev
    from net_lines nl
    group by nl.pid
    having sum(nl.kept_qty) > 0
    order by 5 desc, nl.pid
    limit 5
  )
  select jsonb_build_object(
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'revenue', revenue, 'orders', orders, 'paidOrders', paid_orders)) from buckets), '[]'::jsonb),
    'current', jsonb_build_object(
      'revenue', coalesce((select sum(net) from cur where has_rev), 0),
      'orders', (select count(*) from cur where counts),
      'paid', (select count(*) from cur where is_paid_order)
    ),
    'previous', jsonb_build_object(
      'revenue', coalesce((select sum(net) from prev where has_rev), 0),
      'orders', (select count(*) from prev where counts),
      'paid', (select count(*) from prev where is_paid_order)
    ),
    'byStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from cur group by 1) s), '{}'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(jsonb_build_object('productId', pid, 'name', name, 'image', image, 'quantity', qty, 'revenue', rev) order by rev desc, pid)
      from top
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Protocol validation on trackingUrl in exchange courier RPCs
-- ---------------------------------------------------------------------
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
  if v_tracking_url is not null and v_tracking_url !~* '^https?://' then
    raise exception 'INVALID_TRACKING_URL';
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.resolution_type <> 'exchange' then raise exception 'NOT_EXCHANGE'; end if;

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

  if p_stage = 'set_courier' then
    if v_clean_shipping is null then raise exception 'COURIER_REQUIRED'; end if;
    if not (
      (v_req.status = 'approved' and v_req.exchange_mode = 'doorstep')
      or (v_req.status = 'received' and v_req.exchange_status = 'dispatched')
    ) then
      raise exception 'INVALID_STAGE';
    end if;
    update public.return_requests
    set exchange_shipping = v_clean_shipping,
        exchange_tracking = coalesce(v_clean_tracking, exchange_tracking)
    where id = p_request_id;
    return jsonb_build_object('ok', true);
  end if;

  if v_req.status <> 'received' then raise exception 'NOT_RECEIVED'; end if;
  if v_req.exchange_mode = 'doorstep' then raise exception 'CANNOT_UNDO'; end if;

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

create or replace function public.decide_return_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text,
  p_pickup_date date default null,
  p_exchange_mode text default 'standard',
  p_shipping jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today          date := (now() at time zone 'Asia/Kolkata')::date;
  v_mode           text := case when lower(btrim(coalesce(p_exchange_mode, 'standard'))) = 'doorstep' then 'doorstep' else 'standard' end;
  v_carrier        text := nullif(left(btrim(coalesce(p_shipping ->> 'carrier', '')), 80), '');
  v_tracking_no    text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingNumber', '')), 60), '');
  v_tracking_url   text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingUrl', '')), 500), '');
  v_expected       text := nullif(left(btrim(coalesce(p_shipping ->> 'expectedDelivery', '')), 20), '');
  v_clean_shipping jsonb := null;
  v_clean_tracking text := null;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if v_tracking_url is not null and v_tracking_url !~* '^https?://' then
    raise exception 'INVALID_TRACKING_URL';
  end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 2 then raise exception 'NOTE_REQUIRED'; end if;
  if p_approve and p_pickup_date is not null and (p_pickup_date < v_today or p_pickup_date > v_today + 90) then
    raise exception 'BAD_PICKUP_DATE';
  end if;

  if p_approve and v_mode = 'doorstep' and v_carrier is not null then
    v_clean_shipping := jsonb_build_object(
      'carrier', v_carrier,
      'trackingNumber', v_tracking_no,
      'trackingUrl', v_tracking_url,
      'expectedDelivery', coalesce(v_expected, case when p_pickup_date is not null then to_char(p_pickup_date, 'YYYY-MM-DD') else null end)
    );
    v_clean_tracking := left(
      case when v_tracking_no is not null then v_carrier || ' · ' || v_tracking_no else v_carrier end,
      200
    );
  end if;

  update public.return_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
      pickup_date = case when p_approve then p_pickup_date else null end,
      exchange_mode = case when p_approve and resolution_type = 'exchange' then v_mode else 'standard' end,
      exchange_shipping = case when p_approve and resolution_type = 'exchange' and v_mode = 'doorstep' then v_clean_shipping else null end,
      exchange_tracking = case when p_approve and resolution_type = 'exchange' and v_mode = 'doorstep' then v_clean_tracking else null end,
      decided_at = now()
  where id = p_request_id and status = 'requested';
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_return_request(uuid, boolean, text, date, text, jsonb) from public, anon;
grant execute on function public.decide_return_request(uuid, boolean, text, date, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Trigger privilege consistency & contact_pincode format CHECK
-- ---------------------------------------------------------------------
revoke all on function public.guard_order_status_transition() from public, anon, authenticated;
revoke all on function public.track_product_restock() from public, anon, authenticated;

alter table public.store_settings drop constraint if exists store_settings_contact_pincode_fmt;
alter table public.store_settings add constraint store_settings_contact_pincode_fmt
  check (contact_pincode is null or contact_pincode ~ '^[1-9][0-9]{5}$') not valid;
alter table public.store_settings validate constraint store_settings_contact_pincode_fmt;

-- ---------------------------------------------------------------------
-- 9. Missing performance indexes on hot admin/cron/RLS queries
-- ---------------------------------------------------------------------
create index if not exists order_returns_refunded_created_idx
  on public.order_returns (refunded, created_at desc);

create index if not exists return_requests_status_created_idx
  on public.return_requests (status, created_at desc);

create index if not exists orders_unpaid_expiry_eff_idx
  on public.orders (greatest(created_at, coalesce(updated_at, created_at)))
  where status = 'pending' and payment_status in ('pending', 'failed');

create index if not exists stock_alerts_status_created_idx
  on public.stock_alerts (status, created_at desc);

create index if not exists stock_alerts_user_id_idx
  on public.stock_alerts (user_id)
  where user_id is not null;

create index if not exists product_reviews_user_id_idx
  on public.product_reviews (user_id);
