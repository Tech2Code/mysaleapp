-- 0026: recording a return ALWAYS closes the order's approved return request.
-- Before, only "Items received" opened from the request (p_request_id) did. Recording a return from the Fulfilment
-- card left the request 'approved', so the order kept saying "Pickup scheduled / Return approved" even after the
-- goods came back and were refunded.

create or replace function public.close_request_on_return()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.return_requests
  set status = 'received', received_at = now(), picked_up_at = coalesce(picked_up_at, now())
  where order_id = new.order_id and status = 'approved';
  return new;
end $$;

revoke all on function public.close_request_on_return() from public, anon, authenticated;

drop trigger if exists order_returns_close_request on public.order_returns;
create trigger order_returns_close_request
  after insert on public.order_returns
  for each row execute function public.close_request_on_return();

-- Repair rows already stuck: an approved request whose order already has a return recorded after it was approved.
update public.return_requests r
set status = 'received', received_at = now(), picked_up_at = coalesce(r.picked_up_at, now())
where r.status = 'approved'
  and exists (select 1 from public.order_returns o where o.order_id = r.order_id and o.created_at >= r.created_at);
