-- 0044: one-off data fix. Order KK-5ZXCX7 (packed) had its payment marked "refunded" by mistake from the manual
-- payment form (before migration 0043 forbade refunding an order that has not shipped). The owner asked for it to be
-- reversed: the payment goes back to "paid" and the refund bookkeeping is cleared. The order status (packed) is untouched.
-- The payment guard trigger refuses refunded -> paid by design, so it is switched off for this single statement only.
-- Scoped to that exact order AND its current state, so running it again, or on any other data, changes nothing.

alter table public.orders disable trigger orders_guard_payment;

update public.orders
set payment_status = 'paid',
    refunded_amount = 0,
    refunded_at = null
where id = '96a45f29-d911-4b73-b7a4-49defc542f8c'
  and order_code = 'KK-5ZXCX7'
  and status::text = 'packed'
  and payment_status::text = 'refunded';

alter table public.orders enable trigger orders_guard_payment;
