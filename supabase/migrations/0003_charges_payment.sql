-- =====================================================================
-- Delivery charges, per-product extra charges (handling etc.), and payment info.
--  * store_settings : one row with the delivery fee + "free delivery above" amount
--  * products.fees  : extra charges added per item, e.g. [{"label":"Handling charge","amount":20}]
--  * orders         : stores the full price breakdown and payment status/method
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Store settings (single row)
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id                  boolean primary key default true check (id),
  delivery_fee        numeric(10,2) not null default 60  check (delivery_fee >= 0),
  -- 0 means "never free"
  free_delivery_above numeric(10,2) not null default 999 check (free_delivery_above >= 0),
  updated_at          timestamptz not null default now()
);
insert into public.store_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

alter table public.store_settings enable row level security;
drop policy if exists "settings read" on public.store_settings;
create policy "settings read" on public.store_settings for select using (true);
drop policy if exists "settings admin write" on public.store_settings;
create policy "settings admin write" on public.store_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Per-product extra charges (charged per unit ordered)
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists fees jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_fees_valid;
alter table public.products add constraint products_fees_valid
  check (jsonb_typeof(fees) = 'array' and jsonb_array_length(fees) <= 5);

-- ---------------------------------------------------------------------
-- Orders: price breakdown + payment
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists shipping_fee          numeric(10,2) not null default 0 check (shipping_fee >= 0),
  -- what delivery would have cost before a free-delivery waiver (for the strike-through in the UI)
  add column if not exists shipping_fee_original numeric(10,2) not null default 0 check (shipping_fee_original >= 0),
  add column if not exists extra_fees            jsonb not null default '[]'::jsonb,
  add column if not exists total                 numeric(10,2),
  add column if not exists payment_status        text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded')),
  add column if not exists payment_method        text
    check (payment_method is null or payment_method in ('upi', 'cod', 'bank_transfer', 'card', 'cash', 'other'));

-- Existing orders had no extra charges, so their total is the items subtotal.
update public.orders set total = subtotal where total is null;
alter table public.orders alter column total set not null;

-- ---------------------------------------------------------------------
-- create_order: now also calculates delivery + extra charges (server-side, authoritative)
-- ---------------------------------------------------------------------
drop function if exists public.create_order(jsonb, jsonb, text);

create or replace function public.create_order(p_customer jsonb, p_items jsonb, p_prefix text default 'KK')
returns table (
  order_code            text,
  subtotal              numeric,
  shipping_fee          numeric,
  shipping_fee_original numeric,
  extra_fees            jsonb,
  total                 numeric
)
language plpgsql security definer set search_path = public
as $$
declare
  v_name     text := btrim(p_customer ->> 'name');
  v_phone    text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address  text := btrim(p_customer ->> 'address');
  v_city     text := btrim(p_customer ->> 'city');
  v_pincode  text := btrim(p_customer ->> 'pincode');
  v_note     text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
  v_items    jsonb;
  v_subtotal numeric(10,2);
  v_count    int;
  v_fees     jsonb;
  v_fees_sum numeric(10,2);
  v_settings public.store_settings;
  v_ship_orig numeric(10,2);
  v_ship     numeric(10,2);
  v_total    numeric(10,2);
  v_code     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  -- normalise +91 / 0 prefixed numbers to 10 digits
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
    where jsonb_typeof(e -> 'quantity') <> 'number' or (e ->> 'quantity')::numeric not between 1 and 20
       or (e ->> 'quantity')::numeric <> floor((e ->> 'quantity')::numeric)
  ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- merge duplicate lines, validate availability, join live product data
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
    sum(p.price * m.qty),
    count(*) filter (where p.id is not null and p.is_active and m.qty between 1 and 20 and p.stock >= m.qty)
  into v_items, v_subtotal, v_count
  from merged m
  left join public.products p on p.id = m.product_id;

  if v_count is distinct from (select count(distinct (e ->> 'productId')) from jsonb_array_elements(p_items) e) then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  -- extra charges (handling etc.): each product's fees x quantity, merged by charge name
  select
    coalesce(jsonb_agg(jsonb_build_object('label', s.charge_label, 'amount', s.charge_amount) order by s.charge_label), '[]'::jsonb),
    coalesce(sum(s.charge_amount), 0)
  into v_fees, v_fees_sum
  from (
    select
      f ->> 'label' as charge_label,
      round(sum(coalesce(nullif(f ->> 'amount', '')::numeric, 0) * m.line_qty), 2) as charge_amount
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int) as line_qty
      from jsonb_array_elements(p_items) e
      group by 1
    ) m
    join public.products p on p.id = m.pid
    cross join lateral jsonb_array_elements(p.fees) f
    where nullif(btrim(f ->> 'label'), '') is not null
    group by f ->> 'label'
  ) s
  where s.charge_amount > 0;

  -- delivery: flat fee, waived above the free-delivery amount
  select * into v_settings from public.store_settings limit 1;
  v_ship_orig := coalesce(v_settings.delivery_fee, 60);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := v_subtotal + v_ship + v_fees_sum;

  -- short, human-friendly, non-sequential code: KK-7F3K9Q
  loop
    v_code := upper(coalesce(nullif(btrim(p_prefix), ''), 'KK')) || '-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.order_code = v_code);
  end loop;

  insert into public.orders
    (order_code, user_id, customer_name, phone, address, city, pincode, note, items,
     subtotal, shipping_fee, shipping_fee_original, extra_fees, total)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_total);

  return query select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- track_order: now also returns the price breakdown and payment info
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if p_phone_last4 !~ '^[0-9]{4}$' then return null; end if;

  select * into v_order from public.orders
  where order_code = upper(btrim(p_code)) and right(phone, 4) = p_phone_last4;

  if not found then return null; end if;

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
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'shipping', case
      when v_order.shipping_carrier is null then null
      else jsonb_build_object(
        'carrier', v_order.shipping_carrier,
        'trackingNumber', v_order.tracking_number,
        'trackingUrl', v_order.tracking_url,
        'expectedDelivery', v_order.expected_delivery
      )
    end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
