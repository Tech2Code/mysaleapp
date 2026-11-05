-- =====================================================================
-- Kalakriti store — initial schema
-- Run in Supabase → SQL Editor (or `supabase db push`).
-- Safe to read top-to-bottom: tables → helpers → RLS → RPCs → storage.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum
    ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_url   text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text not null default '',
  price            numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price > price),
  images           text[] not null default '{}',
  category_id      uuid references public.categories(id) on delete set null,
  stock            int  not null default 0 check (stock >= 0),
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_featured_idx on public.products (is_active, is_featured);
create index if not exists products_created_idx on public.products (created_at desc);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  address    text,
  city       text,
  pincode    text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_code    text not null unique,
  user_id       uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone         text not null,
  address       text not null,
  city          text not null,
  pincode       text not null,
  note          text,
  -- snapshot of what was ordered, so later price/name edits don't change history
  items         jsonb not null,
  subtotal      numeric(10,2) not null check (subtotal >= 0),
  status        public.order_status not null default 'pending',
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (phone);

create table if not exists public.order_status_history (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     public.order_status not null,
  changed_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx
  on public.order_status_history (order_id, changed_at);

create table if not exists public.wishlists (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists wishlists_product_idx on public.wishlists (product_id);

-- ---------------------------------------------------------------------
-- Helpers & triggers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Every status change (including the initial one) is written to history.
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status) values (new.id, new.status);
  end if;
  return new;
end $$;

drop trigger if exists orders_status_log on public.orders;
create trigger orders_status_log after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Create a profile row automatically when someone signs up (e.g. Google login).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.admins               enable row level security;
alter table public.profiles             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_status_history enable row level security;
alter table public.wishlists            enable row level security;

-- categories: everyone reads, admins write
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories for select using (true);
drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- products: everyone reads active ones, admins read & write everything
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select
  using (is_active or public.is_admin());
drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- admins: a user may only see their own admin row
drop policy if exists "admins self read" on public.admins;
create policy "admins self read" on public.admins for select using (user_id = auth.uid());

-- profiles: own row; admins may read all
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- orders: customers read their own; only admins update/delete.
-- There is deliberately NO insert policy: orders are created only via create_order().
drop policy if exists "orders read own or admin" on public.orders;
create policy "orders read own or admin" on public.orders for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "orders admin delete" on public.orders;
create policy "orders admin delete" on public.orders for delete using (public.is_admin());

drop policy if exists "history read own or admin" on public.order_status_history;
create policy "history read own or admin" on public.order_status_history for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- wishlists: own rows only
drop policy if exists "wishlists own" on public.wishlists;
create policy "wishlists own" on public.wishlists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- RPC: create_order
-- Prices are read from the database — the client only sends product ids and
-- quantities, so a tampered cart cannot change what the customer is charged.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_customer jsonb, p_items jsonb, p_prefix text default 'KK')
returns table (order_code text, subtotal numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_name    text := btrim(p_customer ->> 'name');
  v_phone   text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address text := btrim(p_customer ->> 'address');
  v_city    text := btrim(p_customer ->> 'city');
  v_pincode text := btrim(p_customer ->> 'pincode');
  v_note    text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
  v_items   jsonb;
  v_total   numeric(10,2);
  v_count   int;
  v_code    text;
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

  -- merge duplicate lines, validate quantities, join live product data
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
  into v_items, v_total, v_count
  from merged m
  left join public.products p on p.id = m.product_id;

  if v_count is distinct from (select count(distinct (e ->> 'productId')) from jsonb_array_elements(p_items) e) then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  -- short, human-friendly, non-sequential code: KK-7F3K9Q
  loop
    v_code := upper(coalesce(nullif(btrim(p_prefix), ''), 'KK')) || '-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.order_code = v_code);
  end loop;

  insert into public.orders
    (order_code, user_id, customer_name, phone, address, city, pincode, note, items, subtotal)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items, v_total);

  return query select v_code, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: track_order — lets a guest see an order's status with
-- the order code + last 4 digits of the phone used.
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
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: public bucket for product photos, admin-only writes
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

drop policy if exists "product images admin insert" on storage.objects;
create policy "product images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
