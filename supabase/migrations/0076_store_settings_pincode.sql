-- Store the shop's contact pincode so Admin -> Settings -> Contact & Location persists it across saves and reloads.
alter table public.store_settings
  add column if not exists contact_pincode text;
