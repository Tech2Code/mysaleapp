-- =====================================================================
-- Order cancellation (customer + admin) and "fresh launch" data reset.
--  * orders        : cancel reason / who / when, refund reference / date
--  * cancel_order  : customer cancels their own order until it is packed
--  * track_order   : also returns the cancellation + refund info
--  * admin_reset_data : admin-only wipe of test data (orders, customers' saved data, catalogue)
-- Safe to re-run.
-- =====================================================================

alter table public.orders
  add column if not exists cancel_reason     text
    check (cancel_reason is null or char_length(cancel_reason) <= 300),
  add column if not exists cancelled_by      text
    check (cancelled_by is null or cancelled_by in ('customer', 'admin')),
  add column if not exists cancelled_at      timestamptz,
  add column if not exists refund_reference  text
    check (refund_reference is null or char_length(refund_reference) <= 60),
  add column if not exists refunded_at       timestamptz;

-- ---------------------------------------------------------------------
-- RPC: cancel_order — a customer cancels before the order is packed.
-- Identified like submit_payment: order code + last 4 phone digits, or signed in as the owner.
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_code text, p_phone_last4 text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
  where order_code = upper(btrim(p_code))
    and (right(phone, 4) = coalesce(p_phone_last4, '') or (auth.uid() is not null and user_id = auth.uid()))
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
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

revoke all on function public.cancel_order(text, text, text) from public;
grant execute on function public.cancel_order(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: track_order — now includes cancellation and refund details
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
    'shippingFee', v_order.shipping_fee,
    'shippingFeeOriginal', v_order.shipping_fee_original,
    'extraFees', v_order.extra_fees,
    'total', v_order.total,
    'paymentStatus', v_order.payment_status,
    'paymentMethod', v_order.payment_method,
    'paymentReference', v_order.payment_reference,
    'paymentAmount', v_order.payment_amount,
    'paymentSubmittedAt', v_order.payment_submitted_at,
    'paymentPaidAt', v_order.payment_paid_at,
    'paymentNote', v_order.payment_note,
    'city', v_order.city,
    'createdAt', v_order.created_at,
    'delivery', case when v_order.status = 'pending' then jsonb_build_object(
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
        'reason', v_order.cancel_reason,
        'by', v_order.cancelled_by,
        'at', v_order.cancelled_at,
        'refundReference', v_order.refund_reference,
        'refundedAt', v_order.refunded_at
      ) else null end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: admin_reset_data — wipe test data. Admin only.
--   orders    : all orders and their status history
--   customers : saved addresses and wishlists (sign-in accounts are kept)
--   catalog   : all products and categories (also clears wishlists, which point at products)
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_data(p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_orders int := 0; v_addresses int := 0; v_wishlists int := 0; v_products int := 0; v_categories int := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  if 'orders' = any (p_scopes) then
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
