-- Sample catalogue so the store isn't empty on day one.
-- Run AFTER migrations/0001_init.sql. Safe to re-run (upserts by slug).
-- Upload real photos later from Admin → Products.

insert into public.categories (name, slug, description, sort) values
  ('Home Decor', 'home-decor', 'Handcrafted pieces that make a house feel like home.', 1),
  ('Gifts',      'gifts',      'Thoughtful handmade gifts for every occasion.',        2),
  ('Candles',    'candles',    'Hand-poured soy candles with natural fragrances.',      3),
  ('Wall Art',   'wall-art',   'Paintings, macramé and prints for your walls.',         4),
  ('Jewellery',  'jewellery',  'Handmade earrings, bracelets and necklaces.',           5)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;

insert into public.products (name, slug, description, price, compare_at_price, stock, is_featured, category_id) values
  ('Hand-painted Terracotta Vase', 'hand-painted-terracotta-vase',
   'A rustic terracotta vase, hand-painted with traditional motifs by artisans. Perfect for dried flowers or as a standalone accent piece. Approx. 25 cm tall.',
   899, 1199, 12, true, (select id from public.categories where slug = 'home-decor')),
  ('Macramé Wall Hanging', 'macrame-wall-hanging',
   'Knotted by hand from 100% cotton rope on a natural driftwood branch. Adds warm boho texture to any wall. 60 × 90 cm.',
   1299, null, 8, true, (select id from public.categories where slug = 'wall-art')),
  ('Lavender Soy Candle', 'lavender-soy-candle',
   'Hand-poured soy wax candle with pure lavender essential oil in a reusable glass jar. Burn time ~40 hours.',
   449, 549, 30, true, (select id from public.categories where slug = 'candles')),
  ('Personalised Name Plate', 'personalised-name-plate',
   'A hand-painted wooden name plate for your home entrance. Share the name you want on WhatsApp after ordering.',
   1499, null, 15, true, (select id from public.categories where slug = 'gifts')),
  ('Brass Jhumka Earrings', 'brass-jhumka-earrings',
   'Lightweight, handcrafted brass jhumkas with an antique finish. Nickel-free hooks.',
   599, 799, 20, false, (select id from public.categories where slug = 'jewellery')),
  ('Madhubani Art Print', 'madhubani-art-print',
   'A4 archival print of an original Madhubani painting, signed by the artist. Frame not included.',
   699, null, 25, false, (select id from public.categories where slug = 'wall-art')),
  ('Gift Hamper — Little Joys', 'gift-hamper-little-joys',
   'A curated hamper with a mini soy candle, handmade soap, a block-printed pouch and a handwritten note.',
   1899, 2299, 10, true, (select id from public.categories where slug = 'gifts')),
  ('Jute & Cotton Table Runner', 'jute-cotton-table-runner',
   'Handwoven jute and cotton table runner with tassel ends. 180 × 35 cm.',
   799, null, 14, false, (select id from public.categories where slug = 'home-decor'))
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, price = excluded.price,
  compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  is_featured = excluded.is_featured, category_id = excluded.category_id;
