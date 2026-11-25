-- =====================================================================
-- 0061: Deep Audit Remediation (Security, Calculations, Stock & Analytics)
--  1. Product price >= 1 constraint (NOT VALID) & review title length 400.
--  2. Column-level privilege lockdown on `admins`, `profiles`, `product_reviews`, `admin_audit_logs`.
--  3. Admin PIN RPC hardening (bcrypt cost 10, current PIN / fresh password proof).
--  4. Internal IP rate-limit helper + `is_admin_email` & `validate_promo_code` IP throttling.
--  5. Stock clamping (<= 100000), exchange stock deduction & re-returnability, `admin_reset_data` reviews cleanup.
--  6. `create_order` deactivation guard, IP throttle & `p_expected_total` check.
--  7. `submit_payment` guest UTR overwrite guard & `track_order` PII redaction + `updatedAt` / `requiresSignIn`.
--  8. `dashboard_stats` promo-aware & exchange-aware `topProducts` + `paidOrders` buckets.
-- =====================================================================

-- 1. Product price floor & review title capacity ----------------------
alter table public.products drop constraint if exists products_price_min_chk;
alter table public.products add constraint products_price_min_chk
  check (price >= 1) not valid;

alter table public.product_reviews drop constraint if exists product_reviews_title_len_chk;
alter table public.product_reviews add constraint product_reviews_title_len_chk
  check (title is null or char_length(btrim(title)) <= 400);

-- 2. Column & table privilege lockdown --------------------------------
revoke select on public.admins from public, anon, authenticated;
grant select (user_id, created_at, pin_mode, pin_updated_at) on public.admins to authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant insert (id, full_name, phone, avatar_url),
      update (full_name, phone, avatar_url)
  on public.profiles to authenticated;

revoke all on public.admin_audit_logs from anon;
revoke update, delete, truncate, references, trigger on public.admin_audit_logs from authenticated;

revoke all on public.product_reviews from anon;
grant select (id, product_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
  on public.product_reviews to anon;
revoke insert, update, truncate, references, trigger on public.product_reviews from authenticated;

create or replace function public.before_profile_write_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_admins          boolean;
  v_caller_role        text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), session_user);
  v_allow_deactivation boolean := current_setting('app.allow_deactivation_write', true) = 'on';
begin
  new.full_name := public.clean_person_name(new.full_name);

  select exists (select 1 from public.admins a where a.user_id = new.id)
    into v_in_admins;

  if pg_trigger_depth() <= 1 and (v_caller_role in ('authenticated', 'anon') or auth.uid() is not null) then
    -- Always derive role from public.admins for API callers so neither customers nor admins can mutate role via PostgREST.
    new.role := case when v_in_admins then 'admin' else 'customer' end;
    if not v_allow_deactivation then
      if tg_op = 'INSERT' then
        new.deactivated_at := null;
        new.deactivation_reason := null;
      else
        new.deactivated_at := old.deactivated_at;
        new.deactivation_reason := old.deactivation_reason;
      end if;
    end if;
  elsif tg_op = 'INSERT' and new.role is null then
    new.role := case when v_in_admins then 'admin' else 'customer' end;
  end if;

  return new;
end $$;

create or replace function public.deactivate_my_account(p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_clean_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if public.is_admin() then
    raise exception 'ADMIN_CANNOT_DEACTIVATE';
  end if;

  if exists (
    select 1 from public.orders o
    where o.user_id = v_uid
      and (
        o.status in ('pending', 'confirmed', 'packed', 'shipped')
        or (o.status = 'cancelled' and o.payment_status in ('paid', 'submitted'))
      )
  ) then
    raise exception 'ACTIVE_ORDERS_EXIST';
  end if;

  if exists (
    select 1
    from public.return_requests r
    join public.orders o on o.id = r.order_id
    where o.user_id = v_uid
      and r.status in ('requested', 'approved')
  ) or exists (
    select 1
    from public.order_returns ret
    join public.orders o on o.id = ret.order_id
    where o.user_id = v_uid
      and ret.refunded = false
      and coalesce(ret.resolution_type, 'refund') = 'refund'
      and o.payment_status in ('paid', 'submitted')
  ) then
    raise exception 'OPEN_RETURNS_EXIST';
  end if;

  perform set_config('app.allow_deactivation_write', 'on', true);

  insert into public.profiles (id, deactivated_at, deactivation_reason)
  values (v_uid, now(), v_clean_reason)
  on conflict (id) do update
  set deactivated_at = now(),
      deactivation_reason = excluded.deactivation_reason;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.deactivate_my_account(text) from public, anon;
grant execute on function public.deactivate_my_account(text) to authenticated;

create or replace function public.reactivate_my_account()
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_restored boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  perform set_config('app.allow_deactivation_write', 'on', true);

  update public.profiles
  set deactivated_at = null,
      deactivation_reason = null
  where id = v_uid
    and deactivated_at is not null;

  v_restored := found;
  return v_restored;
end $$;

revoke all on function public.reactivate_my_account() from public, anon;
grant execute on function public.reactivate_my_account() to authenticated;

-- 3. Admin PIN RPC hardening ------------------------------------------
drop function if exists public.set_admin_pin(text);
drop function if exists public.disable_admin_pin();

create or replace function public.set_admin_pin(p_pin text, p_current_pin text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pin        text := btrim(coalesce(p_pin, ''));
  v_cur        text := btrim(coalesce(p_current_pin, ''));
  v_row        public.admins%rowtype;
  v_fresh_auth boolean := false;
  v_attempts   int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits' using errcode = '22023';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid()
   for update;

  if v_row.pin_mode = 'enabled' and v_row.pin_hash is not null then
    select exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (
          u.last_sign_in_at > now() - interval '120 seconds'
          or u.updated_at > now() - interval '120 seconds'
        )
    ) into v_fresh_auth;

    if not v_fresh_auth then
      if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
        raise exception 'PIN is temporarily locked' using errcode = '42501';
      end if;

      if not (v_cur ~ '^[0-9]{4}$' and v_row.pin_hash = extensions.crypt(v_cur, v_row.pin_hash)) then
        v_attempts := case
          when v_row.pin_locked_until is not null and v_row.pin_locked_until <= now() then 1
          else coalesce(v_row.pin_failed_attempts, 0) + 1
        end;
        update public.admins
           set pin_failed_attempts = v_attempts,
               pin_locked_until    = case when v_attempts >= 5 then now() + interval '10 minutes' else null end
         where user_id = auth.uid();
        raise exception 'Incorrect current PIN' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.admins
     set pin_hash            = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
         pin_mode            = 'enabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

create or replace function public.disable_admin_pin(p_current_pin text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_cur        text := btrim(coalesce(p_current_pin, ''));
  v_row        public.admins%rowtype;
  v_fresh_auth boolean := false;
  v_attempts   int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid()
   for update;

  if v_row.pin_mode = 'enabled' and v_row.pin_hash is not null then
    select exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (
          u.last_sign_in_at > now() - interval '120 seconds'
          or u.updated_at > now() - interval '120 seconds'
        )
    ) into v_fresh_auth;

    if not v_fresh_auth then
      if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
        raise exception 'PIN is temporarily locked' using errcode = '42501';
      end if;

      if not (v_cur ~ '^[0-9]{4}$' and v_row.pin_hash = extensions.crypt(v_cur, v_row.pin_hash)) then
        v_attempts := case
          when v_row.pin_locked_until is not null and v_row.pin_locked_until <= now() then 1
          else coalesce(v_row.pin_failed_attempts, 0) + 1
        end;
        update public.admins
           set pin_failed_attempts = v_attempts,
               pin_locked_until    = case when v_attempts >= 5 then now() + interval '10 minutes' else null end
         where user_id = auth.uid();
        raise exception 'Incorrect current PIN' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.admins
     set pin_hash            = null,
         pin_mode            = 'disabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

create or replace function public.clear_admin_pin_lock()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_fresh_auth boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and (
        u.last_sign_in_at > now() - interval '120 seconds'
        or u.updated_at > now() - interval '120 seconds'
      )
  ) into v_fresh_auth;

  if not v_fresh_auth then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.admins
     set pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

revoke all on function public.set_admin_pin(text, text) from public, anon;
grant execute on function public.set_admin_pin(text, text) to authenticated;

revoke all on function public.disable_admin_pin(text) from public, anon;
grant execute on function public.disable_admin_pin(text) to authenticated;

revoke all on function public.clear_admin_pin_lock() from public, anon;
grant execute on function public.clear_admin_pin_lock() to authenticated;

-- 4. Internal IP key helper & rate limiting ----------------------------
create or replace function public.internal_rate_key(p_namespace text, p_subject text default null)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb := '{}'::jsonb;
  v_ip      text;
  v_salt    text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'noip'
  );

  select coalesce(min(u.created_at)::text, 'kk-internal') into v_salt from auth.users u;
  return md5(v_salt || ':' || coalesce(p_namespace, '') || ':' || coalesce(p_subject, v_ip));
end $$;

revoke all on function public.internal_rate_key(text, text) from public, anon, authenticated;

create or replace function public.check_rate_limit(p_scope text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max     int;
  v_window  int;
  v_key     text;
  v_hits    int;
begin
  select l.max_hits, l.window_seconds into v_max, v_window
  from (values
    ('track-order',     20, 600),
    ('submit-payment',  20, 600),
    ('update-delivery', 20, 600),
    ('cancel-order',    20, 600),
    ('request-return',  20, 600),
    ('withdraw-return', 20, 600),
    ('place-order',     15, 600),
    ('create-order-ip', 40, 600),
    ('login',           10, 600),
    ('pincode',         60, 600),
    ('password-reset',   5, 600)
  ) as l(scope, max_hits, window_seconds)
  where l.scope = p_scope;

  if v_max is null then return true; end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then return true; end if;

  v_key := p_scope || ':' || p_key;

  if random() < 0.05 then
    delete from public.rate_limits
    where ctid in (select ctid from public.rate_limits where window_start < now() - interval '1 hour' limit 1000);
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (v_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => v_window) then now() else r.window_start end,
        hits         = case when r.window_start < now() - make_interval(secs => v_window) then 1 else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= v_max;
end;
$$;

revoke all on function public.check_rate_limit(text, text) from public;
grant execute on function public.check_rate_limit(text, text) to anon, authenticated;

create or replace function public.is_admin_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean text := lower(btrim(coalesce(p_email, '')));
begin
  if v_clean = '' or length(v_clean) > 254 then
    return false;
  end if;

  if not public.check_rate_limit('password-reset', public.internal_rate_key('admin-email-ip')) then
    return false;
  end if;

  return exists (
    select 1
    from auth.users u
    join public.admins a on a.user_id = u.id
    where lower(u.email) = v_clean
  );
end $$;

revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;

create or replace function public.validate_promo_code(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_sub      numeric(10,2) := greatest(round(coalesce(p_subtotal, 0), 2), 0);
  v_promo    public.promo_codes;
  v_discount numeric(10,2);
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.check_rate_limit('track-order', public.internal_rate_key('promo-ip')) then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS');
  end if;

  if v_code = '' or v_code !~ '^[A-Z0-9_-]{3,24}$' then
    return jsonb_build_object('ok', false, 'error', 'PROMO_INVALID');
  end if;

  select * into v_promo from public.promo_codes where code = v_code;
  if not found or not v_promo.is_active then
    return jsonb_build_object('ok', false, 'error', 'PROMO_INVALID');
  end if;

  if v_promo.expires_at is not null and v_promo.expires_at < v_today then
    return jsonb_build_object('ok', false, 'error', 'PROMO_EXPIRED');
  end if;

  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('ok', false, 'error', 'PROMO_LIMIT_REACHED');
  end if;

  if v_sub < v_promo.min_order_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'PROMO_MIN_ORDER',
      'minOrderAmount', v_promo.min_order_amount
    );
  end if;

  v_discount := public.compute_promo_discount(v_promo, v_sub);
  if v_discount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'PROMO_MIN_ORDER', 'minOrderAmount', greatest(v_promo.min_order_amount, 2));
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_promo.code,
    'description', v_promo.description,
    'discountType', v_promo.discount_type,
    'discountValue', v_promo.discount_value,
    'minOrderAmount', v_promo.min_order_amount,
    'maxDiscountAmount', v_promo.max_discount_amount,
    'discountAmount', v_discount
  );
end $$;

revoke all on function public.validate_promo_code(text, numeric) from public;
grant execute on function public.validate_promo_code(text, numeric) to anon, authenticated;

-- 5. Stock clamping, exchange stock & re-returnability, reviews -------
create or replace function public.adjust_product_stock(p_id uuid, p_delta int)
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_stock int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_delta is null or abs(p_delta) > 1000000 then raise exception 'BAD_DELTA'; end if;

  update public.products
     set stock = least(100000, greatest(0, stock + p_delta))
   where id = p_id
   returning stock into v_stock;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  return v_stock;
end $$;

revoke all on function public.adjust_product_stock(uuid, int) from public, anon;
grant execute on function public.adjust_product_stock(uuid, int) to authenticated;

create or replace function public.restock_cancelled_order()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.stock_reserved and new.stock_restored_at is null then
    perform p.id from public.products p
    where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(new.items) e)
    order by p.id
    for update;

    update public.products p
       set stock = least(100000, p.stock + m.qty)
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from jsonb_array_elements(new.items) e group by 1
    ) m
    where p.id = m.pid;

    if new.promo_code is not null then
      update public.promo_codes
         set used_count = greatest(used_count - 1, 0),
             updated_at = now()
       where code = new.promo_code
         and created_at <= new.created_at;
    end if;

    new.stock_restored_at := now();
  end if;
  return new;
end $$;

revoke all on function public.restock_cancelled_order() from public, anon, authenticated;

create or replace function public.admin_reset_data(p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_orders int := 0; v_addresses int := 0; v_wishlists int := 0; v_products int := 0; v_categories int := 0;
  v_restock_ids uuid[];
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if 'orders' = any (p_scopes) then
    select coalesce(array_agg(x.id), '{}') into v_restock_ids from (
      select o.id from public.orders o
      where o.stock_reserved and o.stock_restored_at is null
        and o.status <> 'cancelled' and o.status::text <> 'delivered'
      order by o.id
      for update
    ) x;
    perform o.id from public.orders o order by o.id for update;

    perform p.id from public.products p
    where p.id in (
      select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
    )
    order by p.id for update;

    update public.products p
       set stock = least(100000, p.stock + m.qty)
    from (
      select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
      from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
      group by 1
    ) m
    where p.id = m.pid;

    delete from public.order_status_history where true;
    delete from public.orders where true;
    get diagnostics v_orders = row_count;

    update public.promo_codes
       set used_count = 0,
           updated_at = now()
     where used_count > 0;
  end if;

  if 'orders' = any (p_scopes) or 'customers' = any (p_scopes) or 'catalog' = any (p_scopes) then
    delete from public.product_reviews where true;
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

revoke all on function public.admin_reset_data(text[]) from public, anon;
grant execute on function public.admin_reset_data(text[]) to authenticated;

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

  if exists (select 1 from public.profiles pr where pr.id = v_uid and pr.deactivated_at is not null) then
    raise exception 'ACCOUNT_DEACTIVATED';
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

  if v_title is not null and char_length(v_title) > 400 then
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

create or replace function public.request_return(
  p_code text,
  p_phone_last4 text,
  p_items jsonb,
  p_reason text,
  p_details text,
  p_phone text default null,
  p_resolution_type text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_id            uuid;
  v_state         text;
  v_days          int;
  v_item_days     int;
  v_delivered     timestamptz;
  v_item          jsonb;
  v_pid           uuid;
  v_qty           int;
  v_ordered       int;
  v_returned      int;
  v_inflight      int;
  v_name          text;
  v_clean         jsonb := '[]'::jsonb;
  v_req           uuid;
  v_res_type      text := lower(btrim(coalesce(p_resolution_type, 'refund')));
  v_exchange_pref text := nullif(left(btrim(coalesce(p_exchange_preference, '')), 200), '');
begin
  if v_res_type not in ('refund', 'exchange') then
    v_res_type := 'refund';
  end if;
  if v_res_type = 'exchange' and (v_exchange_pref is null or length(v_exchange_pref) < 2) then
    raise exception 'EXCHANGE_PREF_REQUIRED';
  end if;

  select g.res_id, g.res_state into v_id, v_state
  from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;

  select return_window_days into v_days from public.store_settings limit 1;
  v_delivered := public.order_delivered_at(v_order.id);
  if v_delivered is null then raise exception 'WINDOW_CLOSED'; end if;

  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'NO_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(
      max((e ->> 'returnWindowDays')::int),
      (select p.return_window_days from public.products p where p.id = v_pid),
      v_days,
      0
    )
    into v_item_days
    from jsonb_array_elements(v_order.items) e
    where (e ->> 'productId')::uuid = v_pid;

    if v_item_days <= 0 then raise exception 'RETURNS_OFF'; end if;
    if now() > v_delivered + make_interval(days => v_item_days) then raise exception 'WINDOW_CLOSED'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = v_order.id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference)
    values (
      v_order.id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.request_return(text, text, jsonb, text, text, text, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_create_return_request(
  p_order_id uuid,
  p_items jsonb,
  p_reason text,
  p_details text,
  p_resolution_type text default 'refund',
  p_exchange_preference text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order         public.orders;
  v_item          jsonb;
  v_pid           uuid;
  v_qty           int;
  v_ordered       int;
  v_returned      int;
  v_inflight      int;
  v_name          text;
  v_clean         jsonb := '[]'::jsonb;
  v_req           uuid;
  v_res_type      text := lower(btrim(coalesce(p_resolution_type, 'refund')));
  v_exchange_pref text := nullif(left(btrim(coalesce(p_exchange_preference, '')), 200), '');
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if v_res_type not in ('refund', 'exchange') then
    v_res_type := 'refund';
  end if;
  if v_res_type = 'exchange' and (v_exchange_pref is null or length(v_exchange_pref) < 2) then
    raise exception 'EXCHANGE_PREF_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'NO_ITEMS'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    if v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details, resolution_type, exchange_preference)
    values (
      p_order_id,
      v_clean,
      left(btrim(p_reason), 80),
      nullif(left(btrim(coalesce(p_details, '')), 300), ''),
      v_res_type,
      case when v_res_type = 'exchange' then v_exchange_pref else null end
    )
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.admin_create_return_request(uuid, jsonb, text, text, text, text) to authenticated;

create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order       public.orders;
  v_item        jsonb;
  v_pid         uuid;
  v_qty         int;
  v_ordered     int;
  v_returned    int;
  v_inflight    int;
  v_restocked   int := 0;
  v_rows        int;
  v_clean       jsonb := '[]'::jsonb;
  v_price       numeric;
  v_value       numeric := 0;
  v_items_all   numeric;
  v_items_net   numeric;
  v_raw_prev    numeric;
  v_this_refund numeric := 0;
  v_paid        numeric;
  v_new_ref     numeric;
  v_full        boolean := false;
  v_refunded    numeric := 0;
  v_ret_id      uuid;
  v_res_type    text := 'refund';
  v_do_refund   boolean := false;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is null then raise exception 'REQUEST_REQUIRED'; end if;

  select coalesce(r.resolution_type, 'refund')
    into v_res_type
  from public.return_requests r
  where r.id = p_request_id and r.order_id = p_order_id and r.status = 'approved'
  for update;
  if not found then raise exception 'REQUEST_NOT_OPEN'; end if;

  v_do_refund := coalesce(p_refund, false) and v_res_type <> 'exchange' and v_order.payment_status = 'paid';

  if exists (
    select 1 from (
      select e ->> 'productId' as pid,
             sum(case when coalesce((e ->> 'quantity')::int, 0) >= 1 then (e ->> 'quantity')::int else 0 end) as q
      from jsonb_array_elements(p_items) e
      group by 1
    ) a
    where a.q > coalesce((
      select sum((x ->> 'quantity')::int)
      from public.return_requests r, jsonb_array_elements(r.items) x
      where r.id = p_request_id and x ->> 'productId' = a.pid
    ), 0)
  ) then
    raise exception 'NOT_IN_REQUEST';
  end if;

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
    where o.order_id = p_order_id
      and coalesce(o.resolution_type, 'refund') <> 'exchange'
      and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = least(100000, stock + v_qty) where id = v_pid;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then v_restocked := v_restocked + v_qty; end if;
    end if;

    -- Exchanges ship out a replacement unit, so deduct 1 unit from shelf stock per exchanged quantity.
    if v_res_type = 'exchange' then
      update public.products set stock = greatest(0, stock - v_qty) where id = v_pid;
    end if;

    v_value := v_value + v_price * v_qty;
    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded, refund_amount, resolution_type)
  values (
    p_order_id,
    v_clean,
    nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
    v_do_refund,
    null,
    v_res_type
  )
  returning id into v_ret_id;

  update public.return_requests
  set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
  where id = p_request_id and status = 'approved';
  if not found then raise exception 'REQUEST_NOT_OPEN'; end if;

  if v_do_refund then
    select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
    from jsonb_array_elements(v_order.items) e;
    v_paid := coalesce(v_order.payment_amount, v_order.total);
    v_items_net := least(greatest(v_items_all - coalesce(v_order.discount_amount, 0), 0), v_paid);

    select coalesce(sum(public.return_items_value(v_order.items, r.items)), 0)
      into v_raw_prev
    from public.order_returns r
    where r.order_id = p_order_id and r.refunded and r.id <> v_ret_id;

    if v_raw_prev + v_value >= v_items_all - 0.005 then
      v_full := true;
      v_this_refund := greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0);
      v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
      update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_new_ref
      where id = p_order_id;
    else
      v_this_refund := case when v_items_all > 0 then round(v_value * v_items_net / v_items_all, 2) else 0 end;
      v_this_refund := least(v_this_refund, greatest(round(v_items_net - coalesce(v_order.refunded_amount, 0), 2), 0));
      v_new_ref := round(coalesce(v_order.refunded_amount, 0) + v_this_refund, 2);
      update public.orders set refunded_amount = v_new_ref where id = p_order_id;
    end if;

    update public.order_returns set refund_amount = v_this_refund where id = v_ret_id;
    v_refunded := v_new_ref;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked, 'refundedAmount', v_refunded, 'fullyRefunded', v_full);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- 6. create_order: deactivation guard, IP throttle & expected_total ----
drop function if exists public.create_order(jsonb, jsonb, text, text);

create or replace function public.create_order(
  p_customer       jsonb,
  p_items          jsonb,
  p_prefix         text default 'KK',
  p_promo_code     text default null,
  p_expected_total numeric default null
)
returns table (
  order_code            text,
  subtotal              numeric,
  shipping_fee          numeric,
  shipping_fee_original numeric,
  extra_fees            jsonb,
  discount_amount       numeric,
  promo_code            text,
  total                 numeric
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name            text := btrim(p_customer ->> 'name');
  v_phone           text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_address         text := btrim(p_customer ->> 'address');
  v_city            text := btrim(p_customer ->> 'city');
  v_pincode         text := btrim(p_customer ->> 'pincode');
  v_note            text := nullif(btrim(coalesce(p_customer ->> 'note', '')), '');
  v_items           jsonb;
  v_subtotal        numeric(10,2);
  v_count           int;
  v_fees            jsonb := '[]'::jsonb;
  v_fees_sum        numeric(10,2) := 0;
  v_has_oversized   boolean := false;
  v_has_fragile     boolean := false;
  v_oversized_names text;
  v_fragile_names   text;
  v_oversized_amt   numeric(10,2);
  v_fragile_amt     numeric(10,2);
  v_total_weight    bigint := 0;
  v_free_weight     bigint;
  v_weight_rate     numeric(10,2);
  v_extra_kg        int;
  v_weight_amt      numeric(10,2);
  v_settings        public.store_settings;
  v_tax_snapshot    jsonb;
  v_ship_orig       numeric(10,2);
  v_ship            numeric(10,2);
  v_promo_input     text := nullif(upper(btrim(coalesce(p_promo_code, ''))), '');
  v_promo           public.promo_codes;
  v_discount        numeric(10,2) := 0;
  v_applied_code    text := null;
  v_today           date := (now() at time zone 'Asia/Kolkata')::date;
  v_total           numeric(10,2);
  v_code            text;
  v_prefix          text;
  v_bytes           bytea;
  v_alphabet        text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i                 int;
begin
  if auth.uid() is not null and exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.deactivated_at is not null
  ) then
    raise exception 'ACCOUNT_DEACTIVATED';
  end if;

  if auth.uid() is null and not public.check_rate_limit('create-order-ip', public.internal_rate_key('create-order-ip')) then
    raise exception 'TOO_MANY_ORDERS';
  end if;

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

  perform p.id from public.products p
  where p.id in (select (e ->> 'productId')::uuid from jsonb_array_elements(p_items) e)
  order by p.id
  for update;

  select * into v_settings from public.store_settings limit 1;

  with raw as (
    select (e ->> 'productId')::uuid as product_id, (e ->> 'quantity')::int as qty
    from jsonb_array_elements(p_items) e
  ), merged as (
    select product_id, sum(qty)::int as qty from raw group by product_id
  )
  select
    jsonb_agg(jsonb_build_object(
      'productId', p.id, 'name', p.name, 'slug', p.slug, 'price', p.price,
      'quantity', m.qty, 'image', p.images[1],
      'returnWindowDays', coalesce(p.return_window_days, v_settings.return_window_days, 7)
    ) order by p.name),
    round(sum(p.price * m.qty), 2),
    count(*) filter (where p.id is not null and p.is_active and m.qty between 1 and 20 and p.stock >= m.qty),
    coalesce(bool_or(p.shipping_class = 'oversized'), false),
    coalesce(bool_or(p.shipping_class = 'fragile'), false),
    string_agg(btrim(p.name), ', ' order by lower(btrim(p.name)), btrim(p.name)) filter (where p.shipping_class = 'oversized' and btrim(p.name) <> ''),
    string_agg(btrim(p.name), ', ' order by lower(btrim(p.name)), btrim(p.name)) filter (where p.shipping_class = 'fragile' and btrim(p.name) <> ''),
    coalesce(sum(greatest(coalesce(p.weight_grams, 0), 0)::bigint * m.qty), 0)
  into
    v_items, v_subtotal, v_count,
    v_has_oversized, v_has_fragile, v_oversized_names, v_fragile_names, v_total_weight
  from merged m
  left join public.products p on p.id = m.product_id;

  if v_count is distinct from (select count(distinct (e ->> 'productId')) from jsonb_array_elements(p_items) e) then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  if v_promo_input is not null then
    if v_promo_input !~ '^[A-Z0-9_-]{3,24}$' then
      raise exception 'PROMO_INVALID';
    end if;
    select * into v_promo from public.promo_codes where code = v_promo_input for update;
    if not found or not v_promo.is_active then
      raise exception 'PROMO_INVALID';
    end if;
    if v_promo.expires_at is not null and v_promo.expires_at < v_today then
      raise exception 'PROMO_EXPIRED';
    end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
      raise exception 'PROMO_LIMIT_REACHED';
    end if;
    if v_subtotal < v_promo.min_order_amount then
      raise exception 'PROMO_MIN_ORDER';
    end if;
    v_discount := public.compute_promo_discount(v_promo, v_subtotal);
    if v_discount <= 0 then
      raise exception 'PROMO_MIN_ORDER';
    end if;
    v_applied_code := v_promo.code;

    update public.promo_codes
    set used_count = used_count + 1,
        updated_at = now()
    where id = v_promo.id;
  end if;

  v_oversized_amt := case when v_has_oversized then round(coalesce(v_settings.oversized_fee, 80), 2) else 0 end;
  v_fragile_amt   := case when v_has_fragile   then round(coalesce(v_settings.fragile_fee, 30), 2)   else 0 end;

  if v_oversized_amt > 0 and v_oversized_amt >= v_fragile_amt then
    v_fees := v_fees || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'label', 'Large / bulky item handling',
        'amount', v_oversized_amt,
        'productName', v_oversized_names,
        'reason', 'Special courier handling & protective packing for large items'
      ))
    );
    v_fees_sum := v_fees_sum + v_oversized_amt;
  elsif v_fragile_amt > 0 then
    v_fees := v_fees || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'label', 'Fragile item packaging',
        'amount', v_fragile_amt,
        'productName', v_fragile_names,
        'reason', 'Protective bubble & box cushioning for fragile items'
      ))
    );
    v_fees_sum := v_fees_sum + v_fragile_amt;
  end if;

  v_free_weight := greatest(coalesce(v_settings.free_weight_grams, 1000), 0);
  v_weight_rate := round(coalesce(v_settings.extra_weight_fee_per_kg, 40), 2);

  if v_weight_rate > 0 and v_total_weight > v_free_weight then
    v_extra_kg := ceil((v_total_weight - v_free_weight)::numeric / 1000)::int;
    v_weight_amt := round(v_extra_kg * v_weight_rate, 2);
    if v_weight_amt > 0 then
      v_fees := v_fees || jsonb_build_array(
        jsonb_build_object(
          'label', 'Heavy parcel surcharge',
          'amount', v_weight_amt,
          'reason', case
            when v_free_weight > 0 then
              'Total parcel weight ' || public.format_weight_grams(v_total_weight)
              || ' (' || v_extra_kg::text || ' kg above ' || public.format_weight_grams(v_free_weight) || ' included)'
            else
              'Total parcel weight ' || public.format_weight_grams(v_total_weight)
              || ' (' || v_extra_kg::text || ' kg courier slab)'
          end
        )
      );
      v_fees_sum := v_fees_sum + v_weight_amt;
    end if;
  end if;

  v_ship_orig := round(coalesce(v_settings.delivery_fee, 60), 2);
  v_ship := case
    when coalesce(v_settings.free_delivery_above, 999) > 0
         and v_subtotal >= coalesce(v_settings.free_delivery_above, 999) then 0
    else v_ship_orig
  end;

  v_total := greatest(round(v_subtotal - v_discount + v_ship + v_fees_sum, 2), 1);

  if p_expected_total is not null and abs(v_total - round(p_expected_total, 2)) > 0.009 then
    raise exception 'PRICE_CHANGED';
  end if;

  v_tax_snapshot := jsonb_build_object(
    'gstEnabled', coalesce(v_settings.gst_registered, false),
    'gstRegistered', coalesce(v_settings.gst_registered, false),
    'gstin', v_settings.gstin,
    'gstRate', coalesce(v_settings.gst_rate, 0),
    'legalName', v_settings.legal_name,
    'businessAddress', v_settings.business_address,
    'shopName', coalesce(v_settings.shop_name, 'Kalakriti'),
    'city', v_settings.contact_city,
    'region', v_settings.contact_region,
    'phone', case when coalesce(v_settings.phone_same_as_whatsapp, true) then null else v_settings.contact_phone end,
    'whatsappNumber', v_settings.whatsapp_number,
    'email', v_settings.contact_email
  );

  v_prefix := coalesce(nullif(v_settings.order_code_prefix, ''), 'KK');

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
     subtotal, shipping_fee, shipping_fee_original, extra_fees, promo_code, discount_amount, total, stock_reserved, tax_snapshot)
  values
    (v_code, auth.uid(), v_name, v_phone, v_address, v_city, v_pincode, v_note, v_items,
     v_subtotal, v_ship, v_ship_orig, v_fees, v_applied_code, v_discount, v_total, true, v_tax_snapshot);

  update public.products p set stock = p.stock - m.qty
  from (
    select (e ->> 'productId')::uuid as pid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  ) m
  where p.id = m.pid;

  return query select v_code, v_subtotal, v_ship, v_ship_orig, v_fees, v_discount, v_applied_code, v_total;
end $$;

revoke all on function public.create_order(jsonb, jsonb, text, text, numeric) from public;
grant execute on function public.create_order(jsonb, jsonb, text, text, numeric) to anon, authenticated;

-- 7. submit_payment & track_order hardening ---------------------------
create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
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

  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;
  if v_order.payment_status = 'submitted' then raise exception 'ALREADY_SUBMITTED'; end if;

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

create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
  v_owner boolean;
begin
  if p_phone_last4 !~ '^[0-9]{4}$' then return null; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return null; end if;

  select * into v_order from public.orders where id = v_id;
  v_owner := auth.uid() is not null and v_order.user_id = auth.uid();

  return jsonb_build_object(
    'orderCode', v_order.order_code,
    'status', v_order.status,
    'isOwner', v_owner,
    'requiresSignIn', (v_order.user_id is not null and not v_owner),
    'items', coalesce((
      select jsonb_agg(
        e || jsonb_build_object(
          'returnWindowDays',
          coalesce(
            (e ->> 'returnWindowDays')::int,
            (select p.return_window_days from public.products p where p.id = (e ->> 'productId')::uuid),
            (select s.return_window_days from public.store_settings s limit 1),
            7
          )
        )
      )
      from jsonb_array_elements(v_order.items) e
    ), v_order.items),
    'subtotal', v_order.subtotal,
    'shippingFee', v_order.shipping_fee,
    'shippingFeeOriginal', v_order.shipping_fee_original,
    'extraFees', v_order.extra_fees,
    'promoCode', v_order.promo_code,
    'discountAmount', v_order.discount_amount,
    'total', v_order.total,
    'paymentStatus', v_order.payment_status,
    'refundedAmount', v_order.refunded_amount,
    'paymentMethod', case when v_owner then v_order.payment_method else null end,
    'paymentReference', case
      when v_owner then v_order.payment_reference
      when v_order.payment_reference is null then null
      else repeat('*', greatest(length(v_order.payment_reference) - 4, 0)) || right(v_order.payment_reference, 4)
    end,
    'paymentAmount', case when v_owner then v_order.payment_amount else null end,
    'paymentSubmittedAt', v_order.payment_submitted_at,
    'paymentPaidAt', case when v_owner then v_order.payment_paid_at else null end,
    'paymentNote', case when v_owner or v_order.payment_status = 'failed' then v_order.payment_note else null end,
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'updatedAt', v_order.updated_at,
    'delivery', case when v_owner then jsonb_build_object(
        'name', v_order.customer_name, 'phone', v_order.phone, 'address', v_order.address,
        'city', v_order.city, 'pincode', v_order.pincode, 'note', v_order.note
      ) else null end,
    'shipping', case
      when v_order.shipping_carrier is null then null
      else jsonb_build_object(
        'carrier', v_order.shipping_carrier,
        'trackingNumber', v_order.tracking_number,
        'trackingUrl', v_order.tracking_url,
        'expectedDelivery', v_order.expected_delivery
      )
    end,
    'cancellation', case
      when v_order.status = 'cancelled' then jsonb_build_object(
        'reason', case
          when v_owner then v_order.cancel_reason
          when v_order.cancel_reason is null then null
          else nullif(btrim(regexp_replace(v_order.cancel_reason, '(?:\r?\n|\s)*\[Refund UPI:\s*[^\]]+\]', '', 'gi')), '')
        end,
        'by', v_order.cancelled_by,
        'at', v_order.cancelled_at,
        'refundReference', case
          when v_owner then v_order.refund_reference
          when v_order.refund_reference is null then null
          else repeat('*', greatest(length(v_order.refund_reference) - 4, 4)) || right(v_order.refund_reference, 4)
        end,
        'refundedAt', v_order.refunded_at
      ) else null end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb),
    'returnRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'items', r.items,
        'reason', r.reason,
        'details', case
          when v_owner then r.details
          when r.details is null then null
          else nullif(
            btrim(
              regexp_replace(
                regexp_replace(r.details, '(?:\r?\n|\s)*\[Pickup:\s*[^\]]+\]', '', 'gi'),
                '(?:\r?\n|\s)*\[Refund UPI:\s*[^\]]+\]',
                '',
                'gi'
              )
            ),
            ''
          )
        end,
        'status', r.status,
        'adminNote', r.admin_note,
        'createdAt', r.created_at,
        'decidedAt', r.decided_at,
        'pickupDate', r.pickup_date,
        'pickedUpAt', r.picked_up_at,
        'resolutionType', r.resolution_type,
        'exchangePreference', r.exchange_preference
      ) order by r.created_at)
      from public.return_requests r where r.order_id = v_order.id
    ), '[]'::jsonb),
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'items', o.items, 'reason', o.reason, 'refunded', o.refunded,
        'resolutionType', o.resolution_type, 'createdAt', o.created_at
      ) order by o.created_at)
      from public.order_returns o where o.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- 8. dashboard_stats: promo-netted & exchange-aware topProducts + paidOrders buckets
create or replace function public.dashboard_stats(
  p_start timestamptz, p_end timestamptz, p_prev_start timestamptz, p_prev_end timestamptz, p_bucket text
)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_fmt text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_bucket is null or p_bucket not in ('day', 'month') then raise exception 'BAD_BUCKET'; end if;
  v_fmt := case when p_bucket = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end;

  with cur as (
    select o.id, o.status, o.payment_status, o.items, o.created_at, o.discount_amount, o.payment_amount, o.total, o.subtotal, n.net,
           (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as has_rev,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid_order
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where o.created_at >= p_start and o.created_at < p_end
  ),
  prev as (
    select (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and (o.payment_status = 'paid' or (o.payment_status = 'refunded' and n.net > 0))) as has_rev,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid_order,
           n.net
    from public.orders o
    cross join lateral (
      select greatest(coalesce(nullif(o.payment_amount, 0), o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    ) n
    where p_prev_start is not null and o.created_at >= p_prev_start and o.created_at < p_prev_end
  ),
  buckets as (
    select to_char(c.created_at at time zone 'Asia/Kolkata', v_fmt) as k,
           coalesce(sum(c.net) filter (where c.has_rev), 0) as revenue,
           count(*) filter (where c.counts) as orders,
           count(*) filter (where c.is_paid_order) as paid_orders
    from cur c group by 1
  ),
  order_gross as (
    select c.id as order_id,
           coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) as items_gross,
           coalesce(nullif(c.payment_amount, 0), c.total, c.subtotal) as paid_amt,
           coalesce(c.discount_amount, 0) as discount_amt
    from cur c, jsonb_array_elements(c.items) e
    where c.is_paid_order
    group by c.id, c.payment_amount, c.total, c.subtotal, c.discount_amount
  ),
  order_lines as (
    select c.id as order_id,
           e ->> 'productId' as pid,
           min(e ->> 'name') as name,
           min(e ->> 'image') as image,
           sum((e ->> 'quantity')::int) as qty,
           max((e ->> 'price')::numeric) as unit_price,
           og.items_gross,
           least(greatest(og.items_gross - og.discount_amt, 0), og.paid_amt) as items_net
    from cur c
    join order_gross og on og.order_id = c.id,
         jsonb_array_elements(c.items) e
    group by c.id, e ->> 'productId', og.items_gross, og.discount_amt, og.paid_amt
  ),
  returned_per_order as (
    select ret.order_id,
           r ->> 'productId' as pid,
           sum((r ->> 'quantity')::int) as qty
    from public.order_returns ret
    join cur c on c.id = ret.order_id and c.is_paid_order,
         jsonb_array_elements(ret.items) r
    where coalesce(ret.resolution_type, 'refund') <> 'exchange'
    group by ret.order_id, r ->> 'productId'
  ),
  net_lines as (
    select ol.pid,
           ol.name,
           ol.image,
           greatest(ol.qty - coalesce(rp.qty, 0), 0) as kept_qty,
           case
             when ol.items_gross > 0 then
               round(
                 greatest(ol.qty - coalesce(rp.qty, 0), 0)
                 * ol.unit_price
                 * (ol.items_net / ol.items_gross),
                 2
               )
             else 0
           end as kept_rev
    from order_lines ol
    left join returned_per_order rp on rp.order_id = ol.order_id and rp.pid = ol.pid
  ),
  top as (
    select nl.pid,
           min(nl.name) as name,
           min(nl.image) as image,
           sum(nl.kept_qty) as qty,
           round(sum(nl.kept_rev), 2) as rev
    from net_lines nl
    group by nl.pid
    having sum(nl.kept_qty) > 0
    order by 5 desc, nl.pid
    limit 5
  )
  select jsonb_build_object(
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'revenue', revenue, 'orders', orders, 'paidOrders', paid_orders)) from buckets), '[]'::jsonb),
    'current', jsonb_build_object(
      'revenue', coalesce((select sum(net) from cur where has_rev), 0),
      'orders', (select count(*) from cur where counts),
      'paid', (select count(*) from cur where is_paid_order)
    ),
    'previous', jsonb_build_object(
      'revenue', coalesce((select sum(net) from prev where has_rev), 0),
      'orders', (select count(*) from prev where counts),
      'paid', (select count(*) from prev where is_paid_order)
    ),
    'byStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from cur group by 1) s), '{}'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(jsonb_build_object('productId', pid, 'name', name, 'image', image, 'quantity', qty, 'revenue', rev) order by rev desc, pid)
      from top
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;
