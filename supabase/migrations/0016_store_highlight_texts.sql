-- Owner-editable highlight texts (Admin -> Settings -> Shop profile).
--  * highlight_line : first perk on every product page, e.g. "Handmade by skilled artisans"
--  * hero_badge     : small badge above the home page headline
-- NULL means "use the built-in default text". Safe to re-run.
alter table public.store_settings
  add column if not exists highlight_line text,
  add column if not exists hero_badge     text;

do $$ begin
  alter table public.store_settings
    add constraint store_settings_highlight_line_len check (highlight_line is null or char_length(highlight_line) between 2 and 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.store_settings
    add constraint store_settings_hero_badge_len check (hero_badge is null or char_length(hero_badge) between 2 and 60);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tax & invoices (Admin -> Settings -> Tax & invoices). The shop starts as NOT registered:
-- invoices are a "Bill of Supply" and no tax is shown. After getting a GSTIN the owner switches
-- gst_registered on, enters gstin + gst_rate, and invoices become Tax Invoices.
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists price_note       text,
  add column if not exists gst_registered   boolean not null default false,
  add column if not exists gstin            text,
  add column if not exists gst_rate         numeric(5,2) not null default 0,
  add column if not exists legal_name       text,
  add column if not exists business_address text;

do $$ begin
  alter table public.store_settings add constraint store_settings_price_note_len check (price_note is null or char_length(price_note) between 2 and 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_settings add constraint store_settings_gstin_fmt check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_settings add constraint store_settings_gst_rate_range check (gst_rate between 0 and 28);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_settings add constraint store_settings_gst_needs_details check (not gst_registered or (gstin is not null and gst_rate > 0));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_settings add constraint store_settings_legal_name_len check (legal_name is null or char_length(legal_name) <= 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_settings add constraint store_settings_business_address_len check (business_address is null or char_length(business_address) <= 250);
exception when duplicate_object then null; end $$;
