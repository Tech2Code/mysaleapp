-- =====================================================================
-- 0071: Security hardening for Gmail SMTP & password reset RPCs
--  1. Adds `server_rpc_secret_hash` to `public.email_settings` (SHA-256 hex
--     of the server-only secret, stored when Admin saves email settings).
--  2. Requires `p_server_secret` on all 5 token/mailer SECURITY DEFINER RPCs
--     so direct browser calls using the public anon key are rejected with
--     42501 FORBIDDEN (prevents token forgery, account takeover, email
--     enumeration, and ciphertext exposure).
-- =====================================================================

alter table public.email_settings
  add column if not exists server_rpc_secret_hash text;

alter table public.email_settings drop constraint if exists email_settings_rpc_secret_chk;
alter table public.email_settings add constraint email_settings_rpc_secret_chk
  check (server_rpc_secret_hash is null or server_rpc_secret_hash ~ '^[0-9a-f]{64}$');

-- Drop old signatures that lacked p_server_secret so anon cannot call them!
drop function if exists public.create_password_reset_token(text, text, text, int);
drop function if exists public.verify_password_reset_token(text, text);
drop function if exists public.consume_password_reset_token(text, text, text);
drop function if exists public.prepare_signup_email(uuid, boolean, text, int);
drop function if exists public.consume_signup_verify_token(text);

-- Internal helper: verifies either service_role or matching SHA-256(p_server_secret)
create or replace function public._assert_email_rpc_secret(
  p_expected_hash text,
  p_server_secret text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    return true;
  end if;
  if p_expected_hash is null or p_expected_hash = '' then
    return false;
  end if;
  if p_server_secret is null or char_length(p_server_secret) < 16 then
    return false;
  end if;
  return encode(extensions.digest(p_server_secret, 'sha256'), 'hex') = p_expected_hash;
end $$;

revoke all on function public._assert_email_rpc_secret(text, text) from public, anon, authenticated;

-- 1. Create a one-time reset token (server-authenticated) -------------
create or replace function public.create_password_reset_token(
  p_email         text,
  p_scope         text,
  p_token_hash    text,
  p_server_secret text,
  p_ttl_minutes   int default 30
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
     or nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is null
     or v_mail.server_rpc_secret_hash is null then
    return jsonb_build_object('smtpEnabled', false, 'found', false);
  end if;

  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

revoke all on function public.create_password_reset_token(text, text, text, text, int) from public;
grant execute on function public.create_password_reset_token(text, text, text, text, int) to anon, authenticated, service_role;

-- 2. Verify a one-time reset token (server-authenticated) -------------
create or replace function public.verify_password_reset_token(
  p_token_hash    text,
  p_scope         text,
  p_server_secret text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_hash  text := lower(btrim(coalesce(p_token_hash, '')));
  v_mail  public.email_settings%rowtype;
  v_tok   public.password_reset_tokens%rowtype;
begin
  select * into v_mail from public.email_settings where id = true;
  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

revoke all on function public.verify_password_reset_token(text, text, text) from public;
grant execute on function public.verify_password_reset_token(text, text, text) to anon, authenticated, service_role;

-- 3. Consume reset token and update password (server-authenticated) ---
create or replace function public.consume_password_reset_token(
  p_token_hash    text,
  p_scope         text,
  p_new_password  text,
  p_server_secret text
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
  select * into v_mail from public.email_settings where id = true;
  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

revoke all on function public.consume_password_reset_token(text, text, text, text) from public;
grant execute on function public.consume_password_reset_token(text, text, text, text) to anon, authenticated, service_role;

-- 4. Prepare signup email (server-authenticated) ----------------------
create or replace function public.prepare_signup_email(
  p_user_id             uuid,
  p_server_secret       text,
  p_create_verify_token boolean default false,
  p_token_hash          text default null,
  p_ttl_minutes         int default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
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
     or nullif(btrim(coalesce(v_mail.gmail_app_password_enc, '')), '') is null
     or v_mail.server_rpc_secret_hash is null then
    return jsonb_build_object('smtpEnabled', false);
  end if;

  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
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

revoke all on function public.prepare_signup_email(uuid, text, boolean, text, int) from public;
grant execute on function public.prepare_signup_email(uuid, text, boolean, text, int) to anon, authenticated, service_role;

-- 5. Consume signup verification token (server-authenticated) ---------
create or replace function public.consume_signup_verify_token(
  p_token_hash    text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_mail public.email_settings%rowtype;
  v_tok  public.password_reset_tokens%rowtype;
begin
  select * into v_mail from public.email_settings where id = true;
  if not public._assert_email_rpc_secret(v_mail.server_rpc_secret_hash, p_server_secret) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

revoke all on function public.consume_signup_verify_token(text, text) from public;
grant execute on function public.consume_signup_verify_token(text, text) to anon, authenticated, service_role;
