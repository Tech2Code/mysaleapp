-- =====================================================================
-- Security hardening. Safe to re-run.
--  1. Admin's private order note moves to its own admin-only table. Before this, the note was a
--     column on `orders`, which customers can read for their own orders.
--  2. create_order: the order-code prefix is read from store_settings (it used to be a parameter
--     anyone could set by calling the RPC directly), order codes use a cryptographically random
--     source, and a per-phone / per-account limit on unpaid orders stops order spam.
--  3. profiles: length limits (a signed-in user can write to their own row directly through the API).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Private admin notes
-- ---------------------------------------------------------------------
create table if not exists public.order_admin_notes (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  note       text not null check (char_length(note) between 1 and 1000),
  updated_at timestamptz not null default now()
);

drop trigger if exists order_admin_notes_touch on public.order_admin_notes;
create trigger order_admin_notes_touch before update on public.order_admin_notes
  for each row execute function public.touch_updated_at();

alter table public.order_admin_notes enable row level security;
drop policy if exists "admin notes admin only" on public.order_admin_notes;
create policy "admin notes admin only" on public.order_admin_notes for all
  using (public.is_admin()) with check (public.is_admin());

-- Copy existing notes across, then drop the customer-readable column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'admin_note'
  ) then
    insert into public.order_admin_notes (order_id, note)
    select id, left(btrim(admin_note), 1000) from public.orders
    where admin_note is not null and btrim(admin_note) <> ''
    on conflict (order_id) do nothing;

    alter table public.orders drop column admin_note;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. create_order
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
  v_prefix   text;
  v_bytes    bytea;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 characters
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

  -- The prefix is the owner's setting; the p_prefix argument is ignored (kept so old callers still work).
  v_prefix := coalesce(nullif(v_settings.order_code_prefix, ''), 'KK');

  -- short, non-sequential, unguessable code: KK-7F3K9Q (random bytes from gen_random_uuid, 32 symbols = no bias)
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
     subtotal, shipping_fee, shipping_fee_original, extra_fees, total)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_total);

  return query select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. profiles: length limits. NOT VALID = enforced for new writes without failing on old rows.
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_lengths_check;
alter table public.profiles add constraint profiles_lengths_check check (
  (full_name  is null or char_length(full_name)  <= 80)
  and (phone      is null or char_length(phone)      <= 20)
  and (address    is null or char_length(address)    <= 300)
  and (city       is null or char_length(city)       <= 60)
  and (pincode    is null or char_length(pincode)    <= 10)
  and (avatar_url is null or char_length(avatar_url) <= 500)
) not valid;

-- Sign-up copies name/avatar from user-editable metadata: trim them so an oversized value can't break sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    case when char_length(new.raw_user_meta_data ->> 'avatar_url') <= 500
         then new.raw_user_meta_data ->> 'avatar_url' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
