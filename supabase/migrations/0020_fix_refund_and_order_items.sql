-- =====================================================================
-- Fixes found by the DB verification run against 0018 / 0010. Safe to re-run.
--  1. refund_order: orders.status is an enum, p_expected_status is text — `enum <> text` has no
--     operator, so EVERY call failed. Compare as text.
--  2. create_order: reject any item line that is not an object with a uuid productId and a numeric
--     quantity. Before, `{}` or `{productId:null, quantity:1}` slipped through (typeof(NULL) is NULL, so the
--     quantity check passed) and stored a junk line in orders.items (and reserved stock for it).
-- =====================================================================

-- 1 ------------------------------------------------------------------
create or replace function public.refund_order(
  p_order_id uuid, p_amount numeric, p_expected_status text, p_reference text, p_note text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order  public.orders;
  v_paid   numeric;
  v_new    numeric;
  v_full   boolean;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_expected_status is not null and v_order.status::text <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;

  v_paid := coalesce(v_order.payment_amount, v_order.total);
  if p_amount is not null and (p_amount <= 0 or p_amount > v_paid - coalesce(v_order.refunded_amount, 0) + 0.005) then
    raise exception 'BAD_AMOUNT';
  end if;

  v_new := case when p_amount is null then v_paid else least(v_paid, coalesce(v_order.refunded_amount, 0) + p_amount) end;
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

revoke all on function public.refund_order(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.refund_order(uuid, numeric, text, text, text) to authenticated;

-- 2 ------------------------------------------------------------------
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
  -- every line must be {productId: uuid, quantity: number}; anything else (empty object, null id,
  -- missing quantity) is rejected instead of being stored as a junk line
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

  -- Lock the products being bought (in id order, so two orders can't deadlock) and re-check stock
  -- under the lock: two customers can no longer buy the last unit at the same time.
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
     subtotal, shipping_fee, shipping_fee_original, extra_fees, total, stock_reserved)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_total, true);

  -- reserve the stock
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
