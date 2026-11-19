-- =====================================================================
-- 0057: Seed realistic dummy customer reviews on a subset of active products
--  1. Allow user_id to be NULL on public.product_reviews for seeded showcase reviews
--     (real customer reviews still require auth.uid() via upsert_product_review and
--      remain strictly unique per (product_id, user_id)).
--  2. Insert realistic verified-purchase reviews with "Loved: ..." aspect tags on up to
--     5 active products (leaving other products unreviewed so both states are visible).
-- =====================================================================

alter table public.product_reviews
  alter column user_id drop not null;

do $$
declare
  v_prod record;
  v_idx  int := 0;
begin
  for v_prod in
    select id, name
    from public.products
    where is_active = true
    order by is_featured desc, created_at desc
    limit 5
  loop
    v_idx := v_idx + 1;

    -- Skip if dummy reviews were already seeded for this product
    if exists (
      select 1 from public.product_reviews
      where product_id = v_prod.id and user_id is null
    ) then
      continue;
    end if;

    if v_idx = 1 then
      insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
      values
        (
          v_prod.id,
          null,
          'Ananya Sharma',
          5,
          'Loved: Colour, Material Quality, True to Specs',
          'Absolutely loved the craftsmanship! The finish and colour look even prettier in person than in the photos, and the packaging was super secure.',
          true,
          now() - interval '14 days',
          now() - interval '14 days'
        ),
        (
          v_prod.id,
          null,
          'Rohan Verma',
          5,
          'Loved: Material Quality, Light Weight',
          'Gifted this to my sister and she was thrilled. You can genuinely tell it is handmade with care. Delivery was smooth and right on time.',
          true,
          now() - interval '9 days',
          now() - interval '9 days'
        ),
        (
          v_prod.id,
          null,
          'Meera Kulkarni',
          4,
          'Loved: Colour, True to Specs',
          'Very neat detailing and lovely texture. Matches the description accurately and feels sturdy for everyday use.',
          true,
          now() - interval '4 days',
          now() - interval '4 days'
        );

    elsif v_idx = 2 then
      insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
      values
        (
          v_prod.id,
          null,
          'Priya Nair',
          5,
          'Loved: Comfort, Material Quality, True to Specs',
          'Such a charming handmade piece! The quality exceeded my expectations and it came wrapped very thoughtfully.',
          true,
          now() - interval '18 days',
          now() - interval '18 days'
        ),
        (
          v_prod.id,
          null,
          'Kabir Mehta',
          4,
          'Loved: Colour, Light Weight',
          'Looks great and feels lightweight yet durable. Definitely worth the price for authentic handcrafted work.',
          true,
          now() - interval '6 days',
          now() - interval '6 days'
        );

    elsif v_idx = 3 then
      insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
      values
        (
          v_prod.id,
          null,
          'Sneha Iyer',
          5,
          'Loved: Colour, Comfort, Material Quality',
          'Every little detail is so well finished! Ordered this for my home and already received so many compliments from guests.',
          true,
          now() - interval '12 days',
          now() - interval '12 days'
        ),
        (
          v_prod.id,
          null,
          'Aditya Joshi',
          5,
          'Loved: Material Quality, True to Specs',
          'Top-notch quality and exactly as shown in the pictures. Will definitely be ordering more pieces from this store!',
          true,
          now() - interval '5 days',
          now() - interval '5 days'
        ),
        (
          v_prod.id,
          null,
          'Kavya Menon',
          5,
          'Loved: Colour, Light Weight, True to Specs',
          'Beautifully handcrafted and packed with so much care. Zero damage in transit and looks gorgeous.',
          true,
          now() - interval '2 days',
          now() - interval '2 days'
        );

    elsif v_idx = 4 then
      insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
      values
        (
          v_prod.id,
          null,
          'Vikram Singhania',
          4,
          'Loved: Material Quality, True to Specs',
          'Solid build quality and a very warm, authentic handmade look. Happy with the purchase.',
          true,
          now() - interval '10 days',
          now() - interval '10 days'
        ),
        (
          v_prod.id,
          null,
          'Neha Deshmukh',
          5,
          'Loved: Colour, Material Quality',
          'Lovely colours and very fine finishing. Makes for a wonderful gift item too!',
          true,
          now() - interval '3 days',
          now() - interval '3 days'
        );

    elsif v_idx = 5 then
      insert into public.product_reviews (product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at)
      values
        (
          v_prod.id,
          null,
          'Ishaan Chatterjee',
          5,
          'Loved: Colour, Comfort, Light Weight, True to Specs',
          'Superb quality! Looks premium, feels lightweight, and the artisan detailing really stands out.',
          true,
          now() - interval '7 days',
          now() - interval '7 days'
        );
    end if;
  end loop;
end $$;
