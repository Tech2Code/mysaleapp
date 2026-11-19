-- =====================================================================
-- 0053: Promo Codes & Discount Coupons System
--  1. public.promo_codes table with RLS (admin-managed; customer validation via RPC).
--  2. public.orders.promo_code and public.orders.discount_amount columns.
--  3. public.compute_promo_discount & public.validate_promo_code RPCs.
--  4. Updated public.create_order (supports p_promo_code, atomic validation + usage increment).
--  5. Updated public.restock_cancelled_order (restores promo code usage count on order cancellation).
--  6. Updated public.track_order (returns promoCode and discountAmount).
-- =====================================================================

-- 1. Promo codes table ------------------------------------------------
create table if not exists public.promo_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  description         text,
  discount_type       text not null check (discount_type in ('percent', 'flat')),
  discount_value      numeric(10,2) not null check (discount_value > 0),
  min_order_amount    numeric(10,2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount numeric(10,2) check (max_discount_amount is null or max_discount_amount > 0),
  max_uses            int check (max_uses is null or max_uses > 0),
  used_count          int not null default 0 check (used_count >= 0),
  is_active           boolean not null default true,
  expires_at          date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint promo_codes_code_format_chk check (code ~ '^[A-Z0-9_-]{3,24}$'),
  constraint promo_codes_percent_range_chk check (discount_type <> 'percent' or (discount_value >= 1 and discount_value <= 90))
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);

alter table public.promo_codes enable row level security;

drop policy if exists "promo_codes_admin_all" on public.promo_codes;
create policy "promo_codes_admin_all"
  on public.promo_codes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Add promo_code & discount_amount to public.orders ----------------
alter table public.orders
  add column if not exists promo_code      text,
  add column if not exists discount_amount numeric(10,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_discount_amount_non_negative_chk'
  ) then
    alter table public.orders
      add constraint orders_discount_amount_non_negative_chk check (discount_amount >= 0);
  end if;
end $$;

-- 3. Discount calculation & validation RPCs ---------------------------
create or replace function public.compute_promo_discount(
  p_promo public.promo_codes,
  p_subtotal numeric
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_sub numeric(10,2) := greatest(round(coalesce(p_subtotal, 0), 2), 0);
  v_raw numeric(10,2) := 0;
begin
  if v_sub <= 1 then
    return 0;
  end if;

  if p_promo.discount_type = 'percent' then
    v_raw := round((v_sub * p_promo.discount_value) / 100.0, 2);
    if p_promo.max_discount_amount is not null and v_raw > p_promo.max_discount_amount then
      v_raw := round(p_promo.max_discount_amount, 2);
    end if;
  else
    v_raw := round(p_promo.discount_value, 2);
  end if;

  -- Never allow discount to reduce items subtotal below ₹1 so UPI payment always has a positive payable amount
  return greatest(least(v_raw, round(v_sub - 1, 2)), 0);
end $$;

revoke all on function public.compute_promo_discount(public.promo_codes, numeric) from public, anon, authenticated;

create or replace function public.validate_promo_code(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_sub      numeric(10,2) := greatest(round(coalesce(p_subtotal, 0), 2), 0);
  v_promo    public.promo_codes;
  v_discount numeric(10,2);
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_code = '' or v_code !~ '^[A-Z0-9_-]{3,24}$' then
    return jsonb_build_object('ok', false, 'error', 'PROMO_INVALID');
  end if;

  select * into v_promo from public.promo_codes where code = v_code;
  if not found or not v_promo.is_active then
    return jsonb_build_object('ok', false, 'error', 'PROMO_INVALID');
  end if;

  if v_promo.expires_at is not null and v_promo.expires_at < v_today then
    return jsonb_build_object('ok', false, 'error', 'PROMO_EXPIRED');
  end if;

  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('ok', false, 'error', 'PROMO_LIMIT_REACHED');
  end if;

  if v_sub < v_promo.min_order_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'PROMO_MIN_ORDER',
      'minOrderAmount', v_promo.min_order_amount
    );
  end if;

  v_discount := public.compute_promo_discount(v_promo, v_sub);
  if v_discount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'PROMO_MIN_ORDER', 'minOrderAmount', greatest(v_promo.min_order_amount, 2));
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_promo.code,
    'description', v_promo.description,
    'discountType', v_promo.discount_type,
    'discountValue', v_promo.discount_value,
    'minOrderAmount', v_promo.min_order_amount,
    'maxDiscountAmount', v_promo.max_discount_amount,
    'discountAmount', v_discount
  );
end $$;

revoke all on function public.validate_promo_code(text, numeric) from public;
grant execute on function public.validate_promo_code(text, numeric) to anon, authenticated;

-- 4. Update create_order with optional p_promo_code -------------------
drop function if exists public.create_order(jsonb, jsonb, text);
drop function if exists public.create_order(jsonb, jsonb, text, text);

create or replace function public.create_order(
  p_customer   jsonb,
  p_items      jsonb,
  p_prefix     text default 'KK',
  p_promo_code text default null
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

  -- Validate and lock promo code if provided.
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

  -- Standard delivery + free-delivery threshold waiver (evaluated against items subtotal).
  v_ship_orig := round(coalesce(v_settings.delivery_fee, 60), 2);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := greatest(round(v_subtotal - v_discount + v_ship + v_fees_sum, 2), 1);

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
     subtotal, shipping_fee, shipping_fee_original, extra_fees, promo_code, discount_amount, total, stock_reserved, tax_snapshot)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_applied_code, v_discount, v_total, true, v_tax_snapshot);

  -- Reserve stock.
  update public.products p set stock = p.stock - m.qty
  from (
    select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  ) m
  where p.id = m.pid;

  return query select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_discount, v_applied_code, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;

-- 5. Release promo code usage count when an order is cancelled --------
create or replace function public.restock_cancelled_order()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.stock_reserved and new.stock_restored_at is null then
    perform p.id from public.products p
    where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(new.items) e)
    order by p.id
    for update;

    update public.products p set stock = p.stock + m.qty
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from jsonb_array_elements(new.items) e group by 1
    ) m
    where p.id = m.pid;

    if new.promo_code is not null then
      update public.promo_codes
      set used_count = greatest(used_count - 1, 0),
          updated_at = now()
      where code = new.promo_code;
    end if;

    new.stock_restored_at := now();
  end if;
  return new;
end $$;

revoke all on function public.restock_cancelled_order() from public, anon, authenticated;

-- 6. Include promoCode and discountAmount in track_order --------------
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
    'promoCode', v_order.promo_code,
    'discountAmount', v_order.discount_amount,
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
