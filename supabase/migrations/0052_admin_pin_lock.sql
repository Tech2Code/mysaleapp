-- =====================================================================
-- 0052: Admin 4-digit Quick PIN Lock (12h PIN window + 7-day full session)
--  1. Adds `pin_hash`, `pin_mode` ('unset' | 'enabled' | 'disabled'),
--     `pin_updated_at`, `pin_failed_attempts`, and `pin_locked_until` to `public.admins`.
--  2. Adds SECURITY DEFINER RPCs:
--     - `get_admin_pin_state()`: returns mode, hasPin, updatedAt, lockedUntil
--     - `set_admin_pin(p_pin text)`: stores bcrypt hash (`crypt(p_pin, gen_salt('bf'))`), enables PIN
--     - `verify_admin_pin(p_pin text)`: verifies 4-digit PIN with 5-attempt / 10-minute brute-force lock
--     - `disable_admin_pin()`: clears PIN hash and marks `pin_mode = 'disabled'` ("Don't use PIN")
--     - `clear_admin_pin_lock()`: clears brute-force lock after full password verification
-- =====================================================================

alter table public.admins
  add column if not exists pin_hash text,
  add column if not exists pin_mode text not null default 'unset',
  add column if not exists pin_updated_at timestamptz,
  add column if not exists pin_failed_attempts int not null default 0,
  add column if not exists pin_locked_until timestamptz;

alter table public.admins drop constraint if exists admins_pin_mode_check;
alter table public.admins add constraint admins_pin_mode_check
  check (pin_mode in ('unset', 'enabled', 'disabled'));

-- 1. Read the current admin's PIN configuration
create or replace function public.get_admin_pin_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row public.admins%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid();

  return jsonb_build_object(
    'mode', coalesce(v_row.pin_mode, 'unset'),
    'hasPin', (v_row.pin_hash is not null and v_row.pin_mode = 'enabled'),
    'updatedAt', v_row.pin_updated_at,
    'lockedUntil', case
      when v_row.pin_locked_until is not null and v_row.pin_locked_until > now()
      then v_row.pin_locked_until
      else null
    end
  );
end $$;

-- 2. Set or update the 4-digit PIN
create or replace function public.set_admin_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pin text := btrim(coalesce(p_pin, ''));
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits' using errcode = '22023';
  end if;

  update public.admins
     set pin_hash            = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         pin_mode            = 'enabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

-- 3. Verify the 4-digit PIN (with 5-strike / 10-minute brute-force protection)
create or replace function public.verify_admin_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pin      text := btrim(coalesce(p_pin, ''));
  v_row      public.admins%rowtype;
  v_attempts int;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row
    from public.admins
   where user_id = auth.uid()
   for update;

  if v_row.user_id is null or v_row.pin_mode <> 'enabled' or v_row.pin_hash is null then
    return jsonb_build_object('ok', true);
  end if;

  if v_row.pin_locked_until is not null and v_row.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'lockedUntil', v_row.pin_locked_until,
      'error', 'Too many wrong PIN attempts. Unlock with your account password or wait a few minutes.'
    );
  end if;

  if v_pin ~ '^[0-9]{4}$' and v_row.pin_hash = extensions.crypt(v_pin, v_row.pin_hash) then
    update public.admins
       set pin_failed_attempts = 0,
           pin_locked_until    = null
     where user_id = auth.uid();
    return jsonb_build_object('ok', true);
  end if;

  v_attempts := case
    when v_row.pin_locked_until is not null and v_row.pin_locked_until <= now() then 1
    else coalesce(v_row.pin_failed_attempts, 0) + 1
  end;

  if v_attempts >= 5 then
    update public.admins
       set pin_failed_attempts = v_attempts,
           pin_locked_until    = now() + interval '10 minutes'
     where user_id = auth.uid();
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'lockedUntil', now() + interval '10 minutes',
      'error', '5 wrong attempts — PIN locked for 10 minutes. Use "Forgot PIN? Unlock with password" below.'
    );
  end if;

  update public.admins
     set pin_failed_attempts = v_attempts,
         pin_locked_until    = null
   where user_id = auth.uid();

  return jsonb_build_object(
    'ok', false,
    'locked', false,
    'remainingAttempts', 5 - v_attempts,
    'error', format('Incorrect PIN (%s %s left)', 5 - v_attempts, case when 5 - v_attempts = 1 then 'try' else 'tries' end)
  );
end $$;

-- 4. Disable / remove the PIN ("Don't use PIN")
create or replace function public.disable_admin_pin()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.admins
     set pin_hash            = null,
         pin_mode            = 'disabled',
         pin_updated_at      = now(),
         pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

-- 5. Clear PIN lock after password verification
create or replace function public.clear_admin_pin_lock()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.admins
     set pin_failed_attempts = 0,
         pin_locked_until    = null
   where user_id = auth.uid();
end $$;

revoke all on function public.get_admin_pin_state() from public, anon;
grant execute on function public.get_admin_pin_state() to authenticated;

revoke all on function public.set_admin_pin(text) from public, anon;
grant execute on function public.set_admin_pin(text) to authenticated;

revoke all on function public.verify_admin_pin(text) from public, anon;
grant execute on function public.verify_admin_pin(text) to authenticated;

revoke all on function public.disable_admin_pin() from public, anon;
grant execute on function public.disable_admin_pin() to authenticated;

revoke all on function public.clear_admin_pin_lock() from public, anon;
grant execute on function public.clear_admin_pin_lock() to authenticated;
