# Signal Market

## Overview - Payment System Documentation

Signal Market provides a complete payment and billing system with tiered subscription plans, usage tracking, and quota management.

## Table of Contents

1. [Pricing Plans](#pricing-plans)
2. [Stripe Integration](#stripe-integration)
3. [Billing System](#billing-system)
4. [API Reference](#api-reference)
5. [Webhook Events](#webhook-events)

---

## Pricing Plans

| Plan | Price | API Calls | Signals | Custom Strategies |
|------|-------|-----------|---------|-------------------|
| Free | ¥0 | 1,000/day | 5 | 0 |
| Basic | ¥199/mo | 50,000/day | 50 | 3 |
| Pro | ¥699/mo | 500,000/day | 200 | 20 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

See [pricing.md](./pricing.md) for full feature comparison.

---

## Stripe Integration

### Configuration

```bash
# Environment variables
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_BASIC_PRICE_ID=price_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
BASE_URL=https://signal.market
```

### Usage

```javascript
const { StripeClient, PLANS } = require('./l4/stripe_client');

const stripeClient = new StripeClient();

// Create checkout session
const session = await stripeClient.createCheckoutSession(
  'user_123',
  'pro',
  'https://signal.market/payment/success',
  'https://signal.market/payment/cancel'
);

// Get subscription
const subscription = await stripeClient.getSubscription(subscriptionId);

// Cancel subscription
await stripeClient.cancelSubscription(subscriptionId);

// Create customer portal session
const portal = await stripeClient.createPortalSession(customerId);
```

---

## Billing System

### Initialize User Quota

```javascript
const { BillingSystem } = require('./l4/billing');

const billing = new BillingSystem();

// Initialize with free plan
await billing.initializeUser('user_123', 'free');

// Or initialize with paid plan
await billing.initializeUser('user_456', 'pro');
```

### Check Quota

```javascript
// Check if user can make API call
const check = await billing.checkQuota('user_123', 'apiCalls');

if (check.allowed) {
  console.log(`Remaining: ${check.remaining}`);
} else {
  console.log('Quota exceeded');
}

// Check other resources
await billing.checkQuota('user_123', 'signals');
await billing.checkQuota('user_123', 'customStrategies');
```

### Record Usage

```javascript
// Record API call
await billing.recordUsage('user_123', 'apiCalls', 1);

// Record multiple signals
await billing.recordUsage('user_123', 'signals', 5);

// Record webhook call
await billing.recordUsage('user_123', 'webhookCalls', 1);
```

### Get Current Usage

```javascript
const usage = await billing.getCurrentUsage('user_123');

console.log(usage);
// {
//   plan: 'pro',
//   periodStart: '2024-01-01T00:00:00.000Z',
//   periodEnd: '2024-01-31T23:59:59.999Z',
//   apiCalls: { used: 12500, limit: 500000, remaining: 487500 },
//   signals: { used: 45, limit: 200, remaining: 155 },
//   ...
// }
```

### Upgrade Plan

```javascript
await billing.upgradePlan('user_123', 'pro');
```

---

## API Reference

### Stripe Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/checkout` | Create checkout session |
| POST | `/api/payment/portal` | Create customer portal session |
| POST | `/api/payment/webhook` | Handle Stripe webhooks |
| GET | `/api/payment/subscription` | Get current subscription |
| DELETE | `/api/payment/subscription` | Cancel subscription |

### Billing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/usage` | Get current usage |
| GET | `/api/billing/usage/daily` | Get daily usage breakdown |
| GET | `/api/billing/quota` | Get quota status |
| GET | `/api/billing/invoices` | List user invoices |
| GET | `/api/billing/invoices/:id` | Get invoice details |

---

## Webhook Events

### Handled Events

| Event | Handler | Description |
|-------|---------|-------------|
| `checkout.session.completed` | `subscriptionCreated` | Payment successful, activate subscription |
| `customer.subscription.created` | `subscriptionCreated` | New subscription created |
| `customer.subscription.updated` | `subscriptionUpdated` | Subscription changed (plan, status) |
| `customer.subscription.deleted` | `subscriptionDeleted` | Subscription cancelled |
| `invoice.payment_succeeded` | `paymentSucceeded` | Invoice paid |
| `invoice.payment_failed` | `paymentFailed` | Payment failed |

### Webhook Handler Example

```javascript
const stripeClient = new StripeClient();

app.post('/api/payment/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripeClient.verifyWebhookSignature(req.body, sig);
    
    await stripeClient.handleWebhook(event, {
      async checkoutCompleted(session) {
        const userId = session.client_reference_id;
        const plan = session.metadata.plan;
        
        // Update user plan in database
        await updateUserPlan(userId, plan);
        
        // Initialize billing quota
        await billing.upgradePlan(userId, plan);
      },
      
      async subscriptionDeleted(subscription) {
        // Downgrade to free plan
        await billing.upgradePlan(subscription.metadata.userId, 'free');
      },
      
      async paymentFailed(invoice) {
        // Send notification to user
        await notifyUser(invoice.customer_email, 'Payment failed');
      }
    });
    
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

---

## Usage Limits

### API Rate Limits

| Plan | Daily Limit | Burst |
|------|-------------|-------|
| Free | 1,000 | 10/min |
| Basic | 50,000 | 100/min |
| Pro | 500,000 | 500/min |
| Enterprise | Unlimited | Custom |

### Concurrent Webhooks

| Plan | Concurrent Webhooks |
|------|-------------------|
| Free | 1 |
| Basic | 10 |
| Pro | 50 |
| Enterprise | Unlimited |

---

## Overage Charges

When exceeding plan limits:

| Resource | Overage Rate |
|----------|-------------|
| API Calls | ¥0.001/call |
| Additional Signals | ¥5/signal/month |
| Webhook Calls | ¥0.01/call |

---

## Testing

### Test Card Numbers

Use Stripe test cards for development:

| Card Number | Description |
|-------------|-------------|
| 4242424242424242 | Success |
| 4000000000000002 | Card declined |
| 4000002500003155 | Requires authentication |

---

## Support

- Email: billing@signal.market
- Documentation: docs.signal.market
- Status: status.signal.market

---

*Last updated: 2024*
