# Kalakriti: handmade gifts store

A fast, installable (PWA) online store where customers pay via **UPI** (with zero gateway fees) and receive order updates on **WhatsApp**. It includes an admin panel for products, categories, orders, returns, refunds, and store settings, Google login for customers, saved addresses, a synced wishlist, guest & account order tracking, GST-ready printable invoices, and built-in SEO. Everything runs on free tiers (₹0/month).

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), Motion animations |
| Database / Auth / Images | Supabase (Postgres + RLS, Google OAuth, Storage, `pg_cron`) |
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
2. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: your shop number, e.g. `919876543210`
   - `CRON_SECRET`: a long random string for the keep-alive cron endpoint
   - `RATE_LIMIT_SALT`: a long random string used to hash IPs for rate limiting
3. Apply the database migrations (`supabase/migrations/0001_init.sql` through `0046_smart_shipping_and_security_hardening.sql`) using the CLI below, and optionally run `supabase/seed.sql` for sample products.
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
Run `npx supabase migration repair --remote --status applied 0001` once (and the same for any other number you ran manually), then `npm run db:push` again.

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
3. Add the environment variables from `.env.example`. Set `NEXT_PUBLIC_SITE_URL` to your live URL, `CRON_SECRET` to a long random string, and `RATE_LIMIT_SALT` to a random secret.
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

It opens full-screen, has an app icon and shortcuts, and shows an offline page when there's no internet. (A Play Store listing via TWA is optional later; it has a one-time \$25 fee.)

---

## How ordering, payment, delivery, cancellation, and returns work

Payment comes **first**: cash on delivery is not supported. It uses direct UPI with manual admin verification (₹0 payment-gateway fees).

1. **Cart → Checkout & UPI Payment.** Items live on the customer's device. At checkout they enter (or pick a saved) delivery address, pay by UPI (via "Pay with UPI app" on mobile, QR code on desktop, or copying the UPI ID), and enter their **12-digit UTR / UPI reference number**. The `create_order` database function **re-reads prices, weights, and shipping classes from the database**, computes smart order-level handling fees (fragile / oversized tier once per order + heavy-parcel courier slabs) and delivery charges, snapshots seller/GST tax details for immutable invoices, reserves stock atomically, and records the submitted UTR (`payment_status = 'submitted'`).
2. **Verify or Reject Payment.** The order appears in Admin → Dashboard ("Payments to verify") and Admin → Orders (filter *To verify*).
   - **Verify:** The admin checks their UPI/bank app and clicks **Payment received (confirm order)** — payment becomes *Paid* and the order moves to **Confirmed** in one step.
   - **Reject:** If the UTR is wrong or payment didn't arrive, the admin rejects it with a reason (`payment_status = 'failed'`). The customer sees the reason on `/track` or **My orders**, can submit a corrected UTR, and gets a fresh `unpaid_order_expiry_hours` window before auto-cancellation.
   - **Unique UTR:** One UTR can only be used for one order.
3. **Fulfilment & 1-Step Undo.** The admin moves the order through **Confirmed → Packed → Shipped → Delivered**. Choosing **Shipped** records courier, tracking number, tracking link, and expected delivery date. Every step offers a "Tell customer on WhatsApp" shortcut. If a status was advanced by mistake, the admin can **Undo 1 step** (with an audit reason saved to private admin notes).
4. **Cancellations & Auto-Expiry.**
   - **Customer cancel:** Customers can cancel while the order is `pending` or `confirmed` (guests verify their full 10-digit mobile number).
   - **Admin cancel:** Admins can cancel while `pending`, `confirmed`, or `packed`.
   - **Auto-cancel (`pg_cron`):** Unpaid orders (`pending` / `failed`) older than `unpaid_order_expiry_hours` are automatically cancelled every 15 minutes by `expire_unpaid_orders()`.
   - **Automatic stock restore:** Cancelling an order automatically restores reserved stock via the `orders_restock_on_cancel` trigger. If the customer had already paid (or submitted a UTR before cancellation), the order appears under **Refund due** so the admin can verify/refund it.
5. **Returns & Refunds (Myntra-style 4-step flow).**
   - Within `return_window_days` of delivery, customers can request a return for specific items and quantities.
   - **Step 1 (Requested) → Step 2 (Approved + Pickup date) → Step 2b (Pickup successful) → Step 3 (Goods received & restocked) → Step 4 (Refunded).**
   - Returns refund **item value only** (delivery and handling charges are non-refundable and clearly itemised). Admins can also initiate a return on a customer's behalf or undo a return step if clicked by mistake.
6. **Customer & Guest Tracking.** Signed-in customers manage orders under **My orders** (`/account/orders`) and download printable GST/non-GST invoices. Guests track orders at `/track` using their order code + last 4 phone digits (sensitive details like full address, phone, and UTR prefix are masked for privacy).

Set your UPI ID, delivery/handling charges, return window, auto-cancel hours, GST details, and branding in **Admin → Settings**; changes go live immediately.

### Saved addresses

Signed-in customers keep an address book under **Profile & addresses**: up to 10 addresses (Home / Work / Other), a default one, add / edit / delete. At checkout they pick one in a tap, or enter a new one and tick "Save this address".

## Folder structure

```
src/
  app/
    (store)/          Customer pages: home, products, category, cart, checkout, track, account, wishlist…
    admin/            Admin login + (panel)/ dashboard, orders, products, categories, settings, account
    auth/callback/    Google login return URL
    api/cron/         Keep-alive job
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.tsx …   SEO + PWA
  features/           Business logic per feature (no UI)
    products/         queries (cached), admin-queries, actions, schema, types
    orders/           actions, queries, admin-*, pricing, returns, refund, transitions, deadline, whatsapp
    auth/ account/ addresses/ settings/ security/ wishlist/ location/
  components/
    ui/               shadcn primitives (don't edit by hand; re-add with the shadcn CLI)
    form/             The shared inputs: TextField, TextAreaField, SelectField, SearchField, SwitchField, DateField
    store/ admin/ account/ shared/
  lib/                supabase clients, seo helpers, formatting, validation
  store/              Client state (cart, wishlist, auth) with Zustand
  config/site.ts      Deployment constants only (site URL, locale). Shop details live in Admin → Settings
supabase/             SQL migrations (0001..0046) + seed
public/sw.js          Service worker (offline support)
```

**Rules of thumb:** pages stay thin and call `features/*`. Every Server Action validates input with Zod, enforces rate limits, and checks auth itself. The database enforces access and state transitions with Row Level Security (RLS), `SECURITY DEFINER` RPCs, and triggers as a second line of defence.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest unit test suite (29 test files, 772 tests) |
| `npm run db:dry` | Dry-run pending Supabase migrations against the linked remote project |
| `npm run db:push` | Push pending Supabase migrations to the linked remote project |

## Architecture & Security Highlights

- **Server-side rate limiting:** All public actions (`place-order`, `track-order`, `submit-payment`, `update-delivery`, `cancel-order`, `request-return`, `withdraw-return`) are rate-limited in Postgres via hashed IP buckets (`check_rate_limit`) plus per-order brute-force lockouts (`order_lookup_Export` / `find_order_for_guest`).
- **Atomic stock management:** Stock is reserved with row locks (`FOR UPDATE` in deterministic UUID order) inside `create_order`, restored automatically on cancellation (`orders_restock_on_cancel`), and restocked selectively when returned goods are received (`record_order_return`).
- **Automatic guest-to-account order linking:** When a customer signs in (or signs up) with an email or phone matching earlier guest orders, `claim_my_guest_orders` links those orders to their account.
- **Storage cleanup:** Removing product photos during editing or deleting a product cleans up orphaned files from the Supabase Storage `products` bucket.
