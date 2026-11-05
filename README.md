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
   2. `supabase/migrations/0002_shipping.sql` (courier / tracking details for shipped orders)
   3. `supabase/seed.sql` (optional sample products)
3. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: your shop number, e.g. `919876543210`
4. Restart `npm run dev`.

### Apply database changes from the terminal (no copy-paste)

One-time setup, in your own terminal:

```bash
npm run db:login   # opens the browser; approve the login
npm run db:link    # asks for the project's Database password (Supabase → Project Settings → Database)
```

After that, every new file in `supabase/migrations/` is applied with:

```bash
npm run db:dry     # shows what would run
npm run db:push    # applies it
```

If Supabase says migration `0001` is already applied, or a migration is missing from the history, you have run it by hand before.
Run `npx supabase migration repair --status applied 0001` once (and the same for any other number you ran manually), then `npm run db:push` again.

### Create the admin account

1. Supabase → **Authentication → Users → Add user**. Enter your email and a strong password, and tick "Auto confirm".
2. In the SQL Editor, run:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. Sign in at **/admin/login**.

After that, everything about your login is in the app: **Admin → My account** (name, email, password) and **Forgot password** on the sign-in page. No database access needed.

### Admin account emails (set up before launch)

Change-email and reset-password links are sent by Supabase Auth. Before going live:

1. Supabase → **Authentication → URL Configuration**: set **Site URL** to your live address and add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for testing) under **Redirect URLs**.
2. Supabase → **Authentication → SMTP Settings**: add your own SMTP (the built-in sender is limited to a few emails per hour). Brevo and Resend both have free plans.
3. Optional: edit the "Reset password" and "Change email" templates under **Authentication → Email Templates**.

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

## How ordering and payment work

Payment comes **first**: cash on delivery is not supported. It is free UPI with manual verification (no payment-gateway fees).

1. **Cart → checkout.** Items live on the customer's device. At checkout they enter (or pick a saved) delivery address. The `create_order` database function **re-reads prices from the database** and adds delivery and per-product extra charges, so a tampered cart can't change the total. The order is saved as *Pending · payment pending* with a code like `KK-7F3K9Q`.
2. **Pay by UPI.** The customer lands on a payment screen: a "Pay with UPI app" button on mobile, a QR code on desktop, and the UPI ID to copy. The amount and order code are pre-filled. After paying they enter the **UTR / UPI reference number**. The same screen is available later from **Track order** and **My orders**.
3. **Verify.** The order shows up in Admin → Dashboard ("Payments to verify") and Admin → Orders (filter *To verify*). The admin finds the payment in their UPI/bank app and clicks **Verify payment & confirm order**: the payment becomes *Paid* and the order **Confirmed** in one step. Wrong or missing payment? **Reject** it with a reason; the customer sees the reason and can submit again. One UTR can only be used for one order.
4. **Fulfil.** The admin moves the order through **Confirmed → Packed → Shipped → Delivered**. An unconfirmed order can't be moved forward until its payment is marked paid. Choosing **Shipped** lets the admin add courier, tracking number, link and expected date. Every step has a "send update on WhatsApp" button.
5. **Customer view.** `/track` (order code + last 4 phone digits) or **My orders** shows progress, the price breakdown, the payment receipt (reference, amount, date) and shipping details.
6. **Changing the delivery address.** Until the order is confirmed, the customer can edit name, phone and address on the order. After that it is locked, and the admin sees a note if the customer changed it.

Set your UPI ID and delivery charges in **Admin → Settings**. The same page controls your shop name, tagline, description, SEO keywords, WhatsApp number, email, phone, city, Instagram/Facebook links, an announcement banner and the order-code prefix; changes go live on the website as soon as you save. Revenue on the dashboard counts verified payments only.

### Saved addresses

Signed-in customers keep an address book under **Profile & addresses**: up to 10 addresses (Home / Work / Other), a default one, add / edit / delete. At checkout they pick one in a tap, or enter a new one and tick "Save this address".

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
    form/             The shared inputs: TextField, TextAreaField, SelectField, SearchField, SwitchField. Use these for EVERY form
    store/ admin/ account/ shared/
  lib/                supabase clients, seo helpers, formatting
  store/              Client state (cart, wishlist, auth) with Zustand
  config/site.ts      Deployment constants only (site URL, locale). Shop details live in Admin → Settings
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
