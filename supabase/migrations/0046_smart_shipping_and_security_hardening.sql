-- =====================================================================
-- 0046 Smart E-Commerce Shipping & Security Hardening (idempotent)
--
-- 1. Intelligent property-driven shipping & handling architecture:
--    * products.weight_grams (0..50000) & products.shipping_class ('standard' | 'fragile' | 'oversized')
--    * store_settings.fragile_fee, oversized_fee, free_weight_grams, extra_weight_fee_per_kg
--    * create_order computes order-level handling (highest applicable tier once per order, never multiplied
--      by quantity) + heavy-parcel courier slabs across total cart weight, matching src/features/orders/pricing.ts.
-- 2. Immutable invoice tax & seller snapshot:
--    * orders.tax_snapshot captures GST registration, GSTIN, GST rate and seller details at order creation
--      (automatically frozen on delivered/cancelled orders by 0023 orders_lock_finished).
-- 3. RPC & trigger security hardening:
--    * request_return sums duplicate productId lines via v_inflight so split lines cannot exceed ordered qty.
--    * withdraw_return_request requires full 10-digit phone verification (p_strict = true) for guests.
--    * submit_payment prevents unauthenticated callers from overwriting an already-submitted UTR on orders
--      owned by a signed-in account.
--    * guard_payment_status locks payment_amount / payment_paid_at / payment_reference on ANY refunded order
--      (including shipped orders), not just delivered/cancelled ones.
--    * revert_order_status allows 1-step admin fulfilment revert (delivered -> shipped -> packed -> confirmed -> pending)
--      and cleans ahead entries from order_status_history.
--    * expire_unpaid_orders measures the expiry window from greatest(created_at, updated_at) so orders with a
--      rejected UTR get a full fresh window to resubmit before auto-cancellation.
-- =====================================================================

-- 1. Product physical & handling attributes ---------------------------
alter table public.products
  add column if not exists weight_grams int not null default 0,
  add column if not exists shipping_class text not null default 'standard';

alter table public.products drop constraint if exists products_weight_grams_range;
alter table public.products add constraint products_weight_grams_range
  check (weight_grams between 0 and 50000);

alter table public.products drop constraint if exists products_shipping_class_valid;
alter table public.products add constraint products_shipping_class_valid
  check (shipping_class in ('standard', 'fragile', 'oversized'));

-- 2. Centralised store shipping & handling rules ----------------------
alter table public.store_settings
  add column if not exists fragile_fee numeric(10,2) not null default 30,
  add column if not exists oversized_fee numeric(10,2) not null default 80,
  add column if not exists free_weight_grams int not null default 1000,
  add column if not exists extra_weight_fee_per_kg numeric(10,2) not null default 40;

alter table public.store_settings drop constraint if exists store_settings_fragile_fee_range;
alter table public.store_settings add constraint store_settings_fragile_fee_range
  check (fragile_fee between 0 and 10000);

alter table public.store_settings drop constraint if exists store_settings_oversized_fee_range;
alter table public.store_settings add constraint store_settings_oversized_fee_range
  check (oversized_fee between 0 and 10000);

alter table public.store_settings drop constraint if exists store_settings_free_weight_grams_range;
alter table public.store_settings add constraint store_settings_free_weight_grams_range
  check (free_weight_grams between 0 and 50000);

alter table public.store_settings drop constraint if exists store_settings_extra_weight_fee_range;
alter table public.store_settings add constraint store_settings_extra_weight_fee_range
  check (extra_weight_fee_per_kg between 0 and 10000);

-- 3. Immutable seller & GST snapshot on orders ------------------------
alter table public.orders
  add column if not exists tax_snapshot jsonb;

-- 4. Deterministic weight label helper (matches formatWeightGrams in TS)
create or replace function public.format_weight_grams(p_grams bigint)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when greatest(coalesce(p_grams, 0), 0) >= 1000 then
      trim_scale(round(greatest(coalesce(p_grams, 0), 0)::numeric / 1000, 2))::text || ' kg'
    else
      greatest(coalesce(p_grams, 0), 0)::text || ' g'
  end
$$;

revoke all on function public.format_weight_grams(bigint) from public, anon, authenticated;

-- 5. create_order: smart property-based charges + tax_snapshot --------
create or replace function public.create_order(p_customer jsonb, p_items jsonb, p_prefix text default 'KK')
returns table (
  order_code            text,
  subtotal              numeric,
  shipping_fee          numeric,
  shipping_fee_original numeric,
  extra_fees            jsonb,
  total                 numeric
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name            text := btrim(p_customer ->> 'name');
  v_phone           text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address         text := btrim(p_customer ->> 'address');
  v_city            text := btrim(p_customer ->> 'city');
  v_pincode         text := btrim(p_customer ->> 'pincode');
  v_note            text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
  v_items           jsonb;
  v_subtotal        numeric(10,2);
  v_count           int;
  v_fees            jsonb := '[]'::jsonb;
  v_fees_sum        numeric(10,2) := 0;
  v_has_oversized   boolean := false;
  v_has_fragile     boolean := false;
  v_oversized_names text;
  v_fragile_names   text;
  v_oversized_amt   numeric(10,2);
  v_fragile_amt     numeric(10,2);
  v_total_weight    bigint := 0;
  v_free_weight     bigint;
  v_weight_rate     numeric(10,2);
  v_extra_kg        int;
  v_weight_amt      numeric(10,2);
  v_settings        public.store_settings;
  v_tax_snapshot    jsonb;
  v_ship_orig       numeric(10,2);
  v_ship            numeric(10,2);
  v_total           numeric(10,2);
  v_code            text;
  v_prefix          text;
  v_bytes           bytea;
  v_alphabet        text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i                 int;
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0'  then v_phone := right(v_phone, 10); end if;

  if v_name is null or char_length(v_name) not between 2 and 80 then raise exception 'INVALID_NAME'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'INVALID_PHONE'; end if;
  if v_address is null or char_length(v_address) not between 5 and 300 then raise exception 'INVALID_ADDRESS'; end if;
  if v_city is null or char_length(v_city) not between 2 and 60 then raise exception 'INVALID_CITY'; end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'INVALID_PINCODE'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'INVALID_NOTE'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'INVALID_ITEMS';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e -> 'productId') is distinct from 'string'
       or (e ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(e -> 'quantity') is distinct from 'number'
  ) then
    raise exception 'INVALID_ITEMS';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where (e ->> 'quantity')::numeric not between 1 and 20
       or (e ->> 'quantity')::numeric <> floor((e ->> 'quantity')::numeric)
  ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Spam guard: at most 5 unpaid orders per phone number (10 per signed-in account) per hour.
  if (
    select count(*) from public.orders o
    where o.phone = v_phone and o.created_at > now() - interval '1 hour'
      and o.payment_status = 'pending' and o.status <> 'cancelled'
  ) >= 5 then
    raise exception 'TOO_MANY_ORDERS';
  end if;
  if auth.uid() is not null and (
    select count(*) from public.orders o
    where o.user_id = auth.uid() and o.created_at > now() - interval '1 hour'
      and o.payment_status = 'pending' and o.status <> 'cancelled'
  ) >= 10 then
    raise exception 'TOO_MANY_ORDERS';
  end if;

  -- Lock products in deterministic id order so concurrent orders cannot deadlock or oversell.
  perform p.id from public.products p
  where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(p_items) e)
  order by p.id
  for update;

  with raw as (
    select (e ->> 'productId')::uuid as product_id, (e ->> 'quantity')::int as qty
    from jsonb_array_elements(p_items) e
  ), merged as (
    select product_id, sum(qty)::int as qty from raw group by product_id
  )
  select
    jsonb_agg(jsonb_build_object(
      'productId', p.id, 'name', p.name, 'slug', p.slug, 'price', p.price,
      'quantity', m.qty, 'image', p.images[1]
    ) order by p.name),
    round(sum(p.price * m.qty), 2),
    count(*) filter (where p.id is not null and p.is_active and m.qty between 1 and 20 and p.stock >= m.qty),
    coalesce(bool_or(p.shipping_class = 'oversized'), false),
    coalesce(bool_or(p.shipping_class = 'fragile'), false),
    string_agg(btrim(p.name), ', ' order by lower(btrim(p.name)), btrim(p.name)) filter (where p.shipping_class = 'oversized' and btrim(p.name) <> ''),
    string_agg(btrim(p.name), ', ' order by lower(btrim(p.name)), btrim(p.name)) filter (where p.shipping_class = 'fragile' and btrim(p.name) <> ''),
    coalesce(sum(greatest(coalesce(p.weight_grams, 0), 0)::bigint * m.qty), 0)
  into
    v_items, v_subtotal, v_count,
    v_has_oversized, v_has_fragile, v_oversized_names, v_fragile_names, v_total_weight
  from merged m
  left join public.products p on p.id = m.product_id;

  if v_count is distinct from (select count(distinct (e ->> 'productId')) from jsonb_array_elements(p_items) e) then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  select * into v_settings from public.store_settings limit 1;

  -- Rule A: Special handling tier (highest applicable tier ONCE per order, never compounded per item/qty).
  v_oversized_amt := case when v_has_oversized then round(coalesce(v_settings.oversized_fee, 80), 2) else 0 end;
  v_fragile_amt   := case when v_has_fragile   then round(coalesce(v_settings.fragile_fee, 30), 2)   else 0 end;

  if v_oversized_amt > 0 and v_oversized_amt >= v_fragile_amt then
    v_fees := v_fees || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'label', 'Large / bulky item handling',
        'amount', v_oversized_amt,
        'productName', v_oversized_names,
        'reason', 'Special courier handling & protective packing for large items'
      ))
    );
    v_fees_sum := v_fees_sum + v_oversized_amt;
  elsif v_fragile_amt > 0 then
    v_fees := v_fees || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'label', 'Fragile item packaging',
        'amount', v_fragile_amt,
        'productName', v_fragile_names,
        'reason', 'Protective bubble & box cushioning for fragile items'
      ))
    );
    v_fees_sum := v_fees_sum + v_fragile_amt;
  end if;

  -- Rule B: Heavy parcel courier slab across total cart weight (sum(weight_grams * qty)).
  v_free_weight := greatest(coalesce(v_settings.free_weight_grams, 1000), 0);
  v_weight_rate := round(coalesce(v_settings.extra_weight_fee_per_kg, 40), 2);

  if v_weight_rate > 0 and v_total_weight > v_free_weight then
    v_extra_kg := ceil((v_total_weight - v_free_weight)::numeric / 1000)::int;
    v_weight_amt := round(v_extra_kg * v_weight_rate, 2);
    if v_weight_amt > 0 then
      v_fees := v_fees || jsonb_build_array(
        jsonb_build_object(
          'label', 'Heavy parcel surcharge',
          'amount', v_weight_amt,
          'reason', case
            when v_free_weight > 0 then
              'Total parcel weight ' || public.format_weight_grams(v_total_weight)
              || ' (' || v_extra_kg::text || ' kg above ' || public.format_weight_grams(v_free_weight) || ' included)'
            else
              'Total parcel weight ' || public.format_weight_grams(v_total_weight)
              || ' (' || v_extra_kg::text || ' kg courier slab)'
          end
        )
      );
      v_fees_sum := v_fees_sum + v_weight_amt;
    end if;
  end if;

  -- Standard delivery + free-delivery threshold waiver.
  v_ship_orig := round(coalesce(v_settings.delivery_fee, 60), 2);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := round(v_subtotal + v_ship + v_fees_sum, 2);

  -- Snapshot seller & GST details so historical invoices never drift when settings change later.
  v_tax_snapshot := jsonb_build_object(
    'gstRegistered', coalesce(v_settings.gst_registered, false),
    'gstin', v_settings.gstin,
    'gstRate', coalesce(v_settings.gst_rate, 0),
    'legalName', v_settings.legal_name,
    'businessAddress', v_settings.business_address,
    'shopName', coalesce(v_settings.shop_name, 'Kalakriti'),
    'city', v_settings.contact_city,
    'region', v_settings.contact_region,
    'phone', case when coalesce(v_settings.phone_same_as_whatsapp, true) then null else v_settings.contact_phone end,
    'whatsappNumber', v_settings.whatsapp_number,
    'email', v_settings.contact_email
  );

  v_prefix := coalesce(nullif(v_settings.order_code_prefix, ''), 'KK');

  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := v_prefix || '-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i - 1) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.order_code = v_code);
  end loop;

  insert into public.orders
    (order_code, user_id, customer_name, phone, address, city, pincode, note, items,
     subtotal, shipping_fee, shipping_fee_original, extra_fees, total, stock_reserved, tax_snapshot)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_total, true, v_tax_snapshot);

  -- Reserve stock.
  update public.products p set stock = p.stock - m.qty
  from (
    select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  ) m
  where p.id = m.pid;

  return query select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to anon, authenticated;

-- 6. request_return: prevent split-line over-return via v_inflight ----
create or replace function public.request_return(
  p_code text, p_phone_last4 text, p_items jsonb, p_reason text, p_details text
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
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
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

revoke all on function public.request_return(text, text, jsonb, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text) to anon, authenticated;

-- 7. withdraw_return_request: require full 10-digit phone for guests --
drop function if exists public.withdraw_return_request(text, text, uuid);

create or replace function public.withdraw_return_request(
  p_code text, p_phone_last4 text, p_request_id uuid, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_state text;
begin
  -- Signed-in owners match auth.uid() automatically; guests must prove the full 10-digit mobile number.
  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  update public.return_requests set status = 'withdrawn'
  where id = p_request_id and order_id = v_id and status = 'requested';
  if not found then raise exception 'CANNOT_WITHDRAW'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.withdraw_return_request(text, text, uuid, text) from public;
grant execute on function public.withdraw_return_request(text, text, uuid, text) to anon, authenticated;

-- 8. submit_payment: protect signed-in owner's already-submitted UTR --
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

  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;
  if v_order.payment_status = 'submitted'
     and v_order.user_id is not null
     and auth.uid() is distinct from v_order.user_id then
    raise exception 'ALREADY_SUBMITTED';
  end if;

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

-- 9. guard_payment_status: lock money trail on ALL refunded orders ----
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
       or new.payment_reference is distinct from old.payment_reference then
      raise exception 'PAYMENT_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

-- 10. revert_order_status: 1-step fulfilment revert & clean timeline history --
create or replace function public.lock_finished_orders()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_mutable constant text[] := array[
    'payment_status', 'payment_method', 'payment_reference', 'payment_amount',
    'payment_submitted_at', 'payment_paid_at', 'payment_note',
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

create or replace function public.revert_order_status(
  p_order_id uuid,
  p_expected_status public.order_status,
  p_to_status public.order_status,
  p_clear_shipping boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_Clear text[];
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if not (
    (p_expected_status = 'delivered' and p_to_status = 'shipped') or
    (p_expected_status = 'shipped'   and p_to_status = 'packed') or
    (p_expected_status = 'packed'    and p_to_status = 'confirmed') or
    (p_expected_status = 'confirmed' and p_to_status = 'pending')
  ) then
    raise exception 'CANNOT_UNDO';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;

  if p_expected_status = 'delivered' then
    if v_order.payment_status = 'refunded' or coalesce(v_order.refunded_amount, 0) > 0 then
      raise exception 'CANNOT_UNDO';
    end if;
    if exists (select 1 from public.return_requests where order_id = p_order_id)
       or exists (select 1 from public.order_returns where order_id = p_order_id) then
      raise exception 'CANNOT_UNDO';
    end if;
    perform set_config('app.allow_delivered_revert', 'on', true);
  end if;

  update public.orders
  set status = p_to_status,
      shipping_carrier  = case when p_expected_status = 'shipped' and p_clear_shipping then null else shipping_carrier end,
      tracking_number   = case when p_expected_status = 'shipped' and p_clear_shipping then null else tracking_number end,
      tracking_url      = case when p_expected_status = 'shipped' and p_clear_shipping then null else tracking_url end,
      expected_delivery = case when p_expected_status = 'shipped' and p_clear_shipping then null else expected_delivery end
  where id = p_order_id;

  -- Remove history entries for steps ahead of p_to_status so customer timeline stays clean
  v_Clear := case p_to_status
    when 'shipped'   then array['delivered']
    when 'packed'    then array['shipped', 'delivered']
    when 'confirmed' then array['packed', 'shipped', 'delivered']
    when 'pending'   then array['confirmed', 'packed', 'shipped', 'delivered']
    else array[]::text[]
  end;

  delete from public.order_status_history
  where order_id = p_order_id and status::text = any(v_Clear);

  return jsonb_build_object('ok', true, 'status', p_to_status);
end $$;

revoke all on function public.revert_order_status(uuid, public.order_status, public.order_status, boolean) from public, anon;
grant execute on function public.revert_order_status(uuid, public.order_status, public.order_status, boolean) to authenticated;

-- 11. expire_unpaid_orders: measure deadline from greatest(created_at, updated_at) so rejected payments get a fresh window --
create or replace function public.expire_unpaid_orders()
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_hours int;
  v_ids   uuid[];
  v_count int;
begin
  select unpaid_order_expiry_hours into v_hours from public.store_settings limit 1;
  if coalesce(v_hours, 0) <= 0 then return 0; end if;

  select coalesce(array_agg(x.id), '{}') into v_ids from (
    select o.id from public.orders o
    where o.status = 'pending' and o.payment_status in ('pending', 'failed')
      and greatest(o.created_at, coalesce(o.updated_at, o.created_at)) < now() - make_interval(hours => v_hours)
    order by o.id
    for update skip locked
  ) x;
  if cardinality(v_ids) = 0 then return 0; end if;

  perform p.id from public.products p
  where p.id in (
    select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e where o.id = any (v_ids)
  )
  order by p.id for update;

  update public.orders
  set status = 'cancelled',
      cancel_reason = 'Payment not received in time',
      cancelled_by = 'system',
      cancelled_at = now()
  where id = any (v_ids)
    and status = 'pending' and payment_status in ('pending', 'failed');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
