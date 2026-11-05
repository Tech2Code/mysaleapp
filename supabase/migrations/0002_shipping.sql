-- =====================================================================
-- Shipping details for orders (courier, tracking number/link, ETA).
-- Run in Supabase → SQL Editor AFTER 0001_init.sql. Safe to re-run.
-- =====================================================================

alter table public.orders
  add column if not exists shipping_carrier  text
    check (shipping_carrier is null or char_length(shipping_carrier) between 2 and 60),
  add column if not exists tracking_number   text
    check (tracking_number is null or char_length(tracking_number) between 1 and 60),
  -- only http(s) links, so a "javascript:" URL can never be stored and shown to customers
  add column if not exists tracking_url      text
    check (tracking_url is null or (char_length(tracking_url) <= 500 and tracking_url ~* '^https?://')),
  add column if not exists expected_delivery date;

-- Public order tracking now also returns the shipping details (still no phone/address).
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
    'shipping', case
      when v_order.shipping_carrier is null then null
      else jsonb_build_object(
        'carrier', v_order.shipping_carrier,
        'trackingNumber', v_order.tracking_number,
        'trackingUrl', v_order.tracking_url,
        'expectedDelivery', v_order.expected_delivery
      )
    end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
