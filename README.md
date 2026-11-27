# Kalakriti: Universal Direct-to-Consumer Online Store

A fast, installable (PWA with branded animated splash) niche-agnostic online store where customers pay via **UPI** (with zero gateway fees) or optional payment gateways and receive order updates on **WhatsApp**. It includes an admin panel for products (with multi-option Color × Size × custom variants, smart pricing rules, and per-variant stock/SKU), categories, orders, returns/exchanges, refunds, promo codes/coupons, back-in-stock alerts, and store settings (with a 7-day admin session + 12-hour 4-digit Quick PIN lock), verified customer product reviews & star ratings, email/password & Google login for customers (with password change/reset and self-service account deactivation + automatic recovery on login), saved addresses, a synced wishlist, guest & account order tracking (with fixed order-prefix input), GST-ready printable invoices, and built-in SEO. Everything runs on free tiers (₹0/month).

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + TypeScript |
| UI & Styling | Plain CSS Modules (`*.module.css`, 35 modules), Base UI (`@base-ui/react`), Motion animations |
| Design System | Dual CSS Variable Themes (`src/styles/theme-store.css` for Storefront Sky/Ocean/Coral & `src/styles/theme-admin.css` for Admin Slate/Terracotta, independent Light & Dark) |
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
3. Apply the database migrations (`supabase/migrations/0001_init.sql` through `0069_product_variants.sql`) using the CLI below, and optionally run `supabase/seed.sql` for sample products.
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

1. **Cart → Checkout & UPI Payment.** Items live on the customer's device. At checkout they enter (or pick a saved) delivery address, pay by UPI (via "Pay with UPI app" on mobile, "Show QR code" on mobile or QR code on desktop, or copying the UPI ID), and enter their **12-digit UTR / UPI reference number**. The `create_order` database function **re-reads prices, weights, and shipping classes from the database**, computes smart order-level handling fees (fragile / oversized tier once per order + heavy-parcel courier slabs) and delivery charges, snapshots seller/GST tax details for immutable invoices, reserves stock atomically, and records the submitted UTR (`payment_status = 'submitted'`).
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
5. **Returns, Exchanges & Refunds (Standard & Doorstep Exchange flows).**
   - Within `return_window_days` of delivery, customers can request a **Refund** or an **Exchange / Replacement** (specifying preferred size, colour, or replacement piece, and optionally choosing a saved or newly entered alternate pickup address) for specific items and quantities.
   - **Refund / Standard Exchange:** **Requested → Approved (Expected pickup by date) → Pickup successful → Goods received & restocked → Refunded / Replacement shipped (with courier & estimated delivery) → Replacement delivered.**
   - **Doorstep Exchange (1-visit swap):** Admins can approve an exchange as a single-visit doorstep swap (optionally adding courier/tracking details right inside the Approve dialog or later via the shipping card) so pickup and replacement happen together.
   - Returns refund **item value only** (delivery and handling charges are non-refundable and clearly itemised). Admins can also initiate a return/exchange on a customer's behalf or undo a return step if clicked by mistake.
6. **Promo Codes, Verified Product Reviews & Account Controls.**
   - **Promo Codes:** Admins create, enable/disable, or delete percentage or flat discount codes (with min order amount, max discount cap, usage limits, and expiry dates) in **Admin → Settings**; customers apply them at checkout and discounts appear on order summaries and GST invoices.
   - **Verified Reviews:** Customers who have received a delivered order for a product can rate (1–5 stars) and review it on the product page (with a *Verified purchase* badge, rating distribution bars, and `AggregateRating` SEO schema).
   - **Account Deactivation, Recovery & Data Portability:** Customers can download a printable, human-readable HTML summary of their personal data (**Download my data**, `exportMyAccountDataHtml`) or deactivate their account from `/account/profile` (with required reason selection) once all active orders and returns are complete; signing back in anytime automatically restores a deactivated account.
   - **Legal, Privacy & Compliance Pages:** Dynamic `/privacy` (Privacy Policy with Data Retention schedule & Subprocessors table), `/terms` (Terms of Service), and `/refund-policy` (Refund, Return & Shipping Policy) pages driven by `StoreSettings`, plus an essential-cookies & storage notice banner (`<CookieBanner />`), an in-place tabbed `<LegalQuickModal />` preview dialog, and explicit Terms & Privacy acceptance on account sign-up.
7. **Customer & Guest Tracking.** Signed-in customers manage orders under **My orders** (`/account/orders`) and download printable GST/non-GST invoices. Guests track orders at `/track` using their order code + last 4 phone digits (sensitive details like full address, phone, and UTR prefix are masked for privacy).

Set your UPI ID, payment mode (Direct UPI vs. Payment Gateway — see `payment-gateway-setup.md`), delivery/handling charges, return window, auto-cancel hours, GST details, and branding in **Admin → Settings**; changes go live immediately.

### Saved addresses & account tabs

Signed-in customers manage their account across 2 tabs (**My orders** at `/account/orders` and **Profile & addresses** at `/account/profile`), with up to 10 saved addresses (Home / Work / Other, default selection, add / edit / delete) and profile details (name, email with confirmation, mobile number) on one unified page. At checkout they pick a saved address in a tap, or enter a new one and tick "Save this address".

## Folder structure

```
src/
  app/
    (store)/          Customer pages: home, products, category, cart, checkout, track, account, wishlist…
    admin/            Admin login + (panel)/ dashboard, orders, products, categories, settings, account
    auth/callback/    Google login return URL
    api/cron/         Keep-alive job
    api/webhooks/     Payment gateway webhook handler (`payment/route.ts`)
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.tsx …   SEO + PWA
  features/           Business logic per feature (no UI)
    products/         queries (cached), admin-queries, actions, schema, types
    orders/           actions, queries, admin-*, pricing, payment-gateway, gateway-client, returns, refund, transitions, deadline, whatsapp
    auth/ account/ addresses/ settings/ security/ wishlist/ location/
  components/
    ui/               Base UI primitives (Button, Checkbox, Dialog, Sheet, Select, DropdownMenu, Tabs, Table, Sonner…) + ui.module.css
    form/             Shared form inputs (TextField, TextAreaField, SelectField, FormSelectField, SearchField, SwitchField, CheckboxField, DateField) + form.module.css
    store/            Storefront views & components (Header, Hero, ProductBrowser with 12-per-page Pagination, Cart, Checkout, OrderPlaced, Reviews…) + *.module.css
    admin/            Admin panel views (Dashboard, Orders, Products, Categories, Settings, Account, Launch) + admin-*.module.css
    account/          Customer account views (MyOrders, ProfileForm, AddressBook, AccountNav) + account.module.css
    shared/           Shared components (Pagination, Skeletonize, BusyOverlay, ConfirmDialog, InvoiceDocument, ScrollReset…) + shared.module.css & pagination.module.css
  lib/                supabase clients, seo helpers, formatting, validation
  store/              Client state (cart, wishlist, auth) with Zustand
  styles/             Independent Light & Dark CSS variable theme files (`theme-store.css`, `theme-admin.css`)
  config/site.ts      Deployment constants only (site URL, locale). Shop details live in Admin → Settings
supabase/             SQL migrations (0001..0069) + seed
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
| `npm test` | Run the Vitest unit test suite (30 test files, 840 tests) |
| `npm run db:dry` | Dry-run pending Supabase migrations against the linked remote project |
| `npm run db:push` | Push pending Supabase migrations to the linked remote project |

## Architecture & Security Highlights

- **Server-side rate limiting:** All public actions (`place-order`, `track-order`, `submit-payment`, `update-delivery`, `cancel-order`, `request-return`, `withdraw-return`) are rate-limited in Postgres via hashed IP buckets (`check_rate_limit`) plus per-order brute-force lockouts (`order_lookup_Export` / `find_order_for_guest`).
- **Atomic stock management:** Stock is reserved with row locks (`FOR UPDATE` in deterministic UUID order) inside `create_order`, restored automatically on cancellation (`orders_restock_on_cancel`), and restocked selectively when returned goods are received (`record_order_return`).
- **Automatic guest-to-account order linking:** When a customer signs in (or signs up) with an email or phone matching earlier guest orders, `claim_my_guest_orders` links those orders to their account.
- **Safe storage cleanup & draft isolation:** Removing existing product photos in the admin editor only updates form state until saved (`saveProduct` deletes removed files from the `products` bucket only upon saving, while unsaved newly uploaded files are cleaned up via `deleteUnusedUpload`). Leaving an unsaved form automatically discards dirty edits when Next.js `<Activity>` caches unmount the route.
- **Instant PPR streaming & scroll restoration:** Dynamic detail pages wrap `await params` inside `<Suspense fallback={<Loading />}>` with derived `<Skeletonize>` views for instant navigation and refresh, while `<ScrollReset />` (`useInsertionEffect` + `Navigation API` + `sessionStorage`) restores exact scroll positions across browser Back/Forward and back-link navigations.
