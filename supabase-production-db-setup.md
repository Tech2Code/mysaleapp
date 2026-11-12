# Separate Development & Live (Production) Supabase Database Setup Guide

Abhi aap **Development (`localhost:3000`)** aur **Live (`https://mysaleapp-one.vercel.app`)** dono jagah ek hi Supabase database (`nepfgwfunxebhsfrfxeb`) use kar rahe hain.

Jab aap future me **Live Production App ke liye alag Supabase Database** banana chahenge (taaki local testing ke dummy orders/products live site par na dikhein aur live customer data 100% safe rahe), tab niche diye gaye **8 exact steps** follow karein.

---

## Architecture Overview: Separate Dev & Live DB Kaise Kaam Karta Hai?

Aapke code me kisi bhi file me Supabase URL hardcode nahi hai:
- **Supabase Config**: [`src/lib/supabase/config.ts`](file:///d:/nextApps/mysaleapp/src/lib/supabase/config.ts) — `NEXT_PUBLIC_SUPABASE_URL` aur `NEXT_PUBLIC_SUPABASE_ANON_KEY` read karta hai.
- **Image & CSP Whitelist**: [`next.config.ts`](file:///d:/nextApps/mysaleapp/next.config.ts#L3-L61) — Build time par `NEXT_PUBLIC_SUPABASE_URL` se automatic naye Supabase project ka hostname nikal kar Content-Security-Policy (`img-src`, `connect-src`) aur Next.js Image Optimization (`remotePatterns`) me allow kar deta hai.
- **Database Schema**: [`supabase/migrations/`](file:///d:/nextApps/mysaleapp/supabase/migrations) — Aapki saari tables, RLS policies, triggers, storage buckets (`products`), aur RPC functions `0001_init.sql` se `0046_smart_shipping_and_security_hardening.sql` me saved hain.

| Environment | Kahan Chalta Hai? | Kaunsa Env Use Hota Hai? | Kaunsa Supabase DB? |
|---|---|---|---|
| **Development** | Aapke PC par (`http://localhost:3000`) | Local `.env.local` file | Purana/Dev Supabase DB (`nepfgwfunxebhsfrfxeb`) |
| **Production (Live)** | Vercel (`https://mysaleapp-one.vercel.app` ya Custom Domain) | Vercel Dashboard → Environment Variables | **Naya Production Supabase DB** |

---

## STEP 1: Naya Production Supabase Project Create Karein

1. **[Supabase Dashboard](https://supabase.com/dashboard/projects)** kholein.
2. **"New project"** button par click karein:
   - **Organization**: Apni organization chunein.
   - **Name**: `mysaleapp-prod` (ya apne brand ka naam + `-prod`).
   - **Database Password**: **"Generate a password"** par click karein aur is password ko kisi safe jagah copy karke save kar lein *(CLI se migrations push karte waqt iski zaroorat padegi)*.
   - **Region**: **`South Asia (Mumbai) [ap-south-1]`** chunein *(India ke users ke liye sabse fast response milega)*.
3. **"Create new project"** par click karein (project ready hone me 1–2 minute lagenge).

---

## STEP 2: Naye Production Project Ki 3 Zaroori Keys Copy Karein

Jab naya project ready ho jaye:
1. Left sidebar me **Project Settings (⚙️ Gear Icon)** → **General** par jayein:
   - **Reference ID (`Project Ref`)** copy karein (e.g., `abcdefghijklmno12345`).
2. Left sidebar me **Project Settings (⚙️)** → **API** (ya top bar me **Connect** button) par jayein:
   - **Project URL**: Copy karein (e.g., `https://abcdefghijklmno12345.supabase.co`).
   - **Project API Keys → `anon` `public` (ya `publishable` key)**: Copy karein.
   - *(Note: `service_role` secret key aapko kahin bhi lagane ki zaroorat nahi hai kyunki aapka app RLS + `SECURITY DEFINER` RPCs use karta hai).*

---

## STEP 3: Saari 46 SQL Migrations Naye Production DB me Push Karein

Aapko naye database me ek bhi table ya function haath se banane ki zaroorat nahi hai! [`supabase/migrations/`](file:///d:/nextApps/mysaleapp/supabase/migrations) folder me `0001` se `0046` tak sab kuch maujood hai.

Apne VS Code terminal (`d:\nextApps\mysaleapp`) me yeh commands ek-ek karke chalayein:

### 3.1 Supabase CLI Login Check Karein
```powershell
npm run db:login
```
*(Agar pehle se logged in hain to yeh turant complete ho jayega).*

### 3.2 Terminal ko Naye Production Project se Link Karein
Apne naye project ka **Reference ID** (jo Step 2.1 me copy kiya tha) yahan lagayein:
```powershell
npx supabase link --project-ref YOUR_NEW_PROD_PROJECT_REF
```
- Jab terminal **Database password** maange, to Step 1 me banaya gaya naya Database Password paste karke `Enter` dabayein.

### 3.3 Dry-Run Karke Check Karein
```powershell
npm run db:dry
```
- Yeh dikhayega ki `0001_init.sql` se lekar `0046_smart_shipping_and_security_hardening.sql` tak saari migrations naye DB par apply hone ke liye ready hain.

### 3.4 Saari Migrations Live DB Par Push Karein
```powershell
npm run db:push
```
- **Bas 10–20 seconds me** aapke naye Production Database me:
  - Saari tables (`products`, `categories`, `orders`, `order_status_history`, `order_admin_notes`, `order_returns`, `return_requests`, `profiles`, `addresses`, `wishlists`, `admins`, `store_settings`, `rate_limits`)
  - Saari RLS security policies aur triggers
  - Saare RPC functions (`create_order`, `submit_payment`, `track_order`, `revert_order_status`, etc.)
  - Aur `products` Storage Bucket
  100% automatic create ho jayenge!

> **Tip (`package.json` Script)**:
> [`package.json`](file:///d:/nextApps/mysaleapp/package.json#L11-L15) me aap chahein to do alag scripts rakh sakte hain:
> - `"db:link:dev": "supabase link --project-ref nepfgwfunxebhsfrfxeb"`
> - `"db:link:prod": "supabase link --project-ref YOUR_NEW_PROD_PROJECT_REF"`
> Taaki jab dev DB par kaam karna ho to `npm run db:link:dev` aur jab live DB par migration bhejni ho to `npm run db:link:prod` chala sakein!

---

## STEP 4: Naye Production DB me Apna Admin Account Banayein

Naya database bilkul clean/empty hoga, isliye usme apna **Admin Login** banane ke liye yeh 2 steps karein:

1. **[Supabase Dashboard](https://supabase.com/dashboard)** me apna **Naya Production Project** kholein.
2. Left sidebar me **Authentication** → **Users** par jayein:
   - Top-right me **"Add user"** → **"Create new user"** par click karein.
   - **Email Address**: Apna admin email dalein.
   - **Password**: Strong admin password dalein.
   - **Auto Confirm User**: ✅ Tick rakhein.
   - **"Create user"** par click karein.
   - Ab list me us naye user ke **User UID** (UUID, jaise `a1b2c3d4-...`) ko copy kar lein.
3. Left sidebar me **SQL Editor** par click karein → **"New query"** me yeh 1 line chala dein (apna copied User UID daal kar):
   ```sql
   insert into public.admins (user_id) values ('PASTE-YOUR-USER-UID-HERE');
   ```
   - **Run** par click karein. Ab aapka yeh user Production Database ka **Super Admin** ban gaya hai!

---

## STEP 5: Naye Supabase Project me Auth URLs & Google Login Set Karein

### 5.1 Supabase URL Configuration
Naye Production Supabase Dashboard me:
1. Left sidebar me **Authentication** → **URL Configuration** par jayein.
2. **Site URL** me apni live site ka URL dalein:
   ```text
   https://mysaleapp-one.vercel.app
   ```
   *(Ya agar custom domain le liya hai to `https://www.yourbrand.com`)*.
3. **Redirect URLs** me **"Add URL"** par click karke yeh add karein:
   ```text
   https://mysaleapp-one.vercel.app/**
   ```
   *(Aur agar custom domain bhi hai to `https://www.yourbrand.com/**` aur `https://yourbrand.com/**`)*.
4. **Save changes** par click karein.

### 5.2 Customer Google Login (OAuth) Setup (Agar Customers ke liye Google Sign-In On Rakhna Hai)
Jab Supabase project badalta hai, to uska Google OAuth callback URL bhi badal jata hai:
1. Naye Supabase Dashboard → **Authentication** → **Providers** → **Google** par click karein.
2. Wahan aapko **Callback URL (for OAuth)** dikhega:
   ```text
   https://YOUR_NEW_PROD_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Isko copy karein.
3. **[Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials)** kholein → apne **OAuth 2.0 Client ID** par click karein:
   - **Authorized redirect URIs** me naya callback URL (`https://YOUR_NEW_PROD_PROJECT_REF.supabase.co/auth/v1/callback`) add karein.
   - Wahan se **Client ID** aur **Client Secret** copy karke naye Supabase ke **Authentication → Providers → Google** me paste karke **Enable Sign in with Google** → **Save** kar dein.

---

## STEP 6: Vercel Par Naya Production Database Connect Karein

Ab aapka naya Production DB poori tarah ready hai. Use live app (`https://mysaleapp-one.vercel.app`) se jodne ke liye:

1. **[Vercel Dashboard](https://vercel.com/dashboard)** → apna project **`mysaleapp-one`** → **Settings** → **Environment Variables** kholein.
2. Sirf **`Production`** environment ke liye yeh variables update karein:
   - **`NEXT_PUBLIC_SUPABASE_URL`**:
     ```text
     https://YOUR_NEW_PROD_PROJECT_REF.supabase.co
     ```
   - **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**:
     ```text
     <Aapke Naye Production Project Ki Anon / Publishable Key>
     ```
   - **`RATE_LIMIT_SALT`**: Koi bhi lambi random string (e.g. 32+ characters).
   - **`CRON_SECRET`**: Koi bhi lambi random string (unpaid orders auto-expiry cron ke liye).
   - **`NEXT_PUBLIC_SITE_URL`**: `https://mysaleapp-one.vercel.app` (ya aapka custom domain).
3. **Save** karein.
4. **Redeploy Karein (Mandatory)**:
   - Vercel me `NEXT_PUBLIC_*` variables build time par bundle hote hain aur [`next.config.ts`](file:///d:/nextApps/mysaleapp/next.config.ts#L3-L61) naye Supabase URL se CSP aur image hostnames banata hai.
   - Isliye **Deployments** tab me jayein → latest deployment ke `⋮` menu par click karein → **Redeploy** kar dein!

---

## STEP 7: Apne Local PC (`.env.local`) ko Development DB par Hi Rakhein

- Apne computer ki local `.env.local` file me **purane Development Supabase Project (`nepfgwfunxebhsfrfxeb`)** ka URL aur Key hi rehne dein!
- Isse kya fayda hoga?
  - Jab aap apne PC par `npm run dev` chalayenge, to aapka **Development DB** use hoga (jahan aap bina kisi darr ke test orders, test refunds, test status reverts kar sakte hain).
  - Aur jab code GitHub/Vercel par push hoga, to Vercel apne Environment Variables se **Live Production DB** use karega!

---

## STEP 8: Live Site Par Final Launch Verification Checklist

Vercel Redeploy complete hone ke baad:
1. [https://mysaleapp-one.vercel.app/admin/login](https://mysaleapp-one.vercel.app/admin/login) kholein aur Step 4 me banaye gaye naye Admin Email & Password se login karein.
2. [https://mysaleapp-one.vercel.app/admin/launch](https://mysaleapp-one.vercel.app/admin/launch) (**Data & launch** page) kholein — yeh page aapko ek hi jagah dikha dega ki naye Production DB me kaun-kaun si settings baaki hain:
   - [ ] **Admin → Settings** (`/admin/settings`) me ja kar Shop Name, Tagline, Description, WhatsApp Number, UPI ID (`upiId`), Contact Email/Phone, City, aur Delivery/Shipping charges save karein.
   - [ ] **Admin → Categories** (`/admin/categories`) me apni real categories add karein.
   - [ ] **Admin → Products** (`/admin/products/new`) me ek real product photo ke saath upload karke check karein ki photo upload aur storefront display dono smooth chal rahe hain.

---

## STEP 9: Future me Nayi SQL Migrations Dono DBs (Dev + Prod) me Automatic Kaise Chalayein?

Sabse pehle yeh samjhein ki **roz-roz har UI/code change par migration chalane ki zaroorat nahi hoti** — migration sirf tab chalti hai jab aap [`supabase/migrations/`](file:///d:/nextApps/mysaleapp/supabase/migrations) me koi nayi `.sql` file (jaise `0047_...sql`) banate hain.

Jab bhi nayi SQL migration bane, aapko manually do-do baar mehnat na karni pade, uske liye yeh **3 options** hain:

---

### Option A: GitHub Actions se 100% Automatic Deployment (Recommended & Free)
Jaise `git push` karne par Vercel aapka frontend automatic deploy karta hai, waise hi **GitHub Actions** aapki nayi SQL migration ko **Production Supabase DB** par automatic push kar dega:

#### 1. Supabase Access Token Banayein
1. **[Supabase Access Tokens Page](https://supabase.com/dashboard/account/tokens)** kholein.
2. **"Generate new token"** par click karein → Name dein: `GitHub Actions Prod Deploy` → **Generate token** dabayein.
3. Is token ko copy kar lein.

#### 2. GitHub Repository me 3 Secrets Add Karein
1. Apne GitHub repository page par jayein → top menu me **Settings** → left sidebar me **Secrets and variables** → **Actions** par click karein.
2. **"New repository secret"** par click karke yeh **3 secrets** add karein:
   - **`SUPABASE_ACCESS_TOKEN`**: Step 1 me banaya gaya Personal Access Token.
   - **`SUPABASE_PROD_PROJECT_REF`**: Aapke Production Supabase Project ka Reference ID (16-20 chars, Step 2.1 se).
   - **`SUPABASE_PROD_DB_PASSWORD`**: Aapke Production Database ka Password (Step 1.2 se).

#### 3. Workflow File (`.github/workflows/supabase-prod.yml`) Banayein
Apne project me `.github/workflows/supabase-prod.yml` file me yeh code rakhein:

```yaml
name: Deploy Supabase Production Migrations

on:
  push:
    branches:
      - main
    paths:
      - "supabase/migrations/**"

jobs:
  migrate:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_PROD_DB_PASSWORD }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Production Supabase Project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROD_PROJECT_REF }}

      - name: Push SQL Migrations to Production DB
        run: supabase db push --remote
```

**Ab kaise kaam karega?**
- Local PC par kaam karte waqt aap sirf Dev DB par `npm run db:push` chalayenge.
- Jaise hi aap `git push origin main` karenge aur `supabase/migrations/` me koi nayi `.sql` file hogi, GitHub Action apne aap Production DB par migration chala dega! Zero manual work!

---

### Option B: [`package.json`](file:///d:/nextApps/mysaleapp/package.json) me 1-Click Commands (Terminal Control)
Agar aap terminal se ek hi command me Dev ya Prod (ya dono) par migration push karna chahte hain, to [`package.json`](file:///d:/nextApps/mysaleapp/package.json#L11-L15) ke `"scripts"` section me yeh scripts rakh sakte hain:

```json
"db:link:dev": "supabase link --project-ref nepfgwfunxebhsfrfxeb",
"db:link:prod": "supabase link --project-ref YOUR_NEW_PROD_PROJECT_REF",
"db:push:dev": "npm run db:link:dev && supabase db push --remote",
"db:push:prod": "npm run db:link:prod && supabase db push --remote && npm run db:link:dev",
"db:push:both": "npm run db:push:dev && npm run db:push:prod"
```

- **`npm run db:push:dev`**: Sirf Development DB update karega.
- **`npm run db:push:prod`**: Production DB update karega aur wapas aapke local CLI ko Dev DB par link kar dega taaki galti se agla command Prod par na chale!
- **`npm run db:push:both`**: Ek hi command me pehle Dev DB aur phir Prod DB dono ko update kar dega.

---

### Option C: Supabase Native Branching (Paid Pro Plan Feature)
Agar aap future me **Supabase Pro Plan (\$25/month)** lete hain, to aapko 2 alag projects banane ki bhi zaroorat nahi padti:
1. **[Supabase Dashboard](https://supabase.com/dashboard)** me apne project ke top bar me `main` branch dropdown par click karke **Enable Branching** on karein.
2. Apna GitHub repo connect karein.
3. Supabase aapke `main` (Production) aur `dev` (Development) Git branches ke liye apne aap alag database branches bana deta hai aur GitHub PR merge hote hi migrations automatic apply kar deta hai *(Note: Free tier me Branching available nahi hoti; Free tier me Option A + 2 Free Projects best aur 100% free hai)*.

