-- Demo catalogue: 5 categories and 12 handmade products with photos, highlights, specs, care and charges.
-- Upserts by slug (safe to re-run; nothing is deleted). Edit or replace everything from Admin → Products.
-- Photos live in the public Storage bucket "product-images" under seed/<slug>/ (Pexels, free licence).

insert into public.categories (name, slug, description, sort) values
  ($t$Home Decor$t$, $t$home-decor$t$, $t$Handcrafted pieces that make a house feel like home.$t$, 1),
  ($t$Gifts$t$, $t$gifts$t$, $t$Thoughtful handmade gifts for every occasion.$t$, 2),
  ($t$Candles$t$, $t$candles$t$, $t$Hand-poured soy candles with natural fragrances.$t$, 3),
  ($t$Wall Art$t$, $t$wall-art$t$, $t$Paintings, macramé and prints for your walls.$t$, 4),
  ($t$Jewellery$t$, $t$jewellery$t$, $t$Handmade earrings, bracelets and necklaces.$t$, 5)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Hand-painted Terracotta Vase$t$, $t$hand-painted-terracotta-vase$t$, $t$This terracotta vase starts as local red clay, shaped on the wheel and fired in a traditional kiln. Once it cools, an artisan paints the motifs by hand, one brush stroke at a time, so no two vases are exactly alike.

The warm earthy colour sits beautifully with dried pampas grass, a few fresh stems, or simply on its own on a console table, bookshelf or window ledge. The inside is sealed, so it can hold water for fresh flowers without seeping.

A lovely housewarming gift: it arrives carefully wrapped in recycled paper, and the artisan's small imperfections are what make it handmade.$t$, $t$A rustic terracotta vase hand-painted by artisans with traditional motifs. Perfect for dried flowers or as a standalone accent piece.$t$,
  $j$["Hand-painted by skilled artisans","Natural kiln-fired terracotta","Sealed inside, so it holds water for fresh flowers","Every piece has its own small variations"]$j$::jsonb,
  $j$[{"label":"Material","value":"Kiln-fired terracotta"},{"label":"Height","value":"25 cm"},{"label":"Opening","value":"7 cm"},{"label":"Weight","value":"About 1.1 kg"},{"label":"Finish","value":"Matte, hand-painted"},{"label":"Made in","value":"India"}]$j$::jsonb,
  $t$Wipe gently with a soft, dry cloth. Do not soak the painted surface. For fresh flowers, change the water often and dry the outside after use. Keep away from sudden temperature changes.$t$, 899, 1199, 12,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/hand-painted-terracotta-vase/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/hand-painted-terracotta-vase/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/hand-painted-terracotta-vase/3.jpg$t$], true, true, $j$[{"label":"Handling charge","amount":40,"reason":"Fragile item: extra padding and a double box so it reaches you unbroken."}]$j$::jsonb,
  $t$Hand-painted Terracotta Vase | Handmade Home Decor$t$, $t$Hand-painted terracotta vase, 25 cm, kiln-fired by Indian artisans. Sealed inside for fresh flowers. Pay securely by UPI.$t$,
  (select id from public.categories where slug = $t$home-decor$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Macramé Wall Hanging$t$, $t$macrame-wall-hanging$t$, $t$Each macramé hanging takes our artisans about two days to finish. They tie hundreds of square knots, spiral knots and gathering knots by hand, then trim the fringe so it falls evenly.

The cotton rope is soft and tightly twisted, and the driftwood branch is chosen for its natural curve and grain, so the colours and shape vary slightly from piece to piece.

Hang it above a bed or sofa, in an entryway, or in a nursery for a calm, earthy corner. It looks best with a plain wall behind it so the knotwork stands out.$t$, $t$A boho wall hanging knotted by hand from 100% cotton rope on a natural driftwood branch. It adds soft texture to any wall.$t$,
  $j$["Knotted by hand, one knot at a time","100% soft cotton rope","Natural driftwood branch, never painted","Ready to hang with a jute loop"]$j$::jsonb,
  $j$[{"label":"Material","value":"Cotton rope, driftwood"},{"label":"Size","value":"60 × 90 cm"},{"label":"Colour","value":"Natural cream"},{"label":"Weight","value":"About 450 g"},{"label":"Includes","value":"Hanging loop"},{"label":"Made in","value":"India"}]$j$::jsonb,
  $t$Dust lightly with a soft brush or a hairdryer on a cool setting. Spot-clean with a damp cloth only. Do not machine-wash. Keep away from direct sunlight to prevent yellowing.$t$, 1299, null, 8,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/macrame-wall-hanging/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/macrame-wall-hanging/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/macrame-wall-hanging/3.jpg$t$], true, true, $j$[]$j$::jsonb,
  $t$Handmade Macramé Wall Hanging 60×90 cm | Boho Decor$t$, $t$Boho macramé wall hanging, hand-knotted cotton rope on natural driftwood, 60 × 90 cm. Handmade in India.$t$,
  (select id from public.categories where slug = $t$wall-art$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Lavender Soy Candle$t$, $t$lavender-soy-candle$t$, $t$Soy wax burns slower and cleaner than paraffin, and it holds scent beautifully. We pour every candle by hand, let it cure for a week, and only then pack it, so the lavender is full and calming from the first light.

The scent is made with pure lavender essential oil, with no synthetic perfumes. It is soft and herbal rather than sweet, which makes it a favourite for bedrooms, bath time and quiet evenings.

When the candle is done, wash the jar with warm soapy water and reuse it for pens, cotton buds, or a tiny plant.$t$, $t$A hand-poured soy wax candle with pure lavender essential oil in a reusable glass jar. Burns for about 40 hours.$t$,
  $j$["Hand-poured in small batches","100% natural soy wax","Pure lavender essential oil","About 40 hours of burn time","Reusable glass jar"]$j$::jsonb,
  $j$[{"label":"Wax","value":"100% natural soy wax"},{"label":"Fragrance","value":"Lavender essential oil"},{"label":"Burn time","value":"About 40 hours"},{"label":"Weight","value":"200 g"},{"label":"Jar","value":"Glass, 8 cm tall"},{"label":"Wick","value":"Cotton"}]$j$::jsonb,
  $t$Trim the wick to 5 mm before every burn. Burn for at least 2 hours the first time so the wax melts evenly. Never leave a burning candle unattended and keep it away from children and pets. Stop using when 1 cm of wax is left.$t$, 449, 549, 30,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/lavender-soy-candle/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/lavender-soy-candle/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/lavender-soy-candle/3.jpg$t$], true, true, $j$[]$j$::jsonb,
  $t$Lavender Soy Candle 200 g | Hand-poured Scented Candle$t$, $t$Hand-poured lavender soy candle with pure essential oil in a reusable glass jar. About 40 hours burn time.$t$,
  (select id from public.categories where slug = $t$candles$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Personalised Name Plate$t$, $t$personalised-name-plate$t$, $t$A name plate is the first thing a guest sees, so we make each one to order. After you place the order, send us the name (and any colour preference) on WhatsApp. An artisan paints it by hand on seasoned wood and seals it so it can stay on your door.

Choose a family name, a house name, or a short blessing in English or Hindi. We send you a photo before we pack it, so you can approve the lettering.

It also makes a thoughtful gift for a new home, a wedding or an anniversary.$t$, $t$A hand-painted wooden name plate for your home entrance, made with the name you choose. Share the name on WhatsApp after ordering.$t$,
  $j$["Made with your own name or text","Solid wood, hand-painted","Weather-sealed finish","Ready to mount, screws included"]$j$::jsonb,
  $j$[{"label":"Material","value":"Seasoned wood"},{"label":"Size","value":"30 × 12 cm"},{"label":"Finish","value":"Hand-painted, weather-sealed"},{"label":"Lettering","value":"Up to 20 characters"},{"label":"Making time","value":"4 to 6 days"},{"label":"Includes","value":"Screws and wall plugs"}]$j$::jsonb,
  $t$Wipe with a slightly damp cloth. It is sealed for outdoor use under a shade or porch, but avoid direct rain and harsh sunlight to keep the colours bright for years.$t$, 1499, null, 15,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/personalised-name-plate/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/personalised-name-plate/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/personalised-name-plate/3.jpg$t$], true, true, $j$[{"label":"Personalisation charge","amount":100,"reason":"Each plate is custom-painted with your name, which takes an artisan extra time."}]$j$::jsonb,
  $t$Personalised Wooden Name Plate | Hand-painted Door Sign$t$, $t$Custom hand-painted wooden name plate for your home, 30 × 12 cm, weather-sealed. Made to order in India.$t$,
  (select id from public.categories where slug = $t$gifts$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Brass Jhumka Earrings$t$, $t$brass-jhumka-earrings$t$, $t$Jhumkas are a classic, and these are made the traditional way: shaped, soldered and finished by hand, then given an antique polish that looks warm against both silk and denim.

Despite their size they are light, so you can wear them from morning to the last dance of the night. The hooks are nickel-free for sensitive ears.

They come in a small cloth pouch, ready to gift.$t$, $t$Lightweight, handcrafted brass jhumkas with an antique finish and nickel-free hooks. Easy to wear all day.$t$,
  $j$["Handcrafted in solid brass","Antique gold finish","Nickel-free hooks, gentle on sensitive ears","Light enough for all-day wear"]$j$::jsonb,
  $j$[{"label":"Material","value":"Brass"},{"label":"Length","value":"5.5 cm"},{"label":"Weight","value":"About 14 g per pair"},{"label":"Finish","value":"Antique gold"},{"label":"Closure","value":"Hook"},{"label":"Made in","value":"India"}]$j$::jsonb,
  $t$Store in the pouch provided, away from moisture. Wipe with a soft dry cloth after wearing. Avoid perfume and water on the jewellery to keep the finish bright.$t$, 599, 799, 20,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/brass-jhumka-earrings/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/brass-jhumka-earrings/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/brass-jhumka-earrings/3.jpg$t$], true, false, $j$[]$j$::jsonb,
  $t$Brass Jhumka Earrings | Handcrafted Antique Gold Jewellery$t$, $t$Handcrafted brass jhumka earrings with an antique gold finish and nickel-free hooks. Light, 5.5 cm.$t$,
  (select id from public.categories where slug = $t$jewellery$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Madhubani Art Print$t$, $t$madhubani-art-print$t$, $t$Madhubani painting comes from Bihar, where women have decorated walls and floors with bold lines, patterns and nature motifs for generations. This print reproduces an original painting in rich colour on thick archival paper.

Each print is signed by the artist, and the colours stay vivid for years when framed behind glass. It suits a living room gallery wall, a study, or a hallway.

A good gift for anyone who loves art with a story.$t$, $t$An A4 archival print of an original Madhubani-style painting, signed by the artist. Frame not included.$t$,
  $j$["Printed from an original folk-art painting","Archival paper and fade-resistant ink","Signed by the artist","Fits a standard A4 frame"]$j$::jsonb,
  $j$[{"label":"Size","value":"A4 (21 × 29.7 cm)"},{"label":"Paper","value":"300 gsm archival matte"},{"label":"Ink","value":"Fade-resistant pigment"},{"label":"Edition","value":"Signed by the artist"},{"label":"Frame","value":"Not included"},{"label":"Shipped","value":"Rolled in a tube"}]$j$::jsonb,
  $t$Keep out of direct sunlight and away from damp walls. Frame behind glass for long-lasting colour. Handle by the edges.$t$, 699, null, 25,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/madhubani-art-print/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/madhubani-art-print/2.jpg$t$], true, false, $j$[{"label":"Packaging charge","amount":30,"reason":"Shipped rolled in a sturdy tube so it arrives flat and crease-free."}]$j$::jsonb,
  $t$Madhubani Art Print A4 | Signed Folk Art Wall Decor$t$, $t$A4 archival Madhubani-style art print signed by the artist. Vivid folk-art wall decor, shipped in a protective tube.$t$,
  (select id from public.categories where slug = $t$wall-art$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Gift Hamper — Little Joys$t$, $t$gift-hamper-little-joys$t$, $t$"Little Joys" is our most-loved gift. We pick small things that feel special: a hand-poured mini candle, a cold-process soap, and a block-printed cotton pouch that you can use again and again.

Everything is arranged in a keepsake box with shredded paper and tied with a ribbon. Tell us your message when you order and we write it by hand on the card.

It is a thoughtful choice for birthdays, festivals, Raksha Bandhan, a thank-you, or a new baby.$t$, $t$A curated hamper with a soy candle, handmade soap, a block-printed pouch and a handwritten note, ready to gift.$t$,
  $j$["Soy candle, handmade soap and block-printed pouch","Packed in a reusable keepsake box","Handwritten note with your message","Gift-ready, nothing more to wrap"]$j$::jsonb,
  $j$[{"label":"Includes","value":"Mini soy candle, handmade soap, block-printed pouch, greeting card"},{"label":"Box","value":"Reusable keepsake box"},{"label":"Box size","value":"25 × 18 × 8 cm"},{"label":"Weight","value":"About 700 g"},{"label":"Message","value":"Handwritten note included"},{"label":"Best for","value":"Birthdays, festivals, thank-yous"}]$j$::jsonb,
  $t$Store the soap in a dry place and keep the candle away from heat. The pouch can be hand-washed gently in cold water.$t$, 1899, 2299, 10,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/gift-hamper-little-joys/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/gift-hamper-little-joys/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/gift-hamper-little-joys/3.jpg$t$], true, true, $j$[{"label":"Gift packaging","amount":99,"reason":"Premium gift box, ribbon and your handwritten card."}]$j$::jsonb,
  $t$Gift Hamper “Little Joys” | Handmade Gift Box India$t$, $t$Curated handmade gift hamper with soy candle, soap and block-printed pouch in a keepsake box with a handwritten note.$t$,
  (select id from public.categories where slug = $t$gifts$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Jute & Cotton Table Runner$t$, $t$jute-cotton-table-runner$t$, $t$Jute is a golden natural fibre, and when it is woven with cotton it becomes sturdy and soft at the same time. This runner is made on a traditional loom by weavers who have worked with jute for generations.

The neutral colour works with white crockery, wooden tables and colourful festive decor alike. The tasselled ends add a relaxed, handmade finish.

Use it on a dining table, console, or even as a bed runner.$t$, $t$A handwoven jute and cotton table runner with tassel ends. Brings warm, natural texture to dining and coffee tables.$t$,
  $j$["Handwoven on a traditional loom","Natural jute with soft cotton","Tassel ends","Easy to style all year round"]$j$::jsonb,
  $j$[{"label":"Material","value":"Jute and cotton"},{"label":"Size","value":"180 × 35 cm"},{"label":"Colour","value":"Natural beige"},{"label":"Weight","value":"About 280 g"},{"label":"Care","value":"Spot clean"},{"label":"Made in","value":"India"}]$j$::jsonb,
  $t$Shake out to remove crumbs and spot-clean with a damp cloth. Do not machine-wash or bleach. Air dry flat in the shade.$t$, 799, null, 14,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/jute-cotton-table-runner/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/jute-cotton-table-runner/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/jute-cotton-table-runner/3.jpg$t$], true, false, $j$[]$j$::jsonb,
  $t$Jute & Cotton Table Runner 180 cm | Handwoven Decor$t$, $t$Handwoven jute and cotton table runner, 180 × 35 cm, with tassel ends. Natural, durable home decor.$t$,
  (select id from public.categories where slug = $t$home-decor$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Sandalwood Soy Candle$t$, $t$sandalwood-soy-candle$t$, $t$Sandalwood is the scent of temples, evenings and slow, calm moments. This candle captures it in a soft, creamy way that is never overpowering.

The amber glass jar has a lid, so the fragrance stays fresh between burns and the candle looks lovely on a shelf even when it is not lit.

Pair it with the Lavender candle for a pair that covers both relaxing mornings and cosy nights.$t$, $t$A warm, woody soy candle with a creamy sandalwood scent in an amber glass jar. Burns for about 45 hours.$t$,
  $j$["Hand-poured natural soy wax","Warm, creamy sandalwood fragrance","About 45 hours of burn time","Amber glass jar with a lid"]$j$::jsonb,
  $j$[{"label":"Wax","value":"100% natural soy wax"},{"label":"Fragrance","value":"Sandalwood"},{"label":"Burn time","value":"About 45 hours"},{"label":"Weight","value":"220 g"},{"label":"Jar","value":"Amber glass with lid"},{"label":"Wick","value":"Cotton"}]$j$::jsonb,
  $t$Trim the wick to 5 mm before each use. Let the wax melt to the edges on the first burn. Burn for no longer than 4 hours at a time and never leave it unattended. Keep the lid on between uses to protect the fragrance.$t$, 499, 599, 28,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/sandalwood-soy-candle/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/sandalwood-soy-candle/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/sandalwood-soy-candle/3.jpg$t$], true, true, $j$[]$j$::jsonb,
  $t$Sandalwood Soy Candle 220 g | Natural Scented Candle$t$, $t$Hand-poured sandalwood soy candle in an amber glass jar with a lid. About 45 hours burn time.$t$,
  (select id from public.categories where slug = $t$candles$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Handwoven Seagrass Basket Set$t$, $t$handwoven-seagrass-basket-set$t$, $t$Seagrass is a fast-growing natural fibre, and these baskets are woven by hand in tight, even rows. The three sizes nest into each other, so they take almost no space when you are not using them.

Use the large one for blankets or laundry, the medium for toys or magazines, and the small one for fruit, keys or a plant. The woven handles make them easy to carry.

They bring a calm, natural look to bedrooms, living rooms and balconies.$t$, $t$A set of three nesting seagrass baskets, handwoven for storage, laundry, plants or toys.$t$,
  $j$["Set of three sizes that nest together","Handwoven from natural seagrass","Sturdy handles","Lightweight yet strong"]$j$::jsonb,
  $j$[{"label":"Material","value":"Seagrass"},{"label":"Sizes","value":"Small 20 cm, medium 26 cm, large 32 cm"},{"label":"Set","value":"3 baskets"},{"label":"Colour","value":"Natural, with a light brown weave"},{"label":"Handles","value":"Woven side handles"},{"label":"Made in","value":"India"}]$j$::jsonb,
  $t$Dust with a soft brush. Wipe with a slightly damp cloth and dry fully in the shade. Do not soak. Avoid keeping in a damp bathroom for long.$t$, 1599, 1999, 9,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/handwoven-seagrass-basket-set/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/handwoven-seagrass-basket-set/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/handwoven-seagrass-basket-set/3.jpg$t$], true, false, $j$[{"label":"Handling charge","amount":60,"reason":"Bulky set: larger box and extra care while packing and shipping."}]$j$::jsonb,
  $t$Handwoven Seagrass Basket Set of 3 | Storage Baskets$t$, $t$Set of 3 handwoven nesting seagrass baskets with handles. Natural storage for home, laundry and plants.$t$,
  (select id from public.categories where slug = $t$home-decor$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Beaded Boho Necklace$t$, $t$beaded-boho-necklace$t$, $t$Every bead on this necklace is chosen and strung by hand, so the pattern is never repeated exactly. The mix of earthy terracotta, cream and teal sits well on kurtas, linen shirts and summer dresses.

The sliding knot lets you adjust the length from a close choker-style fit to a longer pendant length. It is light, so you will barely feel it.

It arrives in a small cloth pouch, ready to give as a gift.$t$, $t$A handmade beaded necklace with natural stones and a boho feel. Light, colourful and easy to style.$t$,
  $j$["Strung by hand bead by bead","Natural stone and glass beads","Adjustable length with a sliding knot","Gift-ready pouch included"]$j$::jsonb,
  $j$[{"label":"Material","value":"Natural stone and glass beads, cotton cord"},{"label":"Length","value":"42 to 52 cm, adjustable"},{"label":"Weight","value":"About 30 g"},{"label":"Colour","value":"Earthy mix of terracotta, cream and teal"},{"label":"Closure","value":"Sliding knot"},{"label":"Includes","value":"Cloth pouch"}]$j$::jsonb,
  $t$Keep dry and remove before swimming or bathing. Store flat in the pouch so the cord does not stretch. Wipe gently with a soft cloth.$t$, 749, 949, 16,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/beaded-boho-necklace/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/beaded-boho-necklace/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/beaded-boho-necklace/3.jpg$t$], true, false, $j$[]$j$::jsonb,
  $t$Beaded Boho Necklace | Handmade Natural Stone Jewellery$t$, $t$Handmade beaded boho necklace with natural stone and glass beads, adjustable 42 to 52 cm.$t$,
  (select id from public.categories where slug = $t$jewellery$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

insert into public.products
  (name, slug, description, short_description, highlights, specs, care_instructions, price, compare_at_price, stock,
   images, is_active, is_featured, fees, seo_title, seo_description, category_id)
values (
  $t$Blue Pottery Trinket Dish$t$, $t$blue-pottery-trinket-dish$t$, $t$Jaipur blue pottery is famous for its cobalt blue patterns on a white glaze. Artisans paint each design by hand before the dish is glazed and fired, so the flowers and leaves are a little different every time.

On a dressing table it holds rings, earrings and hair pins. On an entry table it catches keys and coins. It also makes a pretty dish for serving nuts, mints or incense.

A small gift that feels special.$t$, $t$A hand-painted blue pottery dish for rings, keys and small treasures, in the classic blue-and-white style of Jaipur.$t$,
  $j$["Hand-painted in classic blue and white","Glazed and food-safe finish","Perfect for rings, keys and trinkets","Each dish has its own pattern"]$j$::jsonb,
  $j$[{"label":"Material","value":"Ceramic (blue pottery)"},{"label":"Diameter","value":"11 cm"},{"label":"Height","value":"2.5 cm"},{"label":"Weight","value":"About 160 g"},{"label":"Finish","value":"Glazed, hand-painted"},{"label":"Made in","value":"Jaipur, India"}]$j$::jsonb,
  $t$Hand-wash gently with mild soap and dry with a soft cloth. Do not use in a microwave or dishwasher. Avoid dropping on hard surfaces.$t$, 649, 799, 18,
  array[$t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/blue-pottery-trinket-dish/1.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/blue-pottery-trinket-dish/2.jpg$t$, $t$https://nepfgwfunxebhsfrfxeb.supabase.co/storage/v1/object/public/product-images/seed/blue-pottery-trinket-dish/3.jpg$t$], true, false, $j$[{"label":"Handling charge","amount":30,"reason":"Fragile ceramic: extra padding in the box."}]$j$::jsonb,
  $t$Blue Pottery Trinket Dish | Hand-painted Jaipur Ceramic$t$, $t$Hand-painted blue pottery trinket dish, 11 cm, in classic Jaipur blue and white. Glazed ceramic gift.$t$,
  (select id from public.categories where slug = $t$home-decor$t$)
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  highlights = excluded.highlights, specs = excluded.specs, care_instructions = excluded.care_instructions,
  price = excluded.price, compare_at_price = excluded.compare_at_price, stock = excluded.stock,
  images = excluded.images, is_featured = excluded.is_featured, fees = excluded.fees,
  seo_title = excluded.seo_title, seo_description = excluded.seo_description, category_id = excluded.category_id;

