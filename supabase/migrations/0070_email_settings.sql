-- =====================================================================
-- 0070: Gmail App Password SMTP settings & one-time password reset tokens
--  1. public.email_settings: singleton admin-only table storing Gmail SMTP
--     configuration with AES-256-GCM encrypted Gmail App Password.
--  2. public.password_reset_tokens: hashed one-time password reset tokens
--     (30-minute TTL, single-use, customer & admin scopes) with zero direct
--     PostgREST access.
--  3. SECURITY DEFINER RPCs:
--     - create_password_reset_token(p_email, p_scope, p_token_hash, p_ttl_minutes)
--     - verify_password_reset_token(p_token_hash, p_scope)
--     - consume_password_reset_token(p_token_hash, p_scope, p_new_password)
-- =====================================================================

-- 1. Admin-only Gmail SMTP settings -----------------------------------
create table if not exists public.email_settings (
  id                     boolean primary key default true check (id),
  enabled                boolean not null default false,
  gmail_user             text,
  gmail_app_password_enc text,
  sender_name            text,
  reply_to               text,
  last_test_at           timestamptz,
  last_test_status       text,
  last_test_error        text,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users(id) on delete set null
);

alter table public.email_settings drop constraint if exists email_settings_fields_check;
alter table public.email_settings add constraint email_settings_fields_check check (
  (gmail_user is null or (char_length(gmail_user) <= 120 and position('@' in gmail_user) > 1))
  and (gmail_app_password_enc is null or char_length(gmail_app_password_enc) <= 500)
  and (sender_name is null or char_length(sender_name) <= 80)
  and (reply_to is null or (char_length(reply_to) <= 120 and position('@' in reply_to) > 1))
  and (last_test_status is null or last_test_status in ('ok', 'error'))
  and (last_test_error is null or char_length(last_test_error) <= 300)
);

insert into public.email_settings (id) values (true)
on conflict (id) do nothing;

alter table public.email_settings enable row level security;

drop policy if exists "email_settings admin all" on public.email_settings;
create policy "email_settings admin all"
  on public.email_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 2. One-time password reset tokens -----------------------------------
create table if not exists public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  scope      text not null check (scope in ('customer', 'admin', 'signup_verify')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_scope_active_idx
  on public.password_reset_tokens (user_id, scope)
  where used_at is null;

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;
-- Intentionally zero RLS policies: only SECURITY DEFINER RPCs may read/write tokens.

-- 3. RPC: Create a one-time reset token + return encrypted SMTP config -
create or replace function public.create_password_reset_token(
  p_email       text,
  p_scope       text,
  p_token_hash  text,
  p_ttl_minutes int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_hash  text := lower(btrim(coalesce(p_token_hash, '')));
  v_ttl   int  := least(greatest(coalesce(p_ttl_minutes, 30), 5), 60);
  v_mail  public.email_settings%rowtype;
  v_user  record;
  v_name  text;
begin
  if v_scope not in ('customer', 'admin') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_TOKEN_HASH' using errcode = '22023';
  end if;

  select * into v_mail
    from public.email_settings
   where id = true;

  if not found
     or not coalesce(v_mail.enabled, false)
     or nullif(btrim(coalesce(v_mail.gmail_user, '')), '') is null
     or nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is null then
    return jsonb_build_object('smtpEnabled', false, 'found', false);
  end if;

  -- Opportunistic cleanup of old expired/used tokens
  delete from public.password_reset_tokens
   where expires_at < now() - interval '24 hours'
      or (used_at is not null and used_at < now() - interval '24 hours');

  if v_email = '' then
    return jsonb_build_object('smtpEnabled', true, 'found', false);
  end if;

  select u.id, u.email, u.raw_user_meta_data
    into v_user
    from auth.users u
   where lower(u.email) = v_email
     and u.deleted_at is null
   limit 1;

  if not found then
    return jsonb_build_object('smtpEnabled', true, 'found', false);
  end if;

  if v_scope = 'admin' then
    if not exists (select 1 from public.admins a where a.user_id = v_user.id) then
      return jsonb_build_object('smtpEnabled', true, 'found', false);
    end if;
  end if;

  -- Invalidate any previous unused tokens for this user + scope so only the latest link works
  update public.password_reset_tokens
     set used_at = now()
   where user_id = v_user.id
     and scope = v_scope
     and used_at is null;

  insert into public.password_reset_tokens (user_id, email, scope, token_hash, expires_at)
  values (v_user.id, v_user.email, v_scope, v_hash, now() + make_interval(mins => v_ttl));

  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'name'), '')
  )
    into v_name
    from public.profiles p
   where p.id = v_user.id;

  return jsonb_build_object(
    'smtpEnabled', true,
    'found', true,
    'userId', v_user.id,
    'email', v_user.email,
    'recipientName', v_name,
    'mailer', jsonb_build_object(
      'gmailUser', v_mail.gmail_user,
      'gmailAppPasswordEnc', v_mail.gmail_app_password_enc,
      'senderName', v_mail.sender_name,
      'replyTo', v_mail.reply_to
    )
  );
end $$;

revoke all on function public.create_password_reset_token(text, text, text, int) from public;
grant execute on function public.create_password_reset_token(text, text, text, int) to anon, authenticated, service_role;

-- 4. RPC: Verify a one-time reset token without consuming it ----------
create or replace function public.verify_password_reset_token(
  p_token_hash text,
  p_scope      text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_hash  text := lower(btrim(coalesce(p_token_hash, '')));
  v_tok   public.password_reset_tokens%rowtype;
begin
  if v_scope not in ('customer', 'admin') or v_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('valid', false);
  end if;

  select * into v_tok
    from public.password_reset_tokens
   where token_hash = v_hash
     and scope = v_scope
     and used_at is null
     and expires_at > now()
   limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if v_scope = 'admin' then
    if not exists (select 1 from public.admins a where a.user_id = v_tok.user_id) then
      return jsonb_build_object('valid', false);
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'email', v_tok.email,
    'scope', v_tok.scope
  );
end $$;

revoke all on function public.verify_password_reset_token(text, text) from public;
grant execute on function public.verify_password_reset_token(text, text) to anon, authenticated, service_role;

-- 5. RPC: Consume token and update auth.users password atomically -----
create or replace function public.consume_password_reset_token(
  p_token_hash   text,
  p_scope        text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_scope       text := lower(btrim(coalesce(p_scope, '')));
  v_hash        text := lower(btrim(coalesce(p_token_hash, '')));
  v_tok         public.password_reset_tokens%rowtype;
  v_user        record;
  v_mail        public.email_settings%rowtype;
  v_name        text;
  v_reactivated boolean := false;
begin
  if v_scope not in ('customer', 'admin') or v_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if p_new_password is null or char_length(p_new_password) < 8 or char_length(p_new_password) > 128 then
    return jsonb_build_object('ok', false, 'code', 'invalid_password');
  end if;

  select * into v_tok
    from public.password_reset_tokens
   where token_hash = v_hash
     and scope = v_scope
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select u.id, u.email, u.encrypted_password, u.raw_user_meta_data
    into v_user
    from auth.users u
   where u.id = v_tok.user_id
     and u.deleted_at is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_scope = 'admin' then
    if not exists (select 1 from public.admins a where a.user_id = v_user.id) then
      return jsonb_build_object('ok', false, 'code', 'not_admin');
    end if;
  end if;

  if v_user.encrypted_password is not null
     and v_user.encrypted_password <> ''
     and extensions.crypt(p_new_password, v_user.encrypted_password) = v_user.encrypted_password then
    return jsonb_build_object('ok', false, 'code', 'same_password');
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('has_password', true),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_user.id;

  update public.password_reset_tokens
     set used_at = now()
   where user_id = v_user.id
     and scope = v_scope
     and used_at is null;

  if v_scope = 'admin' then
    update public.admins
       set pin_failed_attempts = 0,
           pin_locked_until    = null
     where user_id = v_user.id;
  else
    update public.profiles
       set deactivated_at = null
     where id = v_user.id
       and deactivated_at is not null;
    v_reactivated := found;
  end if;

  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'name'), '')
  )
    into v_name
    from public.profiles p
   where p.id = v_user.id;

  select * into v_mail
    from public.email_settings
   where id = true;

  return jsonb_build_object(
    'ok', true,
    'userId', v_user.id,
    'email', v_user.email,
    'recipientName', v_name,
    'reactivated', v_reactivated,
    'mailer', case
      when coalesce(v_mail.enabled, false)
           and nullif(btrim(coalesce(v_mail.gmail_user, '')), '') is not null
           and nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is not null
      then jsonb_build_object(
        'gmailUser', v_mail.gmail_user,
        'gmailAppPasswordEnc', v_mail.gmail_app_password_enc,
        'senderName', v_mail.sender_name,
        'replyTo', v_mail.reply_to
      )
      else null
    end
  );
end $$;

revoke all on function public.consume_password_reset_token(text, text, text) from public;
grant execute on function public.consume_password_reset_token(text, text, text) to anon, authenticated, service_role;

-- 6. RPC: Prepare Gmail SMTP mailer for customer signup (welcome or verify email)
create or replace function public.prepare_signup_email(
  p_user_id             uuid,
  p_create_verify_token boolean default false,
  p_token_hash          text default null,
  p_ttl_minutes         int default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mail public.email_settings%rowtype;
  v_user record;
  v_ttl  int := least(greatest(coalesce(p_ttl_minutes, 1440), 15), 2880);
begin
  select * into v_mail
    from public.email_settings
   where id = true;

  if not found
     or not coalesce(v_mail.enabled, false)
     or nullif(btrim(coalesce(v_mail.gmail_user, '')), '') is null
     or nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is null then
    return jsonb_build_object('smtpEnabled', false);
  end if;

  select u.id, u.email
    into v_user
    from auth.users u
   where u.id = p_user_id
     and u.deleted_at is null
   limit 1;

  if not found then
    return jsonb_build_object('smtpEnabled', false);
  end if;

  if coalesce(p_create_verify_token, false) then
    if p_token_hash is null or lower(btrim(p_token_hash)) !~ '^[0-9a-f]{64}$' then
      raise exception 'INVALID_TOKEN_HASH' using errcode = '22023';
    end if;

    update public.password_reset_tokens
       set used_at = now()
     where user_id = v_user.id
       and scope = 'signup_verify'
       and used_at is null;

    insert into public.password_reset_tokens (user_id, email, scope, token_hash, expires_at)
    values (v_user.id, v_user.email, 'signup_verify', lower(btrim(p_token_hash)), now() + make_interval(mins => v_ttl));
  end if;

  return jsonb_build_object(
    'smtpEnabled', true,
    'email', v_user.email,
    'mailer', jsonb_build_object(
      'gmailUser', v_mail.gmail_user,
      'gmailAppPasswordEnc', v_mail.gmail_app_password_enc,
      'senderName', v_mail.sender_name,
      'replyTo', v_mail.reply_to
    )
  );
end $$;

revoke all on function public.prepare_signup_email(uuid, boolean, text, int) from public;
grant execute on function public.prepare_signup_email(uuid, boolean, text, int) to anon, authenticated, service_role;

-- 7. RPC: Consume signup email verification token and confirm auth.users.email_confirmed_at
create or replace function public.consume_signup_verify_token(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_tok  public.password_reset_tokens%rowtype;
begin
  if v_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select * into v_tok
    from public.password_reset_tokens
   where token_hash = v_hash
     and scope = 'signup_verify'
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_tok.user_id
     and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  update public.password_reset_tokens
     set used_at = now()
   where user_id = v_tok.user_id
     and scope = 'signup_verify'
     and used_at is null;

  return jsonb_build_object('ok', true, 'email', v_tok.email);
end $$;

revoke all on function public.consume_signup_verify_token(text) from public;
grant execute on function public.consume_signup_verify_token(text) to anon, authenticated, service_role;
