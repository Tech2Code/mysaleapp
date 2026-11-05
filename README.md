# Kalakriti: handmade gifts store

A fast, installable (PWA) online store where customers order on **WhatsApp**. It includes an admin panel for products and orders, Google login for customers, a wishlist, order tracking and built-in SEO. Everything runs on free tiers (₹0/month).

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), Motion animations |
| Database / Auth / Images | Supabase (Postgres + RLS, Google OAuth, Storage) |
| Hosting | Vercel (free Hobby plan) |

---

## 1. Run it locally (2 minutes)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase keys the app runs in **demo mode**: it shows sample products, but orders, login and the admin panel are disabled.

## 2. Connect Supabase (free)

1. Create a project at https://supabase.com. Pick the **Mumbai** region for Indian customers.
2. Open **SQL Editor** and run, in order:
   1. `supabase/migrations/0001_init.sql` (tables, security rules, order functions, image bucket)
   2. `supabase/seed.sql` (optional sample products)
3. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: your shop number, e.g. `919876543210`
4. Restart `npm run dev`.

### Create the admin account

1. Supabase → **Authentication → Users → Add user**. Enter your email and a strong password, and tick "Auto confirm".
2. In the SQL Editor, run:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. Sign in at **/admin/login**.

### Enable "Continue with Google" for customers

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** (type: Web application).
   - Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Providers → Google**: paste the Client ID and Client secret, then enable it.
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: your live URL (e.g. `https://kalakriti.vercel.app`)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`

## 3. Deploy to Vercel (free)

1. Push this folder to a GitHub repository.
2. https://vercel.com → **Add New Project** → import the repository.
3. Add the environment variables from `.env.example`. Set `NEXT_PUBLIC_SITE_URL` to your live URL and `CRON_SECRET` to a long random string.
4. Deploy. `vercel.json` adds a daily cron job that keeps the free Supabase project from pausing after 7 days of inactivity.

Later, buy a `.in` or `.com` domain (about ₹99–800/year). Add it in Vercel → Domains and update `NEXT_PUBLIC_SITE_URL`.

## 4. Get found on Google

The code already handles: per-page titles and descriptions, canonical URLs, `sitemap.xml`, `robots.txt`, Product, Breadcrumb and Organization structured data, share images for WhatsApp and Instagram, fast static pages, and optimised images.

What you need to do:

1. **Google Search Console** (https://search.google.com/search-console): add your site, verify it (put the code in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`), then submit `https://<your-site>/sitemap.xml`.
2. **Google Business Profile** (free): create a profile with your shop name and website. This is the biggest boost for brand-name searches.
3. Link the website from your Instagram bio, Facebook page and WhatsApp Business profile.
4. Write a good description (size, material, care) and upload real photos for every product. The admin form shows a live Google preview.

Searches for your brand name usually reach the top within a few weeks. Generic keywords ("handmade gifts online") take longer and need more content.

## 5. Install as an app

- **Android (Chrome):** open the site → menu → *Install app* (or the install prompt).
- **iPhone (Safari):** Share → *Add to Home Screen*.

It opens full-screen, has an app icon and shortcuts, and shows an offline page when there's no internet. (A Play Store listing via TWA is optional later; it has a one-time $25 fee.)

---

## How ordering works

1. The customer adds items to the cart (saved on their device; no login needed).
2. At checkout they enter name, phone and address. The server calls the `create_order` database function, which **re-reads prices from the database**, so a tampered cart can't change the total. It also checks stock and saves the order with a code like `KK-7F3K9Q`.
3. WhatsApp opens with a pre-filled order message. The customer taps send.
4. The admin confirms on WhatsApp and moves the order through **Pending → Confirmed → Packed → Shipped → Delivered** in `/admin/orders`. Each step has a one-click "send update on WhatsApp" button.
5. Customers track orders at `/track` (order code + last 4 phone digits), or under **My orders** if they were signed in.

## Folder structure

```
src/
  app/
    (store)/          Customer pages: home, products, category, cart, checkout, track, account, wishlist…
    admin/            Admin login + (panel)/ dashboard, orders, products, categories
    auth/callback/    Google login return URL
    api/cron/         Keep-alive job
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.tsx …   SEO + PWA
  features/           Business logic per feature (no UI)
    products/         queries (cached), admin-queries, actions, schema, types
    orders/           actions, queries, admin-*, schema, whatsapp message builder
    auth/ account/ wishlist/
  components/
    ui/               shadcn primitives (don't edit by hand; re-add with the shadcn CLI)
    store/ admin/ account/ shared/
  lib/                supabase clients, seo helpers, formatting
  store/              Client state (cart, wishlist, auth) with Zustand
  config/site.ts      ← shop name, WhatsApp number, socials, SEO defaults: edit here first
supabase/             SQL migration + seed
public/sw.js          Service worker (offline support)
```

**Rules of thumb:** pages stay thin and call `features/*`. Every Server Action validates input with Zod and checks auth itself. The database enforces access with Row Level Security as a second line of defence.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |

## Known limitations / next steps

- Orders aren't rate-limited. If spam orders become a problem, add Vercel BotID or Cloudflare Turnstile to checkout.
- Stock is checked when an order is placed but not deducted automatically. Update stock in the admin panel once an order is confirmed.
- Guest orders aren't linked to an account later, because phone numbers aren't verified without paid SMS OTP. Customers track them with their order code.
- The cart lives on each device. The wishlist syncs across devices once signed in.
- Photos removed from a product while editing stay in Storage until the product is deleted.
