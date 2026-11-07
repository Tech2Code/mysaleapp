-- Input limits, database side. Mirrors src/lib/validation/limits.ts (LIMITS / PATTERNS); change both together.
--  * orders.tracking_number : 5-30 chars, A-Z 0-9 - / _ (LIMITS.trackingNumber, PATTERNS.trackingNumber). Was 1-60, any text.
--  * orders.tracking_url    : https only, max 500 (the form allows 300). Was http or https.
--  * orders.payment_reference : 8-35 A-Z/0-9 (the UTR pattern; the length check already existed).
--  * money / counts upper bounds: product price + MRP <= 1,000,000, stock <= 100,000, payment / refunded amount
--    <= 10,000,000, delivery fee <= 10,000, free-delivery threshold <= 1,000,000.
--  * categories.sort 0-999, categories.description <= 300, products description / SEO text lengths.
-- Production rows were checked before writing this: every existing row satisfies every constraint except one order
-- whose tracking_url starts with http:// (so that constraint is NOT VALID: it guards new and changed rows only).

-- tracking number ------------------------------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_tracking_number_check;
alter table public.orders add constraint orders_tracking_number_fmt check (
  tracking_number is null
  or (char_length(tracking_number) between 5 and 30 and tracking_number ~ '^[A-Z0-9][A-Z0-9/_-]*$')
);

-- tracking link: https only ----------------------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_tracking_url_check;
alter table public.orders add constraint orders_tracking_url_https check (
  tracking_url is null or (char_length(tracking_url) <= 500 and tracking_url ~* '^https://')
) not valid;

-- UTR format -------------------------------------------------------------------------------------------------------
alter table public.orders add constraint orders_payment_reference_fmt check (
  payment_reference is null or payment_reference ~ '^[A-Z0-9]{8,35}$'
);

-- amounts ----------------------------------------------------------------------------------------------------------
alter table public.orders add constraint orders_payment_amount_max check (payment_amount is null or payment_amount <= 10000000);
alter table public.orders add constraint orders_refunded_amount_max check (refunded_amount <= 10000000);

alter table public.products add constraint products_price_max check (price <= 1000000);
alter table public.products add constraint products_compare_at_price_max check (compare_at_price is null or compare_at_price <= 1000000);
alter table public.products add constraint products_stock_max check (stock <= 100000);
alter table public.products add constraint products_text_lengths check (
  (description is null or char_length(description) <= 5000)
  and (seo_title is null or char_length(seo_title) <= 70)
  and (seo_description is null or char_length(seo_description) <= 160)
);

alter table public.categories add constraint categories_sort_range check (sort between 0 and 999);
alter table public.categories add constraint categories_description_len check (description is null or char_length(description) <= 300);

alter table public.store_settings add constraint store_settings_delivery_fee_max check (delivery_fee <= 10000);
alter table public.store_settings add constraint store_settings_free_delivery_max check (free_delivery_above <= 1000000);
