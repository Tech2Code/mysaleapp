-- =====================================================================
-- Audit fixes (database side). Safe to re-run.
--  1. admin_reset_data('orders') gives reserved stock back before deleting the test orders.
--  2. expire_unpaid_orders locks the affected products in id order first (no deadlock with create_order).
--  3. record_order_return: locks products in id order, locks the return request row (a withdraw can no
--     longer be overwritten), and only counts restocked units for products that still exist.
--  4. orders.refunded_amount can't be negative.
--  5. set_default_address(): clear + set the default address in ONE transaction.
--  6. Drop two indexes made redundant by the composite ones from 0013.
-- =====================================================================

-- 1 ------------------------------------------------------------------
create or replace function public.admin_reset_data(p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_orders int := 0; v_addresses int := 0; v_wishlists int := 0; v_products int := 0; v_categories int := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if 'orders' = any (p_scopes) then
    -- Orders placed since 0010 reserved stock. Deleting them directly would leave the catalogue
    -- permanently short, so add back what is still held (not cancelled/restored, minus units a
    -- return already put back).
    perform p.id from public.products p
    where p.id in (
      select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e
      where o.stock_reserved and o.stock_restored_at is null and o.status <> 'cancelled'
    )
    order by p.id for update;

    update public.products p set stock = p.stock + greatest(m.qty - coalesce(r.qty, 0), 0)
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from public.orders o, jsonb_array_elements(o.items) e
      where o.stock_reserved and o.stock_restored_at is null and o.status <> 'cancelled'
      group by 1
    ) m
    left join (
      select (x ->> 'productId')::uuid as pid, sum((x ->> 'quantity')::int)::int as qty
      from public.order_returns ret, jsonb_array_elements(ret.items) x
      where coalesce((x ->> 'restock')::boolean, false)
        and ret.order_id in (
          select o.id from public.orders o
          where o.stock_reserved and o.stock_restored_at is null and o.status <> 'cancelled'
        )
      group by 1
    ) r on r.pid = m.pid
    where p.id = m.pid;

    delete from public.order_status_history where true;
    delete from public.orders where true;
    get diagnostics v_orders = row_count;
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

revoke all on function public.admin_reset_data(text[]) from public;
grant execute on function public.admin_reset_data(text[]) to authenticated;

-- 2 ------------------------------------------------------------------
create or replace function public.expire_unpaid_orders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_hours int;
  v_count int;
begin
  select unpaid_order_expiry_hours into v_hours from public.store_settings limit 1;
  if coalesce(v_hours, 0) <= 0 then return 0; end if;

  -- Lock every product the expiring orders hold, in id order (same order as create_order), BEFORE
  -- the restock trigger runs, so one statement cancelling many orders can't deadlock with a checkout.
  perform p.id from public.products p
  where p.id in (
    select (e ->> 'productId')::uuid
    from public.orders o, jsonb_array_elements(o.items) e
    where o.status = 'pending' and o.payment_status in ('pending', 'failed')
      and o.created_at < now() - make_interval(hours => v_hours)
  )
  order by p.id for update;

  update public.orders
  set status = 'cancelled',
      cancel_reason = 'Payment not received in time',
      cancelled_by = 'system',
      cancelled_at = now()
  where status = 'pending'
    and payment_status in ('pending', 'failed')
    and created_at < now() - make_interval(hours => v_hours);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- 3 ------------------------------------------------------------------
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
  v_rows      int;
  v_clean     jsonb := '[]'::jsonb;
  v_price     numeric;
  v_value     numeric := 0;   -- value of the items in THIS call
  v_items_all numeric;        -- value of every item on the order
  v_paid      numeric;
  v_new_ref   numeric;
  v_full      boolean := false;
  v_refunded  numeric := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  -- Lock the request row: a customer withdrawing at the same moment waits, then finds it is no longer
  -- 'requested' (CANNOT_WITHDRAW) instead of being silently overwritten.
  if p_request_id is not null and not exists (
    select 1 from public.return_requests
    where id = p_request_id and order_id = p_order_id and status in ('requested', 'approved')
    for update
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

  -- Lock the products in id order (same order as create_order and the restock trigger).
  perform p.id from public.products p
  where p.id in (
    select (e ->> 'productId')::uuid from jsonb_array_elements(p_items) e
    where e ->> 'productId' is not null
  )
  order by p.id for update;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), coalesce(max((e ->> 'price')::numeric), 0)
      into v_ordered, v_price
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = stock + v_qty where id = v_pid;
      get diagnostics v_rows = row_count;
      -- the product may have been deleted since the order; then there is nothing to put back
      if v_rows > 0 then v_restocked := v_restocked + v_qty; end if;
    end if;

    v_value := v_value + v_price * v_qty;
    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded)
  values (p_order_id, v_clean, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), coalesce(p_refund, false));

  if p_request_id is not null then
    update public.return_requests set status = 'received', received_at = now()
    where id = p_request_id and status in ('requested', 'approved');
    if not found then raise exception 'REQUEST_NOT_OPEN'; end if;
  end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
    from jsonb_array_elements(v_order.items) e;
    v_paid := coalesce(v_order.payment_amount, v_order.total);

    -- items refunded so far (earlier refunded amount counts items only, delivery/charges come with the final one)
    v_new_ref := coalesce(v_order.refunded_amount, 0) + v_value;
    if v_new_ref >= v_items_all - 0.005 then
      v_full := true;
      v_new_ref := v_paid;
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_paid
      where id = p_order_id;
    else
      v_new_ref := least(v_new_ref, v_paid);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;
    v_refunded := v_new_ref;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked, 'refundedAmount', v_refunded, 'fullyRefunded', v_full);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- 4 ------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_refunded_amount_nonneg;
alter table public.orders add constraint orders_refunded_amount_nonneg check (refunded_amount >= 0);

-- 5 ------------------------------------------------------------------
-- SECURITY INVOKER: RLS still limits the rows to the signed-in owner.
create or replace function public.set_default_address(p_id uuid)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from public.addresses where id = p_id and user_id = auth.uid()) then
    raise exception 'ADDRESS_NOT_FOUND';
  end if;
  update public.addresses set is_default = false where user_id = auth.uid() and is_default and id <> p_id;
  update public.addresses set is_default = true  where id = p_id and user_id = auth.uid();
end $$;

revoke all on function public.set_default_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;

-- 6 ------------------------------------------------------------------
drop index if exists public.orders_user_idx;
drop index if exists public.orders_phone_idx;
