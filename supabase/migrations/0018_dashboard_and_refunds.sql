-- =====================================================================
-- Dashboard aggregates in SQL + one refund path. Safe to re-run.
--  1. dashboard_stats(): admin-only; replaces downloading every order row into Node. Revenue is net of
--     partial refunds (orders.refunded_amount); top products are net of returned quantities.
--  2. refund_order(): admin-only, row-locking; marks a paid order fully or partly refunded and keeps
--     payment_status / refunded_at / refunded_amount in step (same bookkeeping as record_order_return).
--  3. order_returns.refund_amount (nullable, informational; record_order_return does not fill it yet).
--  4. Backfill: orders marked 'refunded' by hand before this (refunded_amount was left at 0).
-- =====================================================================

-- 1 ------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_start timestamptz, p_end timestamptz,
  p_prev_start timestamptz, p_prev_end timestamptz,
  p_bucket text
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_fmt text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_bucket not in ('day', 'month') then raise exception 'BAD_BUCKET'; end if;
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
    order by 5 desc
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
      select jsonb_agg(jsonb_build_object('productId', pid, 'name', name, 'image', image, 'quantity', qty, 'revenue', rev) order by rev desc)
      from top
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.dashboard_stats(timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;

-- 2 ------------------------------------------------------------------
-- p_amount = money returned NOW (null = the whole remaining paid amount). The order becomes 'refunded'
-- once refunded_amount reaches what was paid; before that it stays 'paid' with a partial refunded_amount.
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
  if p_expected_status is not null and v_order.status <> p_expected_status then raise exception 'ORDER_CHANGED'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'NOT_PAID'; end if;

  v_paid := coalesce(v_order.payment_amount, v_order.total);
  if p_amount is not null and (p_amount <= 0 or p_amount > v_paid - coalesce(v_order.refunded_amount, 0) + 0.005) then
    raise exception 'BAD_AMOUNT';
  end if;

  v_new := case when p_amount is null then v_paid else least(v_paid, coalesce(v_order.refunded_amount, 0) + p_amount) end;
  v_full := v_new >= v_paid - 0.005;

  update public.orders set
    refunded_amount = v_new,
    payment_status  = case when v_full then 'refunded' else payment_status end,
    refunded_at     = case when v_full then now() else refunded_at end,
    refund_reference = coalesce(nullif(left(btrim(coalesce(p_reference, '')), 60), ''), refund_reference),
    payment_note    = coalesce(nullif(left(btrim(coalesce(p_note, '')), 300), ''), payment_note)
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'refundedAmount', v_new, 'fullyRefunded', v_full);
end $$;

revoke all on function public.refund_order(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.refund_order(uuid, numeric, text, text, text) to authenticated;

-- 3 ------------------------------------------------------------------
alter table public.order_returns add column if not exists refund_amount numeric(10,2);

-- 4 ------------------------------------------------------------------
update public.orders
set refunded_amount = coalesce(payment_amount, total)
where payment_status = 'refunded' and coalesce(refunded_amount, 0) = 0 and coalesce(payment_amount, total) is not null;
