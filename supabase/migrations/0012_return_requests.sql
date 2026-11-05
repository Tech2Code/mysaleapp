-- =====================================================================
-- Customer return requests.
--   Customer asks  ->  admin approves (with instructions) or rejects (with a reason)
--   ->  the goods arrive and the admin records the return (0011), which closes the request.
--  * store_settings.return_window_days : how many days after delivery a return can be requested (0 = off)
--  * return_requests                   : one row per request; at most ONE open request per order
--  * request_return / withdraw_return_request : customer actions (guest by code + last 4 digits, or signed in)
--  * decide_return_request             : admin approves or rejects
--  * record_order_return               : now also closes the linked request
--  * track_order                       : also returns the order's returns and return requests
-- Safe to re-run.
-- =====================================================================

alter table public.store_settings
  add column if not exists return_window_days int not null default 7;
alter table public.store_settings drop constraint if exists store_settings_return_window_check;
alter table public.store_settings add constraint store_settings_return_window_check
  check (return_window_days between 0 and 90);

create table if not exists public.return_requests (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  -- [{ "productId": "...", "name": "...", "quantity": 1 }]  (names are copied from the order)
  items       jsonb not null,
  reason      text not null check (char_length(reason) between 2 and 80),
  details     text check (details is null or char_length(details) <= 300),
  status      text not null default 'requested'
              check (status in ('requested', 'approved', 'rejected', 'withdrawn', 'received')),
  -- shown to the customer: pickup / shipping instructions, or why it was rejected
  admin_note  text check (admin_note is null or char_length(admin_note) <= 300),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  received_at timestamptz
);
create index if not exists return_requests_order_idx on public.return_requests (order_id);
create index if not exists return_requests_status_idx on public.return_requests (status);
-- only one open request per order
create unique index if not exists return_requests_one_open_uniq
  on public.return_requests (order_id) where status in ('requested', 'approved');

alter table public.return_requests enable row level security;
drop policy if exists "return requests read own or admin" on public.return_requests;
create policy "return requests read own or admin" on public.return_requests for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
-- no insert/update/delete policies: rows are only written by the functions below

-- the moment an order was delivered (latest "delivered" in its history)
create or replace function public.order_delivered_at(p_order_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(changed_at) from public.order_status_history where order_id = p_order_id and status = 'delivered'
$$;
revoke all on function public.order_delivered_at(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Customer: ask for a return
-- ---------------------------------------------------------------------
create or replace function public.request_return(p_code text, p_phone_last4 text, p_items jsonb, p_reason text, p_details text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order     public.orders;
  v_id        uuid;
  v_state     text;
  v_days      int;
  v_delivered timestamptz;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_ordered   int;
  v_returned  int;
  v_name      text;
  v_clean     jsonb := '[]'::jsonb;
  v_req       uuid;
begin
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;

  select return_window_days into v_days from public.store_settings limit 1;
  if coalesce(v_days, 0) <= 0 then raise exception 'RETURNS_OFF'; end if;
  v_delivered := public.order_delivered_at(v_order.id);
  if v_delivered is null or now() > v_delivered + make_interval(days => v_days) then raise exception 'WINDOW_CLOSED'; end if;

  if length(btrim(coalesce(p_reason, ''))) < 2 then raise exception 'REASON_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0), max(e ->> 'name') into v_ordered, v_name
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = v_order.id and (r ->> 'productId')::uuid = v_pid;
    if v_returned + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details)
    values (v_order.id, v_clean, left(btrim(p_reason), 80), nullif(left(btrim(coalesce(p_details, '')), 300), ''))
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.request_return(text, text, jsonb, text, text) from public;
grant execute on function public.request_return(text, text, jsonb, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Customer: withdraw a request that hasn't been decided yet
-- ---------------------------------------------------------------------
create or replace function public.withdraw_return_request(p_code text, p_phone_last4 text, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_state text;
begin
  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  update public.return_requests set status = 'withdrawn'
  where id = p_request_id and order_id = v_id and status = 'requested';
  if not found then raise exception 'CANNOT_WITHDRAW'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.withdraw_return_request(text, text, uuid) from public;
grant execute on function public.withdraw_return_request(text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin: approve or reject
-- ---------------------------------------------------------------------
create or replace function public.decide_return_request(p_request_id uuid, p_approve boolean, p_note text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 2 then raise exception 'NOTE_REQUIRED'; end if;

  update public.return_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
      decided_at = now()
  where id = p_request_id and status = 'requested';
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_return_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_return_request(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Admin: goods arrived (0011), now able to close the linked request
-- ---------------------------------------------------------------------
drop function if exists public.record_order_return(uuid, jsonb, text, boolean);

create or replace function public.record_order_return(
  p_order_id uuid, p_items jsonb, p_reason text, p_refund boolean, p_request_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order     public.orders;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_ordered   int;
  v_returned  int;
  v_restocked int := 0;
  v_clean     jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'NO_ITEMS'; end if;

  if p_request_id is not null and not exists (
    select 1 from public.return_requests where id = p_request_id and order_id = p_order_id and status in ('requested', 'approved')
  ) then raise exception 'REQUEST_NOT_OPEN'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then continue; end if;

    select coalesce(sum((e ->> 'quantity')::int), 0) into v_ordered
    from jsonb_array_elements(v_order.items) e where (e ->> 'productId')::uuid = v_pid;
    if v_ordered = 0 then raise exception 'ITEM_NOT_IN_ORDER'; end if;

    select coalesce(sum((r ->> 'quantity')::int), 0) into v_returned
    from public.order_returns o, jsonb_array_elements(o.items) r
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;
    if v_returned + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    if coalesce((v_item ->> 'restock')::boolean, false) then
      update public.products set stock = stock + v_qty where id = v_pid;
      v_restocked := v_restocked + v_qty;
    end if;

    v_clean := v_clean || jsonb_build_object(
      'productId', v_pid, 'name', left(coalesce(v_item ->> 'name', ''), 120), 'quantity', v_qty,
      'restock', coalesce((v_item ->> 'restock')::boolean, false)
    );
  end loop;

  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  insert into public.order_returns (order_id, items, reason, refunded)
  values (p_order_id, v_clean, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), coalesce(p_refund, false));

  if p_request_id is not null then
    update public.return_requests set status = 'received', received_at = now() where id = p_request_id;
  end if;

  if coalesce(p_refund, false) and v_order.payment_status = 'paid' then
    update public.orders set payment_status = 'refunded', refunded_at = now() where id = p_order_id;
  end if;

  return jsonb_build_object('ok', true, 'restocked', v_restocked);
end $$;

revoke all on function public.record_order_return(uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.record_order_return(uuid, jsonb, text, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- track_order: + returns and return requests
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_code text, p_phone_last4 text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
begin
  if p_phone_last4 !~ '^[0-9]{4}$' then return null; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return null; end if;

  select * into v_order from public.orders where id = v_id;

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
    ), '[]'::jsonb),
    'returnRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'items', r.items, 'reason', r.reason, 'details', r.details, 'status', r.status,
        'adminNote', r.admin_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at
      ) order by r.created_at)
      from public.return_requests r where r.order_id = v_order.id
    ), '[]'::jsonb),
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'items', o.items, 'reason', o.reason, 'refunded', o.refunded, 'createdAt', o.created_at
      ) order by o.created_at)
      from public.order_returns o where o.order_id = v_order.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
