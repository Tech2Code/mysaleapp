-- =====================================================================
-- 0048: Admin vs Customer role visibility in Supabase & First-Admin Bootstrap
--  1. Adds `role` ('admin' | 'customer') to `public.profiles` so Table Editor -> profiles
--     clearly shows who is an admin and who is a customer.
--  2. Adds a 2-way sync between `public.admins`, `public.profiles.role`, and `auth.users`:
--     - In Supabase Dashboard -> Authentication -> Users, the "Display name" column
--       automatically shows "<Name> (Admin)" for admins and "<Name>" for customers,
--       and `raw_app_meta_data.role` / `raw_user_meta_data.role` is set to "admin" | "customer".
--     - Changing `role` in Supabase Table Editor -> `profiles` ('admin' <-> 'customer')
--       automatically inserts/deletes the row in `public.admins`.
--     - RLS/Trigger guard prevents non-admin API callers from escalating their own `role`.
--  3. Adds `public.bootstrap_first_admin()` so the configured `ADMIN_EMAIL` can claim
--     the initial admin account when `public.admins` is empty.
-- =====================================================================

-- 1. Add role column to public.profiles
alter table public.profiles
  add column if not exists role text not null default 'customer';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'customer'));

-- Helper: strip any trailing " (Admin)" suffix from a display name so profiles.full_name stays clean
create or replace function public.clean_person_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    left(
      btrim(regexp_replace(coalesce(p_name, ''), '\s*\(Admin\)\s*$', '', 'i')),
      80
    ),
    ''
  );
$$;

-- Helper: format the display name shown in Supabase Dashboard -> Authentication -> Users
create or replace function public.format_auth_display_name(p_name text, p_is_admin boolean)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_is_admin then
      case
        when public.clean_person_name(p_name) is not null
          then left(public.clean_person_name(p_name), 72) || ' (Admin)'
        else 'Admin'
      end
    else public.clean_person_name(p_name)
  end;
$$;

-- 2. Guard & 2-way sync on public.profiles
create or replace function public.before_profile_write_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_admins boolean;
  v_caller_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
begin
  -- Always keep profiles.full_name clean (without the "(Admin)" suffix used in auth.users)
  new.full_name := public.clean_person_name(new.full_name);

  select exists (select 1 from public.admins a where a.user_id = new.id)
    into v_in_admins;

  if tg_op = 'INSERT' then
    if pg_trigger_depth() <= 1 and v_caller_role in ('authenticated', 'anon') and not public.is_admin() then
      new.role := case when v_in_admins then 'admin' else 'customer' end;
    elsif new.role is null then
      new.role := case when v_in_admins then 'admin' else 'customer' end;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      -- Block non-admin API callers from changing their own role column
      if pg_trigger_depth() <= 1 and v_caller_role in ('authenticated', 'anon') and not public.is_admin() then
        new.role := old.role;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_before_write_role on public.profiles;
create trigger profiles_before_write_role
  before insert or update on public.profiles
  for each row execute function public.before_profile_write_sync_role();

-- Sync public.profiles (name, phone, role) -> public.admins & auth.users
create or replace function public.sync_profile_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone        text    := nullif(left(btrim(coalesce(new.phone, '')), 20), '');
  v_clean_name   text    := public.clean_person_name(new.full_name);
  v_is_admin     boolean := (new.role = 'admin');
  v_role_label   text    := case when v_is_admin then 'admin' else 'customer' end;
  v_display_name text    := public.format_auth_display_name(v_clean_name, v_is_admin);
begin
  -- If `role` was edited in Table Editor -> profiles (or by an admin), sync public.admins
  if pg_trigger_depth() <= 1 then
    if v_is_admin then
      insert into public.admins (user_id)
      values (new.id)
      on conflict (user_id) do nothing;
    else
      delete from public.admins where user_id = new.id;
    end if;
  end if;

  begin
    update auth.users u
       set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object(
                  'full_name', v_display_name,
                  'display_name', v_display_name,
                  'phone', v_phone,
                  'role', v_role_label
                ),
           raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('role', v_role_label),
           phone = case
             when v_phone is null then null
             when not exists (select 1 from auth.users o where o.phone = v_phone and o.id <> new.id) then v_phone
             else u.phone
           end
     where u.id = new.id
       and (
         u.phone is distinct from v_phone
         or (u.raw_user_meta_data ->> 'phone') is distinct from v_phone
         or (u.raw_user_meta_data ->> 'full_name') is distinct from v_display_name
         or (u.raw_user_meta_data ->> 'display_name') is distinct from v_display_name
         or (u.raw_user_meta_data ->> 'role') is distinct from v_role_label
         or (u.raw_app_meta_data ->> 'role') is distinct from v_role_label
       );
  exception when others then
    null;
  end;

  return new;
end $$;

drop trigger if exists profiles_sync_auth_user on public.profiles;
create trigger profiles_sync_auth_user
  after insert or update of full_name, phone, role on public.profiles
  for each row execute function public.sync_profile_to_auth_user();

-- 3. Trigger on public.admins -> syncs public.profiles.role and auth.users metadata
create or replace function public.sync_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid;
  v_is_admin     boolean;
  v_role_label   text;
  v_clean_name   text;
  v_phone        text;
  v_display_name text;
begin
  if tg_op = 'DELETE' then
    v_user_id  := old.user_id;
    v_is_admin := false;
  else
    v_user_id  := new.user_id;
    v_is_admin := true;
  end if;

  v_role_label := case when v_is_admin then 'admin' else 'customer' end;

  update public.profiles
     set role = v_role_label
   where id = v_user_id
     and role is distinct from v_role_label;

  select public.clean_person_name(p.full_name), p.phone
    into v_clean_name, v_phone
    from public.profiles p
   where p.id = v_user_id;

  v_display_name := public.format_auth_display_name(v_clean_name, v_is_admin);

  begin
    update auth.users u
       set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object(
                  'full_name', coalesce(v_display_name, public.format_auth_display_name(u.raw_user_meta_data ->> 'full_name', v_is_admin)),
                  'display_name', coalesce(v_display_name, public.format_auth_display_name(u.raw_user_meta_data ->> 'full_name', v_is_admin)),
                  'role', v_role_label
                ),
           raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('role', v_role_label)
     where u.id = v_user_id;
  exception when others then
    null;
  end;

  return coalesce(new, old);
end $$;

drop trigger if exists admins_sync_role on public.admins;
create trigger admins_sync_role
  after insert or delete on public.admins
  for each row execute function public.sync_admin_membership();

-- 4. Update handle_new_user() so new sign-ups set clean profile name, phone, and role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name      text    := public.clean_person_name(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  v_phone     text    := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20), '');
  v_avatar    text    := case
    when char_length(new.raw_user_meta_data ->> 'avatar_url') <= 500
    then nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
    else null
  end;
  v_is_admin  boolean := exists (select 1 from public.admins a where a.user_id = new.id);
begin
  insert into public.profiles (id, full_name, phone, avatar_url, role)
  values (new.id, v_name, v_phone, v_avatar, case when v_is_admin then 'admin' else 'customer' end)
  on conflict (id) do update
    set full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        phone      = coalesce(public.profiles.phone, excluded.phone),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        role       = case when v_is_admin then 'admin' else public.profiles.role end;

  return new;
end $$;

-- 5. First-Admin Bootstrap RPC (for Option B: ADMIN_EMAIL on initial launch)
--    Only succeeds when `public.admins` has 0 rows (or the caller is already an admin),
--    preventing privilege escalation once the store has an admin.
create or replace function public.bootstrap_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));

  if exists (select 1 from public.admins where user_id = v_uid) then
    return true;
  end if;

  if exists (select 1 from public.admins) then
    return false;
  end if;

  insert into public.admins (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  return true;
end $$;

revoke all on function public.bootstrap_first_admin() from public, anon;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- 6. Backfill all existing users so profiles.role and auth.users Display Name / role metadata are in sync
do $$
declare
  r record;
  v_is_admin     boolean;
  v_role_label   text;
  v_clean_name   text;
  v_display_name text;
begin
  for r in
    select u.id,
           u.raw_user_meta_data,
           p.full_name as profile_name,
           p.phone as profile_phone,
           exists (select 1 from public.admins a where a.user_id = u.id) as is_admin
      from auth.users u
      left join public.profiles p on p.id = u.id
  loop
    v_is_admin   := r.is_admin;
    v_role_label := case when v_is_admin then 'admin' else 'customer' end;
    v_clean_name := coalesce(
      public.clean_person_name(r.profile_name),
      public.clean_person_name(coalesce(r.raw_user_meta_data ->> 'full_name', r.raw_user_meta_data ->> 'name', ''))
    );
    v_display_name := public.format_auth_display_name(v_clean_name, v_is_admin);

    insert into public.profiles (id, full_name, phone, role)
    values (r.id, v_clean_name, r.profile_phone, v_role_label)
    on conflict (id) do update
      set full_name = v_clean_name,
          role      = v_role_label;

    update auth.users u
       set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object(
                  'full_name', v_display_name,
                  'display_name', v_display_name,
                  'role', v_role_label
                ),
           raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('role', v_role_label)
     where u.id = r.id;
  end loop;
end $$;
