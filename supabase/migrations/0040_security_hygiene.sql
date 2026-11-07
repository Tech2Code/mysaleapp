-- 0040: security hygiene (found in the cross-cutting audit).
--  1) admin_reset_data is admin-only (it checks is_admin() inside) but was still executable by anon.
--     Remove the grant so an anonymous caller cannot even reach the function.
--  2) a rate-limit scope for the public "forgot password" email, so it cannot be used to mail-bomb an address.
-- check_rate_limit keeps its signature and grants (create or replace); only the scope table gains a row.

revoke execute on function public.admin_reset_data(text[]) from public, anon;
grant execute on function public.admin_reset_data(text[]) to authenticated;

create or replace function public.check_rate_limit(p_scope text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max     int;
  v_window  int;
  v_key     text;
  v_hits    int;
begin
  -- scope -> (max hits, window seconds). Change limits here (new migration), never from the client.
  select l.max_hits, l.window_seconds into v_max, v_window
  from (values
    ('track-order',     20, 600),
    ('submit-payment',  20, 600),
    ('update-delivery', 20, 600),
    ('cancel-order',    20, 600),
    ('request-return',  20, 600),
    ('withdraw-return', 20, 600),
    ('place-order',     15, 600),
    ('login',           10, 600),
    ('pincode',         60, 600),
    ('password-reset',   5, 600)
  ) as l(scope, max_hits, window_seconds)
  where l.scope = p_scope;

  if v_max is null then return true; end if;                       -- unknown scope: not limited
  -- the app always sends a 32-char hex hash; anything else is not a real caller key
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then return true; end if;

  v_key := p_scope || ':' || p_key;

  -- Opportunistic cleanup (~5% of calls) of long-expired rows. Windows are at most 10 minutes, so
  -- anything older than an hour is dead.
  if random() < 0.05 then
    delete from public.rate_limits
    where ctid in (select ctid from public.rate_limits where window_start < now() - interval '1 hour' limit 1000);
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (v_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => v_window) then now() else r.window_start end,
        hits         = case when r.window_start < now() - make_interval(secs => v_window) then 1 else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= v_max;
end;
$$;
