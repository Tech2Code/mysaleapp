-- 0056: Customer Account Deactivation & Automatic Recovery Flow
-- Allows customers to deactivate their account from /account/profile when they have no active unfulfilled orders
-- or open return requests. If they sign back in later (via Email/Password or Google OAuth), their account is
-- automatically reactivated with all past order history and invoices preserved.

-- 1. Add deactivation columns to profiles ------------------------------
alter table public.profiles
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text
    check (deactivation_reason is null or length(deactivation_reason) <= 200);

-- 2. RPC: deactivate_my_account ----------------------------------------
create or replace function public.deactivate_my_account(p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_clean_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if public.is_admin() then
    raise exception 'ADMIN_CANNOT_DEACTIVATE';
  end if;

  -- Block deactivation while an order is still in progress (pending, confirmed, packed, shipped)
  if exists (
    select 1 from public.orders o
    where o.user_id = v_uid
      and o.status in ('pending', 'confirmed', 'packed', 'shipped')
  ) then
    raise exception 'ACTIVE_ORDERS_EXIST';
  end if;

  -- Block deactivation while an order has an open return/exchange request
  if exists (
    select 1
    from public.return_requests r
    join public.orders o on o.id = r.order_id
    where o.user_id = v_uid
      and r.status in ('requested', 'approved')
  ) then
    raise exception 'OPEN_RETURNS_EXIST';
  end if;

  insert into public.profiles (id, deactivated_at, deactivation_reason)
  values (v_uid, now(), v_clean_reason)
  on conflict (id) do update
  set deactivated_at = now(),
      deactivation_reason = excluded.deactivation_reason;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.deactivate_my_account(text) from public, anon;
grant execute on function public.deactivate_my_account(text) to authenticated;

-- 3. RPC: reactivate_my_account ----------------------------------------
-- Automatically restores a deactivated customer profile when they sign back in.
create or replace function public.reactivate_my_account()
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_restored boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  update public.profiles
  set deactivated_at = null,
      deactivation_reason = null
  where id = v_uid
    and deactivated_at is not null;

  v_restored := found;
  return v_restored;
end $$;

revoke all on function public.reactivate_my_account() from public, anon;
grant execute on function public.reactivate_my_account() to authenticated;
