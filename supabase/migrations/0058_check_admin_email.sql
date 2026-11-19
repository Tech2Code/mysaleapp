-- =====================================================================
-- 0058: Check if an email belongs to an admin account before sending
--       admin password recovery emails from /admin/forgot-password.
-- =====================================================================

create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.user_id = u.id
    where lower(u.email) = lower(btrim(coalesce(p_email, '')))
  );
$$;

revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;
