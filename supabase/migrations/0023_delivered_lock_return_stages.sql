-- =====================================================================
-- 0023 Lock finished orders. Safe to re-run (idempotent).
--
-- Policy: once an order is 'delivered' or 'cancelled' its FACTS are frozen: shipping (courier, tracking,
-- expected delivery), what was ordered (items, prices, fees, totals), who/where (name, phone, address, city,
-- pincode, note), status, cancel reason/by/at, order code, owner, creation time.
-- Still allowed on those orders (the money trail and bookkeeping):
--   payment_*  (status, method, reference, amount, submitted/paid time, note), refunded_amount, refunded_at,
--   refund_reference, stock_reserved / stock_restored_at, updated_at, and user_id -> NULL (account deletion).
-- The admin's private note lives in order_admin_notes (another table), returns in order_returns /
-- return_requests: none of them are touched by this trigger.
--
-- It is an ALLOW-LIST on purpose: a column added to orders later is locked on finished orders until it is
-- added to the list below (fail closed).
--
-- SECURITY DEFINER functions (record_order_return, refund_order, cancel_order, expire_unpaid_orders,
-- update_order_delivery, submit_payment ...) run as the table owner, but triggers still fire for them,
-- so they are covered too. Every one of them either touches only allow-listed columns on a finished
-- order (refund_order, record_order_return) or only touches orders that are not finished yet
-- (cancel_order -> pending/confirmed, update_order_delivery -> pending, expire_unpaid_orders -> pending,
-- submit_payment -> not paid/cancelled).
-- =====================================================================

create or replace function public.lock_finished_orders()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- columns that may still change on a delivered / cancelled order
  v_mutable constant text[] := array[
    'payment_status', 'payment_method', 'payment_reference', 'payment_amount',
    'payment_submitted_at', 'payment_paid_at', 'payment_note',
    'refunded_amount', 'refunded_at', 'refund_reference',
    'stock_reserved', 'stock_restored_at',
    'updated_at',
    'user_id'            -- compared separately below (only NULL is allowed)
  ];
begin
  if old.status::text not in ('delivered', 'cancelled') then
    return new;
  end if;

  -- auth.users deletion nulls orders.user_id (ON DELETE SET NULL); anything else on user_id is a change
  if new.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'ORDER_LOCKED' using errcode = 'P0001';
  end if;

  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'ORDER_LOCKED' using errcode = 'P0001';
  end if;

  return new;
end $$;

revoke all on function public.lock_finished_orders() from public, anon, authenticated;

drop trigger if exists orders_lock_finished on public.orders;
create trigger orders_lock_finished before update on public.orders
  for each row execute function public.lock_finished_orders();
