-- =====================================================================
-- Shop profile, contact details, SEO and order settings, editable from Admin → Settings.
-- Every column is optional: while a value is empty the app uses its built-in default
-- (see src/features/settings/defaults.ts). Safe to re-run.
-- =====================================================================

alter table public.store_settings
  add column if not exists shop_name         text,
  add column if not exists tagline           text,
  add column if not exists description       text,
  add column if not exists seo_keywords      text,
  add column if not exists announcement      text,
  add column if not exists whatsapp_number   text,
  add column if not exists contact_email     text,
  add column if not exists contact_phone     text,
  add column if not exists contact_city      text,
  add column if not exists contact_region    text,
  add column if not exists instagram_url     text,
  add column if not exists facebook_url      text,
  add column if not exists order_code_prefix text;

alter table public.store_settings drop constraint if exists store_settings_profile_check;
alter table public.store_settings add constraint store_settings_profile_check check (
  (shop_name is null or char_length(shop_name) between 2 and 40)
  and (tagline is null or char_length(tagline) between 3 and 100)
  and (description is null or char_length(description) between 10 and 300)
  and (seo_keywords is null or char_length(seo_keywords) <= 400)
  and (announcement is null or char_length(announcement) <= 160)
);

alter table public.store_settings drop constraint if exists store_settings_contact_check;
alter table public.store_settings add constraint store_settings_contact_check check (
  (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$')
  and (contact_email is null or (char_length(contact_email) <= 120 and position('@' in contact_email) > 1))
  and (contact_phone is null or char_length(contact_phone) <= 30)
  and (contact_city is null or char_length(contact_city) <= 60)
  and (contact_region is null or char_length(contact_region) <= 60)
  -- only http(s) links, so a "javascript:" URL can never be stored and rendered
  and (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~* '^https?://'))
  and (facebook_url is null or (char_length(facebook_url) <= 300 and facebook_url ~* '^https?://'))
);

alter table public.store_settings drop constraint if exists store_settings_prefix_check;
alter table public.store_settings add constraint store_settings_prefix_check check (
  order_code_prefix is null or order_code_prefix ~ '^[A-Z]{1,5}$'
);
