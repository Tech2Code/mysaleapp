-- =====================================================================
-- 0047: Sync user phone number across auth.users and public.profiles
--  1. Updates public.handle_new_user() so sign-up copies raw_user_meta_data->>'phone'
--     into public.profiles.phone AND populates auth.users.phone (the "Phone" column
--     in Supabase Dashboard -> Authentication -> Users).
--  2. Adds an AFTER INSERT OR UPDATE trigger on public.profiles so updating a
--     profile's phone/name also keeps auth.users.phone and raw_user_meta_data in sync.
--  3. Backfills existing users between auth.users and public.profiles.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name   text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 80), '');
  v_phone  text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20), '');
  v_avatar text := case
    when char_length(new.raw_user_meta_data ->> 'avatar_url') <= 500
    then nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
    else null
  end;
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (new.id, v_name, v_phone, v_avatar)
  on conflict (id) do update
    set full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        phone      = coalesce(public.profiles.phone, excluded.phone),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  if v_phone is not null and new.phone is null then
    begin
      update auth.users
         set phone = v_phone
       where id = new.id
         and phone is null
         and not exists (select 1 from auth.users u where u.phone = v_phone and u.id <> new.id);
    exception when others then
      null;
    end;
  end if;

  return new;
end $$;

create or replace function public.sync_profile_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := nullif(left(btrim(coalesce(new.phone, '')), 20), '');
  v_name  text := nullif(left(btrim(coalesce(new.full_name, '')), 80), '');
begin
  begin
    update auth.users u
       set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('full_name', v_name, 'phone', v_phone),
           phone = case
             when v_phone is null then null
             when not exists (select 1 from auth.users o where o.phone = v_phone and o.id <> new.id) then v_phone
             else u.phone
           end
     where u.id = new.id
       and (
         u.phone is distinct from v_phone
         or (u.raw_user_meta_data ->> 'phone') is distinct from v_phone
         or (u.raw_user_meta_data ->> 'full_name') is distinct from v_name
       );
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists profiles_sync_auth_user on public.profiles;
create trigger profiles_sync_auth_user
  after insert or update of full_name, phone on public.profiles
  for each row execute function public.sync_profile_to_auth_user();

-- Backfill existing rows: copy metadata phone/name into public.profiles where missing,
-- and sync public.profiles.phone into auth.users.phone for the Supabase Dashboard Users table.
do $$
declare
  r record;
  v_phone text;
  v_name  text;
begin
  for r in
    select u.id,
           u.phone as auth_phone,
           u.raw_user_meta_data,
           p.full_name as profile_name,
           p.phone as profile_phone
      from auth.users u
      left join public.profiles p on p.id = u.id
  loop
    v_name  := coalesce(
      nullif(left(btrim(coalesce(r.profile_name, '')), 80), ''),
      nullif(left(btrim(coalesce(r.raw_user_meta_data ->> 'full_name', r.raw_user_meta_data ->> 'name', '')), 80), '')
    );
    v_phone := coalesce(
      nullif(left(btrim(coalesce(r.profile_phone, '')), 20), ''),
      nullif(left(btrim(coalesce(r.raw_user_meta_data ->> 'phone', '')), 20), ''),
      nullif(left(btrim(coalesce(r.auth_phone, '')), 20), '')
    );

    insert into public.profiles (id, full_name, phone)
    values (r.id, v_name, v_phone)
    on conflict (id) do update
      set full_name = coalesce(public.profiles.full_name, excluded.full_name),
          phone     = coalesce(public.profiles.phone, excluded.phone);
  end loop;
end $$;
