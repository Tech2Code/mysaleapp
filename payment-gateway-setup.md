# Complete Payment Gateway Integration Guide (`mysaleapp`)

Abhi aapka store **Direct UPI (`₹0 gateway fee`)** par chal raha hai — aur saath hi app me **Plug-and-Play Payment Gateway Architecture** pehle se ready rakha gaya hai!

Iska matlab:
- Jab tak aap chahein, store bilkul free **Direct UPI (manual UTR verification)** par chalta rahega.
- Jab future me aapko **Razorpay** (ya Cashfree / PhonePe / Stripe) par switch karna ho, to aapko core checkout, orders, stock reservation, GST invoices, ya database ko dobara nahi likhna padega — sirf API keys dalni hongi aur **Admin → Settings** me mode switch karna hoga!

---

## Architecture Overview: Dual-Mode Payment System Kaise Kaam Karta Hai?

| Mode | Kab Use Karein | Customer Experience | Admin Effort | Gateway Fee |
|---|---|---|---|---|
| **`Direct UPI` (Default)** | Launch & early orders | UPI app / QR se pay karke 12-digit UTR daalta hai | Admin bank app dekh kar 1 click me Verify karta hai | **₹0** |
| **`Payment Gateway`** | Scale hone par (Cards, Netbanking, Auto-UPI) | Checkout popup (Razorpay/etc.) khulta hai → pay karte hi **instant Confirmed** | **Zero manual verification** (Webhook + HMAC auto-confirm) | ~2% (Gateway charges) |

### Connected Code & Database Files
- **Database Schema & RPCs**: [`supabase/migrations/0062_payment_gateway_ready.sql`](file:///d:/nextApps/mysaleapp/supabase/migrations/0062_payment_gateway_ready.sql) — `store_settings` (`payment_mode`, `payment_gateway`), `orders` (`payment_gateway`, `gateway_order_id`, 64-char `payment_reference`), aur `service_role`-only RPCs (`get_order_for_gateway`, `record_gateway_session`, `confirm_gateway_payment`, `record_gateway_failure`).
- **Gateway Adapter Layer**: [`src/features/orders/payment-gateway.ts`](file:///d:/nextApps/mysaleapp/src/features/orders/payment-gateway.ts) — Pluggable `PaymentGatewayAdapter` interface (Razorpay adapter 100% built-in + Cashfree/PhonePe/Stripe ready stubs).
- **Client SDK Loader**: [`src/features/orders/gateway-client.ts`](file:///d:/nextApps/mysaleapp/src/features/orders/gateway-client.ts) — Gateway script sirf tab load hoti hai jab `paymentMode === "gateway"` ho (Direct UPI mode me 0 extra bytes).
- **Server Actions**: [`src/features/orders/actions.ts`](file:///d:/nextApps/mysaleapp/src/features/orders/actions.ts) — `createGatewayCheckoutSession`, `createGatewayRetrySession`, `verifyGatewayPayment`.
- **Webhook Endpoint**: [`src/app/api/webhooks/payment/route.ts`](file:///d:/nextApps/mysaleapp/src/app/api/webhooks/payment/route.ts) — Raw signature verify karke order confirm karta hai (agar customer pay karne ke turant baad browser band kar de tab bhi payment miss nahi hogi).
- **Security CSP & Env**: [`next.config.ts`](file:///d:/nextApps/mysaleapp/next.config.ts) & [`.env.example`](file:///d:/nextApps/mysaleapp/.env.example) — Gateway env vars set hote hi Content-Security-Policy automatic SDK aur iframe origins allow kar deti hai.
- **UI**: [`src/components/admin/store-settings-form.tsx`](file:///d:/nextApps/mysaleapp/src/components/admin/store-settings-form.tsx), [`src/components/store/checkout-form.tsx`](file:///d:/nextApps/mysaleapp/src/components/store/checkout-form.tsx), [`src/components/store/payment-panel.tsx`](file:///d:/nextApps/mysaleapp/src/components/store/payment-panel.tsx), aur [`src/components/admin/payment-control.tsx`](file:///d:/nextApps/mysaleapp/src/components/admin/payment-control.tsx).

---

## STEP 1: Gateway KYC Approval Checklist (Apply Karne Se Pehle)

Razorpay, Cashfree, ya PhonePe PG par merchant account approve karwane ke liye woh aapki live website check karte hain. Apply karne se pehle yeh verify kar lein:

1. **Admin → Settings** (`/admin/settings`) me aapka real **Shop Name**, **Contact Email**, **WhatsApp / Calling Phone**, aur **City / State** bhara ho.
2. Yeh 4 legal/info pages live aur reachable hon (already built-in hain):
   - `/privacy` (Privacy Policy)
   - `/terms` (Terms of Service)
   - `/refund-policy` (Refund, Return & Shipping Policy)
   - `/contact` (Contact Us & Business Address)
3. Kam se kam 3–5 real products unki photos aur INR prices ke saath active hon.
4. *(Tip)* Agar aapne Gateway mode chalu karne ke baad Terms/Privacy text me gateway provider ka naam (e.g. "Razorpay") mention karna ho, to [`src/components/store/legal-view.tsx`](file:///d:/nextApps/mysaleapp/src/components/store/legal-view.tsx) ke Subprocessors table me ek row add kar sakte hain.

---

## STEP 2: Razorpay Integration (Zero-Code Setup — Ready Out-of-the-Box)

Razorpay adapter code me pehle se bana hua hai. Jab aapka Razorpay account ready ho jaye, sirf yeh **5 steps** karein:

### 2.1 Razorpay API Keys Copy Karein
1. **[Razorpay Dashboard](https://dashboard.razorpay.com/)** me login karein.
2. Pehle testing ke liye upar toggle ko **Test Mode** par rakhein *(baad me Live Mode par switch kar sakte hain)*.
3. Left sidebar → **Account & Settings** → **API Keys** → **Generate Key** par click karein:
   - **`Key Id`** copy karein (jaise `rzp_test_...` ya live me `rzp_live_...`).
   - **`Key Secret`** copy karein (isko kahin public ya `NEXT_PUBLIC_` me mat dalein!).

### 2.2 Razorpay Webhook Setup Karein (Mandatory Safety Net)
1. Razorpay Dashboard → **Account & Settings** → **Webhooks** → **+ Add New Webhook**.
2. **Webhook URL** me apni live site ka URL dalein:
   ```text
   https://YOUR-DOMAIN.com/api/webhooks/payment?provider=razorpay
   ```
   *(e.g., `https://mysaleapp-one.vercel.app/api/webhooks/payment?provider=razorpay`)*
3. **Secret**: Koi bhi strong random string dalein (e.g. 24+ characters) aur usko copy karke save kar lein — yahi `RAZORPAY_WEBHOOK_SECRET` banega.
4. **Active Events** me yeh 3 events tick karein:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`
5. **Create Webhook** par click karein.

### 2.3 Supabase `service_role` Key Copy Karein
Gateway verification aur webhook sirf server par chalte hain aur order ko auto-confirm karne ke liye server-only `service_role` client use karte hain:
1. **[Supabase Dashboard](https://supabase.com/dashboard)** → apna project → **Project Settings** → **API**.
2. **`service_role` (`secret`)** key copy karein.
   > **Security Warning:** `service_role` key aur `RAZORPAY_KEY_SECRET` sirf server environment variables me rahengi — inhe kabhi bhi Git, browser code, ya `NEXT_PUBLIC_*` variables me mat dalein.

### 2.4 Environment Variables Add Karein (Local + Vercel)
Local testing ke liye `.env.local` me aur Live site ke liye **Vercel Dashboard → Project → Settings → Environment Variables** me yeh 4 variables add karein:

```env
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
```

- Vercel me save karne ke baad **Deployments → Redeploy** zaroor karein taaki [`next.config.ts`](file:///d:/nextApps/mysaleapp/next.config.ts) build-time CSP me Razorpay (`checkout.razorpay.com` aur `api.razorpay.com`) automatic allow ho jaye.

### 2.5 Admin Panel Se Gateway Mode ON Karein
1. Apni site ka **Admin → Settings** (`/admin/settings`) kholein.
2. **Payment (UPI)** card me:
   - **Checkout payment mode** ko **`Payment Gateway (Auto-verified online checkout)`** chunein.
   - **Gateway provider** me **`Razorpay`** chunein.
   - Status note confirm karega: *"Razorpay server keys are configured and ready..."*
3. Niche **Save settings** par click karein.

### 2.6 End-to-End Test Karein (Test Mode → Live Mode)
1. Storefront par ek product cart me daal kar **Checkout → Proceed to pay** click karein.
2. Razorpay popup khulega:
   - **Test Success:** UPI tab me `success@razorpay` daal kar pay karein → Order instant **Confirmed** + **Paid** ho kar `/order-placed` receipt dikhayega!
   - **Test Dismiss:** Popup close (`×`) karne par temporary unpaid order cancel ho jayega aur aapka cart wapas safe rahega.
   - **Test Failure / Retry:** Failed payment ke baad `/track` ya **My Orders** par `"Pay ₹X securely"` button se retry flow test karein.
3. Sab pass hone par Vercel me `rzp_test_*` ki jagah Razorpay **Live Mode** ki `rzp_live_*` keys + Live Webhook Secret update karke Redeploy kar dein.

---

## STEP 3: Future me Koi Doosra Gateway (Cashfree / PhonePe / Stripe) Kaise Add Karein?

App ka [`PaymentGatewayAdapter`](file:///d:/nextApps/mysaleapp/src/features/orders/payment-gateway.ts) interface provider-agnostic hai. Naya gateway jodne ke liye sirf **3 jagah** code add karna hota hai:

1. **Server Adapter (`src/features/orders/payment-gateway.ts`)**:
   - `GATEWAY_ADAPTERS.<provider>` stub ko replace karein:
     - `isConfigured()`: apni provider env keys + `SUPABASE_SERVICE_ROLE_KEY` check karein.
     - `createOrderSession()`: provider ki Order API call karke `GatewayClientSession` (`gatewayOrderId`, `sessionToken` ya `checkoutUrl`) return karein.
     - `verifyClientPayment()`: HMAC/checksum verify karke provider API se payment status aur amount INR confirm karein.
     - `parseAndVerifyWebhook()`: provider webhook header signature verify karke `"paid"` ya `"failed"` event return karein.
2. **Client Launcher (`src/features/orders/gateway-client.ts`)**:
   - Agar gateway redirect-based hai (jaise PhonePe PayPage ya Stripe Checkout), to `createOrderSession` me `checkoutUrl` bhej dein — `openGatewayCheckout` pehle se `checkoutUrl` redirect handle karta hai!
   - Agar gateway JS SDK modal use karta hai (jaise Cashfree `payment_session_id`), to `openGatewayCheckout` me uske SDK script URL ke liye ek `if (session.provider === "cashfree")` block add kar dein.
3. **CSP & Env Vars**:
   - `.env.local` / Vercel me provider ki API keys ke saath `NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS=https://sdk.example.com` daal kar Redeploy kar dein (ya [`next.config.ts`](file:///d:/nextApps/mysaleapp/next.config.ts) ke `gatewayCspOrigins` me check add kar dein).

---

## STEP 4: Refunds, Late Webhooks & 1-Click Rollback

- **Refunds:** Gateway orders par refund karne ke liye pehle apne Gateway Dashboard (Razorpay → Transactions → Refund) se source refund issue karein, phir **Admin → Orders → [Order] → Payment → Refund** (ya Return flow) me gateway ka refund ID (e.g. `rfnd_P9x...`) record kar dein. DB aur UI dono 64-character `A-Za-z0-9_-` gateway IDs support karte hain.
- **Late Webhook Protection:** Agar customer ne pay kiya aur network slow hone ki wajah se order tab tak auto-expire (`cancelled`) ho gaya, jab gateway ka webhook aayega to `confirm_gateway_payment` payment ko `paid` record kar dega aur order ko **Admin → Orders → Refund due** me dikha dega taaki customer ka paisa kabhi lose na ho.
- **Instant Rollback (`₹0 Fee`):** Agar kisi din gateway band ho jaye ya aap wapas bina fee ke Direct UPI par aana chahein, to **Admin → Settings → Payment** me mode wapas **`Direct UPI`** karke Save kar dein — purane paid gateway orders apni receipt aur lock intact rakhenge aur naye orders turant Direct UPI par aa jayenge.
