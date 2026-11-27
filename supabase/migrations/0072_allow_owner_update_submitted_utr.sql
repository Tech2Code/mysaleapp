-- =====================================================================
-- 0072: Allow signed-in account owner to update their submitted UTR
--  Migration 0061 added `if v_order.payment_status = 'submitted' then
--  raise exception 'ALREADY_SUBMITTED'` unconditionally, which also
--  blocked the signed-in owner from correcting a typo in their UTR
--  while the payment was still pending admin verification.
--  Guests / unauthenticated callers remain blocked with ALREADY_SUBMITTED.
-- =====================================================================

create or replace function public.submit_payment(p_code text, p_phone_last4 text, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_id    uuid;
  v_state text;
  v_ref   text := upper(btrim(coalesce(p_reference, '')));
begin
  if v_ref !~ '^[A-Z0-9]{8,35}$' then raise exception 'INVALID_REFERENCE'; end if;

  select g.res_id, g.res_state into v_id, v_state from public.find_order_for_guest(p_code, p_phone_last4) g;
  if v_state = 'locked' then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;
  if v_state <> 'ok' then return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); end if;

  select * into v_order from public.orders where id = v_id for update;

  if v_order.user_id is not null and auth.uid() is distinct from v_order.user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.payment_status in ('paid', 'refunded') then raise exception 'ALREADY_PAID'; end if;

  -- Only the signed-in owner of an account order may update an already-submitted UTR before admin verifies it.
  if v_order.payment_status = 'submitted'
     and not (v_order.user_id is not null and auth.uid() = v_order.user_id) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

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
