-- =====================================================================
-- 0054: Customer Product Reviews & Star Ratings (Social Proof)
--  1. public.product_reviews table with RLS.
--  2. Denormalized rating_avg and review_count on public.products, kept in sync by trigger.
--  3. public.upsert_product_review and public.delete_product_review RPCs (verified delivered buyers & admins).
--  4. Helper public.can_review_product(p_product_id uuid) for product detail page eligibility check.
-- =====================================================================

-- 1. Add rating summary columns to public.products --------------------
alter table public.products
  add column if not exists rating_avg   numeric(3,2) not null default 0,
  add column if not exists review_count int not null default 0;

-- 2. Create public.product_reviews table ------------------------------
create table if not exists public.product_reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  reviewer_name        text not null,
  rating               int not null check (rating between 1 and 5),
  title                text,
  comment              text not null,
  is_verified_purchase boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint product_reviews_unique_user_product unique (product_id, user_id),
  constraint product_reviews_comment_len_chk check (char_length(btrim(comment)) between 5 and 800),
  constraint product_reviews_title_len_chk check (title is null or char_length(btrim(title)) <= 100)
);

create index if not exists product_reviews_product_created_idx
  on public.product_reviews (product_id, created_at desc);

alter table public.product_reviews enable row level security;

drop policy if exists "product_reviews_public_read" on public.product_reviews;
create policy "product_reviews_public_read"
  on public.product_reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "product_reviews_admin_delete" on public.product_reviews;
create policy "product_reviews_admin_delete"
  on public.product_reviews
  for delete
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- 3. Trigger to keep products.rating_avg and products.review_count in sync --
create or replace function public.sync_product_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce((
        select round(avg(r.rating)::numeric, 2)
        from public.product_reviews r
        where r.product_id = v_pid
      ), 0),
      review_count = (
        select count(*)::int
        from public.product_reviews r
        where r.product_id = v_pid
      )
  where p.id = v_pid;
  return null;
end $$;

revoke all on function public.sync_product_rating_stats() from public, anon, authenticated;

drop trigger if exists product_reviews_sync_stats on public.product_reviews;
create trigger product_reviews_sync_stats
  after insert or update or delete on public.product_reviews
  for each row execute function public.sync_product_rating_stats();

-- 4. RPC: Check if current signed-in user has a delivered order for a product --
create or replace function public.can_review_product(p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_product_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.orders o,
         jsonb_array_elements(o.items) e
    where o.user_id = auth.uid()
      and o.status = 'delivered'
      and (e ->> 'productId')::uuid = p_product_id
  );
end $$;

revoke all on function public.can_review_product(uuid) from public;
grant execute on function public.can_review_product(uuid) to anon, authenticated;

-- 5. RPC: Upsert a verified buyer product review ----------------------
create or replace function public.upsert_product_review(
  p_product_id uuid,
  p_rating     int,
  p_title      text default null,
  p_comment    text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
  v_comment text := btrim(coalesce(p_comment, ''));
  v_name    text;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if p_product_id is null or not exists (select 1 from public.products where id = p_product_id and is_active = true) then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'INVALID_RATING';
  end if;

  if char_length(v_comment) not between 5 and 800 then
    raise exception 'INVALID_REVIEW_COMMENT';
  end if;

  if v_title is not null and char_length(v_title) > 100 then
    raise exception 'INVALID_REVIEW_TITLE';
  end if;

  if not public.can_review_product(p_product_id) then
    raise exception 'NOT_VERIFIED_BUYER';
  end if;

  select nullif(btrim(pr.full_name), '') into v_name
  from public.profiles pr
  where pr.id = v_uid;

  if v_name is null then
    select nullif(btrim(o.customer_name), '') into v_name
    from public.orders o
    where o.user_id = v_uid and o.status = 'delivered'
    order by o.created_at desc
    limit 1;
  end if;

  v_name := coalesce(left(v_name, 80), 'Verified Customer');

  insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, updated_at)
  values (p_product_id, v_uid, v_name, p_rating, v_title, v_comment, true, now())
  on conflict (product_id, user_id) do update
    set reviewer_name = excluded.reviewer_name,
        rating        = excluded.rating,
        title         = excluded.title,
        comment       = excluded.comment,
        updated_at    = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function public.upsert_product_review(uuid, int, text, text) from public, anon;
grant execute on function public.upsert_product_review(uuid, int, text, text) to authenticated;
