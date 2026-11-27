-- =====================================================================
-- 0074: Full-Repository Deep Audit Hardening (Security, Stock, Variants, Refunds)
--
-- Fixes included:
--   1. Per-variant JSONB stock restoration in restock_cancelled_order(),
--      admin_reset_data(), and record_order_return() (plus exchange deduction).
--   2. Reject non-null variantId on non-variant products in create_order().
--   3. Remove auth.users.updated_at bypass from set_admin_pin(),
--      disable_admin_pin(), and clear_admin_pin_lock() (fresh sign-in only).
--   4. Variant-aware unit pricing in record_order_return() and
--      return_items_value() (prevents MAX(price) overpayment on multi-variant orders).
--   6. Enforce 5-strike guest lockout via find_order_for_guest() in
--      get_order_for_gateway().
--   8. DB-level rate limit + guest-row protection in subscribe_stock_alert().
--   9. Gate is_admin_email() behind p_server_secret (prevents anon enumeration).
--  10. Return cumulative v_new_ref as refundedAmount in record_order_return().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. create_order: reject non-null variantId on non-variant products
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_customer       jsonb,
  p_items          jsonb,
  p_prefix         text default 'KK',
  p_promo_code     text default null,
  p_expected_total numeric default null
)
returns table (
  order_code            text,
  subtotal              numeric,
  shipping_fee          numeric,
  shipping_fee_original numeric,
  extra_fees            jsonb,
  discount_amount       numeric,
  promo_code            text,
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
  v_expected_lines  int;
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
  v_promo_input     text := nullif(upper(btrim(coalesce(p_promo_code, ''))), '');
  v_promo           public.promo_codes;
  v_discount        numeric(10,2) := 0;
  v_applied_code    text := null;
  v_today           date := (now() at time zone 'Asia/Kolkata')::date;
  v_total           numeric(10,2);
  v_code            text;
  v_prefix          text;
  v_bytes           bytea;
  v_alphabet        text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i                 int;
  r_var             record;
begin
  if auth.uid() is not null and exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.deactivated_at is not null
  ) then
    raise exception 'ACCOUNT_DEACTIVATED';
  end if;

  if auth.uid() is null and not public.check_rate_limit('create-order-ip', public.internal_rate_key('create-order-ip')) then
    raise exception 'TOO_MANY_ORDERS';
  end if;

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

  perform p.id from public.products p
  where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(p_items) e)
  order by p.id
  for update;

  select * into v_settings from public.store_settings limit 1;

  with raw as (
    select
      (e ->> 'productId')::uuid as product_id,
      nullif(btrim(coalesce(e ->> 'variantId', '')), '') as variant_id,
      (e ->> 'quantity')::int as qty
    from jsonb_array_elements(p_items) e
  ), merged as (
    select product_id, variant_id, sum(qty)::int as qty
    from raw
    group by product_id, variant_id
  ), resolved as (
    select
      m.product_id,
      m.variant_id,
      m.qty,
      p.id as found_id,
      p.is_active,
      p.name as product_name,
      p.slug,
      p.images,
      p.shipping_class,
      p.weight_grams,
      p.return_window_days,
      (jsonb_typeof(p.variants) = 'array' and jsonb_array_length(p.variants) > 0) as has_variants,
      (
        select v
        from jsonb_array_elements(case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end) v
        where (v ->> 'id') = m.variant_id
        limit 1
      ) as matched_variant,
      p.price as base_price,
      p.stock as base_stock
    from merged m
    left join public.products p on p.id = m.product_id
  ), priced as (
    select
      r.*,
      case
        when r.has_variants and r.matched_variant is not null then (r.matched_variant ->> 'price')::numeric(10,2)
        else r.base_price
      end as unit_price,
      case
        when r.has_variants and r.matched_variant is not null then coalesce((r.matched_variant ->> 'stock')::int, 0)
        else r.base_stock
      end as avail_stock,
      case
        when r.has_variants and r.matched_variant is not null and nullif(btrim(r.matched_variant ->> 'label'), '') is not null
          then r.product_name || ' — ' || btrim(r.matched_variant ->> 'label')
        else r.product_name
      end as line_name,
      case
        when r.has_variants and r.matched_variant is not null then nullif(btrim(r.matched_variant ->> 'label'), '')
        else null
      end as variant_label,
      (
        r.found_id is not null
        and r.is_active
        and r.qty between 1 and 20
        and (
          (not r.has_variants and r.variant_id is null)
          or (r.has_variants and r.matched_variant is not null)
        )
        and (
          case
            when r.has_variants and r.matched_variant is not null then coalesce((r.matched_variant ->> 'stock')::int, 0)
            else r.base_stock
          end
        ) >= r.qty
      ) as line_ok
    from resolved r
  )
  select
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'productId', pr.found_id,
        'variantId', pr.variant_id,
        'variantLabel', pr.variant_label,
        'name', pr.line_name,
        'slug', pr.slug,
        'price', pr.unit_price,
        'quantity', pr.qty,
        'image', pr.images[1],
        'returnWindowDays', coalesce(pr.return_window_days, v_settings.return_window_days, 7)
      )) order by pr.line_name
    ),
    round(sum(pr.unit_price * pr.qty), 2),
    count(*) filter (where pr.line_ok),
    count(*),
    coalesce(bool_or(pr.shipping_class = 'oversized'), false),
    coalesce(bool_or(pr.shipping_class = 'fragile'), false),
    string_agg(btrim(pr.line_name), ', ' order by lower(btrim(pr.line_name)), btrim(pr.line_name)) filter (where pr.shipping_class = 'oversized' and btrim(pr.line_name) <> ''),
    string_agg(btrim(pr.line_name), ', ' order by lower(btrim(pr.line_name)), btrim(pr.line_name)) filter (where pr.shipping_class = 'fragile' and btrim(pr.line_name) <> ''),
    coalesce(sum(greatest(coalesce(pr.weight_grams, 0), 0)::bigint * pr.qty), 0)
  into
    v_items, v_subtotal, v_count, v_expected_lines,
    v_has_oversized, v_has_fragile, v_oversized_names, v_fragile_names, v_total_weight
  from priced pr;

  if v_count is distinct from v_expected_lines then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  if v_promo_input is not null then
    if v_promo_input !~ '^[A-Z0-9_-]{3,24}$' then
      raise exception 'PROMO_INVALID';
    end if;
    select * into v_promo from public.promo_codes where code = v_promo_input for update;
    if not found or not v_promo.is_active then
      raise exception 'PROMO_INVALID';
    end if;
    if v_promo.expires_at is not null and v_promo.expires_at < v_today then
      raise exception 'PROMO_EXPIRED';
    end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
      raise exception 'PROMO_LIMIT_REACHED';
    end if;
    if v_subtotal < v_promo.min_order_amount then
      raise exception 'PROMO_MIN_ORDER';
    end if;
    v_discount := public.compute_promo_discount(v_promo, v_subtotal);
    if v_discount <= 0 then
      raise exception 'PROMO_MIN_ORDER';
    end if;
    v_applied_code := v_promo.code;

    update public.promo_codes
    set used_count = used_count + 1,
        updated_at = now()
    where id = v_promo.id;
  end if;

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

  v_ship_orig := round(coalesce(v_settings.delivery_fee, 60), 2);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := greatest(round(v_subtotal - v_discount + v_ship + v_fees_sum, 2), 1);

  if p_expected_total is not null and abs(v_total - round(p_expected_total, 2)) > 0.009 then
    raise exception 'PRICE_CHANGED';
  end if;

  v_tax_snapshot := jsonb_build_object(
    'gstEnabled', coalesce(v_settings.gst_registered, false),
    'gstRegistered', coalesce(v_settings.gst_registered, false),
    'gstin', v_settings.gstin,
    'gstRate', coalesce(v_settings.gst_rate, 0),
    'legalName', v_settings.legal_name,
    'businessAddress', v_settings.business_address,
    'shopName', coalesce(v_settings.shop_name, 'Store'),
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
     subtotal, shipping_fee, shipping_fee_original, extra_fees, promo_code, discount_amount, total, stock_reserved, tax_snapshot)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_applied_code, v_discount, v_total, true, v_tax_snapshot);

  -- Deduct per-variant stock for variant-enabled products
  for r_var in
    select
      (e ->> 'productId')::uuid as pid,
      nullif(btrim(coalesce(e ->> 'variantId', '')), '') as vid,
      sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    where nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
    group by 1, 2
  loop
    update public.products p
    set variants = (
      select coalesce(jsonb_agg(
        case
          when (v ->> 'id') = r_var.vid
            then jsonb_set(v, '{stock}', to_jsonb(greatest(coalesce((v ->> 'stock')::int, 0) - r_var.qty, 0)))
          else v
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(p.variants) v
    )
    where p.id = r_var.pid
      and jsonb_typeof(p.variants) = 'array'
      and jsonb_array_length(p.variants) > 0;
  end loop;

  -- Deduct aggregate product stock
  update public.products p set stock = greatest(p.stock - m.qty, 0)
  from (
    select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  ) m
  where p.id = m.pid;

  return query
    select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_discount, v_applied_code, v_total;
end $$;

grant execute on function public.create_order(jsonb, jsonb, text, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. restock_cancelled_order: restore both aggregate & per-variant stock
-- ---------------------------------------------------------------------
create or replace function public.restock_cancelled_order()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r_var record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.stock_reserved and new.stock_restored_at is null then
    perform p.id from public.products p
    where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(new.items) e)
    order by p.id
    for update;

    -- Restore per-variant stock in products.variants JSONB
    for r_var in
      select
        (e ->> 'productId')::uuid as pid,
        nullif(btrim(coalesce(e ->> 'variantId', '')), '') as vid,
        sum((e ->> 'quantity')::int)::int as qty
      from jsonb_array_elements(new.items) e
      where nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
      group by 1, 2
    loop
      update public.products p
      set variants = (
        select coalesce(jsonb_agg(
          case
            when (v ->> 'id') = r_var.vid
              then jsonb_set(v, '{stock}', to_jsonb(least(100000, coalesce((v ->> 'stock')::int, 0) + r_var.qty)))
            else v
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(p.variants) v
      ),
      restocked_at = case
        when exists (
          select 1 from jsonb_array_elements(p.variants) v
          where (v ->> 'id') = r_var.vid and coalesce((v ->> 'stock')::int, 0) = 0
        ) and r_var.qty > 0 then now()
        else p.restocked_at
      end
      where p.id = r_var.pid
        and jsonb_typeof(p.variants) = 'array'
        and jsonb_array_length(p.variants) > 0;
    end loop;

    -- Restore aggregate product stock
    update public.products p
       set stock = least(100000, p.stock + m.qty),
           restocked_at = case when p.stock = 0 and m.qty > 0 then now() else p.restocked_at end
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from jsonb_array_elements(new.items) e group by 1
    ) m
    where p.id = m.pid;

    if new.promo_code is not null then
      update public.promo_codes
         set used_count = greatest(used_count - 1, 0),
             updated_at = now()
       where code = new.promo_code
         and created_at <= new.created_at;
    end if;

    new.stock_restored_at := now();
  end if;
  return new;
end $$;

revoke all on function public.restock_cancelled_order() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. admin_reset_data: restore per-variant stock when resetting orders
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_data(p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_orders int := 0; v_addresses int := 0; v_wishlists int := 0; v_products int := 0; v_categories int := 0;
  v_restock_ids uuid[];
  r_var record;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if 'orders' = any (p_scopes) then
    select coalesce(array_agg(x.id), '{}') into v_restock_ids from (
      select o.id from public.orders o
      where o.stock_reserved and o.stock_restored_at is null
        and o.status <> 'cancelled' and o.status::text <> 'delivered'
      order by o.id
      for update
    ) x;
    perform o.id from public.orders o order by o.id for update;

    perform p.id from public.products p
    where p.id in (
      select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
    )
    order by p.id for update;

    -- Restore per-variant stock
    for r_var in
      select
        (e ->> 'productId')::uuid as pid,
        nullif(btrim(coalesce(e ->> 'variantId', '')), '') as vid,
        sum((e ->> 'quantity')::int)::int as qty
      from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
        and nullif(btrim(coalesce(e ->> 'variantId', '')), '') is not null
      group by 1, 2
    loop
      update public.products p
      set variants = (
        select coalesce(jsonb_agg(
          case
            when (v ->> 'id') = r_var.vid
              then jsonb_set(v, '{stock}', to_jsonb(least(100000, coalesce((v ->> 'stock')::int, 0) + r_var.qty)))
            else v
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(p.variants) v
      )
      where p.id = r_var.pid
        and jsonb_typeof(p.variants) = 'array'
        and jsonb_array_length(p.variants) > 0;
    end loop;

    update public.products p
       set stock = least(100000, p.stock + m.qty)
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
      group by 1
    ) m
    where p.id = m.pid;

    delete from public.order_status_history where true;
    delete from public.orders where true;
    get diagnostics v_orders = row_count;

    update public.promo_codes
       set used_count = 0,
           updated_at = now()
     where used_count > 0;
  end if;

  if 'orders' = any (p_scopes) or 'customers' = any (p_scopes) or 'catalog' = any (p_scopes) then
    delete from public.product_reviews where true;
  end if;

  if 'customers' = any (p_scopes) or 'catalog' = any (p_scopes) then
    delete from public.wishlists where true;
    get diagnostics v_wishlists = row_count;
  end if;

  if 'customers' = any (p_scopes) then
    delete from public.addresses where true;
    get diagnostics v_addresses = row_count;
  end if;

  if 'catalog' = any (p_scopes) then
    delete from public.products where true;
    get diagnostics v_products = row_count;
    delete from public.categories where true;
    get diagnostics v_categories = row_count;
  end if;

  return jsonb_build_object(
    'orders', v_orders, 'addresses', v_addresses, 'wishlists', v_wishlists,
    'products', v_products, 'categories', v_categories
  );
end $$;

revoke all on function public.admin_reset_data(text[]) from public, anon;
grant execute on function public.admin_reset_data(text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 4. return_items_value & record_order_return:
--    - Variant-aware pricing & stock restock/exchange deduction
--    - Cumulative refundedAmount returned (v_new_ref)
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
          nullif(btrim(coalesce(ri ->> 'variantId', '')), '') is null
          or oi ->> 'variantId' = nullif(btrim(coalesce(ri ->> 'variantId', '')), '')
        )
    ), 0)
  ), 0)
  from jsonb_array_elements(p_return_items) ri
$$;

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
             sum(case when coalesce((e ->> 'quantity')::int, 0) >= 1 then (e ->> 'quantity')::int else 0 end) as q
      from jsonb_array_elements(p_items) e
      group by 1
    ) a
    where a.q > coalesce((
      select sum((x ->> 'quantity')::int)
      from public.return_requests r, jsonb_array_elements(r.items) x
      where r.id = p_request_id and x ->> 'productId' = a.pid
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

    -- Exchanges ship out a replacement unit, so deduct 1 unit from shelf stock per exchanged quantity.
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
-- 5. Admin PIN RPCs: remove auth.users.updated_at bypass (fresh sign-in only)
-- ---------------------------------------------------------------------
create or replace function public.set_admin_pin(p_pin text, p_current_pin text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pin        text := btrim(coalesce(p_pin, ''));
  v_cur        text := btrim(coalesce(p_current_pin, ''));
  v_row        public.admins%rowtype;
  v_fresh_auth boolean := false;
  v_attempts   int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits' using errcode = '22023';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid()
   for update;

  if v_row.pin_mode = 'enabled' and v_row.pin_hash is not null then
    select exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.last_sign_in_at > now() - interval '120 seconds'
    ) into v_fresh_auth;

    if not v_fresh_auth then
      if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
        raise exception 'PIN is temporarily locked' using errcode = '42501';
      end if;

      if not (v_cur ~ '^[0-9]{4}$' and v_row.pin_hash = extensions.crypt(v_cur, v_row.pin_hash)) then
        v_attempts := case
          when v_row.pin_locked_until is not null and v_row.pin_locked_until <= now() then 1
          else coalesce(v_row.pin_failed_attempts, 0) + 1
        end;
        update public.admins
           set pin_failed_attempts = v_attempts,
               pin_locked_until    = case when v_attempts >= 5 then now() + interval '10 minutes' else null end
         where user_id = auth.uid();
        raise exception 'Incorrect current PIN' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.admins
     set pin_hash            = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
         pin_mode            = 'enabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

create or replace function public.disable_admin_pin(p_current_pin text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_cur        text := btrim(coalesce(p_current_pin, ''));
  v_row        public.admins%rowtype;
  v_fresh_auth boolean := false;
  v_attempts   int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid()
   for update;

  if v_row.pin_mode = 'enabled' and v_row.pin_hash is not null then
    select exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.last_sign_in_at > now() - interval '120 seconds'
    ) into v_fresh_auth;

    if not v_fresh_auth then
      if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
        raise exception 'PIN is temporarily locked' using errcode = '42501';
      end if;

      if not (v_cur ~ '^[0-9]{4}$' and v_row.pin_hash = extensions.crypt(v_cur, v_row.pin_hash)) then
        v_attempts := case
          when v_row.pin_locked_until is not null and v_row.pin_locked_until <= now() then 1
          else coalesce(v_row.pin_failed_attempts, 0) + 1
        end;
        update public.admins
           set pin_failed_attempts = v_attempts,
               pin_locked_until    = case when v_attempts >= 5 then now() + interval '10 minutes' else null end
         where user_id = auth.uid();
        raise exception 'Incorrect current PIN' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.admins
     set pin_hash            = null,
         pin_mode            = 'disabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

create or replace function public.clear_admin_pin_lock()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_fresh_auth boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.last_sign_in_at > now() - interval '120 seconds'
  ) into v_fresh_auth;

  if not v_fresh_auth then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.admins
     set pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

revoke all on function public.set_admin_pin(text, text) from public, anon;
grant execute on function public.set_admin_pin(text, text) to authenticated;

revoke all on function public.disable_admin_pin(text) from public, anon;
grant execute on function public.disable_admin_pin(text) to authenticated;

revoke all on function public.clear_admin_pin_lock() from public, anon;
grant execute on function public.clear_admin_pin_lock() to authenticated;

-- ---------------------------------------------------------------------
-- 6. get_order_for_gateway: enforce 5-strike guest lockout
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

-- ---------------------------------------------------------------------
-- 7. subscribe_stock_alert: DB-level rate limit + guest-row protection
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
  v_uid         uuid := auth.uid();
  v_product     record;
  v_variant     jsonb;
  v_var_label   text;
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
    -- Only allow the owning signed-in user to update their own row's name; never hijack guest rows.
    update public.stock_alerts
    set customer_name = case
          when v_uid is not null and user_id = v_uid and v_name <> '' then v_name
          else customer_name
        end,
        variant_label = coalesce(v_var_label, variant_label)
    where id = v_existing_id;
    return jsonb_build_object('ok', true, 'alreadySubscribed', true);
  end if;

  insert into public.stock_alerts (product_id, variant_id, variant_label, user_id, customer_name, phone, status)
  values (p_product_id, v_variant_id, v_var_label, v_uid, v_name, v_phone, 'waiting');

  return jsonb_build_object('ok', true, 'alreadySubscribed', false);
end $$;

revoke all on function public.subscribe_stock_alert(uuid, text, text, text) from public;
grant execute on function public.subscribe_stock_alert(uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. is_admin_email: gate behind p_server_secret (prevents anon enumeration)
-- ---------------------------------------------------------------------
drop function if exists public.is_admin_email(text);

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

    if v_hash is not null and v_hash <> '' then
      if not public._assert_email_rpc_secret(v_hash, p_server_secret) then
        raise exception 'FORBIDDEN' using errcode = '42501';
      end if;
    elsif p_server_secret is null or char_length(p_server_secret) < 16 then
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
