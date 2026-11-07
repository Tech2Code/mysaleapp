-- =====================================================================
-- 0022 hardening. Safe to re-run (idempotent).
--  1. pg_cron: cleanup jobs for rate_limits / order_lookup_failures + admin_cron_status() to inspect them.
--  2. Guest brute-force: DESTRUCTIVE guest actions (cancel_order, update_order_delivery) need the FULL
--     10-digit phone number, not the last 4 digits. Wrong full-phone guesses are counted in the same
--     per-order lockout (order_lookup_failures); the signed-in owner is still recognised by account.
--  3. refund_order idempotency (p_expected_refunded), admin_reset_data lock order + delivered orders,
--     dashboard_stats NULL bucket + deterministic top products, pg_temp on every SECURITY DEFINER function.
--  4. Indexes: covering index for dashboard_stats, pg_trgm GIN indexes for the admin order search.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. pg_cron cleanup + status
-- ---------------------------------------------------------------------
-- Why: anon can create rate_limits rows through check_rate_limit(), and every wrong guest lookup adds an
-- order_lookup_failures row. Nothing else removes them reliably (the inline random cleanup in
-- check_rate_limit only runs when someone calls it; it is KEPT as a fallback if pg_cron is unavailable).
-- Batched with a ctid limit so one run never holds a long lock on a big table.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-rate-limits';
  perform cron.schedule('cleanup-rate-limits', '*/10 * * * *',
    $job$delete from public.rate_limits where ctid in (select ctid from public.rate_limits where window_start < now() - interval '1 hour' limit 5000)$job$);
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-lookup-failures';
  perform cron.schedule('cleanup-lookup-failures', '*/10 * * * *',
    $job$delete from public.order_lookup_failures where ctid in (select ctid from public.order_lookup_failures where failed_at < now() - interval '1 day' limit 5000)$job$);
exception when others then
  raise notice 'pg_cron not available (%): cleanup jobs not scheduled; check_rate_limit still cleans up inline', sqlerrm;
end $$;

-- Admin-only view of our cron jobs and their last runs. Dynamic SQL so the function compiles and returns
-- {"available": false} even when the cron schema does not exist or is not readable.
create or replace function public.admin_cron_status()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  begin
    execute $q$
      select jsonb_build_object(
        'available', true,
        'jobs', coalesce((
          select jsonb_agg(jsonb_build_object('jobname', j.jobname, 'schedule', j.schedule, 'active', j.active) order by j.jobname)
          from cron.job j
          where j.jobname in ('expire-unpaid-orders', 'cleanup-rate-limits', 'cleanup-lookup-failures')
        ), '[]'::jsonb),
        'runs', coalesce((
          select jsonb_agg(to_jsonb(r) order by r.start_time desc) from (
            select j.jobname, d.status, d.return_message, d.start_time, d.end_time
            from cron.job_run_details d join cron.job j on j.jobid = d.jobid
            where j.jobname in ('expire-unpaid-orders', 'cleanup-rate-limits', 'cleanup-lookup-failures')
            order by d.start_time desc limit 10
          ) r
        ), '[]'::jsonb)
      )
    $q$ into v_result;
  exception when others then
    return jsonb_build_object('available', false);
  end;
  return v_result;
end $$;

revoke all on function public.admin_cron_status() from public, anon;
grant execute on function public.admin_cron_status() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Full phone number for destructive guest actions
-- ---------------------------------------------------------------------
-- Why: with only 4 digits (10^4 combinations) and 10 tries per 15 minutes per order, a known order code could
-- be brute-forced in about a day. Cancelling / redirecting an order is destructive, so guests must now prove
-- the full number (10^10). Non-destructive actions (track, pay, return request) keep the last-4 path.
--   p_phone  : full phone (any format; +91 / 0 prefix and spaces are stripped). When given it must equal the
--              order's phone (the last-4 is then ignored).
--   p_strict : destructive mode. A guest without a matching full phone is "not found" (and counted); the
--              signed-in owner of the order is still accepted without any phone.
drop function if exists public.find_order_for_guest(text, text);

create or replace function public.find_order_for_guest(
  p_code text, p_last4 text, p_phone text default null, p_strict boolean default false
)
returns table (res_id uuid, res_state text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id    uuid;
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0'  then v_phone := right(v_phone, 10); end if;

  -- the signed-in owner is recognised by their account, no throttling
  if auth.uid() is not null then
    select o.id into v_id from public.orders o where o.order_code = v_code and o.user_id = auth.uid();
    if found then return query select v_id, 'ok'::text; return; end if;
  end if;

  if (
    select count(*) from public.order_lookup_failures f
    where f.order_code = v_code and f.failed_at > now() - interval '15 minutes'
  ) >= 10 then
    return query select null::uuid, 'locked'::text;
    return;
  end if;

  if p_strict or p_phone is not null then
    -- full-phone match only
    if v_phone ~ '^[0-9]{10}$' then
      select o.id into v_id from public.orders o where o.order_code = v_code and o.phone = v_phone;
    end if;
  else
    select o.id into v_id from public.orders o
    where o.order_code = v_code and right(o.phone, 4) = coalesce(p_last4, '');
  end if;
  if v_id is not null then return query select v_id, 'ok'::text; return; end if;

  -- count the miss (only for codes that exist, so random guesses can't bloat the table). Old rows are removed by
  -- the pg_cron job above; the inline delete stays as a fallback.
  if exists (select 1 from public.orders o where o.order_code = v_code) then
    insert into public.order_lookup_failures (order_code) values (v_code);
    delete from public.order_lookup_failures where failed_at < now() - interval '1 day';
  end if;

  return query select null::uuid, 'not_found'::text;
end $$;

revoke all on function public.find_order_for_guest(text, text, text, boolean) from public, anon, authenticated;

-- cancel_order: the old 3-argument version is dropped (two overloads would make named RPC calls ambiguous).
drop function if exists public.cancel_order(text, text, text);

create or replace function public.cancel_order(p_code text, p_phone_last4 text, p_reason text, p_phone text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  -- destructive: guests must give the full phone number (p_phone); the owner needs nothing
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;

  if v_order.status = 'cancelled' then raise exception 'ALREADY_CANCELLED'; end if;
  if v_order.status not in ('pending', 'confirmed') then raise exception 'CANNOT_CANCEL'; end if;

  update public.orders
  set status = 'cancelled',
      cancel_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
      cancelled_by = 'customer',
      cancelled_at = now()
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'refundDue', v_order.payment_status in ('paid', 'submitted'));
end $$;

revoke all on function public.cancel_order(text, text, text, text) from public;
grant execute on function public.cancel_order(text, text, text, text) to anon, authenticated;

drop function if exists public.update_order_delivery(text, text, jsonb);

create or replace function public.update_order_delivery(
  p_code text, p_phone_last4 text, p_customer jsonb, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
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

  -- destructive: p_phone is the CURRENT phone on the order (proof for a guest); v_phone is the new one
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4, p_phone, true) g;
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

revoke all on function public.update_order_delivery(text, text, jsonb, text) from public;
grant execute on function public.update_order_delivery(text, text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3a. refund_order idempotency
-- ---------------------------------------------------------------------
-- Why: a double click or a stale tab on a PARTIAL refund refunded twice (each call looked valid against the
-- remaining balance). The admin screen now sends the refunded_amount it displayed; if the row has moved on,
-- ORDER_CHANGED is raised. The new param is LAST and defaults to NULL (no check) so older callers keep working.
drop function if exists public.refund_order(uuid, numeric, text, text, text);

create or replace function public.refund_order(
  p_order_id uuid, p_amount numeric, p_expected_status text, p_reference text, p_note text,
  p_expected_refunded numeric default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_paid   numeric;
  v_amount numeric := case when p_amount is null then null else round(p_amount, 2) end;
  v_new    numeric;
  v_full   boolean;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_expected_status is not null and v_order.status::text <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;
  -- before NOT_PAID so a double click on a FULL refund also reports "changed" instead of "not paid"
  if p_expected_refunded is not null
     and abs(coalesce(v_order.refunded_amount, 0) - p_expected_refunded) > 0.005 then
    raise exception 'ORDER_CHANGED';
  end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;

  v_paid := coalesce(v_order.payment_amount, v_order.total);
  if v_amount is not null and (v_amount < 0.01 or v_amount > v_paid - coalesce(v_order.refunded_amount, 0) + 0.005) then
    raise exception 'BAD_AMOUNT';
  end if;

  v_new := case when v_amount is null then v_paid else least(v_paid, coalesce(v_order.refunded_amount, 0) + v_amount) end;
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

revoke all on function public.refund_order(uuid, numeric, text, text, text, numeric) from public, anon;
grant execute on function public.refund_order(uuid, numeric, text, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 3b. admin_reset_data('orders'): lock order, delivered orders
-- ---------------------------------------------------------------------
-- Why: (a) every other path locks ORDER rows first, then products in id order; this function locked products
-- first, so it could deadlock with a customer cancel. Now: orders (for update, by id) -> products (by id) ->
-- restock -> delete.
-- (b) Orders with status 'delivered' are NOT restocked: those goods left the shop and were sold (or are in a
-- customer's hands), so adding them back would invent stock. Units a return already put back via
-- record_order_return are only possible on delivered orders, so the old "minus restocked returns" join is no
-- longer needed. Pending/confirmed/packed/shipped orders still give their reservation back (a reset is meant
-- for test orders that never really left).
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
    -- 1) lock the order rows that still hold reserved stock (id order)
    select coalesce(array_agg(x.id), '{}') into v_restock_ids from (
      select o.id from public.orders o
      where o.stock_reserved and o.stock_restored_at is null
        and o.status <> 'cancelled' and o.status::text <> 'delivered'
      order by o.id
      for update
    ) x;
    -- and every other order we are about to delete, so a concurrent change can't slip in
    perform o.id from public.orders o order by o.id for update;

    -- 2) then their products, in id order
    perform p.id from public.products p
    where p.id in (
      select (e ->> 'productId')::uuid from public.orders o, jsonb_array_elements(o.items) e
      where o.id = any (v_restock_ids)
    )
    order by p.id for update;

    -- 3) give the reserved stock back
    update public.products p set stock = p.stock + m.qty
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

-- ---------------------------------------------------------------------
-- 3c. dashboard_stats: NULL bucket rejected, deterministic top products
-- ---------------------------------------------------------------------
-- Why: `null not in (...)` is NULL, so a NULL p_bucket slipped past the check; equal-revenue products came
-- back in arbitrary order (unstable between refreshes). Body otherwise identical to 0018.
create or replace function public.dashboard_stats(
  p_start timestamptz, p_end timestamptz,
  p_prev_start timestamptz, p_prev_end timestamptz,
  p_bucket text
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
    select o.id, o.status, o.payment_status, o.items, o.created_at,
           greatest(coalesce(o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net,
           (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid
    from public.orders o
    where o.created_at >= p_start and o.created_at < p_end
  ),
  prev as (
    select (o.status <> 'cancelled') as counts,
           (o.status <> 'cancelled' and o.payment_status = 'paid') as is_paid,
           greatest(coalesce(o.total, o.subtotal) - coalesce(o.refunded_amount, 0), 0) as net
    from public.orders o
    where p_prev_start is not null and o.created_at >= p_prev_start and o.created_at < p_prev_end
  ),
  buckets as (
    select to_char(c.created_at at time zone 'Asia/Kolkata', v_fmt) as k,
           coalesce(sum(c.net) filter (where c.is_paid), 0) as revenue,
           count(*) filter (where c.counts) as orders
    from cur c group by 1
  ),
  lines as (
    select e ->> 'productId' as pid,
           min(e ->> 'name') as name,
           min(e ->> 'image') as image,
           sum((e ->> 'quantity')::int) as qty,
           sum((e ->> 'price')::numeric * (e ->> 'quantity')::int) as rev
    from cur c, jsonb_array_elements(c.items) e
    where c.is_paid
    group by 1
  ),
  returned as (
    select r ->> 'productId' as pid, sum((r ->> 'quantity')::int) as qty
    from public.order_returns ret
    join cur c on c.id = ret.order_id and c.is_paid,
         jsonb_array_elements(ret.items) r
    group by 1
  ),
  top as (
    select l.pid, l.name, l.image,
           l.qty - coalesce(rt.qty, 0) as qty,
           l.rev - coalesce(rt.qty, 0) * (l.rev / nullif(l.qty, 0)) as rev
    from lines l left join returned rt on rt.pid = l.pid
    where l.qty - coalesce(rt.qty, 0) > 0
    order by 5 desc, l.pid
    limit 5
  )
  select jsonb_build_object(
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'revenue', revenue, 'orders', orders)) from buckets), '[]'::jsonb),
    'current', jsonb_build_object(
      'revenue', coalesce((select sum(net) from cur where is_paid), 0),
      'orders', (select count(*) from cur where counts),
      'paid', (select count(*) from cur where is_paid)
    ),
    'previous', jsonb_build_object(
      'revenue', coalesce((select sum(net) from prev where is_paid), 0),
      'orders', (select count(*) from prev where counts),
      'paid', (select count(*) from prev where is_paid)
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

-- ---------------------------------------------------------------------
-- 3d. pg_temp on every SECURITY DEFINER function in public
-- ---------------------------------------------------------------------
-- Why: a SECURITY DEFINER function whose search_path omits pg_temp resolves unqualified names in the
-- session's temp schema FIRST, so a caller could shadow a table/function with a temp object. Only the
-- config is altered (bodies are untouched). The existing search_path value is kept and ", pg_temp" appended
-- (functions with no search_path get "public, pg_temp"). Extension-owned functions are skipped.
do $$
declare
  r record;
  v_path text;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig,
           (select regexp_replace(c, '^search_path=', '') from unnest(p.proconfig) c where c like 'search_path=%' limit 1) as cur_path
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%pg_temp%')
  loop
    v_path := coalesce(r.cur_path, 'public') || ', pg_temp';
    execute format('alter function %s set search_path = %s', r.sig, v_path);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
-- dashboard_stats reads orders by created_at range and only needs these columns for the aggregates (the
-- previous-period CTE becomes an index-only scan). Not partial: byStatus counts cancelled orders too.
create index if not exists orders_created_cover_idx on public.orders (created_at)
  include (status, payment_status, total, subtotal, refunded_amount);

-- Admin search is ilike '%q%' on code / phone / name: a btree can't help, trigram GIN can.
do $$
declare
  v_schema text;
begin
  create extension if not exists pg_trgm with schema extensions;
  select n.nspname into v_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists orders_order_code_trgm_idx on public.orders using gin (order_code %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists orders_phone_trgm_idx on public.orders using gin (phone %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists orders_customer_name_trgm_idx on public.orders using gin (customer_name %I.gin_trgm_ops)', v_schema);
end $$;
