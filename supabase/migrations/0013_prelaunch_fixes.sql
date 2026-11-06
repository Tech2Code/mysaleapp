-- =====================================================================
-- Pre-launch database fixes. Safe to re-run. No table/column changes.
--  1. record_order_return: the same product listed twice in one call could return more than was
--     ordered (the per-line check did not count lines of the same call). Now it does.
--  2. submit_payment / update_order_delivery: lock the order row, so a payment or an address edit
--     cannot slip in while the order is being cancelled/expired. submit_payment also refuses a
--     refunded order (it used to flip it back to "submitted").
--  3. A cancelled order can never be re-opened: stock was already given back once, so un-cancelling
--     (e.g. by a hand edit in the dashboard) would leave the order holding stock it no longer reserves.
--  4. restock_cancelled_order locks the products in id order (same order as create_order), so
--     expiring several orders at once cannot deadlock with a customer placing an order.
--  5. Indexes for the lists, counters and the expiry job.
--  6. Storage: admins need SELECT on the bucket to list/delete photos (the launch "clear catalogue"
--     step lists the bucket; without it nothing was removed).
--  7. Table privileges: anon never writes to tables (writes go through the RPCs above), and nobody
--     needs TRUNCATE/REFERENCES/TRIGGER. RLS stays the main guard; this is defence in depth.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. record_order_return: count lines of the same call too
-- ---------------------------------------------------------------------
create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order     public.orders;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_ordered   int;
  v_returned  int;
  v_inflight  int;
  v_restocked int := 0;
  v_clean     jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is not null and not exists (
    select 1 from public.return_requests where id = p_request_id and order_id = p_order_id and status in ('requested', 'approved')
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0) into v_ordered
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;

    -- lines of this same call that were already accepted
    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = stock + v_qty where id = v_pid;
      v_restocked := v_restocked + v_qty;
    end if;

    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded)
  values (p_order_id, v_clean, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), coalesce(p_refund, false));

  if p_request_id is not null then
    update public.return_requests set status = 'received', received_at = now() where id = p_request_id;
  end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    update public.orders set payment_status = 'refunded', refunded_at = now() where id = p_order_id;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. submit_payment / update_order_delivery: lock the row
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public
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

create or replace function public.update_order_delivery(p_code text, p_phone_last4 text, p_customer jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order   public.orders;
  v_id      uuid;
  v_state   text;
  v_name    text := btrim(p_customer ->> 'name');
  v_phone   text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address text := btrim(p_customer ->> 'address');
  v_city    text := btrim(p_customer ->> 'city');
  v_pincode text := btrim(p_customer ->> 'pincode');
  v_note    text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0'  then v_phone := right(v_phone, 10); end if;

  if v_name is null or char_length(v_name) not between 2 and 80 then raise exception 'INVALID_NAME'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'INVALID_PHONE'; end if;
  if v_address is null or char_length(v_address) not between 5 and 300 then raise exception 'INVALID_ADDRESS'; end if;
  if v_city is null or char_length(v_city) not between 2 and 60 then raise exception 'INVALID_CITY'; end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'INVALID_PINCODE'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'INVALID_NOTE'; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.status <> 'pending' then raise exception 'NOT_EDITABLE'; end if;

  update public.orders
  set customer_name = v_name, phone = v_phone, address = v_address,
      city = v_city, pincode = v_pincode, note = v_note, delivery_updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('phoneLast4', right(v_phone, 4));
end $$;

revoke all on function public.update_order_delivery(text, text, jsonb) from public;
grant execute on function public.update_order_delivery(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. A cancelled order stays cancelled
-- ---------------------------------------------------------------------
create or replace function public.block_uncancel()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'ORDER_CANCELLED';
  end if;
  return new;
end $$;

revoke all on function public.block_uncancel() from public, anon, authenticated;

drop trigger if exists orders_block_uncancel on public.orders;
create trigger orders_block_uncancel before update of status on public.orders
  for each row execute function public.block_uncancel();

-- ---------------------------------------------------------------------
-- 4. restock on cancel: lock products in id order first
-- ---------------------------------------------------------------------
create or replace function public.restock_cancelled_order()
returns trigger language plpgsql security definer set search_path = public as $$
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
    new.stock_restored_at := now();
  end if;
  return new;
end $$;

revoke all on function public.restock_cancelled_order() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------
-- "my orders" list
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
-- dashboard counters and admin filters (to verify / awaiting payment / to ship)
create index if not exists orders_payment_status_idx on public.orders (payment_status, status);
-- expire_unpaid_orders(): only unpaid pending orders, oldest first
create index if not exists orders_unpaid_expiry_idx on public.orders (created_at)
  where status = 'pending' and payment_status in ('pending', 'failed');
-- spam guard in create_order (per phone, recent, unpaid)
create index if not exists orders_phone_created_idx on public.orders (phone, created_at desc);

-- ---------------------------------------------------------------------
-- 6. Storage: admins can list / remove photos
-- ---------------------------------------------------------------------
drop policy if exists "product images admin select" on storage.objects;
create policy "product images admin select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 7. Table privileges (defence in depth; RLS still decides what each signed-in user may do)
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- written only by the SECURITY DEFINER functions / triggers above
revoke insert, update, delete on public.order_status_history from authenticated;
revoke insert, update, delete on public.order_returns        from authenticated;
revoke insert, update, delete on public.return_requests      from authenticated;
revoke insert, update, delete on public.admins               from authenticated;
