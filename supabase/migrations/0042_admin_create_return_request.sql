-- 0042: the admin can open a return request on the customer's behalf (the customer asked on WhatsApp / phone).
-- Same checks as the customer's request_return (delivered order, items really on the order, not more than was bought
-- minus what already came back, one open request per order) EXCEPT the return window: the shop agreed outside the app.
-- The request is created as 'requested'; the admin then approves it like any other (pickup date) from the status dropdown.

create or replace function public.admin_create_return_request(p_order_id uuid, p_items jsonb, p_reason text, p_details text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order    public.orders;
  v_item     jsonb;
  v_pid      uuid;
  v_qty      int;
  v_ordered  int;
  v_returned int;
  v_inflight int;
  v_name     text;
  v_clean    jsonb := '[]'::jsonb;
  v_req      uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'delivered' then raise exception 'NOT_DELIVERED'; end if;
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
    where o.order_id = p_order_id and (r ->> 'productId')::uuid = v_pid;

    select coalesce(sum((c ->> 'quantity')::int), 0) into v_inflight
    from jsonb_array_elements(v_clean) c where (c ->> 'productId')::uuid = v_pid;

    if v_returned + v_inflight + v_qty > v_ordered then raise exception 'TOO_MANY_RETURNED'; end if;

    v_clean := v_clean || jsonb_build_object('productId', v_pid, 'name', left(coalesce(v_name, ''), 120), 'quantity', v_qty);
  end loop;
  if jsonb_array_length(v_clean) = 0 then raise exception 'NO_ITEMS'; end if;

  begin
    insert into public.return_requests (order_id, items, reason, details)
    values (p_order_id, v_clean, left(btrim(p_reason), 80), nullif(left(btrim(coalesce(p_details, '')), 300), ''))
    returning id into v_req;
  exception when unique_violation then
    raise exception 'ALREADY_OPEN';
  end;

  return jsonb_build_object('ok', true, 'id', v_req);
end $$;

revoke all on function public.admin_create_return_request(uuid, jsonb, text, text) from public, anon;
grant execute on function public.admin_create_return_request(uuid, jsonb, text, text) to authenticated;
