-- =====================================================================
-- 0024 Payment guard + refund of an earlier return. Safe to re-run (idempotent).
--
--  1. guard_payment_status (BEFORE UPDATE trigger on orders):
--       * payment_status can never move away from 'refunded', and never away from 'paid' except to 'refunded'
--         (on ANY order). A paid order is not set back to pending / submitted / failed; money that went back
--         is a refund.
--       * on a FINISHED order (delivered / cancelled) that is paid or refunded, payment_amount, payment_paid_at
--         and payment_reference are frozen.
--     Every path that writes payment_status still passes:
--       submit_payment            pending|failed -> submitted (refuses paid / refunded / cancelled itself)
--       admin form / verify       unpaid -> paid | failed | pending | submitted; paid -> paid (note / method)
--       refund_order              paid -> paid (partial) or paid -> refunded; touches refunded_*, payment_note
--       record_order_return       paid -> refunded or refunded_amount only
--       refund_return (below)     same as record_order_return
--       expire_unpaid_orders      only changes status / cancel_*, payment_status stays
--       0003 / 0004 / 0018 data fixes (applied): payment_method / total / refunded_amount only
--       admin_reset_data          deletes orders, never updates them
--     (it only inspects NEW vs OLD of payment_status, payment_amount, payment_paid_at, payment_reference)
--
--  2. return_items_value() + refund_return(): refund ONE earlier return that was recorded without a refund,
--     with the same bookkeeping as record_order_return(p_refund => true): order_returns.refunded / refund_amount,
--     orders.refunded_amount += item value (capped at what was paid), payment 'refunded' once the value of all
--     refunded returns reaches the value of all items.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. payment guard
-- ---------------------------------------------------------------------
create or replace function public.guard_payment_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    if old.payment_status::text = 'refunded'
       or (old.payment_status::text = 'paid' and new.payment_status::text <> 'refunded') then
      raise exception 'PAYMENT_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  if old.status::text in ('delivered', 'cancelled') and old.payment_status::text in ('paid', 'refunded') then
    if new.payment_amount is distinct from old.payment_amount
       or new.payment_paid_at is distinct from old.payment_paid_at
       or new.payment_reference is distinct from old.payment_reference then
      raise exception 'PAYMENT_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

revoke all on function public.guard_payment_status() from public, anon, authenticated;

drop trigger if exists orders_guard_payment on public.orders;
create trigger orders_guard_payment before update on public.orders
  for each row execute function public.guard_payment_status();

-- ---------------------------------------------------------------------
-- 2. refund an earlier return
-- ---------------------------------------------------------------------
-- price x quantity of the returned lines, priced from the ORDER's items (same rule as record_order_return)
create or replace function public.return_items_value(p_order_items jsonb, p_return_items jsonb)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    (ri ->> 'quantity')::int * coalesce((
      select max((oi ->> 'price')::numeric)
      from jsonb_array_elements(p_order_items) oi
      where oi ->> 'productId' = ri ->> 'productId'
    ), 0)
  ), 0)
  from jsonb_array_elements(p_return_items) ri
$$;

drop function if exists public.refund_return(uuid, numeric);

create or replace function public.refund_return(p_return_id uuid, p_expected_refunded numeric default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_ret       public.order_returns;
  v_order     public.orders;
  v_value     numeric;
  v_items_all numeric;
  v_items_ref numeric;
  v_paid      numeric;
  v_new_ref   numeric;
  v_full      boolean := false;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  -- lock order first (same lock order as every other path), then re-read the return
  select * into v_ret from public.order_returns where id = p_return_id;
  if not found then raise exception 'RETURN_NOT_FOUND'; end if;
  select * into v_order from public.orders where id = v_ret.order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into v_ret from public.order_returns where id = p_return_id for update;
  if not found then raise exception 'RETURN_NOT_FOUND'; end if;

  if v_ret.refunded then raise exception 'ALREADY_REFUNDED'; end if;
  if v_order.payment_status::text <> 'paid' then raise exception 'NOT_PAID'; end if;
  if p_expected_refunded is not null
     and abs(coalesce(v_order.refunded_amount, 0) - p_expected_refunded) > 0.005 then
    raise exception 'ORDER_CHANGED';
  end if;

  v_value := public.return_items_value(v_order.items, v_ret.items);
  v_paid  := coalesce(v_order.payment_amount, v_order.total);

  select coalesce(sum((e ->> 'price')::numeric * (e ->> 'quantity')::int), 0) into v_items_all
  from jsonb_array_elements(v_order.items) e;

  select coalesce(sum(coalesce(r.refund_amount, public.return_items_value(v_order.items, r.items))), 0) into v_items_ref
  from public.order_returns r
  where r.order_id = v_order.id and r.refunded and r.id <> v_ret.id;

  update public.order_returns set refunded = true, refund_amount = v_value where id = v_ret.id;

  if v_items_ref + v_value >= v_items_all - 0.005 then
    v_full := true;
    v_new_ref := v_paid;
    update public.orders set payment_status = 'refunded', refunded_at = now(), refunded_amount = v_paid
    where id = v_order.id;
  else
    v_new_ref := least(coalesce(v_order.refunded_amount, 0) + v_value, v_paid);
    update public.orders set refunded_amount = v_new_ref where id = v_order.id;
  end if;

  return jsonb_build_object('ok', true, 'refundedAmount', v_new_ref, 'fullyRefunded', v_full);
end $$;

revoke all on function public.refund_return(uuid, numeric) from public, anon;
grant execute on function public.refund_return(uuid, numeric) to authenticated;
