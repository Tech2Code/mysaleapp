-- Unified Storefront + Admin Theme selection (8 curated presets + Custom 3-color builder)
alter table public.store_settings
  add column if not exists theme_preset text not null default 'terracotta',
  add column if not exists theme_custom jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_settings_theme_preset_check'
      and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings
      add constraint store_settings_theme_preset_check
      check (
        theme_preset in (
          'terracotta',
          'vermilion',
          'emerald',
          'indigo',
          'teal',
          'burgundy',
          'cobalt',
          'charcoal',
          'custom'
        )
      );
  end if;
end $$;
