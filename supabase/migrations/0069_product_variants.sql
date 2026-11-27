-- 0069: Product Variants (Size / Colour / Capacity / Pack) — Universal Multi-Category Support
-- Backward-compatible: products.variants defaults to '[]'::jsonb so all existing single-SKU products work identically.

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb;

-- Update create_order to support optional variantId on cart lines while keeping single-SKU products 100% identical.
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
        and (not r.has_variants or r.matched_variant is not null)
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

  -- Deduct aggregate product stock (always kept in sync with sum of variants for multi-variant products)
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
