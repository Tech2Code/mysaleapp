-- 0066: Optional Courier Details for Doorstep Exchange (and editable courier on dispatched exchanges)
-- Adds 'set_courier' stage to advance_exchange_fulfillment so admin can attach/update courier details
-- on an approved doorstep exchange (without slowing down 1-click handover) or a dispatched standard exchange.

create or replace function public.advance_exchange_fulfillment(
  p_request_id uuid,
  p_stage text,
  p_tracking text default null,
  p_shipping jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_req            public.return_requests;
  v_clean_tracking text := nullif(left(btrim(coalesce(p_tracking, '')), 200), '');
  v_carrier        text := nullif(left(btrim(coalesce(p_shipping ->> 'carrier', '')), 80), '');
  v_tracking_no    text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingNumber', '')), 60), '');
  v_tracking_url   text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingUrl', '')), 500), '');
  v_expected       text := nullif(left(btrim(coalesce(p_shipping ->> 'expectedDelivery', '')), 20), '');
  v_clean_shipping jsonb := null;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.resolution_type <> 'exchange' then raise exception 'NOT_EXCHANGE'; end if;

  if v_carrier is not null then
    v_clean_shipping := jsonb_build_object(
      'carrier', v_carrier,
      'trackingNumber', v_tracking_no,
      'trackingUrl', v_tracking_url,
      'expectedDelivery', v_expected
    );
    if v_clean_tracking is null then
      v_clean_tracking := left(
        case when v_tracking_no is not null then v_carrier || ' · ' || v_tracking_no else v_carrier end,
        200
      );
    end if;
  end if;

  if p_stage = 'set_courier' then
    if v_clean_shipping is null then raise exception 'COURIER_REQUIRED'; end if;
    if not (
      (v_req.status = 'approved' and v_req.exchange_mode = 'doorstep')
      or (v_req.status = 'received' and v_req.exchange_status = 'dispatched')
    ) then
      raise exception 'INVALID_STAGE';
    end if;
    update public.return_requests
    set exchange_shipping = v_clean_shipping,
        exchange_tracking = coalesce(v_clean_tracking, exchange_tracking)
    where id = p_request_id;
    return jsonb_build_object('ok', true);
  end if;

  if v_req.status <> 'received' then raise exception 'NOT_RECEIVED'; end if;
  if v_req.exchange_mode = 'doorstep' then raise exception 'CANNOT_UNDO'; end if;

  if p_stage = 'dispatched' then
    if v_req.exchange_status is not null then raise exception 'ALREADY_DISPATCHED'; end if;
    update public.return_requests
    set exchange_status = 'dispatched',
        exchange_shipped_at = now(),
        exchange_tracking = v_clean_tracking,
        exchange_shipping = v_clean_shipping
    where id = p_request_id;
  elsif p_stage = 'delivered' then
    if v_req.exchange_status <> 'dispatched' then raise exception 'NOT_DISPATCHED'; end if;
    update public.return_requests
    set exchange_status = 'delivered',
        exchange_delivered_at = now()
    where id = p_request_id;
  elsif p_stage = 'undo_dispatched' then
    if v_req.exchange_status <> 'dispatched' then raise exception 'CANNOT_UNDO'; end if;
    update public.return_requests
    set exchange_status = null,
        exchange_shipped_at = null,
        exchange_tracking = null,
        exchange_shipping = null
    where id = p_request_id;
  elsif p_stage = 'undo_delivered' then
    if v_req.exchange_status <> 'delivered' then raise exception 'CANNOT_UNDO'; end if;
    update public.return_requests
    set exchange_status = 'dispatched',
        exchange_delivered_at = null
    where id = p_request_id;
  else
    raise exception 'INVALID_STAGE';
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.advance_exchange_fulfillment(uuid, text, text, jsonb) from public, anon;
grant execute on function public.advance_exchange_fulfillment(uuid, text, text, jsonb) to authenticated;

-- Also clear exchange_shipping/exchange_tracking if admin undoes approval on a doorstep exchange
create or replace function public.undo_return_step(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_req   public.return_requests;
  v_state text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_PENDING'; end if;

  if v_req.status = 'approved' and v_req.picked_up_at is not null then
    update public.return_requests set picked_up_at = null where id = p_request_id;
    v_state := 'approved';
  elsif v_req.status = 'approved' then
    update public.return_requests
    set status = 'requested',
        decided_at = null,
        admin_note = null,
        pickup_date = null,
        exchange_mode = 'standard',
        exchange_shipping = null,
        exchange_tracking = null
    where id = p_request_id;
    v_state := 'requested';
  elsif v_req.status = 'rejected' then
    if exists (
      select 1 from public.return_requests
      where order_id = v_req.order_id and id <> p_request_id and status in ('requested', 'approved')
    ) then raise exception 'ANOTHER_OPEN'; end if;
    update public.return_requests
    set status = 'requested',
        decided_at = null,
        admin_note = null,
        pickup_date = null,
        exchange_mode = 'standard',
        exchange_shipping = null,
        exchange_tracking = null
    where id = p_request_id;
    v_state := 'requested';
  else
    raise exception 'CANNOT_UNDO';
  end if;

  return jsonb_build_object('ok', true, 'state', v_state);
end $$;

revoke all on function public.undo_return_step(uuid) from public, anon;
grant execute on function public.undo_return_step(uuid) to authenticated;
