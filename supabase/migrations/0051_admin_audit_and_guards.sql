-- =====================================================================
-- 0051: Admin audit logs & DB-level order status transition guard
-- =====================================================================

-- 1. Append-only admin audit log table
create table if not exists public.admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  target_type text not null,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin audit read" on public.admin_audit_logs;
create policy "admin audit read" on public.admin_audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin audit insert" on public.admin_audit_logs;
create policy "admin audit insert" on public.admin_audit_logs
  for insert to authenticated
  with check (public.is_admin() and actor_id = auth.uid());

-- 2. DB-level guard on orders.status transitions (forward, 1-step revert, cancel)
create or replace function public.guard_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allow_delivered_revert boolean := current_setting('app.allow_delivered_revert', true) = 'on';
  v_has_carrier boolean := nullif(btrim(coalesce(new.shipping_carrier, '')), '') is not null;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Cancellation is allowed from pending, confirmed, or packed
  if new.status = 'cancelled' and old.status in ('pending', 'confirmed', 'packed') then
    return new;
  end if;

  -- 1-step revert (handled by revert_order_status RPC / admin)
  if old.status = 'delivered' and new.status = 'shipped' and v_allow_delivered_revert then
    return new;
  end if;
  if public.is_admin() and (
    (old.status = 'shipped' and new.status = 'packed') or
    (old.status = 'packed' and new.status = 'confirmed') or
    (old.status = 'confirmed' and new.status = 'pending')
  ) then
    return new;
  end if;

  -- Forward fulfilment transitions
  if old.status = 'pending' and new.status = 'confirmed' then
    if new.payment_status <> 'paid' then raise exception 'PAYMENT_REQUIRED'; end if;
    return new;
  end if;

  if old.status = 'confirmed' and new.status in ('packed', 'shipped') then
    if new.payment_status <> 'paid' then raise exception 'PAYMENT_REQUIRED'; end if;
    if new.status = 'shipped' and not v_has_carrier then raise exception 'CARRIER_REQUIRED'; end if;
    return new;
  end if;

  if old.status = 'packed' and new.status = 'shipped' then
    if new.payment_status <> 'paid' then raise exception 'PAYMENT_REQUIRED'; end if;
    if not v_has_carrier then raise exception 'CARRIER_REQUIRED'; end if;
    return new;
  end if;

  if old.status = 'shipped' and new.status = 'delivered' then
    if new.payment_status <> 'paid' then raise exception 'PAYMENT_REQUIRED'; end if;
    return new;
  end if;

  raise exception 'INVALID_STATUS_TRANSITION';
end $$;

drop trigger if exists orders_guard_status on public.orders;
create trigger orders_guard_status
  before update of status on public.orders
  for each row execute function public.guard_order_status_transition();

