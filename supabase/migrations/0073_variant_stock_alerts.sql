-- =====================================================================
-- 0073: Variant-aware Back-in-Stock alerts (products.variants JSONB)
--  When a multi-variant product has one variant out of stock (e.g. M / Black
--  with stock = 0) while other variants are in stock (products.stock > 0),
--  customers selecting M / Black can subscribe to Notify Me for that specific
--  variant instead of receiving a false ALREADY_IN_STOCK error.
-- =====================================================================

alter table public.stock_alerts
  add column if not exists variant_id text null,
  add column if not exists variant_label text null;

drop index if exists public.idx_stock_alerts_waiting_unique;
create unique index if not exists idx_stock_alerts_waiting_unique
  on public.stock_alerts (product_id, coalesce(variant_id, ''), phone)
  where status = 'waiting';

drop function if exists public.subscribe_stock_alert(uuid, text, text);
drop function if exists public.subscribe_stock_alert(uuid, text, text, uuid);

create or replace function public.subscribe_stock_alert(
  p_product_id uuid,
  p_name       text default '',
  p_phone      text default '',
  p_variant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone       text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name        text := left(btrim(coalesce(p_name, '')), 60);
  v_variant_id  text := nullif(left(btrim(coalesce(p_variant_id, '')), 80), '');
  v_uid         uuid := auth.uid();
  v_product     record;
  v_variant     jsonb;
  v_var_label   text;
  v_existing_id uuid;
begin
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substr(v_phone, 3);
  elsif length(v_phone) = 11 and left(v_phone, 1) = '0' then
    v_phone := substr(v_phone, 2);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  select id, is_active, stock, variants into v_product
  from public.products
  where id = p_product_id;

  if not found or not v_product.is_active then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_variant_id is not null then
    select elem into v_variant
    from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) elem
    where elem ->> 'id' = v_variant_id
    limit 1;

    if v_variant is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if coalesce((v_variant ->> 'stock')::int, 0) > 0 then
      raise exception 'ALREADY_IN_STOCK';
    end if;
    v_var_label := nullif(btrim(coalesce(v_variant ->> 'label', '')), '');
  else
    if coalesce(v_product.stock, 0) > 0 then
      raise exception 'ALREADY_IN_STOCK';
    end if;
  end if;

  select id into v_existing_id
  from public.stock_alerts
  where product_id = p_product_id
    and coalesce(variant_id, '') = coalesce(v_variant_id, '')
    and phone = v_phone
    and status = 'waiting'
  limit 1;

  if v_existing_id is not null then
    update public.stock_alerts
    set customer_name = case when v_name <> '' then v_name else customer_name end,
        user_id = coalesce(user_id, v_uid),
        variant_label = coalesce(v_var_label, variant_label)
    where id = v_existing_id;
    return jsonb_build_object('ok', true, 'alreadySubscribed', true);
  end if;

  insert into public.stock_alerts (product_id, variant_id, variant_label, user_id, customer_name, phone, status)
  values (p_product_id, v_variant_id, v_var_label, v_uid, v_name, v_phone, 'waiting');

  return jsonb_build_object('ok', true, 'alreadySubscribed', false);
end $$;

revoke all on function public.subscribe_stock_alert(uuid, text, text, text) from public;
grant execute on function public.subscribe_stock_alert(uuid, text, text, text) to anon, authenticated;
