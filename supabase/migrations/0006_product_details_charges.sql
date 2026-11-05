-- =====================================================================
--  * products: short summary, highlights, specifications, care instructions
--  * store_settings: "calling number is the same as WhatsApp" toggle
--  * create_order: per-product charges are added ONCE per product (not × quantity) and are saved
--    per product with the reason, so customers see which product a charge belongs to and why.
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Product details
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists short_description text,
  add column if not exists highlights        jsonb not null default '[]'::jsonb,
  add column if not exists specs             jsonb not null default '[]'::jsonb,
  add column if not exists care_instructions text;

alter table public.products drop constraint if exists products_details_valid;
alter table public.products add constraint products_details_valid check (
  (short_description is null or char_length(short_description) <= 240)
  and (care_instructions is null or char_length(care_instructions) <= 1500)
  and jsonb_typeof(highlights) = 'array' and jsonb_array_length(highlights) <= 6
  and jsonb_typeof(specs) = 'array' and jsonb_array_length(specs) <= 10
);

-- ---------------------------------------------------------------------
-- Settings: one number for both calls and WhatsApp (default), or a separate calling number
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists phone_same_as_whatsapp boolean not null default true;

-- ---------------------------------------------------------------------
-- create_order: charges once per product, kept per product with a reason
-- ---------------------------------------------------------------------
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

  -- extra charges: every charge on every product in the order, ONCE per product (not × quantity),
  -- kept per product with the reason so it can be explained to the customer
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'productId', s.pid, 'productName', s.pname, 'label', s.charge_label,
      'amount', s.charge_amount, 'reason', s.charge_reason
    ) order by s.pname, s.charge_label), '[]'::jsonb),
    coalesce(sum(s.charge_amount), 0)
  into v_fees, v_fees_sum
  from (
    select
      p.id as pid,
      p.name as pname,
      f ->> 'label' as charge_label,
      round(coalesce(nullif(f ->> 'amount', '')::numeric, 0), 2) as charge_amount,
      nullif(btrim(f ->> 'reason'), '') as charge_reason
    from (select distinct (e ->> 'productId')::uuid as pid from jsonb_array_elements(p_items) e) m
    join public.products p on p.id = m.pid
    cross join lateral jsonb_array_elements(p.fees) f
    where nullif(btrim(f ->> 'label'), '') is not null
  ) s
  where s.charge_amount > 0;

  select * into v_settings from public.store_settings limit 1;
  v_ship_orig := coalesce(v_settings.delivery_fee, 60);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := v_subtotal + v_ship + v_fees_sum;

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
