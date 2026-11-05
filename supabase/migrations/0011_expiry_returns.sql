-- =====================================================================
-- Auto-release of unpaid orders, and returns.
--  * store_settings.unpaid_order_expiry_hours : unpaid orders are cancelled after this many hours
--    (0 = never). Their reserved stock goes back on sale (the 0010 trigger does that).
--  * expire_unpaid_orders() : the cleanup itself; scheduled every 15 minutes with pg_cron.
--    Only orders nobody has paid for are touched: a payment the customer already submitted ("I paid")
--    waits for the admin to verify and is never auto-cancelled.
--  * order_returns + record_order_return() : the admin records goods that came back, item by item,
--    and chooses per item whether it goes back into stock (resellable) or not (damaged).
-- Safe to re-run.
-- =====================================================================

alter table public.store_settings
  add column if not exists unpaid_order_expiry_hours int not null default 24;
alter table public.store_settings drop constraint if exists store_settings_expiry_hours_check;
alter table public.store_settings add constraint store_settings_expiry_hours_check
  check (unpaid_order_expiry_hours between 0 and 720);

-- orders can now also be cancelled by the system
alter table public.orders drop constraint if exists orders_cancelled_by_check;
alter table public.orders add constraint orders_cancelled_by_check
  check (cancelled_by is null or cancelled_by in ('customer', 'admin', 'system'));

-- ---------------------------------------------------------------------
-- Auto-cancel unpaid orders
-- ---------------------------------------------------------------------
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

-- run it every 15 minutes (needs the pg_cron extension; skipped quietly if it can't be enabled)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-unpaid-orders';
  perform cron.schedule('expire-unpaid-orders', '*/15 * * * *', 'select public.expire_unpaid_orders()');
exception when others then
  raise notice 'pg_cron not available (%): unpaid orders will not auto-cancel until it is enabled', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Returns
-- ---------------------------------------------------------------------
create table if not exists public.order_returns (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  -- [{ "productId": "...", "name": "...", "quantity": 1, "restock": true }]
  items      jsonb not null,
  reason     text check (reason is null or char_length(reason) <= 300),
  refunded   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists order_returns_order_idx on public.order_returns (order_id);

alter table public.order_returns enable row level security;
drop policy if exists "returns read own or admin" on public.order_returns;
create policy "returns read own or admin" on public.order_returns for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
-- no insert/update/delete policy: rows are only written by record_order_return() below

create or replace function public.record_order_return(p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean)
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
  v_restocked int := 0;
  v_clean     jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

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

    if v_returned + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

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

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    update public.orders set payment_status = 'refunded', refunded_at = now() where id = p_order_id;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean) to authenticated;
