-- 0041: let the admin take back a mis-click on a return REQUEST, one step at a time.
--   pickup marked successful  -> back to "pickup scheduled"
--   approved (no pickup yet)  -> back to "requested" (waiting for a decision)
--   rejected                  -> back to "requested" (only if the customer has no other open request)
-- Not undoable here: "received" (stock was changed and a return row exists) and refunds (money). Those stay on record.

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
    set status = 'requested', decided_at = null, admin_note = null, pickup_date = null
    where id = p_request_id;
    v_state := 'requested';
  elsif v_req.status = 'rejected' then
    if exists (
      select 1 from public.return_requests
      where order_id = v_req.order_id and id <> p_request_id and status in ('requested', 'approved')
    ) then raise exception 'ANOTHER_OPEN'; end if;
    update public.return_requests
    set status = 'requested', decided_at = null, admin_note = null, pickup_date = null
    where id = p_request_id;
    v_state := 'requested';
  else
    raise exception 'CANNOT_UNDO';
  end if;

  return jsonb_build_object('ok', true, 'state', v_state);
end $$;

revoke all on function public.undo_return_step(uuid) from public, anon;
grant execute on function public.undo_return_step(uuid) to authenticated;
