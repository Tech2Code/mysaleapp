-- 0067: Accept optional courier/shipping details directly during Doorstep Exchange approval
-- Keeps the Order Status dropdown clean: admin can optionally enter courier + AWB + tracking link
-- right inside "Approve this exchange?" when selecting Doorstep Exchange, or leave blank for direct handover.

drop function if exists public.decide_return_request(uuid, boolean, text, date, text);
drop function if exists public.decide_return_request(uuid, boolean, text, date, text, jsonb);

create or replace function public.decide_return_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text,
  p_pickup_date date default null,
  p_exchange_mode text default 'standard',
  p_shipping jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today          date := (now() at time zone 'Asia/Kolkata')::date;
  v_mode           text := case when lower(btrim(coalesce(p_exchange_mode, 'standard'))) = 'doorstep' then 'doorstep' else 'standard' end;
  v_carrier        text := nullif(left(btrim(coalesce(p_shipping ->> 'carrier', '')), 80), '');
  v_tracking_no    text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingNumber', '')), 60), '');
  v_tracking_url   text := nullif(left(btrim(coalesce(p_shipping ->> 'trackingUrl', '')), 500), '');
  v_expected       text := nullif(left(btrim(coalesce(p_shipping ->> 'expectedDelivery', '')), 20), '');
  v_clean_shipping jsonb := null;
  v_clean_tracking text := null;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 2 then raise exception 'NOTE_REQUIRED'; end if;
  if p_approve and p_pickup_date is not null and (p_pickup_date < v_today or p_pickup_date > v_today + 90) then
    raise exception 'BAD_PICKUP_DATE';
  end if;

  if p_approve and v_mode = 'doorstep' and v_carrier is not null then
    v_clean_shipping := jsonb_build_object(
      'carrier', v_carrier,
      'trackingNumber', v_tracking_no,
      'trackingUrl', v_tracking_url,
      'expectedDelivery', coalesce(v_expected, case when p_pickup_date is not null then to_char(p_pickup_date, 'YYYY-MM-DD') else null end)
    );
    v_clean_tracking := left(
      case when v_tracking_no is not null then v_carrier || ' · ' || v_tracking_no else v_carrier end,
      200
    );
  end if;

  update public.return_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
      pickup_date = case when p_approve then p_pickup_date else null end,
      exchange_mode = case when p_approve and resolution_type = 'exchange' then v_mode else 'standard' end,
      exchange_shipping = case when p_approve and resolution_type = 'exchange' and v_mode = 'doorstep' then v_clean_shipping else null end,
      exchange_tracking = case when p_approve and resolution_type = 'exchange' and v_mode = 'doorstep' then v_clean_tracking else null end,
      decided_at = now()
  where id = p_request_id and status = 'requested';
  if not found then raise exception 'NOT_PENDING'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_return_request(uuid, boolean, text, date, text, jsonb) from public, anon;
grant execute on function public.decide_return_request(uuid, boolean, text, date, text, jsonb) to authenticated;
