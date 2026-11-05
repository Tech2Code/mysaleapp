-- =====================================================================
-- Payments (UPI, verified by the admin), saved addresses, and editable order delivery.
--  * store_settings : UPI id + payee name shown to customers on the payment screen
--  * orders         : payment reference (UTR), amount, dates, note; COD removed
--  * submit_payment : customer submits the UTR after paying
--  * update_order_delivery : customer edits the delivery address until the order is confirmed
--  * addresses      : address book per signed-in customer
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Store settings: UPI details
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists upi_id         text,
  add column if not exists upi_payee_name text;

alter table public.store_settings drop constraint if exists store_settings_upi_id_check;
alter table public.store_settings add constraint store_settings_upi_id_check
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$');
alter table public.store_settings drop constraint if exists store_settings_upi_payee_check;
alter table public.store_settings add constraint store_settings_upi_payee_check
  check (upi_payee_name is null or char_length(upi_payee_name) between 2 and 60);

-- ---------------------------------------------------------------------
-- Orders: payment details. Cash on delivery is not supported.
-- ---------------------------------------------------------------------
update public.orders set payment_method = 'other' where payment_method = 'cod';

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'submitted', 'paid', 'failed', 'refunded'));
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('upi', 'bank_transfer', 'card', 'cash', 'other'));

alter table public.orders
  add column if not exists payment_reference    text
    check (payment_reference is null or char_length(payment_reference) between 8 and 35),
  add column if not exists payment_amount       numeric(10,2) check (payment_amount is null or payment_amount >= 0),
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_paid_at      timestamptz,
  -- visible to the customer, e.g. the reason a payment was rejected
  add column if not exists payment_note         text
    check (payment_note is null or char_length(payment_note) <= 300),
  add column if not exists delivery_updated_at  timestamptz;

-- One UTR can only back one order (stops the same payment being claimed twice).
create unique index if not exists orders_payment_reference_active_uniq
  on public.orders (upper(payment_reference))
  where payment_reference is not null and payment_status in ('submitted', 'paid');

-- ---------------------------------------------------------------------
-- RPC: submit_payment — customer says "I paid", with the UPI reference (UTR).
-- Identified by order code + last 4 phone digits (guests) or by being signed in as the owner.
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_ref   text := upper(btrim(coalesce(p_reference, '')));
begin
  if v_ref !~ '^[A-Z0-9]{8,35}$' then raise exception 'INVALID_REFERENCE'; end if;

  select * into v_order from public.orders
  where order_code = upper(btrim(p_code))
    and (right(phone, 4) = coalesce(p_phone_last4, '') or (auth.uid() is not null and user_id = auth.uid()));

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status = 'paid' then raise exception 'ALREADY_PAID'; end if;

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

-- ---------------------------------------------------------------------
-- RPC: update_order_delivery — change name/phone/address while the order is still "pending".
-- ---------------------------------------------------------------------
create or replace function public.update_order_delivery(p_code text, p_phone_last4 text, p_customer jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order   public.orders;
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

  select * into v_order from public.orders
  where order_code = upper(btrim(p_code))
    and (right(phone, 4) = coalesce(p_phone_last4, '') or (auth.uid() is not null and user_id = auth.uid()));

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending' then raise exception 'NOT_EDITABLE'; end if;

  update public.orders
  set customer_name = v_name, phone = v_phone, address = v_address,
      city = v_city, pincode = v_pincode, note = v_note, delivery_updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('phoneLast4', right(v_phone, 4));
end $$;

revoke all on function public.update_order_delivery(text, text, jsonb) from public;
grant execute on function public.update_order_delivery(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- track_order: payment details, and the delivery details while they are still editable
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
    -- only while the order can still be edited (not yet confirmed)
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
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'changedAt', h.changed_at) order by h.changed_at)
      from public.order_status_history h where h.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Address book
-- ---------------------------------------------------------------------
create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null default 'Home' check (char_length(label) between 1 and 20),
  full_name  text not null check (char_length(full_name) between 2 and 80),
  phone      text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address    text not null check (char_length(address) between 5 and 300),
  city       text not null check (char_length(city) between 2 and 60),
  pincode    text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);
-- at most one default address per customer
create unique index if not exists addresses_one_default_uniq on public.addresses (user_id) where is_default;

drop trigger if exists addresses_touch on public.addresses;
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();

create or replace function public.limit_addresses()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
    raise exception 'ADDRESS_LIMIT';
  end if;
  return new;
end $$;

drop trigger if exists addresses_limit on public.addresses;
create trigger addresses_limit before insert on public.addresses
  for each row execute function public.limit_addresses();

alter table public.addresses enable row level security;
drop policy if exists "addresses own" on public.addresses;
create policy "addresses own" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Move the single address that used to live on the profile into the address book.
insert into public.addresses (user_id, label, full_name, phone, address, city, pincode, is_default)
select p.id, 'Home', coalesce(nullif(btrim(p.full_name), ''), 'Customer'), p.phone, p.address, p.city, p.pincode, true
from public.profiles p
where p.address is not null and char_length(p.address) between 5 and 300
  and p.city is not null and char_length(p.city) between 2 and 60
  and p.pincode ~ '^[1-9][0-9]{5}$' and p.phone ~ '^[6-9][0-9]{9}$'
  and not exists (select 1 from public.addresses a where a.user_id = p.id);
