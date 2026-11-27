-- 0068: Back in Stock — restocked_at tracking on products + stock_alerts notify-me subscriptions
-- Backward-compatible: products.restocked_at is nullable and stock_alerts is an additive table.

alter table public.products
  add column if not exists restocked_at timestamptz null;

-- Automatically stamp restocked_at whenever a sold-out product comes back in stock (via admin save, order cancel, or return restock).
create or replace function public.track_product_restock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(old.stock, 0) <= 0 and coalesce(new.stock, 0) > 0 then
    new.restocked_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_products_restocked_at on public.products;
create trigger trg_products_restocked_at
  before update of stock on public.products
  for each row
  execute function public.track_product_restock();

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  customer_name text not null default '',
  phone text not null,
  status text not null default 'waiting' check (status in ('waiting', 'notified')),
  notified_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_alerts_product_status
  on public.stock_alerts (product_id, status, created_at desc);

create unique index if not exists idx_stock_alerts_waiting_unique
  on public.stock_alerts (product_id, phone)
  where status = 'waiting';

alter table public.stock_alerts enable row level security;

drop policy if exists "stock_alerts_admin_all" on public.stock_alerts;
create policy "stock_alerts_admin_all"
  on public.stock_alerts
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "stock_alerts_owner_select" on public.stock_alerts;
create policy "stock_alerts_owner_select"
  on public.stock_alerts
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- Public / customer-safe RPC to subscribe for a Back in Stock alert on a sold-out active product.
create or replace function public.subscribe_stock_alert(
  p_product_id uuid,
  p_name text default '',
  p_phone text default ''
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_product record;
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name    text := left(btrim(coalesce(p_name, '')), 80);
  v_uid     uuid := auth.uid();
  v_existing_id uuid;
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substr(v_phone, 3);
  end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0' then
    v_phone := substr(v_phone, 2);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  select id, is_active, stock into v_product
  from public.products
  where id = p_product_id;

  if not found or not v_product.is_active then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if coalesce(v_product.stock, 0) > 0 then
    raise exception 'ALREADY_IN_STOCK';
  end if;

  select id into v_existing_id
  from public.stock_alerts
  where product_id = p_product_id and phone = v_phone and status = 'waiting'
  limit 1;

  if v_existing_id is not null then
    update public.stock_alerts
    set customer_name = case when v_name <> '' then v_name else customer_name end,
        user_id = coalesce(user_id, v_uid)
    where id = v_existing_id;
    return jsonb_build_object('ok', true, 'alreadySubscribed', true);
  end if;

  insert into public.stock_alerts (product_id, user_id, customer_name, phone, status)
  values (p_product_id, v_uid, v_name, v_phone, 'waiting');

  return jsonb_build_object('ok', true, 'alreadySubscribed', false);
end $$;

grant execute on function public.subscribe_stock_alert(uuid, text, text) to anon, authenticated;
