# Stripe Live Activation Checklist

## Current State
Billing API exists at `/api/billing/` but runs in demo mode (no real charges).
The `sec_stripe_secret_key` is stored in vault but NOT injected into Vercel env.

## Steps to Go Live

### 1. Vercel Environment Variables
In Vercel dashboard → Project → Settings → Environment Variables, add:
- `STRIPE_SECRET_KEY` = (value from vault: `sec_stripe_secret_key`) — use live key `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` = (from Stripe dashboard after creating webhook)

### 2. Create Stripe Products
In Stripe dashboard → Products → Add product:
- **Pro Plan**: $29/month recurring → note the Price ID (starts with `price_`)
- **Team Plan**: $99/month recurring → note the Price ID

### 3. Update Price IDs in Code
Edit `api/billing/checkout.js` (or wherever PRICE_IDS are defined):
```javascript
const PRICE_IDS = {
  pro: 'price_XXXX',   // replace with real Pro price ID
  team: 'price_YYYY',  // replace with real Team price ID
};
```

### 4. Create Stripe Webhook
In Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://signal-market-z14d.vercel.app/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the signing secret → add as `STRIPE_WEBHOOK_SECRET` in Vercel env

### 5. Test with Stripe Test Mode First
- Use test key `sk_test_...` first
- Use Stripe test card: 4242 4242 4242 4242
- Verify checkout → webhook → subscription activated flow

### 6. Switch to Live Mode
- Replace `sk_test_` with `sk_live_` in Vercel env
- Verify webhook endpoint still works

### 7. Remove Demo Mode Flag
In billing API code, remove any `demo_mode: true` flags.
Redeploy.

## Timeline Estimate
~2 hours total if Stripe account is already verified.
