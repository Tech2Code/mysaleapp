-- Dynamic per-category and per-product "Why do you love it?" review aspects.
-- Resolution order on the storefront:
--   1) products.review_aspects (when non-empty)
--   2) categories.review_aspects (when non-empty)
--   3) App-level default handmade aspects fallback

alter table public.categories
  add column if not exists review_aspects text[];

alter table public.products
  add column if not exists review_aspects text[];

alter table public.categories
  drop constraint if exists categories_review_aspects_max,
  add constraint categories_review_aspects_max
    check (review_aspects is null or cardinality(review_aspects) <= 8);

alter table public.products
  drop constraint if exists products_review_aspects_max,
  add constraint products_review_aspects_max
    check (review_aspects is null or cardinality(review_aspects) <= 8);

-- Seed sensible defaults for existing starter categories (idempotent: only when still null)
update public.categories
set review_aspects = array['Fragrance', 'Burn Time', 'Jar Quality', 'Packaging', 'Value for Money']
where slug = 'candles' and review_aspects is null;

update public.categories
set review_aspects = array['Finish & Shine', 'Comfort', 'Light Weight', 'Craftsmanship', 'Skin Friendly']
where slug = 'jewellery' and review_aspects is null;

update public.categories
set review_aspects = array['Craft & Detail', 'Colour Accuracy', 'Material Quality', 'Finish', 'Packaging']
where slug = 'wall-art' and review_aspects is null;

update public.categories
set review_aspects = array['Craftsmanship', 'Colour & Finish', 'Material Quality', 'Sturdiness', 'True to Size']
where slug = 'home-decor' and review_aspects is null;

update public.categories
set review_aspects = array['Gift Presentation', 'Packaging', 'Quality', 'Uniqueness', 'Value for Money']
where slug = 'gifts' and review_aspects is null;

