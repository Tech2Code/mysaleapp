-- 0019: app-level rate limiting (per hashed IP / key, fixed window).
-- Called by the server actions via rpc('check_rate_limit'). Keys are hashed by the app; no raw IPs are stored.

create table if not exists public.rate_limits (
  key          text        primary key,
  window_start timestamptz not null default now(),
  hits         integer     not null default 0
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);

-- Returns true when the call is allowed, false when over the limit.
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200
     or p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    return true;
  end if;

  -- Opportunistic cleanup (~2% of calls) of long-expired rows.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  -- Atomic: start a fresh window if the old one expired, otherwise increment.
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start end,
        hits = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
