-- 0043: a paid payment can only be marked refunded once the order has shipped, been delivered or been cancelled.
-- Before dispatch (pending / confirmed / packed) the order must be CANCELLED first (cancel_order / admin cancel),
-- otherwise it would still be packed and sent with no money behind it and its reserved stock never released.
-- Same rule as src/features/orders/payment-rules.ts (REFUNDABLE_STATUSES). Body = the live guard_payment_status
-- (0024) plus the new check; paths that mark payments refunded (refund_order, record_order_return,
-- refund_return) run on cancelled or delivered orders, so they are unaffected.

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
    if new.payment_status::text = 'refunded' and new.status::text in ('pending', 'confirmed', 'packed') then
      raise exception 'REFUND_BEFORE_DISPATCH' using errcode = 'P0001';
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
